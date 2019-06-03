import {
  Observable,
  Subject,
  Subscription,
  animationFrameScheduler,
  from,
  of,
  interval
} from "rxjs"
import { filter, map, first } from "rxjs/operators"
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
  RendererPromiser,
  Subscriber,
  SubscriberConfig
} from "./types"

// Export utility rxjs operators and our own custom
export * from "./operators"
export { from, of, empty, concat, merge, interval } from "rxjs"
export { startWith, last, filter, delay, map, mapTo, scan } from "rxjs/operators"

/**
 * Represents the instance of an Rx-Helper action processor which is
 * usually the only one in this JavaScript runtime. The heart and circulatory system of
 * an Agent is its action stream. You put actions on the action stream
 * by calling `agent.process(action)` and from there filters and renderers respond.
 * Because renderers may emit more actions, this process can continue indefinitely.
 */
export class Agent implements ActionProcessor {
  public static configurableProps = ["agentId", "relayActions"]
  public static VERSION = "1.2.1"

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
      filter(predicate),
      map(({ action }) => action)
    )
  }

  /**
   * Gets a promise for the next action matching the ActionFilter. */
  nextActionOfType(matcher: ActionFilter) {
    const predicate = getActionFilter(matcher)
    return this.action$
      .pipe(
        filter(predicate),
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

  /**
   * Renderers are functions that exist to create side-effects
   * outside of the Rx-Helper Agent - called Renderings. This can be changes to a
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
   * For creating consequences (aka async side-effects aka renders) outside of
   * the running Agent, write and attach a Renderer. Filters run in series.
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

  /** The unconditional version of filter
   * ```js
   * agent.addFilter(({ action }) => console.log(action))
   * ```
   */
  addFilter(filter: Filter, config: SubscriberConfig = {}): Subscription {
    validateSubscriberName(config.name)
    const removeFilter = new Subscription(() => {
      this.allFilters.delete(name)
    })

    // Pass all actions unless otherwise told
    const predicate = config.actionsOfType ? getActionFilter(config.actionsOfType) : () => true
    const _filter: Subscriber = (asi: ActionStreamItem) => {
      if (predicate(asi)) {
        return filter(asi, asi.action.payload)
      }
    }

    const name = this.uniquifyName(config, "filter")
    this.allFilters.set(name, _filter)

    // The subscription does little except give us an object
    // which, when unsubscribed, will remove our filter
    return removeFilter
  }

  addRenderer(follower: Renderer, config: SubscriberConfig = {}): Subscription {
    const removeRenderer = new Subscription(() => {
      this.allRenderers.delete(name)
    })

    const name = this.uniquifyName(config, "renderer")
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
   * @return A subscription handle with which to unsubscribe()
   *
   */
  subscribe(item$: Observable<any>, config: SubscribeConfig = {}): Subscription {
    return item$.subscribe(item => {
      const actionToProcess = config.type ? { type: config.type, payload: item } : item
      this.process(actionToProcess, config.context)
    })
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

  private uniquifyName(config: SubscriberConfig, type: "renderer" | "filter") {
    const nameBase =
      config.name ||
      //@ts-ignore
      (config.actionsOfType && config.actionsOfType.substring
        ? config.actionsOfType.toString()
        : type)
    validateSubscriberName(nameBase)
    const name =
      this[type + "Names"]().includes(nameBase) || nameBase === type
        ? `${nameBase}_${++this._subscriberCount}`
        : nameBase

    return name
  }
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

/** An agent instance with no special options - good enough for most purposes */
export const agent = new Agent()

/** A function that creates and processes an action via the default agent */
export const trigger = (type: string, payload?: any) => agent.process({ type, payload })

/** Controls what types can be returned from an `on` handler:
    Primitive types: `of()`
    Promises: `from()`
    Observables: pass-through
*/
function toObservable(_results: any) {
  if (typeof _results === "undefined") return of(undefined)

  // An Observable is preferred
  if (_results.subscribe) return _results

  // A Promise is acceptable
  if (_results.then) return from(_results)

  // otherwiser we convert it to a single-item Observable
  return of(_results)
}

function actionFilterFrom({ actionsOfType = () => true }: SubscriberConfig): Predicate {
  let predicate: Predicate

  if (actionsOfType instanceof RegExp) {
    predicate = ({ action }: ActionStreamItem) => actionsOfType.test(action.type)
  } else if (actionsOfType instanceof Function) {
    predicate = actionsOfType
  } else {
    predicate = ({ action }: ActionStreamItem) => actionsOfType === action.type
  }
  return predicate
}
