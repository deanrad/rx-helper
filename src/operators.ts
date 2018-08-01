import { Observable, from, of } from "rxjs"
import { ajax } from "rxjs/ajax"
import { StreamingGetOptions } from "./types"
import { delay, map, flatMap } from "rxjs/operators"
import { compare, Operation } from "fast-json-patch"

/** @description Delays the occurrence of an object, or the
 * invocation of a function, for the number of milliseconds given
 * @returns An Observable of the desired effect/object
 * @example after(100, {type: 'Timedout'}).subscribe(action => ...)
 */
export const after = (ms: number, objOrFn: Object | Function): Observable<any> => {
  const [obj, effect] =
    objOrFn instanceof Function ? [null, objOrFn] : [objOrFn, (value: Object) => value]

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
      return Array.isArray(resultArr) ? from(resultArr) : of(resultArr)
    })
  )
}

/** @description Turns a stream of objects into a stream of the patches between them.
 */
export const jsonPatch = () => <T>(source: Observable<T>) =>
  new Observable<Operation[]>(observer => {
    let lastSeen: any = {}

    return source.subscribe({
      next(newObj) {
        const patch = compare(lastSeen, newObj)
        if (patch.length === 0) return

        // TODO allow for tests to be included in the patches that assert the old values
        observer.next(patch)
        lastSeen = newObj
      },
      error(err) {
        observer.error(err)
      },
      complete() {
        observer.complete()
      }
    })
  })
