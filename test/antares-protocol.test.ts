import { default as faker } from "faker"
import fs from "fs"
import { Observable, Subject, of, empty } from "rxjs"
import { delay, first, map, take, toArray } from "rxjs/operators"
import {
  Action,
  ActionStreamItem,
  Agent,
  Concurrency,
  Subscriber,
  reservedSubscriberNames
} from "../src/antares-protocol"

// a mutable variable, reset between tests
let counter = 0

describe("Agent", () => {
  let antares: Agent

  beforeEach(() => {
    counter = 0
    antares = new Agent()
  })

  // Sanity check
  it("is instantiable", () => {
    expect(new Agent()).toBeInstanceOf(Agent)
  })

  it("has instance methods", () => {
    const antares = new Agent()
    expect(antares).toMatchObject({
      process: expect.any(Function),
      addFilter: expect.any(Function),
      addRenderer: expect.any(Function)
    })
  })

  describe("#addFilter", () => {
    describe("arguments", () => {
      describe("function argument", () => {
        it("will be called synchronously when an action is processed", () => {
          const spy = jest.fn()
          antares.addFilter(spy)
          expect(spy).not.toHaveBeenCalled()
          antares.process(anyAction)
          expect(spy).toHaveBeenCalled()
        })
      })
    })
  })

  describe("#addFilter or #addRenderer", () => {
    describe("arguments", () => {
      describe("function argument", () => {
        it("should be a function", () => {
          antares.addFilter(nullFn)
        })
      })

      describe("config argument", () => {
        describe("name", () => {
          it("will be filter_N if not given for a filter", () => {
            expect(antares.filterNames).not.toContain("filter_1")
            antares.addFilter(() => 3.141)
            expect(antares.filterNames).toContain("filter_1")
          })

          it("will be renderer_N if not given for a renderer", () => {
            expect(antares.rendererNames).not.toContain("renderer_1")
            antares.addRenderer(() => 3.141)
            expect(antares.rendererNames).toContain("renderer_1")
          })

          it("cannot be a reserved name", () => {
            expect.assertions(reservedSubscriberNames.length)
            reservedSubscriberNames.forEach(badName => {
              expect(() => {
                antares.addFilter(nullFn, { name: badName })
              }).toThrow()
            })
          })
        })
      })
      describe("return value", () => {
        it("is a subscription", () => {
          let callCount = 0
          const subscription = antares.addFilter(() => callCount++)
          const result = antares.process(anyAction)
          expect(callCount).toEqual(1)
          subscription.unsubscribe()
          antares.process(anyAction)
          expect(callCount).toEqual(1)
        })
      })
    })
  })

  describe("#addRenderer", () => {
    describe("arguments", () => {
      describe("first argument", () => {
        it("should return an Observable", undefined)
        it("may return null or an object to be cast to Observable", undefined)
      })
      describe("config argument", () => {
        describe("concurrency", () => {
          it("should run in parallel mode (shown in demo)", undefined)
          it("should run in series mode (shown in demo)", undefined)
          it("should run in cutoff mode (shown in demo)", undefined)
          it("should run in mute mode (shown in demo)", undefined)
        })
        describe("processResults", () => {
          it("should enable returned actions from renderer to go through antares.process", () => {
            expect.assertions(1)
            antares.addRenderer(
              ({ action }) => {
                if (action.type === "addTwo") {
                  counter += 2
                  return empty()
                }
                counter += 1
                return of({ type: "addTwo" })
              },
              { processResults: true }
            )

            // since this render returns another action, we'll get two calls
            antares.process({ type: "addOne" })
            return new Promise(resolve => {
              setTimeout(() => {
                expect(counter).toEqual(3)
                resolve()
              }, 20)
            })
          })
        })
      })
    })
  })

  describe("#process", () => {
    beforeEach(() => {
      counter = 0
    })

    describe("arguments", () => {
      describe("action", () => {
        it("should be an action", () => {
          expect.assertions(0)
          antares.process(anyAction)
        })
      })
    })

    describe("return value", () => {
      it("should be a superset of the action", () => {
        expect.assertions(1)
        const result = antares.process(anyAction)
        expect(result).toMatchObject(anyAction)
      })

      it("should have a field for each filter", () => {
        expect.assertions(8)

        const firstRetVal = 1
        const secondRetVal = "abc123"
        antares.addFilter(() => firstRetVal)
        antares.addFilter(() => secondRetVal, { name: "_id" })

        const result = antares.process(anyAction)

        // Any way u want, u got it
        const { filter_1, _id } = result

        expect(filter_1).toEqual(firstRetVal)
        expect(result["filter_1"]).toEqual(firstRetVal)
        expect(result.filter_1).toEqual(firstRetVal)
        expect(result).toHaveProperty("filter_1", firstRetVal)

        expect(_id).toEqual(secondRetVal)
        expect(result["_id"]).toEqual(secondRetVal)
        expect(result._id).toEqual(secondRetVal)
        expect(result).toHaveProperty("_id", secondRetVal)
      })

      it("should not serialize result properties, allowing them to be complex", () => {
        expect.assertions(1)
        const retVal = "abc123"
        antares.addFilter(() => retVal)
        const serailizedResult = JSON.stringify(antares.process(anyAction))
        expect(serailizedResult).not.toContain(retVal)
      })

      describe("#completed: (all triggered renderers are done)", () => {
        it("is a Promise for all async renderers' results to have completed", () => {
          antares.addRenderer(() => of("🐌").pipe(delay(100)), {
            name: "snail",
            concurrency: Concurrency.serial
          })
          antares.addRenderer(() => of("⚡").pipe(delay(20)), {
            name: "quickie"
          })

          return antares.process(anyAction).completed
        })

        it("can get a promise for a renderers final value via completed.rendererName", () => {
          expect.assertions(4)

          // This 'renderer' returns an Observable which yields 3.14 after 20msec
          antares.addRenderer(() => of(2.71828, 3.14).pipe(delay(20)), { name: "thing1" })

          // Renderer can return simple object
          antares.addRenderer(() => 7, { name: "thing2" })

          // Can return null or undefined
          antares.addRenderer(() => null, { name: "nully" })

          // Renderer returns an array
          antares.addRenderer(() => ["---", "=--", "==-", "==="], { name: "progressBars" })

          const result = antares.process(anyAction)
          return result.completed.thing1
            .then(r => {
              expect(r).toEqual(3.14)
            })
            .then(() =>
              result.completed.thing2.then(r => {
                expect(r).toEqual(7)
              })
            )
            .then(() =>
              result.completed.nully.then(r => {
                expect(r).toEqual(null)
              })
            )
            .then(() =>
              result.completed.progressBars.then(r => {
                expect(r).toEqual("===")
              })
            )
        })

        it("resolves if you have no renderers", () => {
          expect.assertions(0)
          const result = antares.process(anyAction)
          return result.completed
        })

        it("resolves even if you have a time-delayed renderer", undefined)
        it("resolves even if a renderer is cutoff by itself", undefined)
      })
    })
    describe("behavior", () => {
      it("should emit the action on the action$ Observable", () => {
        expect.assertions(1)

        // Build up our assertion
        const assertion = antares.action$
          .pipe(first())
          .toPromise()
          .then(asi => {
            expect(asi.action).toEqual(anyAction)
          })

        // Then process an action
        antares.process(anyAction)

        // And return the assertion
        return assertion
      })

      it("should run filters in order", () => {
        expect.assertions(1)

        // Define some functions about which we solely care
        //  about their (synchronous) side-effects
        let counter = 1
        const incrementer = () => {
          return (counter += 0.1)
        }
        const doubler = () => {
          return (counter *= 2)
        }

        antares.addFilter(incrementer, { name: "inc" })
        antares.addFilter(doubler, { name: "double" })

        let result = antares.process(anyAction)
        const { double, inc } = result
        expect({ double, inc }).toMatchSnapshot()
      })

      describe("errors in filters", () => {
        it("should propogate up to the caller of #process", () => {
          antares.addFilter(() => {
            throw new Error("whoops!")
          })
          expect(() => {
            antares.process({ type: "timebomb" })
          }).toThrowErrorMatchingSnapshot()
        })
      })

      describe("errors in async renderers", () => {
        it("should not propogate up to the caller of #process", () => {
          expect.assertions(0)
          let sub = antares.addRenderer(
            () => {
              throw new Error("Who_ops")
            },
            { name: "janky" }
          )
          antares.process(anyAction)
        })

        it("should unsubscribe the renderer", undefined)
      })
    })
  })
})

