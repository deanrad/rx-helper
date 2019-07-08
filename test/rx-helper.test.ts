/* tslint:disable  */
import { Observable, Subscription, of, from, empty, timer, throwError, concat } from "rxjs"
import { map, first, toArray, scan, tap } from "rxjs/operators"
import {
  Action,
  Agent,
  Concurrency,
  Subscriber,
  reservedSubscriberNames,
  after,
  agentConfigFilter,
  AgentConfig,
  toProps,
  ajaxStreamingGet,
  randomId
} from "../src/rx-helper"

let seen: Array<Action> = []
let callCount = 0
let blowupCount = 0
let counter = 0

// Synchronously uppdates our resettable counter.
// Returns immediately completed observable
const callCounter: Subscriber = ({ action }) => {
  ++callCount
  return empty()
}

// Returns next-callstack completed observable
const deferredCallCounter: Subscriber = ({ action }) => {
  return new Observable(notify => {
    setTimeout(() => {
      callCount++
      // The combo of next and complete will cause the Promise for its
      // completion to resolve/await to the callCount
      notify.next(callCount)
      notify.complete()
    }, 0)
  })
}

// @ts-ignore
const delayedCall = (msec: number) => ({ action: Action }) => {
  callCount++
  return timer(msec).pipe(map(() => callCount))
}

const peekOnly = () => {
  return of(callCount)
}

const seenFilter: Subscriber = ({ action }) => {
  seen.push(action)
  return action
}

// Updates our resettable array, and returns the action just seen
const seenAdder: Subscriber = ({ action }) => {
  seen.push(action)
  return of(action)
}

// Dies in a fire upon invocation, to test error handling
const blowUpOnRender: Subscriber = ({ action }) => {
  blowupCount++
  throw new Error("Expected Error - wont fail the suite")
}

// Dies in a fire upon subscription
const blowUpOnSubscribe: Subscriber = ({ action }) =>
  new Observable(notify => {
    blowupCount++
    throw "Recipe threw when subscribed"
  })

const returnsObsErr: Subscriber = ({ action }) => throwError("Notified of Error")

const handleError = (obj: Promise<any>, field: any, handler: Function) => {
  // obj.catch(handler)
  // @ts-ignore
  obj[field] && obj[field].catch(handler)
}

