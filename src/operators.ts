import { Observable, from, of } from "rxjs"
import { ajax } from "rxjs/ajax"
import { StreamingGetOptions } from "./types"
import { delay, map, flatMap } from "rxjs/operators"
import { compare, Operation } from "fast-json-patch"

/**
 * Delays the occurrence of an object, or the invocation of a function, for the number of milliseconds given
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

/**
 * Gets the resource, returning an Observable of resources referred to by the URL
 * It is cancelable, and if you have the oboejs library, you'll get full streaming.
 * Otherwise, you'll get an Observable that batches all its 'next' notifications at
 * the end - which is no worse than normal AJAX performance.
 */
export const ajaxStreamingGet = (opts: StreamingGetOptions): Observable<any> => {
  //@ts-ignore
  return typeof oboe === "undefined" || opts.lib === "rxjs" ? rxGet(opts) : oboeGet(opts)
}

// An Observable of the response, expanded to individual results if applicable.
function rxGet(opts: StreamingGetOptions): Observable<any> {
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

function oboeGet(opts: StreamingGetOptions): Observable<any> {
  return new Observable(o => {
    let userCanceled = false
    // @ts-ignore
    oboe(opts.url) // Get items from a url
      // Matched items could be single or multiple items depending on expandKey
      .node(opts.expandKey, function(items: any) {
        if (userCanceled) {
          o.complete()
          // @ts-ignore
          this.abort()
          return
        }
        o.next(items)
      })
      .done(() => o.complete())

    // When a caller unsubscribes, we'll get max one more
    return () => {
      userCanceled = true
    }
  })
}

/**
 * Turns a stream of objects into a stream of the patches between them.
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