//#region Util Functions Below
const justTheAction = ({ action }: ActionStreamItem) => action
const toAction = (x: any): Action => ({ type: "wrapper", payload: x })
const nullFn = () => null
const noSpecialValue = "noSpecialValue"
const syncReturnValue = "syncReturnValue"
const observableValue = toAction("observableValue")
const asyncReturnValue = of(observableValue).pipe(delay(1))
const anyAction: Action = { type: "any" }
const consequentialAction: Action = { type: "consequntialAction" }
const logFileAppender: Subscriber = ({ action: { type, payload } }) => {
  // Most renderers care about a subset of actions. Return early if you don't care.
  if (!type.match(/^File\./)) return

  const { fileName, content } = payload
  fs.appendFileSync(fileName, content + "\n", { encoding: "UTF8" })

  // a synchronous renderer need not provide a return value
}
// wraps an it scenario and silences console messages during its test-time executions
const inSilence = itFn => {
  const callIt = done => {
    const _console = global.console
    Object.assign(global.console, { log: jest.fn(), error: jest.fn() })

    try {
      itFn(done)
    } catch (ex) {
      // tslint:disable-line
    } finally {
      global.console = _console
    }
  }

  // preserve arity in returned fn
  return itFn.length === 1 ? done => callIt(done) : () => callIt(undefined)
}

const slightDelay = [
  () => {
    const done = new Subject()
    setTimeout(() => {
      counter += 1
      done.complete()
    }, 10)
    return done.asObservable()
  },
  { name: "slightDelay" }
]
const longerDelay = [
  () => {
    const done = new Subject()
    setTimeout(() => {
      counter *= 1.1
      done.complete()
    }, 40)
    return done.asObservable()
  },
  { name: "longerDelay" }
]
//#endregion
