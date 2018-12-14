import { Observable, Subject, Subscription, asyncScheduler, from, of, empty } from "rxjs"
import { observeOn, last, startWith, filter, map, first } from "rxjs/operators"
import {
  ActionProcessor,
  Action,
  ActionFilter,
  ActionStreamItem,
  AgentConfig,
  Concurrency,
  ProcessResult,
  Subscriber,
  SubscriberConfig,
  StreamTransformer
} from "./types"

import { getActionFilter } from "./lib"

// Leave this as require not import! https://github.com/webpack/webpack/issues/1019
const assert = typeof require === "undefined" ? () => null : require("assert")
export {
  Action,
  ActionFilter,
  AgentConfig,
  ActionStreamItem,
  Concurrency,
  ProcessResult,
  StreamTransformer,
  Subscriber,
  SubscriberConfig
} from "./types"

// Export utility rxjs operators and our own custom
export * from "./operators"
export { from, of, empty, concat, merge, interval } from "rxjs"
export { startWith, last, filter, delay, map, mapTo, scan } from "rxjs/operators"

/**
 * Represents the instance of an Antares action processor which is
 * usually the only one in this JavaScript runtime. The heart and circulatory system of
 * an Agent is its action stream. You put actions on the action stream
 * by calling `agent.process(action)` and from there filters and renderers respond.
 * Because renderers may emit more actions, this process can continue indefinitely.
 */
export class Agent implements ActionProcessor {
  public static configurableProps = ["agentId", "relayActions"]

  /**
   * The heart and circulatory system of an Agent is `action$`, its action stream. */
  private action$: Observable<ActionStreamItem>
  filterNames: Array<string>
  rendererNames: Array<string>
  [key: string]: any

  /**
   * Gets a promise for the next action matching the ActionFilter. */
  // @ts-ignore
  nextOfType: ((filter: ActionFilter) => Promise<Action>)
  /**
   * Gets an Observable of all actions matching the ActionFilter. */
  // @ts-ignore
  allOfType: ((filter: ActionFilter) => Observable<Action>)

  private _subscriberCount = 0
  private actionStream: Subject<ActionStreamItem>
  private allFilters: Map<string, Subscriber>
  private activeRenders: Map<string, Subscription>
  private activeResults: Map<string, Observable<any>>

  constructor(config: AgentConfig = {}) {
    this.actionStream = new Subject<ActionStreamItem>()
    this.action$ = this.actionStream.asObservable()
    this.filterNames = []
    this.allFilters = new Map<string, Subscriber>()
    this.rendererNames = []
    this.activeRenders = new Map<string, Subscription>()
    this.activeResults = new Map<string, Observable<any>>()

    for (let key of Object.keys(config)) {
      Agent.configurableProps.includes(key) &&
        Object.defineProperty(this, key.toString(), {
          value: config[key],
          writable: false,
          enumerable: true,
          configurable: false
        })
    }

    Object.defineProperty(this, "nextOfType", {
      get: () => {
        return (matcher: ActionFilter) => {
          const predicate = getActionFilter(matcher)
          return this.action$
            .pipe(
              filter(predicate),
              first(),
              map(({ action }) => action)
            )
            .toPromise()
        }
      }
    })

    Object.defineProperty(this, "allOfType", {
      get: () => {
        return (matcher: ActionFilter) => {
          const predicate = getActionFilter(matcher)
          return this.action$.pipe(
            filter(predicate),
            map(({ action }) => action)
          )
        }
      }
    })
  }

  /**
   * Process sends an Action (eg Flux Standard Action), which
   * is an object with a payload and type description, through the chain of
   * filters, and then out through any applicable renderers.
   * @throws Throws if a filter errs, but not if a renderer errs.
   *
   */
  process(action: Action, context?: Object): ProcessResult {
    const results = new Map<string, any>()
    const renderBeginnings = new Map<string, Subject<boolean>>()
    const renderEndings = new Map<string, Subject<boolean>>()

    // In order to do completion detection, we need to set these
    // locations up synchronously, and let them be read later.
    this.rendererNames.forEach(name => {
      renderBeginnings.set(name, new Subject<boolean>())
      renderEndings.set(name, new Subject<boolean>())
      this.activeResults.set(name, empty())
    })
    const item = { action, context, results, renderBeginnings, renderEndings }

    // Run all filters sync (RxJS as of v6 no longer will sync error)
    for (let filterName of this.allFilters.keys()) {
      let filter = this.allFilters.get(filterName) || (() => null)
      let result
      let err
      try {
        result = filter(item)
      } catch (ex) {
        err = ex
        throw ex
      } finally {
        results.set(filterName, result || err)
      }
    }

    // If we passed filtering, next it on to the action stream
    this.actionStream.next(item)

    // Our result is a shallow clone of the action...
    let resultObject = Object.assign({}, action)

    // Add readonly properties for each result
    for (let [key, value] of results.entries()) {
      Object.defineProperty(resultObject, key.toString(), {
        value,
        writable: false,
        enumerable: false,
        configurable: false
      })
    }

    // Allow hooking the completion of async renders
    let _completedObject: Promise<boolean[]>
    Object.defineProperty(resultObject, "completed", {
      get: () => {
        if (_completedObject) return _completedObject

        const completedObject = Promise.all(
          Array.from(renderEndings.values()).map(s => s.asObservable().toPromise())
        )
        for (let name of this.rendererNames) {
          Object.defineProperty(completedObject, name, {
            get: () => {
              return new Promise(resolve => {
                // only on the next callstack is our results Observable ready
                setTimeout(() => {
                  const results = this.activeResults.get(name)
                  // @ts-ignore # we should detect its an Observable
                  results
                    .pipe(
                      startWith(undefined),
                      last()
                    )
                    .toPromise()
                    .then(resolve)
                }, 0)
              })
            }
          })
        }
        _completedObject = completedObject
        return completedObject
      }
    })

    // Now they get their result
    return resultObject as ProcessResult
  }

