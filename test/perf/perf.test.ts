import { filter, on, trigger, reset, after } from "../../src/agent"
import { range } from "rxjs"

describe("Performance Testing", () => {
  beforeEach(() => reset())

  describe("Cost to trigger/process", () => {
    const threshold1s = 10000
    const timeScale = 0.1
    const thresholdTime = 1000 // 1 second
    it(`Can process ${threshold1s} per second with no filters or handlers`, () => {
      expectToCompleteWithin(thresholdTime * timeScale, () => {
        range(0, threshold1s * timeScale).subscribe(i => {
          trigger("perf/test", { i })
        })
      })
    })
    it(`Can process ${threshold1s} per second with a filter and an sync handler`, () => {
      let counter = 0
      filter(true, () => {
        counter += 1
      })
      on(true, () => {
        counter += 1
      })
      expectToCompleteWithin(thresholdTime * timeScale, () => {
        range(0, threshold1s * timeScale).subscribe({
          next(i) {
            trigger("perf/test", { i })
          },
          complete() {
            expect(counter).toEqual(threshold1s * 2)
          }
        })
      })
    })
    it(`Can process ${threshold1s} per second with a filter and an async handler`, () => {
      let counter = 0
      filter(true, () => {
        counter += 1
      })
      on(true, () =>
        after(100, () => {
          counter += 1
        })
      )
      expectToCompleteWithin(thresholdTime * timeScale, () => {
        range(0, threshold1s * timeScale).subscribe(i => trigger("perf/test", { i }))
      })
    })

    const manyFilters = 500
    const processNum = 1000

    it(`Can process ${processNum} per second with ${manyFilters} filters`, done => {
      let counter = 0
      range(0, manyFilters + 1).subscribe(i => {
        filter(
          true,
          () => {
            counter = i
          },
          { name: `filter_${i}` }
        )
      })

      range(0, processNum).subscribe({
        next(i) {
          trigger("perf/test", { i })
        },
        complete() {
          expect(counter).toEqual(manyFilters)
          done()
        }
      })
    })

    const manyHandlers = 40
    it(`Can process ${processNum} per second with ${manyHandlers} handlers`, () => {
      let counter = 0
      range(0, manyHandlers + 1).subscribe(i => {
        on(
          true,
          () => {
            counter += 1
          },
          { name: `handler_${i}` }
        )
      })

      expectToCompleteWithin(thresholdTime, () => {
        range(0, processNum).subscribe(i => trigger("perf/test", { i }))
      })
    })

    it("Is affected by time spent in filters / event matchers", done => {
      let counter = 0
      let startTime = Date.now()
      filter(true, () => {
        block(20)
        counter += 1
      })
      range(0, 5).subscribe({
        next(i) {
          trigger("perf/test", { i })
        },
        complete() {
          let endTime = Date.now()
          expect(endTime - startTime).toBeGreaterThanOrEqual(100)
          done()
        }
      })
    })
  })
})

function expectToCompleteWithin(ms, fn) {
  const beginTime = Date.now()
  let result = fn.call()

  if (result && result.then) {
    return Promise.race([
      result,
      new Promise((_, reject) => setTimeout(() => reject(new Error("timeout")), ms))
    ])
  }

  const endTime = Date.now()
  expect(endTime - beginTime).toBeLessThan(ms)
}

function getTime() {
  return Date.now()
}
function block(ms = 200) {
  const orig = getTime()
  while (getTime() - orig < ms) {}
}
