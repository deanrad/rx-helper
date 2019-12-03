/* tslint:disable  */
import { Observable, Subscription, of, from, empty, timer, throwError, concat } from "rxjs"
import { first, toArray, scan, tap } from "rxjs/operators"
import {
  Event,
  Agent,
  Concurrency,
  Subscriber,
  reservedSubscriberNames,
  after,
  toProps,
  ajaxStreamingGet,
  randomId
} from "../src/agent"

let seen: Array<Event> = []
let callCount = 0
let blowupCount = 0
let counter = 0

// Returns next-callstack completed observable
const deferredCallCounter: Subscriber = () => {
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
const delayedCall = (msec: number) => () => {
  callCount++
  return after(msec, () => callCount)
}

const peekOnly = () => {
  return of(callCount)
}

const seenFilter: Subscriber = ({ event }) => {
  seen.push(event)
  return event
}

const eventModifyingFilter = ({ event }) => {
  event.foreverChanged = true
}

const ignoreEventFilter = ({ event }) => {
  event.type = "_ignored"
}

// Updates our resettable array, and returns the event just seen
const seenAdder: Subscriber = ({ event }) => {
  seen.push(event)
  return of(event)
}

// Dies in a fire upon invocation, to test error handling
const blowUpHandler: Subscriber = () => {
  blowupCount++
  throw new Error("NoPrintError - wont fail the suite")
}

const returnsObsErr: Subscriber = () => throwError("Notified of Error")

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
    it("should set agentId if given", () => {
      const agentId = 2.718 // or 'a3efcd' typically
      expect(new Agent({ agentId })).toHaveProperty("agentId", 2.718)
    })
    it("will make an agentId if not defined", () => {
      expect(new Agent()).toMatchObject({
        agentId: expect.stringMatching(/[0-9a-f]+/)
      })
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

    describe("getNextEvent", () => {
      it("should be a promise for the first event matching the type", () => {
        expect.assertions(1)
        const agent = new Agent()
        const result = agent.getNextEvent("test/foo")

        const matcher = { type: "test/foo" }
        agent.process(matcher)

        return result.then(matchingEvent => {
          expect(matchingEvent).toMatchObject(matcher)
        })
      })
      it("defaults to the next event (true)", async () => {
        expect.assertions(1)
        const agent = new Agent()
        const getNextEvent = agent.getNextEvent()
        agent.process(anyEvent)
        const seenIt = await getNextEvent
        expect(seenIt).toEqual(anyEvent)
      })
    })

    describe("getAllEvents", () => {
      it("should be an Observable of matching events", () => {
        const agent = new Agent()
        let counter = 0
        agent.getAllEvents("test/foo").subscribe(() => counter++)

        agent.process({ type: "test/foo" })
        agent.process({ type: "notCaught" })
        agent.process({ type: "test/foo" })

        expect(counter).toEqual(2)
      })

      it("should be able to replace Redux with a single line", () => {
        expect.assertions(1)
        let state = []
        // define an aggregator function which appends to an array (same signature as reducer)
        const builder = (state, event) => {
          return [...state, event.payload]
        }

        // set it up to scan over the event stream, storing payloads
        agent
          .getAllEvents(() => true)
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

  describe("#filter", () => {
    beforeEach(() => {
      agent = new Agent()
    })
    it("will be called synchronously when an event is processed", () => {
      const spy = jest.fn()
      agent.filter(() => true, spy)
      expect(spy).not.toHaveBeenCalled()
      agent.process(anyEvent)
      expect(spy).toHaveBeenCalled()
    })

    it("can modify the event", () => {
      agent.filter(true, eventModifyingFilter)

      const result = agent.process(anyEvent)
      expect(anyEvent).toHaveProperty("foreverChanged", true)
      expect(result).toHaveProperty("foreverChanged", true)
    })

    it("can modify the event type to prevent a handler to run", () => {
      agent.filter(true, ignoreEventFilter)
      const sawAnUnignored = jest.fn()

      agent.on(({ event: { type } }) => type != "_ignored", sawAnUnignored)
      //agent.trigger("_ignored")
      agent.process(anyEvent)
      expect(sawAnUnignored).not.toHaveBeenCalled()
    })

    it("can add a handler called immediately (ala groupby)", () => {
      const jitHandler = jest.fn()
      agent.reset()
      expect(agent.handlerNames()).toEqual([])
      agent.filter("needsHandler", () => {
        agent.on("needsHandler", jitHandler, { name: "jitHandler" })
      })

      agent.trigger("needsHandler")
      expect(agent.handlerNames()).toEqual(["jitHandler"])
      expect(jitHandler).toHaveBeenCalled()
    })
  })

  describe("#spy", () => {
    it("runs for all events", () => {
      const spy = jest.fn()

      agent.spy(spy)
      agent.process(anyEvent)

      expect(spy).toHaveBeenCalled()
    })

    it("will be silently removed if it dies", () => {
      const spy = jest.fn(() => {
        throw new Error("NoPrintError")
      })

      const sub = agent.spy(spy)
      expect(() => {
        agent.process(anyEvent)
      }).not.toThrow()

      expect(sub).toHaveProperty("closed", true)
    })
  })

  describe("#filter or #on", () => {
    describe("arguments", () => {
      describe("function argument", () => {
        it("should be a function", () => {
          agent.filter(() => true, nullFn)
        })
        it("receives type and payload as properties on the first argument", () => {
          const spy = jest.fn()
          agent.filter(true, ({ type, payload }) => {
            spy({ type, payload })
          })
          agent.process({ type: "foo", payload: "bar" })
          expect(spy).toHaveBeenCalled()
          expect(spy).toHaveBeenCalledWith({ type: "foo", payload: "bar" })
        })
      })

      describe("config argument", () => {
        describe("name", () => {
          it("will be filter_N if not given for a filter", () => {
            expect(agent.filterNames()).not.toContain("filter_1")
            agent.filter(true, () => 3.141)
            expect(agent.filterNames()).toContain("filter_1")
          })

          it("will be the eventType filter if given", () => {
            expect(agent.handlerNames()).not.toContain("autonamer")
            agent.on("autonamer", () => null)
            expect(agent.handlerNames()).toContain("autonamer")

            expect(agent.filterNames()).not.toContain("autonamer")
            agent.filter("autonamer", () => null)
            expect(agent.filterNames()).toContain("autonamer")
          })

          it("will be handler_N if not given for a handler", () => {
            expect(agent.handlerNames()).not.toContain("handler_1")
            agent.on(true, () => 3.141)
            expect(agent.handlerNames()).toContain("handler_1")
          })

          it("will assign new name for existing handler", () => {
            expect(agent.handlerNames()).not.toContain("foo")
            expect(agent.handlerNames()).not.toContain("foo_1")
            agent.on("foo", () => 3.141)
            agent.on("foo", () => 2.718)
            expect(agent.handlerNames()).toContain("foo")
            expect(agent.handlerNames()).toContain("foo_1")
          })

          it("cannot be a reserved name", () => {
            expect.assertions(reservedSubscriberNames.length)
            reservedSubscriberNames.forEach(badName => {
              expect(() => {
                agent.filter(true, nullFn, { name: badName })
              }).toThrow()
            })
          })

          it("Will use the event matcher, if a string", () => {
            // no autonumbering occurs for the first one of a string EventMatcher
            // successive ones get numbers appended eg helloEcho_1
            agent.filter("helloEcho", () => "echo 1")
            agent.filter("helloEcho", () => "echo 2")

            // run through both filters
            const result = agent.process({ type: "helloEcho" })
            expect(result).toMatchObject({
              helloEcho: "echo 1",
              helloEcho_1: "echo 2"
            })
          })
        })
        describe("type", () => {
          it("will wrap the handlers return Observable in FSAs of this type if provided", () => {
            expect.assertions(1)
            const seenNums = []
            agent.filter("num", ({ event: { payload } }) => seenNums.push(payload))
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
        it("is a subscription, to allow cancelation", () => {
          let callCount = 0
          const subscription = agent.filter(true, () => callCount++)
          const result = agent.process(anyEvent)
          expect(callCount).toEqual(1)
          subscription.unsubscribe()
          agent.process(anyEvent)
          expect(callCount).toEqual(1)
        })
      })
    })
  })

  describe("#on", () => {
    describe("arguments", () => {
      describe("eventMatcher", () => {
        it("should only run the event handler on matching events (string)", () => {
          expect.assertions(1)
          agent.on("Counter.inc", () => of(++counter), { name: "inc" })
          agent.process(anyEvent)
          let result = agent.process({ type: "Counter.inc" }).completed.inc

          return result.then(() => {
            expect(counter).toEqual(1)
          })
        })
        it("should only run the event handler on matching events (Regexp)", () => {
          expect.assertions(1)
          agent.on(/^Counter\./, () => of(++counter), { name: "inc" })
          let result1 = agent.process(anyEvent)
          let result2 = agent.process({ type: "Counter.inc" }).completed.inc

          return result2.then(() => {
            expect(counter).toEqual(1)
          })
        })
        it("should only run the event handler on matching events (Function)", () => {
          expect.assertions(1)
          agent.on(({ event: { type } }) => type.startsWith("Counter"), () => of(++counter), {
            name: "inc"
          })
          let result1 = agent.process(anyEvent)
          let result2 = agent.process({ type: "Counter.inc" }).completed.inc

          return result2.then(() => {
            expect(counter).toEqual(1)
          })
        })
        it("should only run the event handler on matching events (Array)", async () => {
          agent.on(["Counter.inc"], () => ++counter, {
            name: "inc"
          })
          // await agent.process(anyEvent).completed
          agent.process(anyEvent)
          agent.trigger("Counter.inc")
          expect(counter).toEqual(1)
        })
      })

      describe("Handler", () => {
        it.skip("Returns an Observable", () => {})
        it.skip("May return a Subscription", () => {})
        it.skip("May return a Promise", () => {})
        it.skip("May return any object, null, or undefined", () => {})
      })

      describe("config", () => {
        describe("processResults", () => {
          it("should enable the returned events to be processed", () => {
            expect.assertions(1)
            agent.on(
              true,
              ({ event }) => {
                if (event.type === "addTwo") {
                  counter += 2
                  return empty()
                }
                counter += 1
                return of({ type: "addTwo" })
              },
              { processResults: true }
            )

            // since this handler returns another event, we'll get two calls
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
          it.skip("should embed the handler's returned payload(s) in events of that type", () => {})
        })
        describe("withContext", () => {
          it("should allow context to be passed along", done => {
            expect.assertions(1)

            const ctx = { i: 1 }
            agent.on(
              "add",
              () => {
                return of({ type: "times", payload: 2.1 })
              },
              { processResults: true, withContext: true }
            )

            agent.on("times", ({ context }) => {
              expect(context).toEqual(ctx)
              done()
            })

            agent.process({ type: "add", payload: -0.5 }, ctx)
          })
        })
        describe("validation", () => {
          it.skip("should not allow bad configs", () => {})
        })

        describe("result mappers", () => {
          it("providing type should wrap the handler's Observable output as payloads", () => {
            expect.assertions(1)
            let seenEvents = []
            agent = new Agent()
            // filter to remember
            agent.filter(true, ({ event }) => (seenEvents = [...seenEvents, event]))

            // handler to wrap
            agent.on("wrap", () => of(2.1), { type: "mapped" }) // implies processResults: true

            return agent.process({ type: "wrap" }).completed.then(() => {
              expect(seenEvents).toContainEqual({ type: "mapped", payload: 2.1 })
            })
          })
        })
      })
    })

    describe("Behavior", () => {
      it("Supplements the return value of process via completed", () => {
        expect.assertions(3)
        const seenTypes = []
        agent.on(/foo/, ({ event: { type } }) => {
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

    describe("unsubscribe", () => {
      it("cancels any running handler", async () => {
        let finished = jest.fn()

        let sub = agent.on("foo", () => after(50, () => finished()))

        agent.trigger("foo")
        await after(20, () => sub.unsubscribe())
        await after(50, null)

        expect(finished).not.toHaveBeenCalled()
      })
    })

    describe("error handling", () => {
      it.skip("should unsubscribe the offending handler", () => {})
    })
  })

  describe("#process", () => {
    describe("First argument: event: { type, payload }", () => {
      it("Should be a Flux Standard Action", () => {
        expect.assertions(0)
        agent.process(anyEvent)
      })
    })
    describe("Second argument: context", () => {
      it("May be an object ", done => {
        expect.assertions(1)
        const contextObj = { foo: "bar" } // an object such as an express request, which a handler may do work upon
        agent.on(
          () => true,
          ({ context }) => {
            expect(context).toBe(contextObj)
            done()
          }
        )
        agent.process(anyEvent, contextObj)
      })
    })

    describe("Return Value", () => {
      it("Has the properties of the event", () => {
        const result = agent.process(anyEvent)
        expect(result).toMatchObject(anyEvent)
      })
      it("Has each filters result under its name", () => {
        agent.filter(() => true, seenFilter, { name: "seen" })
        const results = agent.process(anyEvent)
        expect(results.seen).toMatchObject(anyEvent)
      })
      it("Has handler results as properties under #completed", async () => {
        // Run on every event
        agent.on(true, peekOnly, { name: "peek" })
        agent.on(true, ({ event }) => event, { name: "seen" })
        agent.on(true, deferredCallCounter, { name: "later" })
        agent.on(true, delayedCall(100), { name: "molater" })
        agent.on(true, () => Promise.resolve(5), { name: "promise" })
        agent.on(true, () => "the0ry", { name: "string" })
        agent.on(true, () => 2.71828, { name: "num" })
        agent.on(true, () => [3, 1, "2!"], { name: "ary" })
        agent.on(false, () => of(undefined), { name: "notrun" })

        const anyEvent = { type: "oOo" }
        // Call #process. Result Duck types the event
        const result = agent.process(anyEvent)
        expect(result).toMatchObject(anyEvent)

        // Duck types a Promise for all handler's completion
        expect(result.completed).toHaveProperty("then")
        expect(result.completed).toHaveProperty("catch")

        // All results accessible via await result.completed
        let completedResult = await result.completed

        // the successful ones
        expect(completedResult).toMatchObject({
          peek: 0,
          seen: anyEvent,
          later: 2,
          molater: 2, // same binding
          promise: 5,
          string: "the0ry",
          num: 2.71828,
          ary: [3, 1, "2!"]
        })

        // The unrun ones
        expect(completedResult).toHaveProperty("notrun", undefined)

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
      it("Is safe to access #completed multiple times", () => {
        expect.assertions(3)

        let timesCalled = 0
        agent.on("inc", () =>
          after(0, () => {
            ++timesCalled
          })
        )
        const result = agent.process({ type: "inc" })

        // Expect same object is returned each time property is referenced
        expect(result.completed === result.completed).toBeTruthy()

        return result.completed.then(() => {
          return result.completed
            .then(() => {
              expect(timesCalled).toEqual(1)
            })
            .then(() => {
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
          agent.filter(() => true, blowUpHandler)
          expect(() => {
            agent.process(anyEvent)
          }).toThrow()
          expect(() => {
            agent.process(anyEvent)
          }).toThrow()
        })
        it("may return values", () => {
          agent.filter(() => true, seenFilter, { name: "seen" })
          const results = agent.process(anyEvent)
          expect(results.seen).toMatchObject(anyEvent)
        })
        it.skip("Will be run in order of their addition", () => {})
        it.skip("Will not be awaited if they return a promise", () => {})
        it.skip("May modify the events", () => {})
      })

      describe("Handlers", () => {
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
            badSubRender = agent.on(() => true, blowUpHandler, { name: "blowUpHandler" })

            const result = agent.process(anyEvent)

            // Available on the Promises
            expect(result.completed.blowUpHandler).rejects.toEqual(
              new Error("NoPrintError - wont fail the suite")
            )
            expect(result.completed).rejects.toEqual(
              new Error("NoPrintError - wont fail the suite")
            )

            // Prevents unhandled rejection error on completed and completed.blowUpHandler
            handleError(result.completed, "blowUpHandler", () => {})

            // Doesn't prevent filters from running
            expect(seen).toContain(anyEvent)
            // Doesn't prevent handlers added before or after
            expect(result.completed.pi).resolves.toEqual(3.14159)
            expect(result.completed.e).resolves.toEqual(2.71828)
          })

          it("Will unsubscribe the handler, processing no more events through it", () => {
            badSubRender = agent.on(() => true, blowUpHandler, { name: "blowUpHandler" })

            const result = agent.process(anyEvent)
            expect(result.completed.blowUpHandler).rejects.toEqual(
              new Error("NoPrintError - wont fail the suite")
            )
            expect(result.completed).rejects.toEqual(
              new Error("NoPrintError - wont fail the suite")
            )

            // Prevents unhandled rejection error on completed and completed.blowUpHandler
            handleError(result.completed, "blowUpHandler", () => {})

            expect(goodSub1).toHaveProperty("closed", false)
            expect(goodSub2).toHaveProperty("closed", false)
            expect(badSubRender).toHaveProperty("closed", true)

            // no sign of handler - next event will work
            expect(agent.process(anyEvent).completed).resolves.toEqual({ e: 2.71828, pi: 3.14159 })
          })
        })

        describe("Errors: Returning an erroring Observable", () => {
          it("Should return a rejected Promise, but keep the subscription", () => {
            const sub = agent.on(() => true, returnsObsErr, { name: "returnsObsErr" })

            const result = agent.process(anyEvent)
            expect(result.completed).rejects.toEqual("Notified of Error")
            expect(sub).toHaveProperty("closed", false)
            expect(agent.process(anyEvent).completed).rejects.toEqual("Notified of Error")
          })
        })

        describe("Return Value", () => {
          it("Should return an Observable", () => {})
          it("Will be handled if it throws an exception", () => {})
          it("Can return a Promise", () => {})
          it("Can return a single value - string", () => {})
          it("Will send results back through the agent if processResults: true", async () => {
            agent.on("sound", ({ event }) => ({ type: "echo", payload: event.payload }), {
              processResults: true
            })

            const result = agent.process({ type: "sound", payload: "Hello" })
            await result.completed
            expect(seen.map(a => a.type)).toEqual(["sound", "echo"])
          })
          it("Will send results back through the agent if type given a value", async () => {
            agent.on("sound", ({ event }) => of(event.payload), {
              type: "echo"
            })

            const result = agent.process({ type: "sound", payload: "Hello" })
            await result.completed
            expect(seen.map(a => a.type)).toEqual(["sound", "echo"])
          })
        })

        describe("Concurrency Modes", () => {
          const concurTester: Subscriber = ({ event }) =>
            concat(
              // sync results (will never be cutoff)
              of(`now: ${event.payload}`),
              after(0, `start: ${event.payload}`),
              // a delayed result
              after(20, `end: ${event.payload}`)
            )

          it("can be called with either concurrency or mode property", async () => {
            const syncArray = []
            agent.on("foo", ({ payload }) => after(20, () => syncArray.push(payload)), {
              mode: Concurrency.serial
            })
            agent.trigger("foo", "bar1")
            agent.trigger("foo", "bar2")
            await after(25, () => expect(syncArray).toEqual(["bar1"]))
          })
          describe("Parallel", () => {
            it("Should start handlings up asap", async () => {
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
                "start: 1",
                2,
                "now: 2",
                "start: 2",
                "end: 1",
                "end: 2"
              ])
            })
          })
          describe("Serial", () => {
            it("Should enqueue handlings", async () => {
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
                "start: 1",
                2,
                3,
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
            it("Should prevent Observables returned from handlers from starting if one is running already.", async () => {
              agent.on("concur", concurTester, {
                type: "result",
                concurrency: Concurrency.mute
              })

              agent.process({ type: "concur", payload: 1 })
              agent.process({ type: "concur", payload: 2 })

              await after(50, null).toPromise()
              expect(seen.map(a => a.payload)).toEqual([1, "now: 1", "start: 1", 2, "end: 1"])
            })
          })
          describe("Cutoff", () => {
            it("Should kill the current handler", async () => {
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
                "start: 1",
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
                onCutoff: ({ event }) =>
                  agent.process({ type: "canceled", payload: `cutoff: ${event.payload}` })
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
                "start: 1",
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
          describe("Toggle", () => {
            it("should work like a light switch", async () => {
              const cutoffHandler = jest.fn()
              agent.on("concur", concurTester, {
                type: "result",
                concurrency: Concurrency.toggle,
                onCutoff: cutoffHandler
              })

              agent.process({ type: "concur", payload: 1 })
              await after(10, () => {
                agent.process({ type: "concur", payload: 2 })
              })

              await after(10, () => {
                agent.process({ type: "concur", payload: 3 })
              })

              await after(50, null).toPromise()
              expect(seen.map(a => a.payload)).toEqual([
                1,
                "now: 1",
                "start: 1",
                2,
                3,
                "now: 3",
                "start: 3",
                "end: 3"
              ])
              expect(cutoffHandler).toHaveBeenCalledWith({ event: { payload: 1, type: "concur" } })
            })
          })
        })
      })
    })

    describe("behavior", () => {
      it("should emit the event on the getAllEvents Observable", () => {
        expect.assertions(1)

        // Build up our assertion
        const assertion = agent
          .getAllEvents(() => true)
          .pipe(first())
          .toPromise()
          .then(event => {
            expect(event).toEqual(anyEvent)
          })

        // Then process an event
        agent.process(anyEvent)

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

        let result = agent.process(anyEvent)
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

      describe("errors in async handlers", () => {
        it.skip("should not propogate up to the caller of #process, but surface somewhere", () => {})
        it.skip("should unsubscribe the handler", () => {})
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
        it("should wrap observed items in events", () => {
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
          agent.subscribe(o, "coolEvent")
          expect(seen).toEqual([
            { type: "coolEvent", payload: "A" },
            { type: "coolEvent", payload: "B" }
          ])
        })
      })
      describe("#context", () => {
        it("should be passed along to all calls to #process", () => {
          const contextualRenderings = []
          const o = from([{ type: "A" }, { type: "B" }])
          agent.on(
            () => true,
            ({ event, context }) =>
              contextualRenderings.push({ type: event.type, payload: context })
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
    it("should remove all filters and handlers", () => {
      let i = 0
      agent.on(/.*/, () => i++)
      agent.process(anyEvent)
      expect(i).toEqual(1)
      agent.filter(/.*/, () => {
        if (i === 1) throw new Error("woops")
      })
      agent.reset()
      agent.process(anyEvent)
      expect(i).toEqual(1)
    })
  })
})

describe("Utilities", () => {
  describe("after", () => {
    let counter = 0
    // a function incrementing c
    const incrementCounter = () => {
      return ++counter
    }

    describe("First argument", () => {
      describe("If zero (0)", () => {
        it("executes synchronously when subscribed", async () => {
          const effects = []

          // sync
          after(0, () => effects.push(1)).subscribe()
          // not subscribed
          const effect2 = after(0, () => effects.push(2))

          expect(effects).toEqual([1])

          effect2.subscribe()
          expect(effects).toEqual([1, 2])
        })
      })
      describe("Greater than 0", () => {
        it("defers the function till then", async () => {
          const effects = []
          after(5, () => {
            effects.push(1)
          }).subscribe()

          expect(effects).toEqual([])
          await after(10, () => {
            expect(effects).toEqual([1])
          })
        })
      })
      describe("Positive infinity", () => {
        it("is Observable.never", () => {
          const finished = jest.fn()
          // Never do this obviously!
          // await after(Infinity, () => {})
          after(Infinity, () => {}).subscribe({
            complete: finished
          })
          expect(finished).not.toHaveBeenCalled
        })
      })
    })
    describe("Second argument", () => {
      describe("If a function", () => {
        it("Schedules its execution later", async () => {
          let counter = 0
          await after(1, () => counter++).toPromise()
          expect(counter).toEqual(1)
        })
        it("Returns its return value", async () => {
          let result = await after(1, () => 2.71).toPromise()
          expect(result).toEqual(2.71)
        })
      })
      describe("If not a function", () => {
        it("Becomes the value of the Observable", async () => {
          const result = await after(1, 2.718).toPromise()
          expect(result).toEqual(2.718)
        })
      })
    })
    describe("Return Value", () => {
      it("Is unstarted/lazy/not running", async () => {
        after(1, incrementCounter) // no .subscribe() or .toPromise()

        // Wait long enough that we'd see a change if it was eager (but it's lazy)
        await timer(10).toPromise()
        expect(counter).not.toBeGreaterThan(0)
      })
      it("Can be obtained via subscribe", done => {
        after(10, 1.1).subscribe(n => {
          expect(n).toEqual(1.1)
          done()
        })
      })
      it("Can be awaited directly", async () => {
        const result = await after(1, () => 2.718)
        expect(result).toEqual(2.718)
      })
    })
    describe("Cancelability", () => {
      it("Can be canceled", async () => {
        const results = []

        const twoEvents = [1, 2].map(i => after(10, () => results.push(i)))

        const sub = concat(...twoEvents).subscribe()

        await after(10, () => {
          expect(results).toEqual([1])
          sub.unsubscribe()
        })
        await after(30, () => {
          expect(results).toEqual([1])
        })
      })
    })
  })

  const TEST_API_SERVER = "https://jsonplaceholder.typicode.com"

  describe.skip(`ajaxStreamingGet (test requires ${TEST_API_SERVER})`, () => {
    const singleEndpoint = `${TEST_API_SERVER}/users/1`
    const pluralEndpointTopLevelArray = `${TEST_API_SERVER}/users`
    const pluralEndpointNestedArray = "https://www.googleapis.com/books/v1/volumes?q=midsommar"

    it("Returns an Observable of one from a singular-object ajax response", async () => {
      jest.setTimeout(10000)
      const result$ = ajaxStreamingGet({
        url: singleEndpoint
      })
      const user = await result$.toPromise()

      expect(user).toHaveProperty("username")
    })
    it("Returns an Observable of many from an array ajax response", async () => {
      jest.setTimeout(10000)
      const result$ = ajaxStreamingGet({
        url: pluralEndpointTopLevelArray
      })

      const users = await result$.pipe(toArray()).toPromise()

      expect(users.length).toBeGreaterThan(0)
    })
    it("Returns an Observable of 1 from a nested-array ajax response", async () => {
      jest.setTimeout(10000)

      const result$ = ajaxStreamingGet({
        url: pluralEndpointNestedArray
      })

      const resultObj = result$.toPromise()
      // The response container, with the items field will be the resolved value

      expect(resultObj).toHaveProperty("items")
    })
    it("Returns an Observable of many from a nested-array ajax response, if expandKey specified", async () => {
      jest.setTimeout(10000)
      expect.assertions(1)

      const result$ = ajaxStreamingGet({
        url: pluralEndpointNestedArray,
        expandKey: "items"
      })

      const resultArray = await result$.pipe(toArray()).toPromise()
      expect(resultArray.length).toBeGreaterThan(0)
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
const anyEvent: Event = { type: "any" }

//#endregion
