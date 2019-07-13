import {
  Observable,
  Subject,
  Subscription,
  animationFrameScheduler,
  from,
  of,
  interval
} from "rxjs"
import { filter as rxFilter, map, first } from "rxjs/operators"
import {
  ActionProcessor,
  Action,
  ActionFilter,
  ActionStreamItem,
  AgentConfig,
  Concurrency,
  Filter,
  Predicate,
  Renderer,
  RendererPromiser,
  Subscriber,
  SubscribeConfig,
  SubscriberConfig
} from "./types"

export {
  Action,
  ActionFilter,
  AgentConfig,
  ActionStreamItem,
  Concurrency,
  ProcessResult,
  RendererPromiser,
  Subscriber,
  SubscriberConfig
} from "./types"

// Export utility rxjs operators and our own custom
export * from "./operators"
export { from, of, empty, concat, merge, interval, zip } from "rxjs"

// Leave this as require not import! https://github.com/webpack/webpack/issues/1019
const assert = typeof require === "undefined" ? () => null : require("assert")

/**
 * Represents the instance of an Rx-Helper action processor which is
 * usually the only one in this JavaScript runtime. The heart and circulatory system of
 * an Agent is its action stream. You put actions on the action stream
 * by calling `agent.process(action)` and from there filters and renderers respond.
 * Because renderers may emit more actions, this process can continue indefinitely.
 */
export class Agent implements ActionProcessor {
  public static configurableProps = ["agentId", "relayActions"]
  public static VERSION = "1.2.5"

  /**
   * The heart and circulatory system of an Agent is `action$`, its action stream. */
  private action$: Observable<ActionStreamItem>
  [key: string]: any

  private _subscriberCount = 0
  private actionStream: Subject<ActionStreamItem>
  private allFilters: Map<string, Subscriber>
  private allRenderers: Map<string, RendererPromiser>

  rendererNames() {
    return Array.from(this.allRenderers.keys())
  }
  filterNames() {
    return Array.from(this.allFilters.keys())
  }

  /**
   * Gets an Observable of all actions matching the ActionFilter. */
  actionsOfType(matcher: ActionFilter) {
    const predicate = getActionFilter(matcher)
    return this.action$.pipe(
      rxFilter(predicate),
      map(({ action }) => action)
    )
  }

  /**
   * Gets a promise for the next action matching the ActionFilter. */
  nextActionOfType(matcher: ActionFilter) {
    const predicate = getActionFilter(matcher)
    return this.action$
      .pipe(
        rxFilter(predicate),
        first(),
        map(({ action }) => action)
      )
      .toPromise()
  }

  constructor(config: AgentConfig = {}) {
    this.actionStream = new Subject<ActionStreamItem>()
    this.action$ = this.actionStream.asObservable()
    this.allFilters = new Map<string, Subscriber>()
    this.allRenderers = new Map<string, RendererPromiser>()

    for (let key of Object.keys(config)) {
      Agent.configurableProps.includes(key) &&
        Object.defineProperty(this, key.toString(), {
          value: config[key],
          writable: false,
          enumerable: true,
          configurable: false
        })
    }
  }

