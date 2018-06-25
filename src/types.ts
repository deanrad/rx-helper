import { Observable, Subject, Subscription } from "rxjs"
import { SubscriberConfig } from "./types"

export interface AntaresProcessor {
  process(action: Action): ProcessResult
  addFilter(subscriber: Subscriber, config: SubscriberConfig): Subscription
  addRenderer(subscriber: Subscriber, config: SubscriberConfig): Subscription
}

export interface Subscriber {
  (item: ActionStreamItem): any
}

export interface SafeSubscriber {
  (item: ActionStreamItem): any
}

export interface Action {
  type: string
  payload?: any
  error?: boolean
  meta?: Object
}

export interface ActionStreamItem {
  action: Action
  results: Map<String, any>
  renderBeginnings: Map<String, Subject<boolean>>
  renderEndings: Map<String, Subject<boolean>>
}

export enum SubscribeMode {
  sync = "sync",
  async = "async"
}

/**
 * @description When a renderer (async usually) returns an Observable, it's possible
 * that multiple renderings will be active at once (see demo 'speak-up'). The options
 * are:
 * - parallel - a mergeMap will be performed
 * - serial - a concatMap will be performed
 * - cutoff - a switchMap will be performed
 */
export enum Concurrency {
  parallel = "parallel",
  serial = "serial",
  cutoff = "cutoff"
}

export interface SubscriberConfig {
  mode?: SubscribeMode
  name?: string
  concurrency?: Concurrency
}

/**
 * @description Your contract for what is returned from calling #process.
 * Basically this is the Object.assign({}, action, results), and so
 * you can destructure from it your renderer's return values by name,
 * or `type`, `payload`, or `meta`. Meta will often be interesting since
 * synchronous renderers (filters) can modify or add new meta, and often do.
 */
export interface ProcessResult {
  [key: string]: any
}
