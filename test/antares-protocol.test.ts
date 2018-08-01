import { of, from, empty } from "rxjs"
import { delay, first, toArray } from "rxjs/operators"
import {
  Action,
  Agent,
  Concurrency,
  reservedSubscriberNames,
  after,
  agentConfigFilter,
  AgentConfig,
  jsonPatch,
  ajaxStreamingGet
} from "../src/antares-protocol"

// a mutable variable, reset between tests
let counter = 0

describe("Agent", () => {
  let agent: Agent

  beforeEach(() => {
    counter = 0
    agent = new Agent()
  })

  // Sanity check
  it("is instantiable", () => {
    expect(new Agent()).toBeInstanceOf(Agent)
  })

  describe("config argument", () => {
    it("should set agentId", () => {
      const agentId = 2.718 // or 'a3efcd' typically
      expect(new Agent({ agentId })).toHaveProperty("agentId", 2.718)
    })
    it("should not set properties not whitelisted", () => {
      expect(Agent.configurableProps).not.toContain("momofuku")
      expect(new Agent({ momofuku: "yes" })).not.toHaveProperty("momofuku")
    })
  })

  describe("instance properties", () => {
    it("has readonly agentId", () => {
      expect(() => {
        new Agent({ agentId: 1234 }).agentId = 4321
      }).toThrow()
    })

    describe("nextOfType", () => {
      it("should be a promise for the first action matching the type", () => {
        expect.assertions(1)
        const agent = new Agent()
        const { nextOfType } = agent
        const seenIt = nextOfType("test/foo")

        // fails without calling process
        const matcher = { type: "test/foo" }
        agent.process(matcher)

        return seenIt.then(matchingAction => {
          expect(matchingAction).toMatchObject(matcher)
        })
      })
    })

    describe("allOfType", () => {
      it("should be an Observable of matching actions", () => {
        const agent = new Agent()
        const { allOfType } = agent
        let counter = 0
        allOfType("test/foo").subscribe(() => counter++)

        agent.process({ type: "test/foo" })
        agent.process({ type: "notCaught" })
        agent.process({ type: "test/foo" })

        expect(counter).toEqual(2)
      })
    })
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
          agent.addFilter(spy)
          expect(spy).not.toHaveBeenCalled()
          agent.process(anyAction)
          expect(spy).toHaveBeenCalled()
        })
      })
    })
  })

  describe("#addFilter or #addRenderer", () => {
    describe("arguments", () => {
      describe("function argument", () => {
        it("should be a function", () => {
          agent.addFilter(nullFn)
        })
      })

      describe("config argument", () => {
        describe("name", () => {
          it("will be filter_N if not given for a filter", () => {
            expect(agent.filterNames).not.toContain("filter_1")
            agent.addFilter(() => 3.141)
            expect(agent.filterNames).toContain("filter_1")
          })

          it("will be renderer_N if not given for a renderer", () => {
            expect(agent.rendererNames).not.toContain("renderer_1")
            agent.addRenderer(() => 3.141)
            expect(agent.rendererNames).toContain("renderer_1")
          })

          it("cannot be a reserved name", () => {
            expect.assertions(reservedSubscriberNames.length)
            reservedSubscriberNames.forEach(badName => {
              expect(() => {
                agent.addFilter(nullFn, { name: badName })
              }).toThrow()
            })
          })
        })
      })
      describe("return value", () => {
        it("is a subscription", () => {
          let callCount = 0
          const subscription = agent.addFilter(() => callCount++)
          const result = agent.process(anyAction)
          expect(callCount).toEqual(1)
          subscription.unsubscribe()
          agent.process(anyAction)
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
          it("should run in series mode", () => {
            expect.assertions(2)
            // This renderer takes 10msec to complete, and adds increment to counter
            agent.addRenderer(() => after(10, () => (counter += 1)), {
              concurrency: Concurrency.serial,
              name: "inc"
            })

            let result1 = agent.process(anyAction)
            let result2 = agent.process(anyAction)
            return result1.completed
              .then(() => {
                expect(counter).toEqual(1)
              })
              .then(() => result2.completed)
              .then(() => {
                expect(counter).toEqual(2)
              })
          })

          it("should run in cutoff mode", () => {
            let increment = 0
            // each action raises the increment
            agent.addFilter(() => ++increment)

            // This renderer takes time to complete, and adds increment to counter
            agent.addRenderer(() => after(40, () => (counter += increment)), {
              concurrency: Concurrency.cutoff
            })

            // If we process 2 actions fast enough, we should cutoff the first
            let result = agent.process(anyAction) // filter makes increment 1
            result = agent.process(anyAction) // filter makes increment 2

            return result.completed.then(() => {
              expect(counter).toEqual(0 + 2)
            })
          })

          it("should run in mute mode", () => {
            let increment = 0
            // each action raises the increment
            agent.addFilter(() => ++increment)

            // This renderer takes time to complete, and adds increment to counter
            agent.addRenderer(() => after(40, () => (counter += increment)), {
              concurrency: Concurrency.mute
            })

            // If we process 2 actions fast enough, we should cutoff the first
            let result1 = agent.process(anyAction) // filter makes increment 1

            return result1.completed.then(() => {
              expect(counter).toEqual(0 + 1)
            })
          })
        })
        describe("processResults", () => {
          it("should enable returned actions from renderer to go through antares.process", () => {
            expect.assertions(1)
            agent.addRenderer(
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
            agent.process({ type: "addOne" })
            return new Promise(resolve => {
              setTimeout(() => {
                expect(counter).toEqual(3)
                resolve()
              }, 20)
            })
          })
        })
        describe("validation", () => {
          it("should not accept xform and actionType argument", undefined)
        })
        describe("xform", () => {
          it("accepts a function that modifies the Action Stream", undefined)
        })
        describe("actionType", () => {
          it("should only run the render on matching actions (string)", () => {
            expect.assertions(1)
            agent.addRenderer(() => of(++counter), { name: "inc", actionsOfType: "Counter.inc" })
            let result1 = agent.process(anyAction)
            let result2 = agent.process({ type: "Counter.inc" }).completed.inc

            return result2.then(() => {
              expect(counter).toEqual(1)
            })
          })
          it("should only run the action render on matching actions (Regexp)", () => {
            expect.assertions(1)
            agent.addRenderer(() => of(++counter), { name: "inc", actionsOfType: /^Counter\./ })
            let result1 = agent.process(anyAction)
            let result2 = agent.process({ type: "Counter.inc" }).completed.inc

            return result2.then(() => {
              expect(counter).toEqual(1)
            })
          })
          it("should only run the action render on matching actions (Function)", () => {
            expect.assertions(1)
            agent.addRenderer(() => of(++counter), {
              name: "inc",
              actionsOfType: ({ action: { type } }) => type.startsWith("Counter")
            })
            let result1 = agent.process(anyAction)
            let result2 = agent.process({ type: "Counter.inc" }).completed.inc

            return result2.then(() => {
              expect(counter).toEqual(1)
            })
          })
        })
      })
    })
    describe("error handling", () => {
      it("should set the renderResult to be in error", undefined)
      it("should unsubscribe the offending renderer", undefined)
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
          agent.process(anyAction)
        })
      })
      describe("context", () => {
        it("can be any object to be available to renderers", undefined)
      })
    })

    describe("return value", () => {
      it("should be a superset of the action", () => {
        expect.assertions(1)
        const result = agent.process(anyAction)
        expect(result).toMatchObject(anyAction)
      })

      it("should have a field for each filter", () => {
        expect.assertions(8)

        const firstRetVal = 1
        const secondRetVal = "abc123"
        agent.addFilter(() => firstRetVal)
        agent.addFilter(() => secondRetVal, { name: "_id" })

        const result = agent.process(anyAction)

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
        agent.addFilter(() => retVal)
        const serailizedResult = JSON.stringify(agent.process(anyAction))
        expect(serailizedResult).not.toContain(retVal)
      })

      describe("#completed: (all triggered renderers are done)", () => {
        it("is a Promise for all async renderers' results to have completed", () => {
          agent.addRenderer(() => of("🐌").pipe(delay(100)), {
            name: "snail",
            concurrency: Concurrency.serial
          })
          agent.addRenderer(() => of("⚡").pipe(delay(20)), {
            name: "quickie"
          })

          return agent.process(anyAction).completed
        })

        it("can get a promise for a renderers final value via completed.rendererName", () => {
          expect.assertions(4)

          // This 'renderer' returns an Observable which yields 3.14 after 20msec
          agent.addRenderer(() => of(2.71828, 3.14).pipe(delay(20)), { name: "thing1" })

          // Renderer can return simple object
          agent.addRenderer(() => 7, { name: "thing2" })

          // Can return null or undefined
          agent.addRenderer(() => null, { name: "nully" })

          // Renderer returns an array
          agent.addRenderer(() => ["---", "=--", "==-", "==="], { name: "progressBars" })

          const result = agent.process(anyAction)
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
          const result = agent.process(anyAction)
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
        const assertion = agent.action$
          .pipe(first())
          .toPromise()
          .then(asi => {
            expect(asi.action).toEqual(anyAction)
          })

        // Then process an action
        agent.process(anyAction)

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

        agent.addFilter(incrementer, { name: "inc" })
        agent.addFilter(doubler, { name: "double" })

        let result = agent.process(anyAction)
        const { double, inc } = result
        expect({ double, inc }).toMatchSnapshot()
      })

      describe("errors in filters", () => {
        it("should propogate up to the caller of #process", () => {
          agent.addFilter(() => {
            throw new Error("whoops!")
          })
          expect(() => {
            agent.process({ type: "timebomb" })
          }).toThrowErrorMatchingSnapshot()
        })
      })

      describe("errors in async renderers", () => {
        it("should not propogate up to the caller of #process, but surface somewhere", undefined)
        it("should unsubscribe the renderer", undefined)
      })
    })
  })
})