  /**
   * Process sends an Action (eg Flux Standard Action), which
   * is an object with a payload and type description, through the chain of
   * filters, and then out through any applicable renderers.
   * @throws Throws if a filter errs, but not if a renderer errs.
   *
   */
  process(action: Action, context?: any): any {
    // Execute all filters one after the other, synchronously, in the order added
    const filterResults = new Map<string, any>()
    const asi: ActionStreamItem = {
      action: action,
      event: action,
      results: filterResults
    }
    this.runFilters(asi, filterResults)

    this.actionStream.next(asi)

    // Add readonly properties for each filter result
    // The return value of agent.process ducktypes the action,
    // plus some additional properties
    const resultObject = Object.assign({}, action)
    for (let [key, value] of filterResults) {
      Object.defineProperty(resultObject, key.toString(), {
        value,
        configurable: false,
        enumerable: true,
        writable: false
      })
    }

    const renderPromises = new Map<string, Promise<any>>()
    for (let [name, renderPromiser] of this.allRenderers) {
      renderPromises.set(name, renderPromiser(action, context))
    }

    // From the renderPromises, create the Promise for an array of {name, resolvedValue} objects,
    // then reduce it to an object where the resolved values are keyed under the name
    const completedObject = Promise.all(
      Array.from(renderPromises.keys()).map(name => {
        // @ts-ignore
        return renderPromises.get(name).then(value => ({ name, resolvedValue: value }))
      })
    ).then(arrResults => {
      return arrResults.reduce((all, one) => {
        // @ts-ignore
        all[one.name] = one.resolvedValue
        return all
      }, {})
    })

    for (let name of renderPromises.keys()) {
      Object.defineProperty(completedObject, name, {
        value: renderPromises.get(name),
        configurable: false,
        enumerable: true,
        writable: false
      })
    }

    Object.defineProperty(resultObject, "completed", {
      value: completedObject,
      configurable: false,
      enumerable: true,
      writable: false
    })

    return resultObject
  }

  trigger(type: string, payload?: any): any {
    return this.process({ type, payload })
  }
  /**
   * Handlers attached via `on` are functions that exist to create side-effects
   * outside of the Rx-Helper Agent. Handlers may make changes to a
   * DOM, to a database, or communications (eg AJAX) sent on the wire. Handlers run
   * in parallel with respect to other handlers, and are error-isolated.
   * They return Observables - an object that models a series of notifications over
   * time, much like Promise models a single result over some time.
   * Should they overlap, the `concurrency` config parameter controls whether they
   * run immediately, are queued, dropped, or replace the existing running one.
   *
   * Here we attach a handler to fire on actions of `type: 'kickoff'`.
   * After 50ms, the agent will process `{ type: 'search', payload: '#go!' }`,
   * at which point the Promise `result.completed.kickoff` will resolve.
   *
   * ```js
   * //
   * const { Agent, after } = require('rx-helper')
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
   * Filters are synchronous functions that sequentially process
   * each item on `action$`, possibly changing them or creating synchronous
   * state changes. Useful for type-checking, writing to a memory-based store.
   * Filters run in series. Their results are present on the return value of `process`/`trigger`
   * ```js
   * agent.filter('search/message/success', ({ action }) => console.log(action))
   * ```
   * Returns an object which, when unsubscribed, will remove our filter. Filters are *not* removed
   * automatically upon untrapped errors, like handlers attached via `on`.
   */
  filter(actionFilter: ActionFilter, filter: Subscriber, config: SubscriberConfig = {}) {
    validateSubscriberName(config.name)
    const removeFilter = new Subscription(() => {
      this.allFilters.delete(name)
    })

    // Pass all actions unless otherwise told
    const predicate = actionFilter ? getActionFilter(actionFilter) : () => true
    const _filter: Subscriber = (asi: ActionStreamItem) => {
      if (predicate(asi)) {
        return filter(asi, asi.action.payload)
      }
    }

    const name = this.uniquifyName(config.name, actionFilter, "filter")
    this.allFilters.set(name, _filter)

    // The subscription does little except give us an object
    // which, when unsubscribed, will remove our filter
    return removeFilter
  }

