import { Observable, Subject, Subscription } from "rxjs"
import { SubscriberConfig } from "./types"

/**
 * Options that get mixed into the agent as read-only
 * properties upon construction. Whitelisted to: agentId
 */
export interface AgentConfig {
  /**
   * Any value: One Suggestion is hex digits (a4ad3d) but
   * the way you'll create this will depend on your environment.
   */
  agentId?: any
  /**
   * If true, indicates that this Agent is willing to
   * forward actions out, if they have `meta.push` set to true. More
   * appropriate for a server, than a client.
   */
  relayActions?: boolean
  [key: string]: any
}

/**
 * The core of the Antares Agent API: methods to add subscribers (filters or renderers)
 * and a single method to 'dispatch' an action (Flux Standard Action) to relevant subscribers.
 */
export interface ActionProcessor {
  process(action: Action, context?: Object): ProcessResult
  addFilter(subscriber: Subscriber, config: SubscriberConfig): Subscription
  addRenderer(subscriber: Subscriber, config: SubscriberConfig): Subscription
}

/**
 * A subscriber is either a renderer or a filter - a function which
 * receives as its argument the ActionStreamItem, typically to use
 * the payload of the `action` property to cause some side-effect.
 */
export interface Subscriber {
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
  context?: Object
  results: Map<string, any>
  renderBeginnings: Map<string, Subject<boolean>>
  renderEndings: Map<string, Subject<boolean>>
}

/**
 * When a renderer (async usually) returns an Observable, it's possible
 * that multiple renderings will be active at once (see demo 'speak-up'). The options
 * are:
 * - parallel: Concurrent renders are unlimited, unadjusted
 * - serial: Concurrency of 1, render starts are queued
 * - cutoff: Concurrency of 1, any existing render is killed
 * - mute: Concurrency of 1, existing render prevents new renders
 */
export enum Concurrency {
  /**
   * Concurrent renders are unlimited, unadjusted */
  parallel = "parallel",
  /**
   * Concurrency of 1, render starts are queued */
  serial = "serial",
  /**
   * Concurrency of 1, any existing render is killed */
  cutoff = "cutoff",
  /**
   * Concurrency of 1, existing render prevents new renders */
  mute = "mute"
}

export interface StreamTransformer {
  (stream: Observable<ActionStreamItem>): Observable<ActionStreamItem>
}

export interface SubscriberConfig {
  name?: string
  concurrency?: Concurrency
  xform?: StreamTransformer
  processResults?: Boolean
  actionsOfType?: ActionFilter
}

export type ActionFilter = string | RegExp | ((asi: ActionStreamItem) => boolean)

/**
 * Your contract for what is returned from calling #process.
 * Basically this is the Object.assign({}, action, results), and so
 * you can destructure from it your renderer's return values by name,
 * or `type`, `payload`, or `meta`. Meta will often be interesting since
 * synchronous renderers (filters) can modify or add new meta, and often do.
 */
export interface ProcessResult {
  [key: string]: any
}

/**
 * Options are typical from rxjs/ajax, however the expandKey string
 * is one corresponding to an OboeJS node matcher, or a sub-key, depending on whether
 * the `lib` option is set to "oboe" or "rxjs". Oboe is used if present in the global
 * namespace, and lib is not set to `rxjs`.
 */
export interface StreamingGetOptions {
  url: string
  /** If an RxJS request, you can provide a key of an array field to turn its items into your notifications. If an Oboe request see: http://oboejs.com/api#pattern-matching */
  expandKey?: string
  method?: "GET" | "POST"
  headers?: Object
  body?: string | Object
  withCredentials?: Boolean
  timeout?: number
  /** Defaults to `oboe` if global `oboe` is present, otherwise uses `rxjs` */
  lib?: "rxjs" | "oboe"
}