describe("Utilities", () => {
  describe("after", () => {
    it("should schedule the execution of a function later", () => {
      expect.assertions(1)

      let counter = 0
      // prettier-ignore
      const result = after(1, () => {
        return ++counter
      }).toPromise().then(() => expect(counter).toEqual(1))

      return result
    })

    describe("second argument", () => {
      it("if a function, should create an Observable of its return value", () => {
        expect.assertions(1)
        const result = after(1, () => 1.11)
        return result.toPromise().then(value => {
          expect(value).toEqual(1.11)
        })
      })
      it("if a value, should create an Observable of the value", () => {
        expect.assertions(1)
        const result = after(1, 1.987)
        return result.toPromise().then(value => {
          expect(value).toEqual(1.987)
        })
      })
    })
  })

  describe("agentConfigFilter", () => {
    it("should return a filter that adds agentConfig properties to an actions meta", () => {
      const config: AgentConfig = { agentId: 12345 }
      const agent = new Agent(config)
      const filter = agentConfigFilter(agent)
      agent.addFilter(filter)

      const action = { type: "gotmeta" }
      agent.process(action)
      expect(action).toMatchObject(action)
      // @ts-ignore // yep, filters may mutate their actions
      expect(action.meta.agentId).toEqual(12345)
      // @ts-ignore // again, filters may mutate their actions. Write it, Bart
      expect(action.meta).toMatchObject(config)
    })
  })

  describe("ajaxStreamingGet (test requires https://jsonplaceholder.typicode.com)", () => {
    it("should create an observable of many from an array ajax response", () => {
      expect.assertions(1)
      const user$ = ajaxStreamingGet({
        url: "https://jsonplaceholder.typicode.com/users/"
      }).pipe(toArray())
      return user$.toPromise().then(userArray => {
        expect(userArray).toHaveLength(10)
      })
    })
    it("should create an observable of one from a singular-object ajax response", () => {
      expect.assertions(1)
      const user$ = ajaxStreamingGet({
        url: "https://jsonplaceholder.typicode.com/users/1"
      })
      return user$.toPromise().then(user => {
        expect(user).toHaveProperty("username")
      })
    })
  })
  describe("jsonPatch operator", () => {
    it("should turn a stream of objects into a stream of RFC6902 patches", async () => {
      let sources = [
        { name: { first: "Albert" } },
        { name: { first: "Albert" } },
        { name: { first: "Albert", last: "Einstein" } },
        { name: "Banana" },
        { name: "Banana" }
      ]
      let result = await from(sources)
        .pipe(
          jsonPatch(),
          toArray()
        )
        .toPromise()
      expect(result).toHaveLength(3)
      expect(result).toMatchSnapshot()
    })
    it("does not swallow errors", undefined)
  })
})

//#region Util Functions Below
const nullFn = () => null
const anyAction: Action = { type: "any" }

//#endregion