  private addRenderer(follower: Renderer, config: SubscriberConfig = {}): Subscription {
    const removeRenderer = new Subscription(() => {
      this.allRenderers.delete(name)
    })

    const name = this.uniquifyName(config.name, config.actionsOfType, "renderer")
    const predicate = getActionFilter(config.actionsOfType || (() => true))
    const concurrency = config.concurrency || Concurrency.parallel
    const cutoffHandler = config.onCutoff

    let prevSub: Subscription // for cutoff to unsubscribe, mute not to start a new
    // let prevEnder:Subject    // for cutoff to call .error()
    let prevEnd: Promise<any> // for serial to chain on

    // Build a function, and keep it around for #process, which
    // returns a Promise for any rendering done for this action
    const renderPromiser = (action: Action, context?: any) => {
      // If this renderer doesn't apply to this action...
      if (!predicate({ action })) {
        return Promise.resolve(undefined)
      }

      let recipe: Observable<any>
      let ender = new Subject()
      let completed = ender.toPromise()

      // Call this if we fail to get the recipe, or subscribe to it
      const reportFail = (ex: any) => {
        console.error(ex)
        removeRenderer.unsubscribe()
        ender.error(ex)
      }

      // 1. Get the Observable aka recipe back from the renderer
      try {
        const actionStreamItem = { action, context, event: action }
        const followerReturnValue = follower(actionStreamItem, action.payload)
        recipe = toObservable(followerReturnValue)
      } catch (ex) {
        reportFail(ex)
        // will warn of unhandled rejection error if completed and completed.bad are not handled
        return completed
      }

      // 2. If processing results, set that up
      if (config.processResults || config.type) {
        const opts: SubscribeConfig = config.type ? { type: config.type } : {}
        if (config.withContext) {
          opts.context = context
        }
        // Some actions from an Observable may be seen prior to the next action
        this.subscribe(ender, opts)
      }

      // 3. Subscribe to the recipe accordingly
      switch (concurrency) {
        case Concurrency.parallel:
          recipe.subscribe(ender)
          break
        case Concurrency.serial:
          if (prevSub && !prevSub.closed) {
            if (!prevEnd) {
              prevEnd = completed
            } else {
              prevEnd.then(() => {
                prevSub = recipe.subscribe(ender)
              })
              prevEnd = prevEnd.then(() => completed)
            }
          } else {
            prevEnd = completed
            prevSub = recipe.subscribe(ender)
          }
          break
        case Concurrency.mute:
          if (prevSub && !prevSub.closed) {
            // dies in a fire - but do we notify ?
            // ender.error('mute')
          } else {
            prevSub = recipe.subscribe(ender)
          }
          break
        case Concurrency.cutoff:
          if (prevSub && !prevSub.closed) {
            prevSub.unsubscribe()
          }
          prevSub = recipe.subscribe(ender)
          if (cutoffHandler) {
            prevSub.add(() => {
              if (!ender.isStopped) cutoffHandler({ action })
            })
          }

          break
      }

      return completed
    }

    this.allRenderers.set(name, renderPromiser)
    return removeRenderer
  }

  /**
   * Subscribes to an Observable of actions (Flux Standard Action), sending
   * each through agent.process. If the Observable is not of FSAs, include
   * { type: 'theType' } to wrap the Observable's items in FSAs of that type.
   * Allows a shorthand where the second argument is just a string type for wrapping.
   * @return A subscription handle with which to unsubscribe()
   *
   */
  subscribe(item$: Observable<any>, config: SubscribeConfig | string = {}): Subscription {
    const _config = typeof config === "string" ? { type: config } : config
    return item$.subscribe(item => {
      const actionToProcess = _config.type ? { type: _config.type, payload: item } : item
      this.process(actionToProcess, _config.context)
    })
  }

  /**
   * Removes all filters and renderers, not canceling any in-progress consequences.
   * Useful as the first line of a script in a Hot-Module Reloading environment.
   */
  reset() {
    this.allFilters.clear()
    this.allRenderers.clear()
  }

  private runFilters(asi: ActionStreamItem, results: Map<string, any>): void {
    // Run all filters sync (RxJS as of v6 no longer will sync error)
    for (let filterName of this.allFilters.keys()) {
      let filter = this.allFilters.get(filterName)
      let result
      let err
      try {
        // @ts-ignore
        result = filter(asi)
      } catch (ex) {
        err = ex
        throw ex
      } finally {
        results.set(filterName, result || err)
      }
    }
  }

