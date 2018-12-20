import { Observable, Subscription } from "rxjs";
import { ActionProcessor, Action, ActionFilter, ActionStreamItem, AgentConfig, ProcessResult, Subscriber, SubscriberConfig } from "./types";
export { Action, ActionFilter, AgentConfig, ActionStreamItem, Concurrency, ProcessResult, StreamTransformer, Subscriber, SubscriberConfig } from "./types";
export * from "./operators";
export { from, of, empty, concat, merge, interval } from "rxjs";
export { startWith, last, filter, delay, map, mapTo, scan } from "rxjs/operators";
/**
 * Represents the instance of an Antares action processor which is
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
    filterNames: Array<string>;
    rendererNames: Array<string>;
    [key: string]: any;
    /**
     * Gets a promise for the next action matching the ActionFilter. */
    nextOfType: ((filter: ActionFilter) => Promise<Action>);
    /**
     * Gets an Observable of all actions matching the ActionFilter. */
    allOfType: ((filter: ActionFilter) => Observable<Action>);
    private _subscriberCount;
    private actionStream;
    private allFilters;
    private activeRenders;
    private activeResults;
    constructor(config?: AgentConfig);
    /**
     * Process sends an Action (eg Flux Standard Action), which
     * is an object with a payload and type description, through the chain of
     * filters, and then out through any applicable renderers.
     * @throws Throws if a filter errs, but not if a renderer errs.
     *
     */
    process(action: Action, context?: Object): ProcessResult;
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
    on(actionFilter: ActionFilter, renderer: Subscriber, config?: SubscriberConfig): Subscription;
    /**
     * Calls addFilter, but uses a more event-handler-like syntax.
     * ```js
     * agent.filter('search/message/success', ({ action }) => console.log(action))
     * ```
     */
    filter(actionFilter: ActionFilter, filter: Subscriber, config?: SubscriberConfig): Subscription;
    /**
     * Filters are synchronous functions that sequentially process
     * each item on `action$`, possibly changing them or creating synchronous
     * state changes. Useful for type-checking, writing to a memory-based store.
     * For creating consequences (aka async side-effects aka renders) outside of
     * the running Agent, write and attach a Renderer. Filters run in series.
     */
    addFilter(filter: Subscriber, config?: SubscriberConfig): Subscription;
    addRenderer(subscriber: Subscriber, config?: SubscriberConfig): Subscription;
    /**
     * Subscribes to the Observable of actions (Flux Standard Action), sending
     * each through agent.process.
     * @return A subscription handle with which to unsubscribe()
     *
     */
    subscribe(action$: Observable<Action>, context?: Object): Subscription;
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
 * A filter that adds a string of hex digits to
 * action.meta.actionId to uniquely identify an action among its neighbors.
 * @see randomId
 */
export declare const randomIdFilter: (length?: number, key?: string) => ({ action }: ActionStreamItem) => void;
/**
 * Pretty-print an action */
export declare const pp: (action: Action) => string;
/** An agent instance with no special options - good enough for most purposes */
export declare const agent: Agent;
