import { Observable, from, of } from "rxjs"
import { ajax } from "rxjs/ajax"
import { StreamingGetOptions } from "./types"
import { timer } from "rxjs"
import { map, delay, flatMap } from "rxjs/operators"
import { compare, Operation } from "fast-json-patch"

/**
 * Delays the occurrence of an object, or the invocation of a function, for the number of milliseconds given
 * @returns An Observable of the desired effect/object
 * @example after(100, ()=>({type: 'Timedout'})).subscribe(action => ...)
 */
export const after = (ms: number, thunk: Function, name?: string): Observable<any> => {
  return timer(ms).pipe(map(() => thunk(name)))
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

/**
 * Turns an Observable into a stream of Apollo Query-style props {data, loading, error}
 * Takes an optional reducer (requires an initial value) with which to aggregate multiple
 * next notifications, otherwise defaults to replacing the `data` property.
 * Will work nicely with hooks using `react-observable-hook`
 */
export const toProps = (reducer: Function = (acc: any, item: any): any => item) => <T>(
  source: Observable<T>
) => {
  return new Observable<Object>(notify => {
    let lastAccumulated: any

    notify.next({ loading: true })
    return source.subscribe(
      (newObj: any) => {
        const newAccumulation = reducer(lastAccumulated, newObj)
        if (newAccumulation === lastAccumulated) return
        lastAccumulated = newAccumulation
        notify.next({ loading: true, data: lastAccumulated })
      },
      e => {
        notify.next({ loading: false, data: null, error: e })
        notify.complete()
      },
      () => {
        notify.next({ loading: false, data: lastAccumulated, error: null })
        notify.complete()
      }
    )
  })
}
