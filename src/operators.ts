import { Observable, from } from "rxjs"
import { ajax } from "rxjs/ajax"
import { StreamingGetOptions } from "./types"
const { of } = require("rxjs")
const { delay, map, flatMap } = require("rxjs/operators")

/** @description Delays the occurrence of an object, or the
 * invocation of a function, for the number of milliseconds given
 * @returns An Observable of the desired effect/object
 * @example after(100, {type: 'Timedout'}).subscribe(action => ...)
 */
export const after = (ms: Number, objOrFn: Object | Function): Observable<any> => {
  const [obj, effect] = objOrFn instanceof Function ? [null, objOrFn] : [objOrFn, () => null]

  return of(obj).pipe(
    delay(ms),
    map(effect)
  )
}

/** @description Gets the resource, returning an Observable of resources referred to by the URL
 * @see https://medium.com/@deaniusaur/how-to-stream-json-data-over-rest-with-observables-80e0571821d3
 */
export const ajaxStreamingGet = (opts: StreamingGetOptions): Observable<any> => {
  // An Observable of the response, expanded to individual results if applicable.
  return ajax({
    url: opts.url,
    method: opts.method || "GET",
    withCredentials: Boolean(opts.withCredentials),
    timeout: opts.timeout || 30*1000
  }).pipe(
    // @ts-ignore
    flatMap(ajax => {
      ajax.response instanceof Array ? from(ajax.response) : of(ajax.response)
    })
  )
}
