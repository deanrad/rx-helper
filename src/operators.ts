import { Observable, from, of } from "rxjs"
import { ajax } from "rxjs/ajax"
import { StreamingGetOptions } from "./types"
import { timer } from "rxjs"
import { map, mapTo, flatMap } from "rxjs/operators"

/**
 * Delays the invocation of a function, for the number of milliseconds given.
 * Produces an Observable of the thunk's invocation and subsequent return value.
 * The optional 3rd argument can be a name string which will be passed to the thunk.
 * @returns An Observable of the object or thunk return value. It is 'thenable', so may also be awaited directly.
 * @example after(100, name => ({type: `Timeout-${name}`}), 'session_expired').subscribe(event => ...)
 */
export const after = (ms: number, objOrFn: any, name = "") => {
  let returnObs: Observable<any>
  if (objOrFn instanceof Function) {
    returnObs = timer(ms).pipe(map(() => objOrFn(name)))
  } else {
    returnObs = timer(ms).pipe(mapTo(objOrFn))
  }

  // after is a 'thenable, thus usable with await.
  // ref: https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Operators/await
  // @ts-ignore
  returnObs.then = function(resolve, reject) {
    return this.toPromise().then(resolve, reject)
  }
  return returnObs
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
    // For compatibility with Rx, we'll treat `items` same as `items[*]`
    // To prevent this, provide the full path to the JSON node you want to singly select
    // `$.item` or `order.total` will not be expanded, but `items` will.
    let expandKey = opts.expandKey + (opts.expandKey && opts.expandKey.match(/\w+s$/i) ? "[*]" : "")
    // @ts-ignore
    oboe(opts.url) // Get items from a url
      // Matched items could be single or multiple items depending on expandKey
      .node(expandKey, function(items: any) {
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
