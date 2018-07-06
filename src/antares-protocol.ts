import { Observable, Subject, Subscription, asyncScheduler, from, of, empty } from "rxjs"
import { observeOn, last, startWith } from "rxjs/operators"
import {
  ActionProcessor,
  Action,
  ActionStreamItem,
  Concurrency,
  ProcessResult,
  Subscriber,
  SubscriberConfig
} from "./types"

// Leave this as require not import! https://github.com/webpack/webpack/issues/1019
const assert = typeof require === "undefined" ? () => null : require("assert")
export * from "./types"

/**
 * @description Represents the instance of an Antares action processor which is
 * usually the only one in this JavaScript runtime. The heart and circulatory system of
 * an Agent is `action$`, its action stream.
 */
export class Agent implements ActionProcessor {
  /** @description The heart and circulatory system of an Agent is `action$`, its action stream. */
  action$: Observable<ActionStreamItem>
  filterNames: Array<string>
  rendererNames: Array<string>

  private _subscriberCount = 0
  private actionStream: Subject<ActionStreamItem>
  private allFilters: Map<string, Subscriber>
  private activeRenders: Map<string, Subscription>
  private activeResults: Map<string, Observable<any>>

  constructor() {
    this.actionStream = new Subject<ActionStreamItem>()
    this.action$ = this.actionStream.asObservable()
    this.filterNames = []
    this.allFilters = new Map<string, Subscriber>()
    this.rendererNames = []
    this.activeRenders = new Map<string, Subscription>()
    this.activeResults = new Map<string, Observable<any>>()
  }

  /** @description Process sends an Action (eg Flux Standard Action), which
   * is an object with a payload and type description, through the chain of
   * filters, and then out through any applicable renderers.
   * @throws Throws if a filter errs, but not if a renderer errs.
   *
   */
  process(action: Action): ProcessResult {
    const results = new Map<String, any>()
    const renderBeginnings = new Map<String, Subject<boolean>>()
    const renderEndings = new Map<String, Subject<boolean>>()

    // In order to do completion detection, we need to set these
    // locations up synchronously, and let them be read later.
    this.rendererNames.forEach(name => {
      renderBeginnings.set(name, new Subject<boolean>())
      renderEndings.set(name, new Subject<boolean>())
      this.activeResults.set(name, empty())
    })
    const item = { action, results, renderBeginnings, renderEndings }

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
    Object.defineProperty(resultObject, "completed", {
      get: () => {
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
        return completedObject
      }
    })

    // Now they get their result
    return resultObject as ProcessResult
  }

  /** @description Filters are synchronous functions that sequentially process
   * each item on `action$`, possibly changing them or creating synchronous
   * state changes. Useful for type-checking, writing to a memory-based store.
   * For creating consequences (aka async side-effects aka renders) outside of
   * the running Agent, write and attach a Renderer. Filters run in series.
   */
  addFilter(filter: Subscriber, config: SubscriberConfig = {}): Subscription {
    validateSubscriberName(config.name)
    const name = config.name || `filter_${++this._subscriberCount}`
    this.filterNames.push(name)
    this.allFilters.set(name, filter)

    const errHandler = (e: Error) => {
      console.error("So sad, an error" + e.message)
    }

    // The subscription does little except give us an object
    // which, when unsubscribed, will remove our filter
    const sub = this.action$.subscribe(asi => null, errHandler)
    sub.add(() => {
      this.allFilters.delete(name)
    })
    return sub
  }

  /** @description Renderers are functions that exist to create side-effects
   * outside of the Antares Agent - called Renderings. This can be changes to a
   * DOM, to a database, or communications (eg AJAX) sent on the wire. If its
   * an async behavior, it should be a Renderer not a filter. Renderers run
   * in parallel with respect to other renderers. The way they act with respect
   * to their own overlap, is per their `concurrency` config parameter.
   */
  addRenderer(subscriber: Subscriber, config: SubscriberConfig = {}): Subscription {
    validateSubscriberName(config.name)
    const name = config.name || `renderer_${++this._subscriberCount}`

    const xform = config.xform || (stream => stream)
    this.rendererNames.push(name)

    const concurrency = config.concurrency || Concurrency.parallel
    const { processResults } = config
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
        const results =
          _results && _results.subscribe // an Observable
            ? _results
            : _results && _results[Symbol.iterator] && !_results.substring
              ? from(_results) // an iterable, such as an array, but not string
              : of(_results)

        this.activeResults.set(name, results)

        // Eventually we may send actions back through, but for now at least subscribe
        const completer = {
          next: (resultAction: Action) => {
            if (!processResults) return
            this.process(resultAction)
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
        // ⑨  🥑   ②  🥑   ①  🥑  🥑  🥑  🥑  🥑  🥑  🥑  💥
        // 🍌  🍓  💥
        // 🍌  💥  <-- note the interleaving of banana and strawberry
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
}

function validateSubscriberName(name: string | undefined) {
  assert(
    !name || !reservedSubscriberNames.includes(name),
    "The following subscriber names are reserved: " + reservedSubscriberNames.join(", ")
  )
}

export const reservedSubscriberNames = ["completed", "then", "catch"]