  private uniquifyName(
    name: string | undefined,
    actionFilter: ActionFilter | undefined,
    type: "renderer" | "filter"
  ) {
    const nameBase =
      //@ts-ignore
      name || (actionFilter && actionFilter.substring ? actionFilter.toString() : type)
    validateSubscriberName(nameBase)
    const _name =
      this[type + "Names"]().includes(nameBase) || nameBase === type
        ? `${nameBase}_${++this._subscriberCount}`
        : nameBase

    return _name
  }
}

function getActionFilter(actionFilter: ActionFilter) {
  let predicate: ((asi: ActionStreamItem) => boolean)

  if (actionFilter instanceof RegExp) {
    predicate = ({ action }: ActionStreamItem) => actionFilter.test(action.type)
  } else if (actionFilter instanceof Function) {
    predicate = actionFilter
  } else if (typeof actionFilter === "boolean") {
    predicate = () => actionFilter
  } else {
    predicate = ({ action }: ActionStreamItem) => actionFilter === action.type
  }
  return predicate
}

function validateSubscriberName(name: string | undefined) {
  assert(
    !name || !reservedSubscriberNames.includes(name),
    "The following subscriber names are reserved: " + reservedSubscriberNames.join(", ")
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
 *  Returns an Observable of { delta } objects where delta is the time in ms
 *  since the GameLoop was constructed. Frames occur as often as
 *  requestAnimationFrame is invoked, so:
 *
 *  - Not while the browser is in the background
 *  - Whenever the browser has painted and is ready for you to update the view
 *
 * @example
 * ```js
 *
 *  const drawToCanvas(world) { ... }
 *
 *  const frames = new GameLoop()
 *
 *  agent.on("world", ({ action: { payload: { world }}}) => {
 *    drawToCanvas(world)
 *  })
 *
 *  const worlds = frames.pipe(
 *     map(({ delta }) => delta),
 *     scan(function aWholeNewWorld(oldWorld, delta) {
 *       return aWholeNewWorld
 *     }, {})
 *  )
 *  agent.subscribe(worlds, { type: "world"})
 * ```
 */
export function GameLoop() {
  if (typeof animationFrameScheduler === "undefined") {
    throw new Error("ERR: animationFrame not detected in this environment.")
  }
  const startTime = animationFrameScheduler.now()
  return interval(0, animationFrameScheduler).pipe(
    map(() => ({
      delta: animationFrameScheduler.now() - startTime
    }))
  )
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

/** An instance of Agent - also exported as `app`. */
export const agent = new Agent()
/** An instance of Agent - also exported as `agent`. */
export const app = agent
/** Calls the corresponding method of, `app`, the default agent */
export const { process, trigger, filter, on, subscribe, reset } = {
  process: agent.process.bind(agent),
  trigger: agent.trigger.bind(agent),
  filter: agent.filter.bind(agent),
  on: agent.on.bind(agent),
  subscribe: agent.subscribe.bind(agent),
  reset: agent.reset.bind(agent)
}

/** Controls what types can be returned from an `on` handler:
    Primitive types: `of()`
    Promises: `from()`
    Observables: pass-through
*/
function toObservable(_results: any) {
  if (typeof _results === "undefined") return of(undefined)

  // An Observable is preferred
  if (_results.subscribe) return _results

  // Returning a subscription from a handler will allow
  // modes serial and cutoff to work.
  // Remember we're already subscribed - just add
  // completion/teardown logic.
  if (_results.unsubscribe)
    return new Observable(notify => {
      const sub: Subscription = _results
      sub.add(() => notify.complete())
      return () => sub.unsubscribe()
    })

  // A Promise is acceptable
  if (_results.then) return from(_results)

  // otherwiser we convert it to a single-item Observable
  return of(_results)
}