  /**
   * Renderers are functions that exist to create side-effects
   * outside of the Antares Agent - called Renderings. This can be changes to a
   * DOM, to a database, or communications (eg AJAX) sent on the wire. Renderers run
   * in parallel with respect to other renderers. The way they act with respect
   * to their own overlap, is per their `concurrency` config parameter.
   *
   * Here we attach a renderer to fire on actions of `type: 'kickoff'`.
   * After 50ms, the agent will process `{ type: 'search', payload: '#go!' }`,
   * at which point the Promise `result.completed.kickoff` will resolve.
   *
   * ```js
   * //
   * const { Agent, after } = require('antares-protocol')
   * const agent = new Agent()
   * agent.on('kickoff', () => after(50, () => '#go'), { type: 'search' })

   * // Logs Done once 50 ms has elapsed
   * agent.process({ type: 'kickoff' }).completed.kickoff.then(() => console.log('done'))
   * ```
   */
  on(actionFilter: ActionFilter, renderer: Subscriber, config: SubscriberConfig = {}) {
    const _config = {
      ...config,
      actionsOfType: actionFilter
    }
    return this.addRenderer(renderer, _config)
  }

  /**
   * Calls addFilter, but uses a more event-handler-like syntax.
   * ```js
   * agent.filter('search/message/success', ({ action }) => console.log(action))
   * ```
   */
  filter(actionFilter: ActionFilter, filter: Subscriber, config: SubscriberConfig = {}) {
    const _config = {
      ...config,
      actionsOfType: actionFilter
    }
    return this.addFilter(filter, _config)
  }

  /**
   * Filters are synchronous functions that sequentially process
   * each item on `action$`, possibly changing them or creating synchronous
   * state changes. Useful for type-checking, writing to a memory-based store.
   * For creating consequences (aka async side-effects aka renders) outside of
   * the running Agent, write and attach a Renderer. Filters run in series.
   */
  addFilter(filter: Subscriber, config: SubscriberConfig = {}): Subscription {
    validateSubscriberName(config.name)

    // Pass all actions unless otherwise told
    const predicate = config.actionsOfType ? getActionFilter(config.actionsOfType) : () => true
    const _filter: Subscriber = (asi: ActionStreamItem) => {
      if (predicate(asi)) {
        return filter(asi)
      }
    }

    const nameBase: string =
      //@ts-ignore
      config.actionsOfType && config.actionsOfType.substring
        ? config.actionsOfType.toString()
        : "filter"
    const name =
      config.name ||
      (this.filterNames.includes(nameBase) || nameBase === "filter"
        ? `${nameBase}_${++this._subscriberCount}`
        : nameBase)
    this.filterNames.push(name)
    this.allFilters.set(name, _filter)

    // The subscription does little except give us an object
    // which, when unsubscribed, will remove our filter
    const sub = this.action$.subscribe(asi => null)
    sub.add(() => {
      this.allFilters.delete(name)
    })
    return sub
  }

