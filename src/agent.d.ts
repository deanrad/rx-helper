import { Observable, Subscription } from "rxjs";
import { ActionProcessor, Action, ActionFilter, ActionStreamItem, AgentConfig, Subscriber, SubscribeConfig, SubscriberConfig } from "./types";
export { Action, ActionFilter, AgentConfig, ActionStreamItem, Concurrency, ProcessResult, RendererPromiser, Subscriber, SubscriberConfig } from "./types";
export * from "./operators";
export { from, of, empty, concat, merge, interval, zip } from "rxjs";
/**
 * Represents the instance of an Rx-Helper action processor which is
 * usually the only one in this JavaScript runtime. The heart and circulatory system of
 * an Agent is its action stream. You put actions on the action stream
 * by calling `agent.process(action)` and from there filters and renderers respond.
 * Because renderers may emit more actions, this process can continue indefinitely.
 */
export declare class Agent implements ActionProcessor {
    static configurableProps: string[];
    static VERSION: string;
    /**
     * The heart and circulatory system of an Agent is `action$`, its action stream. */
    private action$;
    [key: string]: any;
    private _subscriberCount;
    private actionStream;
    private allFilters;
    private allRenderers;
    rendererNames(): string[];
    filterNames(): string[];
    /**
     * Gets an Observable of all actions matching the ActionFilter. */
    actionsOfType(matcher: ActionFilter): Observable<Action>;
    /**
     * Gets a promise for the next action matching the ActionFilter. */
    nextActionOfType(matcher: ActionFilter): Promise<Action>;
    constructor(config?: AgentConfig);
    /**
     * Process sends an Action (eg Flux Standard Action), which
     * is an object with a payload and type description, through the chain of
     * filters, and then out through any applicable renderers.
     * @throws Throws if a filter errs, but not if a renderer errs.
     *
     */
    process(action: Action, context?: any): any;
    trigger(type: string, payload?: any): any;
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
    on(actionFilter: ActionFilter, subscriber: Subscriber, config?: SubscriberConfig): Subscription;
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
    filter(actionFilter: ActionFilter, filter: Subscriber, config?: SubscriberConfig): Subscription;
    /**
     * Subscribes to an Observable of actions (Flux Standard Action), sending
     * each through agent.process. If the Observable is not of FSAs, include
     * { type: 'theType' } to wrap the Observable's items in FSAs of that type.
     * Allows a shorthand where the second argument is just a string type for wrapping.
     * @return A subscription handle with which to unsubscribe()
     *
     */
    subscribe(item$: Observable<any>, config?: SubscribeConfig | string): Subscription;
    /**
     * Removes all filters and renderers, not canceling any in-progress consequences.
     * Useful as the first line of a script in a Hot-Module Reloading environment.
     */
    reset(): void;
    private runFilters;
    private uniquifyName;
}
export declare const reservedSubscriberNames: string[];
/**
 * Constructs a filter (see agent.addFilter) which mixes AgentConfig properties
 * into the meta of an action
 */
export declare const agentConfigFilter: (agent: Agent) => ({ action }: ActionStreamItem) => void;
/**
 * A random enough identifier, 1 in a million or so,
 * to identify actions in a stream. Not globally or cryptographically
 * random, just more random than: https://xkcd.com/221/
 */
export declare const randomId: (length?: number) => string;
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
export declare function GameLoop(): Observable<{
    delta: number;
}>;
/**
 * A filter that adds a string of hex digits to
 * action.meta.actionId to uniquely identify an action among its neighbors.
 * @see randomId
 */
export declare const randomIdFilter: (length?: number, key?: string) => ({ action }: ActionStreamItem) => void;
/**
 * Pretty-print an action */
export declare const pp: (action: Action) => string;
/** An instance of Agent - also exported as `app`. */
export declare const agent: Agent;
/** An instance of Agent - also exported as `agent`. */
export declare const app: Agent;
/** Calls the corresponding method of, `app`, the default agent */
export declare const process: (action: Action, context?: any) => any, trigger: (type: string, payload?: any) => any, filter: (actionFilter: ActionFilter, filter: Subscriber, config?: SubscriberConfig | undefined) => Subscription, on: (actionFilter: ActionFilter, subscriber: Subscriber, config?: SubscriberConfig | undefined) => Subscription, subscribe: (item$: Observable<any>, config?: string | SubscribeConfig | undefined) => Subscription, reset: () => void;
