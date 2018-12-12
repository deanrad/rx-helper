import { Observable } from "rxjs";
import { StreamingGetOptions } from "./types";
import { Operation } from "fast-json-patch";
/**
 * Delays the occurrence of an object, or the invocation of a function, for the number of milliseconds given
 * @returns An Observable of the desired effect/object
 * @example after(100, {type: 'Timedout'}).subscribe(action => ...)
 */
export declare const after: (ms: number, objOrFn: Object | Function) => Observable<any>;
/**
 * Gets the resource, returning an Observable of resources referred to by the URL
 * It is cancelable, and if you have the oboejs library, you'll get full streaming.
 * Otherwise, you'll get an Observable that batches all its 'next' notifications at
 * the end - which is no worse than normal AJAX performance.
 */
export declare const ajaxStreamingGet: (opts: StreamingGetOptions) => Observable<any>;
/**
 * Turns a stream of objects into a stream of the patches between them.
 */
export declare const jsonPatch: () => <T>(source: Observable<T>) => Observable<Operation[]>;
/**
 * Turns an Observable into a stream of Apollo Query-style props {data, loading, error}
 * Takes an optional reducer (requires an initial value) with which to aggregate multiple
 * next notifications, otherwise defaults to replacing the `data` property.
 * Will work nicely with hooks using `react-observable-hook`
 */
export declare const toProps: (reducer?: Function) => <T>(source: Observable<T>) => Observable<Object>;
