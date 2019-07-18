import { Observable, Subscription } from "rxjs";
import { EventBus, Action, EventMatcher, EventBusItem, AgentConfig, Subscriber, SubscribeConfig, HandlerConfig } from "./types";
export { Action, EventMatcher, AgentConfig, EventBusItem, Concurrency, ProcessResult, Subscriber, HandlerConfig } from "./types";
export * from "./operators";
export { from, of, empty, concat, merge, interval, zip } from "rxjs";
/**
 * Represents an instance of an event bus which you trigger/process events
 * to, and listen via handlers attached via `filter`(sync) and `on`(async).
 * Handlers can emit further events, thus extending the process.
 *
 * A singleton instance is exported as `app`, and top-level `filter` `on`
 * `process` and `subscribe` are bound to it.
 */
export declare class Agent implements EventBus {
    static configurableProps: string[];
    static VERSION: string;
    private event$;
    [key: string]: any;
    private _subscriberCount;
    private eventBus;
    private allFilters;
    private allHandlers;
    handlerNames(): string[];
    filterNames(): string[];
    /**
     * Gets an Observable of all events matching the EventMatcher. */
    getAllEvents(matcher: EventMatcher): Observable<Action>;
    /**
     * Gets a promise for the next event matching the EventMatcher. */
    getNextEvent(matcher?: EventMatcher): Promise<Action>;
    constructor(config?: AgentConfig);
    /**
     * Process sends an event (eg Flux Standard Action), which
     * is an object with a payload and `type`, through the chain of
     * filters, and then triggers any applicable handlers.
     * @throws Throws if a filter errs, but not if a handler errs.
     * @see trigger
     */
    process(event: Action, context?: any): any;
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
     * Here we attach a handler to fire on events of `type: 'kickoff'`.
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
    on(eventMatcher: EventMatcher, subscriber: Subscriber, config?: HandlerConfig): Subscription;
    /**
     * Filters are synchronous functions that sequentially process events,
     * possibly changing them or creating synchronous state changes.
     * Filters are useful for type-checking, writing to a memory-based store.
     * Filters run in series. Their results are present on the return value of `process`/`trigger`
     * ```js
     * agent.filter('search/message/success', ({ event }) => console.log(event))
     * ```
     * Returns an object which, when unsubscribed, will remove our filter. Filters are *not* removed
     * automatically upon untrapped errors, like handlers attached via `on`.
     */
    filter(eventMatcher: EventMatcher, filter: Subscriber, config?: HandlerConfig): Subscription;
    /**
     * Subscribes to an Observable of events (Flux Standard Action), sending
     * each through agent.process. If the Observable is not of FSAs, include
     * { type: 'theType' } to wrap the Observable's items in FSAs of that type.
     * Allows a shorthand where the second argument is just a string type for wrapping.
     * @return A subscription handle with which to unsubscribe()
     *
     */
    subscribe(item$: Observable<any>, config?: SubscribeConfig | string): Subscription;
    /**
     * Removes all filters and handlers, not canceling any in-progress consequences.
     * Useful as the first line of a script in a Hot-Module Reloading environment.
     */
    reset(): void;
    private runFilters;
    private uniquifyName;
}
export declare const reservedSubscriberNames: string[];
/**
 * A random enough identifier, 1 in a million or so,
 * to identify events in a stream. Not globally or cryptographically
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
 *  agent.on("world", ({ event: { payload: { world }}}) => {
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
 * event.meta.eventId to uniquely identify an event among its neighbors.
 * @see randomId
 */
export declare const randomIdFilter: (length?: number, key?: string) => ({ event }: EventBusItem) => void;
/**
 * Pretty-print an event */
export declare const pp: (event: Action) => string;
/** An instance of Agent - also exported as `app`. */
export declare const agent: Agent;
/** An instance of Agent - also exported as `agent`. */
export declare const app: Agent;
/** Calls the corresponding method of, `app`, the default agent */
export declare const process: (event: Action, context?: any) => any, trigger: (type: string, payload?: any) => any, filter: (eventMatcher: EventMatcher, filter: Subscriber, config?: HandlerConfig | undefined) => Subscription, on: (eventMatcher: EventMatcher, subscriber: Subscriber, config?: HandlerConfig | undefined) => Subscription, subscribe: (item$: Observable<any>, config?: string | SubscribeConfig | undefined) => Subscription, reset: () => void;
