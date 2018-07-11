import { Observable } from "rxjs"

const { of } = require("rxjs")
const { delay, map } = require("rxjs/operators")

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
