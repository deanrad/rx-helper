/* tslint:disable  */
import { of, from, empty, interval, timer, throwError, concat as rxConcat } from "rxjs"
import { delay, map, first, toArray, take, concat, concatMap, scan, tap } from "rxjs/operators"
import {
  Action,
  Agent,
  Concurrency,
  reservedSubscriberNames,
  after,
  agentConfigFilter,
  AgentConfig,
  toProps,
  ajaxStreamingGet,
  randomId
} from "../src/antares-protocol"

// a mutable variable, reset between tests
let counter = 0
let seenActions = []

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

      it("should be able to replace Redux with a single line", () => {
        expect.assertions(1)
        let state = []
        // define an aggregator function which appends to an array (same signature as reducer)
        const builder = (state, action) => {
          return [...state, action.payload]
        }

        // set it up to scan over the action stream, storing payloads
        agent
          .allOfType(() => true)
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

  describe("#filter", () => {
    it("should alias addFilter, reversing arguments", () => {
      let counter = 0
      agent.filter("foo", () => counter++)
      agent.process({ type: "foo" })
      agent.process({ type: "not" })
      expect(counter).toEqual(1)
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

          it("will be the actionType filter if given", () => {
            expect(agent.rendererNames).not.toContain("autonamer")
            agent.on("autonamer", () => null)
            expect(agent.rendererNames).toContain("autonamer")

            expect(agent.filterNames).not.toContain("autonamer")
            agent.filter("autonamer", () => null)
            expect(agent.filterNames).toContain("autonamer")
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

          it("can use a string from actionsOfType", () => {
            // no autonumbering occurs for the first one of a string ActionFilter
            // successive ones get numbers appended eg helloEcho_1
            agent.filter("helloEcho", () => "echo 1")
            agent.filter("helloEcho", () => "echo 2")

            // run through both filters
            const result = agent.process({ type: "helloEcho" })

            // its not enumerable, currently, but its there
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
        it.skip("should return an Observable", () => {})
        it.skip("may return null or an object to be cast to Observable", () => {})
      })
      describe("config argument", () => {
        describe("concurrency", () => {
          it.skip("should run in parallel mode (shown in demo)", () => {})
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
          it.skip("should not accept xform and actionType argument", () => {})
        })
        describe("xform", () => {
          it.skip("accepts a function that modifies the Action Stream", () => {})
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
            agent.addFilter(({ action }) => (seenActions = [...seenActions, action]))
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
    beforeEach(() => {
      counter = 0
      seenActions = []
      agent.addFilter(({ action }) => seenActions.push(action))
    })

    describe("arguments", () => {
      describe("action", () => {
        it("may be an action", () => {
          expect.assertions(0)
          agent.process(anyAction)
        })
        describe("Observable<Action>", () => {
          const makeAction = n => ({ type: "n", payload: n })
          it("may be an observable", () => {
            const actions = [1, 2].map(makeAction)
            agent.subscribe(from(actions))
            expect(seenActions).toEqual(actions)
          })
          it.skip("will continue to process others if it dies", () => {
            expect.assertions(1)
            const errorsIn100 = interval(100).pipe(
              take(2),
              map(makeAction),
              concat(throwError("Boom"))
            )
            agent.subscribe(errorsIn100)
          })
        })
      })
      describe("context", () => {
        it.skip("can be any object to be available to renderers", () => {})
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
          expect.assertions(0)
          agent.addRenderer(() => of("🐌").pipe(delay(100)), {
            name: "snail",
            concurrency: Concurrency.serial
          })
          agent.addRenderer(() => of("⚡").pipe(delay(20)), {
            name: "quickie"
          })

          return agent.process(anyAction).completed
        })

        it.skip("is cached, not causing renderers to rerun", () => {
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

        it.skip("resolves even if you have a time-delayed renderer", () => {})
        it.skip("resolves even if a renderer is cutoff by itself", () => {})
      })
    })

    describe("behavior", () => {
      it("should emit the action on the allOfType Observable", () => {
        expect.assertions(1)

        // Build up our assertion
        const assertion = agent
          .allOfType(() => true)
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
        it.skip("should not propogate up to the caller of #process, but surface somewhere", () => {})
        it.skip("should unsubscribe the renderer", () => {})
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
      let c
      // a function incrementing c
      const incrementVar = () => {
        return ++c
      }

      beforeEach(() => {
        c = 0
      })

      it("should create an Observable of its return value", () => {
        expect.assertions(1)
        const result = after(1, () => 1.11)
        return result.toPromise().then(value => {
          expect(value).toEqual(1.11)
        })
      })
      it("does nothing unless subscribed to", async () => {
        // An Observable of the incrementVar being called in 100msec
        // and its subscription. If we dont subscribe, the
        // 100msec will never start tic
        let o = after(40, incrementVar)

        await timer(50).toPromise()
        expect(c).toEqual(0)
      })
      it("does work if subscribed to", async () => {
        let o = after(40, incrementVar)

        o.subscribe()

        await timer(50).toPromise()
        expect(c).toEqual(1)
      })
      it("Will not be called and after will not notify of a value", async () => {
        let o = after(40, incrementVar)
        jest.setTimeout(100)

        let sub = o.subscribe()

        // begin a cancellation before the end
        after(20, () => sub.unsubscribe()).subscribe()

        // await the value of c 50 msec from now
        let result = await after(50, () => c).toPromise()

        expect(c).toEqual(0)
        expect(result).toEqual(0)
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
        const o = rxConcat(of(1), throwError("foo"))
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
