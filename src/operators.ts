import { Observable, from, of } from "rxjs"
import { ajax } from "rxjs/ajax"
import { StreamingGetOptions } from "./types"
import { delay, map, flatMap, tap } from "rxjs/operators"

/** @description Delays the occurrence of an object, or the
 * invocation of a function, for the number of milliseconds given
 * @returns An Observable of the desired effect/object
 * @example after(100, {type: 'Timedout'}).subscribe(action => ...)
 */
export const after = (ms: number, objOrFn: Object | Function): Observable<any> => {
  const [obj, effect] =
    objOrFn instanceof Function ? [null, objOrFn] : [objOrFn, (value: Object) => null]

  return of(obj).pipe(
    delay(ms),
    // @ts-ignore
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
    timeout: opts.timeout || 30 * 1000
  }).pipe(
    // @ts-ignore
    flatMap(ajax => {
      const resultArr = opts.expandKey ? ajax.response[opts.expandKey] : ajax.response
      return resultArr instanceof Array ? from(resultArr) : of(resultArr)
    })
  )
}
