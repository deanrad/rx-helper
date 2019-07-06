import { Observable, Subscription } from "rxjs";
import { SubscriberConfig } from "./types";
/**
 * Options that get mixed into the agent as read-only
 * properties upon construction. Whitelisted to: agentId
 */
export interface AgentConfig {
    /**
     * Any value: One Suggestion is hex digits (a4ad3d) but
     * the way you'll create this will depend on your environment.
     */
    agentId?: any;
    /**
     * If true, indicates that this Agent is willing to forward actions to others.
     */
    relayActions?: boolean;
    [key: string]: any;
}
/**
 * The core of the Rx-Helper Agent API: methods to add subscribers (filters or renderers)
 * and a single method to 'dispatch' an action (Flux Standard Action) to relevant subscribers.
 */
export interface ActionProcessor {
    process(action: Action, context?: Object): ProcessResult;
    subscribe(action$: Observable<Action>, context?: Object): Subscription;
    filter(actionFilter: ActionFilter, renderer: Subscriber, config?: SubscriberConfig): Subscription;
    on(actionFilter: ActionFilter, renderer: Subscriber, config?: SubscriberConfig): Subscription;
}
/**
 * A subscriber is either a renderer or a filter - a function which
 * receives as its argument the ActionStreamItem, typically to use
 * the payload of the `action` property to cause some side-effect.
 */
export declare type Subscriber = Filter | Renderer;
export interface Action {
    type: string;
    payload?: any;
    error?: boolean;
    meta?: Object;
}
export interface ActionStreamItem {
    /** Alias for action */
    event?: Action;
    /** The action which caused a filter/handler to be run */
    action: Action;
    /** An optional object, like the websocket or http response
     * that this action arrived on, on which its processing may
     * make function calls (such as res.write())
     */
    context?: Object;
    /** The results of filters, keyed by their name */
    results?: Map<string, any>;
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
export declare enum Concurrency {
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
/**
 * The function you assign to handle `.on(actionType)`
 * events is known as a Renderer. It receives as arguments
 * 1) An object containing an event (aka action), and context as fields
 * 2) The event's payload as a 2nd parameter (This makes
 *    referring to the payload easy, and is actually similar to JQuery ha!)
 */
export interface Renderer {
    (item: ActionStreamItem, payload?: any): any;
}
/**
 * A Filter runs a synchronous function prior to any renderers
 * being invoked, and can cancel future filters, and all handlers
 * by throwing an exception, which must be caught by the caller of
 * `process(action)`.
 *
 * It does *not*, as its name suggest, split off a slice of the
 * stream. To do that see `actionsOfType`.
 * @see actionsOfType
 */
export interface Filter {
    (item: ActionStreamItem, payload?: any): any;
}
export interface RendererPromiser {
    (action: Action, context?: any): Promise<any>;
}
export interface SubscriberConfig {
    /** A name by which the results will be keyed. Example: `agent.process(action).completed.NAME.then(() => ...)` */
    name?: string;
    /** A string, regex, or boolean function controlling which actions this renderer is configured to run upon. */
    actionsOfType?: ActionFilter;
    /** The concurrency mode to use. Governs what happens when renderings from this renderer overlap. */
    concurrency?: Concurrency;
    /** If true, the Observable returned by the renderer will be fed to `agent.subscribe`, so its actions are `process`ed. */
    processResults?: Boolean;
    /** If provided, this renderers' Observables values will be wrapped in FSAs with this type. */
    type?: string;
    /** If provided, this will be called if cutoff mode terminates a rendering. Parameter is {action}. */
    onCutoff?: Subscriber;
    /** If provided, the context of the action being responded to will be forwarded */
    withContext?: Boolean;
}
export interface SubscribeConfig {
    /** If provided, this renderers' Observables values will be wrapped in FSAs with this type. */
    type?: string;
    /** If provided, this will be the context argument for each processed action */
    context?: any;
}
export declare type ActionFilter = string | RegExp | Predicate | true;
export interface Predicate {
    (asi: ActionStreamItem): boolean;
}
/**
 * Your contract for what is returned from calling #process.
 * Basically this is the Object.assign({}, action, results), and so
 * you can destructure from it your renderer's return values by name,
 * or `type`, `payload`, or `meta`. Meta will often be interesting since
 * synchronous renderers (filters) can modify or add new meta, and often do.
 */
export interface ProcessResult {
    [key: string]: any;
}
/**
 * Options are typical from rxjs/ajax, however the expandKey string
 * is one corresponding to an OboeJS node matcher, or a sub-key, depending on whether
 * the `lib` option is set to "oboe" or "rxjs". Oboe is used if present in the global
 * namespace, and lib is not set to `rxjs`.
 */
export interface StreamingGetOptions {
    url: string;
    /** If an RxJS request, you can provide a key of an array field to turn its items into your notifications. If an Oboe request see: http://oboejs.com/api#pattern-matching */
    expandKey?: string;
    method?: "GET" | "POST";
    headers?: Object;
    body?: string | Object;
    withCredentials?: Boolean;
    timeout?: number;
    /** Defaults to `oboe` if global `oboe` is present, otherwise uses `rxjs` */
    lib?: "rxjs" | "oboe";
}