describe("Agent", () => {
  let agent: Agent

  beforeEach(() => {
    agent = new Agent()
    seen = []
    counter = 0
    callCount = 0
    blowupCount = 0
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

    describe("nextActionOfType", () => {
      it("should be a promise for the first action matching the type", () => {
        expect.assertions(1)
        const agent = new Agent()
        const seenIt = agent.nextActionOfType("test/foo")

        // fails without calling process
        const matcher = { type: "test/foo" }
        agent.process(matcher)

        return seenIt.then(matchingAction => {
          expect(matchingAction).toMatchObject(matcher)
        })
      })
    })

    describe("actionsOfType", () => {
      it("should be an Observable of matching actions", () => {
        const agent = new Agent()
        let counter = 0
        agent.actionsOfType("test/foo").subscribe(() => counter++)

        agent.process({ type: "test/foo" })
        agent.process({ type: "notCaught" })
        agent.process({ type: "test/foo" })

        expect(counter).toEqual(2)
      })

      it("should be able to replace Redux with a single line", () => {
        expect.assertions(1)
        let state = []
        // define an aggregator function which appends to an array (same signature as reducer)
        const builder = (state, action) => {
          return [...state, action.payload]
        }

        // set it up to scan over the action stream, storing payloads
        agent
          .actionsOfType(() => true)
          .pipe(
            scan(builder, []),
            tap(newState => {
              state = newState
            })
          )
          .subscribe()

        // assert that the aggregation got the payloads
        agent.process({ type: "foo", payload: 1.1 })
        return agent.process({ type: "foo", payload: 1.2 }).completed.then(() => {
          expect(state).toEqual([1.1, 1.2])
        })
      })
    })
  })

  it("has instance methods", () => {
    const agent = new Agent()
    expect(agent).toMatchObject({
      process: expect.any(Function),
      on: expect.any(Function),
      filter: expect.any(Function),
      subscribe: expect.any(Function),
      addFilter: expect.any(Function),
      addRenderer: expect.any(Function)
    })
  })

  describe("#filter", () => {
    it("should alias addFilter, reversing arguments", () => {
      let counter = 0
      agent.filter("foo", () => counter++)
      agent.process({ type: "foo" })
      agent.process({ type: "not" })
      expect(counter).toEqual(1)
    })
  })

  describe("#on", () => {
    it("should alias addRenderer", () => {
      expect.assertions(3)
      const seenTypes = []
      agent.on(/foo/, ({ action: { type } }) => {
        seenTypes.push(type)
        return empty() // An Observable which completes, so we know it's completed
      })

      return agent
        .process({ type: "foolz" })
        .completed.then(() => {
          return agent.process({ type: "fool2" }).completed
        })
        .then(() => {
          expect(seenTypes).toHaveLength(2)
          expect(seenTypes).toContain("foolz")
          expect(seenTypes).toContain("fool2")
        })
    })
  })

  describe("#addFilter or #addRenderer", () => {
    describe("arguments", () => {
      describe("function argument", () => {
        it("should be a function", () => {
          agent.filter(() => true, nullFn)
        })
      })

      describe("config argument", () => {
        describe("name", () => {
          it("will be filter_N if not given for a filter", () => {
            expect(agent.filterNames()).not.toContain("filter_1")
            agent.filter(() => true, () => 3.141)
            expect(agent.filterNames()).toContain("filter_1")
          })

          it("will be the actionType filter if given", () => {
            expect(agent.rendererNames()).not.toContain("autonamer")
            agent.on("autonamer", () => null)
            expect(agent.rendererNames()).toContain("autonamer")

            expect(agent.filterNames()).not.toContain("autonamer")
            agent.filter("autonamer", () => null)
            expect(agent.filterNames()).toContain("autonamer")
          })

          it("will be renderer_N if not given for a renderer", () => {
            expect(agent.rendererNames()).not.toContain("renderer_1")
            agent.addRenderer(() => 3.141)
            expect(agent.rendererNames()).toContain("renderer_1")
          })

          it("will assign new name for existing renderer", () => {
            expect(agent.rendererNames()).not.toContain("foo")
            expect(agent.rendererNames()).not.toContain("foo_1")
            agent.on("foo", () => 3.141)
            agent.on("foo", () => 2.718)
            expect(agent.rendererNames()).toContain("foo")
            expect(agent.rendererNames()).toContain("foo_1")
          })

          it("cannot be a reserved name", () => {
            expect.assertions(reservedSubscriberNames.length)
            reservedSubscriberNames.forEach(badName => {
              expect(() => {
                agent.filter(() => true, nullFn, { name: badName })
              }).toThrow()
            })
          })

          it("can use a string from actionsOfType", () => {
            // no autonumbering occurs for the first one of a string ActionFilter
            // successive ones get numbers appended eg helloEcho_1
            agent.filter("helloEcho", () => "echo 1")
            agent.filter("helloEcho", () => "echo 2")

            // run through both filters
            const result = agent.process({ type: "helloEcho" })

            expect(result.helloEcho).toEqual("echo 1")
            expect(result["helloEcho_1"]).toEqual("echo 2")
          })
        })
        describe("type", async () => {
          it("will wrap the renderers return Observable in FSAs of this type if provided", () => {
            expect.assertions(1)
            const seenNums = []
            agent.filter("num", ({ action: { payload } }) => seenNums.push(payload))
            agent.on("start", () => from([1, 2, 3]), { type: "num" })
            agent.on("start", () => from([7, 8, 9]), { name: "notseen" })

            const result = agent.process({ type: "start" })
            return result.completed.then(() => {
              expect(seenNums).toEqual([1, 2, 3])
            })
          })
        })
      })
      describe("return value", () => {
        it("is a subscription", () => {
          let callCount = 0
          const subscription = agent.filter(() => true, () => callCount++)
          const result = agent.process(anyAction)
          expect(callCount).toEqual(1)
          subscription.unsubscribe()
          agent.process(anyAction)
          expect(callCount).toEqual(1)
        })
      })
    })
  })

  describe("#addFilter", () => {
    describe("arguments", () => {
      describe("function argument", () => {
        it("will be called synchronously when an action is processed", () => {
          const spy = jest.fn()
          agent.filter(() => true, spy)
          expect(spy).not.toHaveBeenCalled()
          agent.process(anyAction)
          expect(spy).toHaveBeenCalled()
        })
      })
    })
  })

  describe("#addRenderer", () => {
    describe("arguments", () => {
      describe("first argument", () => {
        it.skip("should return an Observable", () => {})
        it.skip("may return null or an object to be cast to Observable", () => {})
      })

      describe("config argument", () => {
        describe("processResults", () => {
          it("should enable returned actions from renderer to go through agent.process", () => {
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
        describe("type", () => {
          it.skip("should embed the output payloads in actions of that type", () => {})
        })
        describe("withContext", () => {
          it("should allow context to be passed along", done => {
            expect.assertions(1)

            const ctx = { i: 1 }
            agent.on(
              "add",
              ({ action }) => {
                // agent.process({ type: "times", payload: 2.1 }, ctx)
                return of({ type: "times", payload: 2.1 })
              },
              { processResults: true, withContext: true }
            )

            agent.on("times", ({ action, context }) => {
              expect(context).toEqual(ctx)
              done()
            })

            agent.process({ type: "add", payload: -0.5 }, ctx)
          })
        })
        describe("validation", () => {
          it.skip("should not allow bad configs", () => {})
        })
        describe("actionsOfType", () => {
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

        describe("result mappers", () => {
          it("providing type should wrap the renderer's Observable output as payloads", () => {
            expect.assertions(1)
            let seenActions = []
            agent = new Agent()
            // filter to remember
            agent.filter(() => true, ({ action }) => (seenActions = [...seenActions, action]))
            // renderer to wrap

            agent.on("wrap", () => of(2.1), { type: "mapped" }) // implies processResults: true

            return agent.process({ type: "wrap" }).completed.then(() => {
              expect(seenActions).toContainEqual({ type: "mapped", payload: 2.1 })
            })
          })
        })
      })
    })
    describe("error handling", () => {
      it.skip("should set the renderResult to be in error", () => {})
      it.skip("should unsubscribe the offending renderer", () => {})
    })
  })

  describe("#process", () => {
    describe("First argument", () => {
      it("Should be a Flux Standard Action", () => {
        expect.assertions(0)
        agent.process(anyAction)
      })
    })
    describe("Second argument", () => {
      it("May be an object ", done => {
        expect.assertions(1)
        const contextObj = { foo: "bar" } // an object such as an express request, which a renderer may do work upon
        agent.on(
          () => true,
          ({ context }) => {
            expect(context).toBe(contextObj)
            done()
          }
        )
        agent.process(anyAction, contextObj)
      })
    })

    describe("Return Value", () => {
      it("Has the properties of the action", () => {
        const result = agent.process(anyAction)
        expect(result).toMatchObject(anyAction)
      })
      it("Has each filters result under its name", () => {
        agent.filter(() => true, seenFilter, { name: "seen" })
        const results = agent.process(anyAction)
        expect(results.seen).toMatchObject(anyAction)
      })
      it("Has render results as properties under #completed", async () => {
        // Run on every action
        agent.on(() => true, peekOnly, { name: "peek" })
        agent.on(() => true, ({ action }) => action, { name: "seen" })
        agent.on(() => true, deferredCallCounter, { name: "later" })
        agent.on(() => true, delayedCall(100), { name: "molater" })
        agent.on(() => true, () => Promise.resolve(5), { name: "promise" })
        agent.on(() => true, () => "the0ry", { name: "string" })
        agent.on(() => true, () => 2.71828, { name: "num" })
        agent.on(() => true, () => [3, 1, "2!"], { name: "ary" })
        agent.on(() => false, () => of(undefined), { name: "notrun" })

        const anyAction = { type: "oOo" }
        // Call #process. Result Duck types the action
        const result = agent.process(anyAction)
        expect(result).toMatchObject(anyAction)

        // Duck types a Promise for all renderer's completion
        expect(result.completed).toHaveProperty("then")
        expect(result.completed).toHaveProperty("catch")

        // All results accessible via await result.completed
        let completedResult = await result.completed

        // the successful ones
        expect(completedResult).toMatchObject({
          peek: 0,
          seen: anyAction,
          later: 2,
          molater: 2, // same binding
          promise: 5,
          string: "the0ry",
          num: 2.71828,
          ary: [3, 1, "2!"]
        })

        // the unrun ones
        expect(completedResult).toHaveProperty("notrun", undefined)
        // TODO and the unsuccessful ones

        // The individual ones exist as Promises too
        expect(result.completed.num).toHaveProperty("then")
        expect(result.completed.promise).toHaveProperty("then")
        expect(await result.completed.promise).toEqual(5)

        // Safe to ask/await multiple times
        expect(result.completed.later).toBe(result.completed.later)
        expect(await result.completed.later).toEqual(2)

        // didn't change
        expect(await result.completed.later).toEqual(2)
      })
      it("Does not cause rerenders when accessing #completed multiple times", () => {
        expect.assertions(3)

        let timesCalled = 0
        agent.on("inc", () =>
          after(0, () => {
            ++timesCalled
          })
        )
        const result = agent.process({ type: "inc" })

        // expect same object is returned each time property is referenced
        expect(result.completed === result.completed).toBeTruthy()

        return result.completed.then(() => {
          return result.completed
            .then(() => {
              expect(timesCalled).toEqual(1)
            })
            .then(() => {
              // LEFTOFF this nested call to .inc reruns the renderer
              return result.completed.inc.then(() => {
                expect(timesCalled).toEqual(1)
              })
            })
        })
      })
    })

    describe("Behavior", () => {
      describe("Filters", () => {
        it("Will raise exceptions synchronously (without unsubscribing)", () => {
          agent.filter(() => true, blowUpOnRender)
          expect(() => {
            agent.process(anyAction)
          }).toThrow()
          expect(() => {
            agent.process(anyAction)
          }).toThrow()
        })
        it("may return values", () => {
          agent.filter(() => true, seenFilter, { name: "seen" })
          const results = agent.process(anyAction)
          expect(results.seen).toMatchObject(anyAction)
        })
        it.skip("Will be run in order of their addition", () => {})
        it.skip("Will not be awaited if they return a promise", () => {})
        it.skip("May modify the actions", () => {})
      })
      describe("Renderers", () => {
        let goodSub1: Subscription
        let goodSub2: Subscription
        let badSubRender: Subscription

        beforeEach(() => {
          agent.filter(() => true, seenAdder, { name: "seenAdder" })
          goodSub1 = agent.on(() => true, () => 3.14159, { name: "pi" })
          goodSub2 = agent.on(() => true, () => after(0, () => 2.71828), { name: "e" })
        })

        describe("Errors: Render/Subscribe-time", () => {
          it("Errors appear as rejected completed properties, not synchronously", () => {
            badSubRender = agent.on(() => true, blowUpOnRender, { name: "blowUpOnRender" })

            const result = agent.process(anyAction)

            // Available on the Promises
            expect(result.completed.blowUpOnRender).rejects.toEqual(
              new Error("Expected Error - wont fail the suite")
            )
            expect(result.completed).rejects.toEqual(
              new Error("Expected Error - wont fail the suite")
            )

            // Prevents unhandled rejection error on completed and completed.blowUpOnRender
            handleError(result.completed, "blowUpOnRender", () => {})

            // Doesn't prevent filters from running
            expect(seen).toContain(anyAction)
            // Doesn't prevent renderers added before or after
            expect(result.completed.pi).resolves.toEqual(3.14159)
            expect(result.completed.e).resolves.toEqual(2.71828)
          })

          it("Will unsubscribe the renderer, processing no more actions through it", () => {
            badSubRender = agent.on(() => true, blowUpOnRender, { name: "blowUpOnRender" })

            const result = agent.process(anyAction)
            expect(result.completed.blowUpOnRender).rejects.toEqual(
              new Error("Expected Error - wont fail the suite")
            )
            expect(result.completed).rejects.toEqual(
              new Error("Expected Error - wont fail the suite")
            )

            // Prevents unhandled rejection error on completed and completed.blowUpOnRender
            handleError(result.completed, "blowUpOnRender", () => {})

            expect(goodSub1).toHaveProperty("closed", false)
            expect(goodSub2).toHaveProperty("closed", false)
            expect(badSubRender).toHaveProperty("closed", true)

            // no sign of renderer - next action will work
            expect(agent.process(anyAction).completed).resolves.toEqual({ e: 2.71828, pi: 3.14159 })
          })
        })

        describe("Errors: Returning an erroring Observable", () => {
          it("Should return a rejected Promise, but keep the subscription", () => {
            const sub = agent.on(() => true, returnsObsErr, { name: "returnsObsErr" })

            const result = agent.process(anyAction)
            expect(result.completed).rejects.toEqual("Notified of Error")
            expect(sub).toHaveProperty("closed", false)
            expect(agent.process(anyAction).completed).rejects.toEqual("Notified of Error")
          })
        })

        describe("Return Value", () => {
          it("Should return an Observable", () => {})
          it("Will be handled if it throws an exception", () => {})
          it("Can return a Promise", () => {})
          it("Can return a single value - string", () => {})
          it("Will send results back through the agent if processResults: true", async () => {
            agent.on("sound", ({ action }) => ({ type: "echo", payload: action.payload }), {
              processResults: true
            })

            const result = agent.process({ type: "sound", payload: "Hello" })
            await result.completed
            expect(seen.map(a => a.type)).toEqual(["sound", "echo"])
          })
          it("Will send results back through the agent if type given a value", async () => {
            agent.on("sound", ({ action }) => of(action.payload), {
              type: "echo"
            })

            const result = agent.process({ type: "sound", payload: "Hello" })
            await result.completed
            expect(seen.map(a => a.type)).toEqual(["sound", "echo"])
          })
        })

        describe("Concurrency Modes", () => {
          const concurTester: Subscriber = ({ action }) =>
            concat(
              // a sync result (will never be cutoff)
              of(`now: ${action.payload}`),
              // a next-stack result
              after(0, `start: ${action.payload}`),
              // a delayed result
              after(20, `end: ${action.payload}`)
            )

          describe("Parallel", () => {
            it("Should start renderings up asap", async () => {
              agent.on("concur", concurTester, {
                type: "result",
                concurrency: Concurrency.parallel
              })

              agent.process({ type: "concur", payload: 1 })
              agent.process({ type: "concur", payload: 2 })

              await after(50, null).toPromise()
              expect(seen.map(a => a.payload)).toEqual([
                1,
                "now: 1",
                2,
                "now: 2",
                "start: 1",
                "start: 2",
                "end: 1",
                "end: 2"
              ])
            })
          })
          describe("Serial", () => {
            it("Should enqueue renderings", async () => {
              agent.on("concur", concurTester, {
                type: "result",
                concurrency: Concurrency.serial
              })

              agent.process({ type: "concur", payload: 1 })
              agent.process({ type: "concur", payload: 2 })
              agent.process({ type: "concur", payload: 3 })

              await after(90, null).toPromise()
              expect(seen.map(a => a.payload)).toEqual([
                1,
                "now: 1",
                2,
                3,
                "start: 1",
                "end: 1",
                "now: 2",
                "start: 2",
                "end: 2",
                "now: 3",
                "start: 3",
                "end: 3"
              ])
            })
          })
          describe("Mute", () => {
            it("Should prevent concurrent renderings", async () => {
              agent.on("concur", concurTester, {
                type: "result",
                concurrency: Concurrency.mute
              })

              agent.process({ type: "concur", payload: 1 })
              agent.process({ type: "concur", payload: 2 })

              await after(50, null).toPromise()
              expect(seen.map(a => a.payload)).toEqual([1, "now: 1", 2, "start: 1", "end: 1"])
            })
          })
          describe("Cutoff", () => {
            it("Should kill old renderings", async () => {
              agent.on("concur", concurTester, {
                type: "result",
                concurrency: Concurrency.cutoff
              })

              agent.process({ type: "concur", payload: 1 })
              agent.process({ type: "concur", payload: 2 })
              after(10, () => {
                agent.process({ type: "concur", payload: 3 })
              }).subscribe()

              await after(50, null).toPromise()

              expect(seen.map(a => a.payload)).toEqual([
                1,
                "now: 1",
                2,
                "now: 2",
                "start: 2",
                3,
                "now: 3",
                "start: 3",
                "end: 3"
              ])
            })
            it("Will call the onCutoff argument", async () => {
              agent.on("concur", concurTester, {
                type: "result",
                concurrency: Concurrency.cutoff,
                onCutoff: ({ action }) =>
                  agent.process({ type: "canceled", payload: `cutoff: ${action.payload}` })
              })

              agent.process({ type: "concur", payload: 1 })
              agent.process({ type: "concur", payload: 2 })
              after(10, () => {
                agent.process({ type: "concur", payload: 3 })
              }).subscribe()

              await after(50, null).toPromise()

              expect(seen.map(a => a.payload)).toEqual([
                1,
                "now: 1",
                2,
                "cutoff: 1",
                "now: 2",
                "start: 2",
                3,
                "cutoff: 2",
                "now: 3",
                "start: 3",
                "end: 3"
                // when we add a teardown, it gets called even if run to completion
                // so we get a cutoff: 3 even though 3 ended normally
              ])
            })
          })
        })
      })
    })

    describe("behavior", () => {
      it("should emit the action on the actionsOfType Observable", () => {
        expect.assertions(1)

        // Build up our assertion
        const assertion = agent
          .actionsOfType(() => true)
          .pipe(first())
          .toPromise()
          .then(action => {
            expect(action).toEqual(anyAction)
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

        agent.filter(() => true, incrementer, { name: "inc" })
        agent.filter(() => true, doubler, { name: "double" })

        let result = agent.process(anyAction)
        const { double, inc } = result
        expect({ double, inc }).toMatchSnapshot()
      })

      describe("errors in filters", () => {
        it("should propogate up to the caller of #process", () => {
          agent.filter(
            () => true,
            () => {
              throw new Error("whoops!")
            }
          )
          expect(() => {
            agent.process({ type: "timebomb" })
          }).toThrowErrorMatchingSnapshot()
        })
      })

      describe("errors in async renderers", () => {
        it.skip("should not propogate up to the caller of #process, but surface somewhere", () => {})
        it.skip("should unsubscribe the renderer", () => {})
      })
    })
  })

  describe("#subscribe", () => {
    describe("First argument <Observable>", () => {
      it("should call process for each in the observable", () => {
        agent.filter(() => true, seenFilter)
        const o = from([{ type: "A" }, { type: "B" }])
        agent.subscribe(o)
        expect(seen).toEqual([{ type: "A" }, { type: "B" }])
      })
    })
    describe("Second argument <Config>", () => {
      describe("#type", () => {
        it("should wrap observed items in actions", () => {
          agent.filter(() => true, seenFilter)
          const o = from(["A", "B"])
          agent.subscribe(o, {
            type: "category"
          })
          expect(seen).toEqual([
            { type: "category", payload: "A" },
            { type: "category", payload: "B" }
          ])
        })
        it("should allow a string shorthand", () => {
          agent.filter(() => true, seenFilter)
          const o = from(["A", "B"])
          agent.subscribe(o, "coolAction")
          expect(seen).toEqual([
            { type: "coolAction", payload: "A" },
            { type: "coolAction", payload: "B" }
          ])
        })
      })
      describe("#context", () => {
        it("should be passed along to all calls to #process", () => {
          const contextualRenderings = []
          const o = from([{ type: "A" }, { type: "B" }])
          agent.on(
            () => true,
            ({ action, context }) =>
              contextualRenderings.push({ type: action.type, payload: context })
          )
          agent.subscribe(o, {
            context: { client: 123 }
          })
          expect(contextualRenderings).toEqual([
            { payload: { client: 123 }, type: "A" },
            { payload: { client: 123 }, type: "B" }
          ])
        })
      })
    })
  })

  describe("#reset", () => {
    it("should remove all filters and renderers", () => {
      let i = 0
      agent.on(/.*/, () => i++)
      agent.process(anyAction)
      expect(i).toEqual(1)
      agent.filter(/.*/, () => {
        if (i === 1) throw new Error("woops")
      })
      agent.reset()
      agent.process(anyAction)
      expect(i).toEqual(1)
    })
  })
})

describe("Utilities", () => {
  describe("after", () => {
    let c = 0
    // a function incrementing c
    const incrementVar = () => {
      return ++c
    }

    describe("First argument", () => {
      it("should be the delay in msec", () => {})
    })
    describe("Second argument", () => {
      describe("If an object", () => {
        it("Becomes the value of the Observable", async () => {
          const result = await after(1, () => 2.718).toPromise()
          expect(result).toEqual(2.718)
        })
      })
      describe("If a function", () => {
        it("should schedule its execution later", async () => {
          expect.assertions(1)

          let counter = 0
          await after(1, () => counter++).toPromise()
          expect(counter).toEqual(1)
        })
        describe("Optional name argument", () => {
          it("Should be passed to the 2nd argument", async () => {
            const namer = name => `Got ${name}`
            const result1 = await after(1, namer, "foo").toPromise()
            const result2 = await after(1, namer, "boo").toPromise()
            expect(result1).toEqual("Got foo")
            expect(result2).toEqual("Got boo")
          })
        })
      })
    })
    describe("Behavior", () => {
      it("Does nothing unless subscribed to", async () => {
        let o = after(1, incrementVar)

        // didnt call subscribe or toPromise
        await timer(10).toPromise()
        expect(c).toEqual(0)
      })
    })
  })

  describe("agentConfigFilter", () => {
    it("should return a filter that adds agentConfig properties to an actions meta", () => {
      const config: AgentConfig = { agentId: 12345 }
      const agent = new Agent(config)
      const filter = agentConfigFilter(agent)
      agent.filter(() => true, filter)

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
      jest.setTimeout(10000)
      expect.assertions(1)
      const user$ = ajaxStreamingGet({
        url: "https://jsonplaceholder.typicode.com/users/"
      }).pipe(toArray())
      return user$.toPromise().then(userArray => {
        expect(userArray).toHaveLength(10)
      })
    })
    it("should create an observable of one from a singular-object ajax response", () => {
      jest.setTimeout(10000)
      expect.assertions(1)
      const user$ = ajaxStreamingGet({
        url: "https://jsonplaceholder.typicode.com/users/1"
      })
      return user$.toPromise().then(user => {
        expect(user).toHaveProperty("username")
      })
    })

    describe("expandKey", () => {
      afterEach(() => {
        // @ts-ignore
        global.oboe = null
      })
      describe("oboe", () => {
        it("should expand an array at a given key: items", () => {
          expect.assertions(1)
          // @ts-ignore
          global.oboe = require("oboe")

          const volume$ = ajaxStreamingGet({
            url: "https://www.googleapis.com/books/v1/volumes?q=quilting",
            lib: "oboe",
            expandKey: "items" // or '!items', or 'items[*]'
          })

          return volume$
            .pipe(toArray())
            .toPromise()
            .then(volumes => {
              expect(volumes.length).toEqual(10)
            })
        })
        it("should find a singular item at a given key: items[0].title", () => {
          expect.assertions(1)
          // @ts-ignore
          global.oboe = require("oboe")

          const title$ = ajaxStreamingGet({
            url: "https://www.googleapis.com/books/v1/volumes?q=quilting",
            lib: "oboe",
            expandKey: "items[0].volumeInfo.title"
          })

          return title$.toPromise().then(t => {
            expect(t).toMatch(/quilt/i)
          })
        })
      })
      describe("rxjs", () => {
        it("should expand an array at a given key: items", () => {
          expect.assertions(1)

          const volume$ = ajaxStreamingGet({
            url: "https://www.googleapis.com/books/v1/volumes?q=quilting",
            lib: "rxjs",
            expandKey: "items"
          })

          return volume$
            .pipe(toArray())
            .toPromise()
            .then(volumes => {
              expect(volumes.length).toEqual(10)
            })
        })
      })
    })
  })

  describe("toProps", () => {
    describe("with no reducer", () => {
      it("should handle an observable of 1 value", async () => {
        expect.assertions(1)
        const o = from(Promise.resolve(1.1))
        const propObjects = await o
          .pipe(
            toProps(),
            toArray()
          )
          .toPromise()
        expect(propObjects).toMatchSnapshot()
      })
      it("should handle an observable of >1 value", async () => {
        expect.assertions(1)
        const o = of(1.1, 2.2)
        const propObjects = await o
          .pipe(
            toProps(),
            toArray()
          )
          .toPromise()
        expect(propObjects).toMatchSnapshot()
      })
      it("should handle a 1 value observable that errors", async () => {
        expect.assertions(1)
        const o = from(Promise.reject("foozle"))
        const propObjects = await o
          .pipe(
            toProps(),
            toArray()
          )
          .toPromise()
        expect(propObjects).toMatchSnapshot()
      })
      it("should handle a multi-value observable that errors", async () => {
        expect.assertions(1)
        const o = concat(of(1), throwError("foo"))
        const propObjects = await o
          .pipe(
            toProps(),
            toArray()
          )
          .toPromise()
        expect(propObjects).toMatchSnapshot()
      })
    })
    describe("with a reducer", () => {
      it("should handle an observable of >1 value", async () => {
        const o = of(11, 22, 0)
        const propObjects = await o
          .pipe(
            toProps((acc = 0, obj) => acc + obj),
            toArray()
          )
          .toPromise()
        expect(propObjects).toHaveLength(4) // begin, middle, end, no dupe objects
        expect(propObjects).toMatchSnapshot()
      })
    })
  })
  describe("randomId", () => {
    it("should be run 1000 times without producing a dupe", () => {
      const ids = []
      for (let i = 0; i < 1000; i++) {
        const newOne = randomId()
        expect(ids).not.toContain(newOne)
        ids.push(newOne)
      }
    })
  })
})

//#region Util Functions Below
const nullFn = () => null
const anyAction: Action = { type: "any" }

//#endregion
