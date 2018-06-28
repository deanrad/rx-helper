import { Observable, Subject, Subscription, asyncScheduler, from } from "rxjs"
import { observeOn } from "rxjs/operators"
import {
  AntaresProcessor,
  Action,
  ActionStreamItem,
  Concurrency,
  ProcessResult,
  Subscriber,
  SubscriberConfig,
  SubscribeMode
} from "./types"
import assert from "assert"
export * from "./types"

export class AntaresProtocol implements AntaresProcessor {
  actionStream: Subject<ActionStreamItem>
  action$: Observable<ActionStreamItem>
  _subscriberCount = 0
  filterNames: Array<string>
  allFilters: Map<string, Subscriber>
  rendererNames: Array<string>
  activeRenders: Map<string, Subscription>

  constructor() {
    this.actionStream = new Subject<ActionStreamItem>()
    this.action$ = this.actionStream.asObservable()
    this.filterNames = []
    this.allFilters = new Map<string, Subscriber>()
    this.rendererNames = []
    this.activeRenders = new Map<string, Subscription>()
  }

  process(action: Action): ProcessResult {
    const results = new Map<String, any>()
    const renderBeginnings = new Map<String, Subject<boolean>>()
    const renderEndings = new Map<String, Subject<boolean>>()
    this.rendererNames.forEach(name => {
      renderBeginnings.set(name, new Subject<boolean>())
      renderEndings.set(name, new Subject<boolean>())
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
      get() {
        return Promise.all(
          Array.from(renderEndings.values()).map(s => s.asObservable().toPromise())
        )
      }
    })

    // Now they get their result
    return resultObject as ProcessResult
  }

  addFilter(filter: Subscriber, config: SubscriberConfig = {}): Subscription {
    assert(
      !config || !config.mode || config.mode !== SubscribeMode.async,
      "addFilter only subscribes synchronously, check your config."
    )
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

  addRenderer(subscriber: Subscriber, config: SubscriberConfig = {}): Subscription {
    validateSubscriberName(config.name)
    const name = config.name || `renderer_${++this._subscriberCount}`
    this.rendererNames.push(name)

    const concurrency = config.concurrency
    const sub = this.action$.pipe(observeOn(asyncScheduler)).subscribe(asi => {
      const itHasBegun = new Subject<boolean>()
      itHasBegun.complete()
      asi.renderBeginnings.set(name, itHasBegun)

      // Renderers return Observables, usually of actions
      const results = subscriber(asi)

      // Eventually we may send actions back through, but for now at least subscribe
      const completer = {
        complete() {
          // @ts-ignore
          asi.renderEndings.get(name).complete()
        },
        error() {
          // @ts-ignore
          asi.renderEndings.get(name).error()
        }
      }

      const inProgress = this.activeRenders.get(name)
      let thisSub
      const subAndSave = () => {
        thisSub = results.subscribe(completer)
        this.activeRenders.set(name, thisSub)
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
        inProgress ? inProgress.add(subAndSave) : subAndSave()
      }
      if (concurrency === Concurrency.parallel) {
        subAndSave()
      }
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
