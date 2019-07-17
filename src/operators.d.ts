import { Observable } from "rxjs";
import { StreamingGetOptions } from "./types";
/**
 * Delays the invocation of a function, for the number of milliseconds given.
 * Produces an Observable of the thunk's invocation and subsequent return value.
 * The optional 3rd argument can be a name string which will be passed to the thunk.
 * @returns An Observable of the object or thunk return value. It is 'thenable', so may also be awaited directly.
 * @example after(100, name => ({type: `Timeout-${name}`}), 'session_expired').subscribe(action => ...)
 */
export declare const after: (ms: number, objOrFn: any, name?: string) => Observable<any>;
/**
 * Gets the resource, returning an Observable of resources referred to by the URL
 * It is cancelable, and if you have the oboejs library, you'll get full streaming.
 * Otherwise, you'll get an Observable that batches all its 'next' notifications at
 * the end - which is no worse than normal AJAX performance.
 */
export declare const ajaxStreamingGet: (opts: StreamingGetOptions) => Observable<any>;
/**
 * Turns an Observable into a stream of Apollo Query-style props {data, loading, error}
 * Takes an optional reducer (requires an initial value) with which to aggregate multiple
 * next notifications, otherwise defaults to replacing the `data` property.
 * Will work nicely with hooks using `react-observable-hook`
 */
export declare const toProps: (reducer?: Function) => <T>(source: Observable<T>) => Observable<Object>;
