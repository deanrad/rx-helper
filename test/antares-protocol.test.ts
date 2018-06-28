import { default as faker } from "faker"
import fs from "fs"
import { Observable, of } from "rxjs"
import { delay, first, map, take, toArray } from "rxjs/operators"
import {
  Action,
  ActionStreamItem,
  AntaresProtocol,
  ProcessResult,
  SubscribeMode,
  Subscriber,
  reservedSubscriberNames
} from "../src/antares-protocol"

describe("AntaresProtocol", () => {
  let antares: AntaresProtocol

  beforeEach(() => {
    antares = new AntaresProtocol()
  })
  // Sanity check
  it("is instantiable", () => {
    expect(new AntaresProtocol()).toBeInstanceOf(AntaresProtocol)
  })
  it("has instance methods", () => {
    const antares = new AntaresProtocol()
    expect(antares).toMatchObject({
      process: expect.any(Function),
      addFilter: expect.any(Function),
      addRenderer: expect.any(Function)
    })
  })

  describe("#addFilter", () => {
    describe("arguments", () => {
      describe("subscriber argument", () => {
        it("will be called synchronously when an action is processed", () => {
          const spy = jest.fn()
          antares.addFilter(spy)
          expect(spy).not.toHaveBeenCalled()
          antares.process(anyAction)
          expect(spy).toHaveBeenCalled()
        })
      })
      describe("config argument", () => {
        it("should not have mode async since filters are only sync", () => {
          expect.assertions(1)
          expect(() => {
            antares.addFilter(nullFn, { mode: SubscribeMode.async })
          }).toThrow()
        })
      })
    })
  })

  describe("#addFilter or #addRenderer", () => {
    describe("arguments", () => {
      describe("subscriber argument", () => {
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

  describe("#process", () => {
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
      describe("errors in filters", () => {
        xit("should propogate up to the caller of #process", () => {
          antares.addFilter(() => {
            throw new Error("whoops!")
          })
          expect(() => {
            antares.process({ type: "timebomb" })
          }).toThrow()
        })
      })
      describe("errors in async renderers", () => {
        it("should not propogate up to the caller of #process", undefined)
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
//#endregion