  addRenderer(subscriber: Subscriber, config: SubscriberConfig = {}): Subscription {
    validateConfig(config)

    const nameBase: string =
      //@ts-ignore
      config.actionsOfType && config.actionsOfType.substring
        ? config.actionsOfType.toString()
        : "renderer"
    const name =
      config.name ||
      (this.filterNames.includes(nameBase) || nameBase === "renderer"
        ? `${nameBase}_${++this._subscriberCount}`
        : nameBase)

    const xform = streamTransformerFrom(config)
    this.rendererNames.push(name)

    const concurrency = config.concurrency || Concurrency.parallel
    const processResults = !!(config.processResults || config.type)

    // @ts-ignore
    const [identity, wrapper] = [x => x, type => payload => ({ type, payload })]
    const resultMapper = config.type ? wrapper(config.type) : identity

    let previousAsi: ActionStreamItem
    const sub = xform(this.action$)
      .pipe(observeOn(asyncScheduler))
      // Note if our stream has been transformed with such as bufferCount,
      // we won't be processing an ASI, but rather some reduction of one
      .subscribe(asi => {
        const itHasBegun = new Subject<boolean>()
        itHasBegun.complete()
        asi.renderBeginnings && asi.renderBeginnings.set(name, itHasBegun)

        // Renderers return Observables, usually of actions
        const _results = subscriber(asi)
        const _result$ =
          _results && _results.subscribe // an Observable
            ? _results
            : _results && _results[Symbol.iterator] && !_results.substring
              ? from(_results) // an iterable, such as an array, but not string
              : of(_results)

        const results = _result$.pipe(map(resultMapper))
        this.activeResults.set(name, results)

        const completer = {
          // If we're set up to do so, send results back through #process
          next: (resultAction: Action) => {
            if (!processResults) return
            this.process(resultAction, asi.context)
          },
          complete: () => {
            // @ts-ignore
            asi.renderEndings && asi.renderEndings.get(name).complete()
          },
          error: () => {
            // @ts-ignore
            asi.renderEndings && asi.renderEndings.get(name).error()
            sub.unsubscribe()
            this.activeRenders.delete(name)
            this.rendererNames = this.rendererNames.filter(n => n === name)
          }
        }

        const inProgress = this.activeRenders.get(name)
        let thisSub
        const subAndSave = () => {
          thisSub = results.subscribe(completer)
          this.activeRenders.set(name, thisSub)
        }

        if (concurrency === Concurrency.mute) {
          // Will not start new if one is in progress
          if (!inProgress || (inProgress && inProgress.closed)) {
            subAndSave()
          }
        }

        if (concurrency === Concurrency.cutoff) {
          // cancel any in progress - the latest one is all we care
          inProgress && inProgress.unsubscribe()
          subAndSave()
        }
        // Bug hiding below: if you run the fruit serial demo,
        // two keypresses in close succession will both run
        // after the current inProgress, but not themselves serially
        // ⑨  🥑   ②  🥑   ①  🥑  🥑  🥑  🥑  🥑  🥑  🥑  ✅
        // 🍌  🍓  ✅
        // 🍌  ✅  <-- note the interleaving of banana and strawberry
        if (concurrency === Concurrency.serial) {
          if (!previousAsi) {
            subAndSave()
          } else {
            // @ts-ignore
            previousAsi.renderEndings
              .get(name)
              .toPromise()
              .then(() => {
                subAndSave()
              })
          }
        }
        if (concurrency === Concurrency.parallel) {
          subAndSave()
        }
        previousAsi = asi
      })
    return sub
  }

  /**
   * Subscribes to the Observable of actions (Flux Standard Action), sending
   * each through agent.process.
   * @return A subscription handle with which to unsubscribe()
   *
   */
  subscribe(action$: Observable<Action>, context?: Object) {
    return action$.subscribe(action => this.process(action, context))
  }
}

function validateSubscriberName(name: string | undefined) {
  assert(
    !name || !reservedSubscriberNames.includes(name),
    "The following subscriber names are reserved: " + reservedSubscriberNames.join(", ")
  )
}

function streamTransformerFrom(config: SubscriberConfig): StreamTransformer {
  if (config.xform) return config.xform

  const { actionsOfType } = config
  let predicate
  if (actionsOfType) {
    const predicate = getActionFilter(actionsOfType)

    const xform: StreamTransformer = s => {
      return s.pipe(filter(predicate))
    }
    return xform
  }

  return s => s
}
// Throws if any violations
function validateConfig(config: SubscriberConfig) {
  validateSubscriberName(config.name)

  assert(
    !config.xform || !config.actionsOfType,
    "For simple control of renderer trigers, use config.actionsOfType; use xform for more complicated ones. Never both."
  )
}

export const reservedSubscriberNames = ["completed", "then", "catch"]

/**
 * Constructs a filter (see agent.addFilter) which mixes AgentConfig properties
 * into the meta of an action
 */
export const agentConfigFilter = (agent: Agent) => ({ action }: ActionStreamItem) => {
  Object.assign(action, { meta: action.meta || {} })
  Agent.configurableProps.forEach(key => {
    if (typeof agent[key] !== "undefined") {
      Object.assign(action.meta, { [key]: agent[key] })
    }
  })
}

/**
 * A random enough identifier, 1 in a million or so,
 * to identify actions in a stream. Not globally or cryptographically
 * random, just more random than: https://xkcd.com/221/
 */
export const randomId = (length: number = 7) => {
  return Math.floor(Math.pow(2, length * 4) * Math.random()).toString(16)
}

/**
 * A filter that adds a string of hex digits to
 * action.meta.actionId to uniquely identify an action among its neighbors.
 * @see randomId
 */
export const randomIdFilter = (length: number = 7, key = "actionId") => ({
  action
}: ActionStreamItem) => {
  action.meta = action.meta || {}
  const newId = randomId(length)
  // @ts-ignore
  action.meta[key] = newId
}

/**
 * Pretty-print an action */
export const pp = (action: Action) => JSON.stringify(action)

/** An agent instance with no special options - good enough for most purposes */
export const agent = new Agent()
