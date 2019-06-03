// @ts-nocheck

// This file controls what is run when you do npm run demos:test
// See also: demos/index.js - for environment variables
//
// Adding tests:
// A demo file should export a function to be run with config
// The function should return an await-able Promise for its
//    completion (implementing this is fun!)
// Your function should write to the `log` fn it is passed
// By doing so you can assert on console.log output!
// `output` will be a string that should match your console.log
//
// In contrast to RxJS marble tests, very complex assertions
// can be made in a very readable format, and without ever
// needing to write them (thanks Jest snapshots!)
// Example of detecting a subtle bug in the interaction of
// two invocations of a renderer:
// - Snapshot
// + Received
//     ①  🍓  ✅
//     ②  🍌  🍌  ✅
//     ③  🍉  🍉  🍉  ✅
// -   ⑨  🥑  🥑  🥑  🥑  🥑   ④  🍍  🍍  🍍  🍍  ✅
// +   ⑨  🥑  🥑  🥑  🥑   ④  🍍  🍍  🍍  🍍  ✅
//     ⑤  🍏  🍏  🍏  🍏  🍏  ✅
// In this case, the 'cutoff' behavior was as expected, but
// a subtle timing issue caused the interruption to occur
// slightly sooner. In this case, the test did not fail.
// It's best if tests are forgiving at least to 40ms, though
// ideally this should come down to 15ms or less.
const Demos = require("./configs")
const { Agent, after } = require("../dist/rx-helper")
const { format } = require("./utils")
const { of, from, empty, asyncScheduler } = require("rxjs")
const { observeOn } = "rxjs/operators"

let output = ""
let agent
const appendLine = s => {
  output = output + `${s}\n`
}
const append = s => {
  output += s
}
const log = appendLine

jest.setTimeout(30000)
describe("All Demos", () => {
  beforeEach(() => {
    output = ""
    agent = new Agent()
  })
  describe("Spoken-rendering Demo", () => {
    beforeAll(async () => {
      return await new Promise(resolve => setTimeout(resolve, 200))
    })
    it.skip("should hear overlapping speakings", async () => {
      if (!process.env.CI) {
        const [demoFn, config] = Demos.doubleSpeak || [() => true, {}]

        await demoFn({ Agent, config, log })

        // snapshots wont work for tests that sometimes aren't run - Jest says 'obsolete'!
        // test output is too highly variable
        expect(output).toEqual(expectedSpeak)
      }
    })
  })

  describe("Fruit Concurrency Demo", () => {
    it("should run in parallel", async () => {
      await runDemo(Demos.parallelFruit)
      expect(output).toMatchSnapshot()
    })
    it("should run in series", async () => {
      await runDemo(Demos.serialFruit)
      expect(output).toMatchSnapshot()
    })
    it("should abort in-flight renders in cutoff mode", async () => {
      await runDemo(Demos.cutoffFruit)
      expect(output).toMatchSnapshot()
    })
    it("should mute/drop new renders in mute mode", async () => {
      await runDemo(Demos.muteFruit)
      expect(output).toMatchSnapshot()
    })
  })

  describe("Cheat-Code Demo", () => {
    it("should run the test", async () => {
      await runDemo(Demos.cheatCode)
      expect(output).toMatchSnapshot()
    })
  })

  describe("Session Timeout Demo", () => {
    it.skip("should run the test (flaky)", async () => {
      await runDemo(Demos.sessionTimeout)
      expect(output).toMatchSnapshot()
    })
  })
  describe("Node Callback Demo", () => {
    it.only("should run the test", async () => {
      await runDemo(Demos.nodeCallback)
      expect(output).toMatchInlineSnapshot(`
"gandalfTheGreat: 1, 2
gandalfTheGreat: 3, 4
"
`)
    })
  })

  describe("snapshot Demo", () => {
    it("should match inline snapshot", () => {
      const expected = {
        Foo: "bar"
      }
      expect(expected).toMatchInlineSnapshot(`
Object {
  "Foo": "bar",
}
`)
    })

    /* This illustrates the pattern of turning the runtime logs of a
      * process into their
      */
    it("should assert that log output matches a snapshot", () => {
      const agent = new Agent()

      // `log` adds to the `output` variable; add an additional line on start
      agent.filter("start", () => log("--started--"))
      agent.filter(() => true, ({ action }) => log(format(action)))

      agent.process({ type: "start", payload: { val: "bar" } })
      agent.process({ type: "foo", payload: { must: "bebar" } })

      expect(output).toMatchInlineSnapshot(`
"--started--
start: val: bar
foo: must: bebar
"
`)
    })

    describe("Array iteration demo", () => {
      // A subscription of a player in the role of 'comparitor'.
      // Periodically squawks 'match'!
      let comparator

      beforeEach(() => {
        agent.filter(() => true, ({ action }) => log(format(action)))

        comparator = agent.on(
          "comparison",
          ({ action }) => {
            const { item, toFind } = action.payload
            if (item === toFind) {
              return of(item)
            } else {
              return empty()
            }
          },
          { type: "match" }
        )
      })

      it("should iterate all if toFind was not found", () => {
        const ary = [1, 2, 4]
        const toFind = 3

        let searchSub
        agent.on("match", ({ action }) => {
          log("DONE")
          searchSub.unsubscribe()
        })

        searchSub = from(ary).subscribe(item => {
          agent.process({ type: "comparison", payload: { toFind, item } })
        })

        expect(output).toMatchInlineSnapshot(`
"comparison: toFind: 3, item: 1
comparison: toFind: 3, item: 2
comparison: toFind: 3, item: 4
"
`)
      })
      it("should detect when toFind was found - way 1", () => {
        const ary = [1, 2, 4]
        const toFind = 2

        let searchFound = false
        agent.on("match", ({ action }) => {
          log("DONE!")
          searchFound = true
        })

        for (let item of ary) {
          if (searchFound) {
            break
          }
          agent.process({ type: "comparison", payload: { toFind, item } })
        }
        expect(output).toMatchInlineSnapshot(`
"comparison: toFind: 2, item: 1
comparison: toFind: 2, item: 2
match:
DONE!
"
`)
      })
      it.skip("should detect when toFind was found - way 2, takeUntil", () => null)
    })
  })
})

// snapshots wont work for tests that sometimes aren't run - Jest says 'obsolete'!
// test output is too highly variable
const expectedSpeak = `•
> Processing action: Say.speak("International House of Pancakes")
< Done Processing
•
> Processing action: Say.speak("Starbucks")
< Done Processing
•
•
•
< Done speaking
< Done speaking
`
async function runDemo(demo) {
  const [demoFn, config] = demo
  if (process.env.CI) {
    // CI is flaky on small timings - we should have the same output with a larger timing
    if (config.inner) config.inner = 2 * (config.inner + 5)
    if (config.outer) config.outer *= 2
  }
  const agent = new Agent()
  return await demoFn({ Agent, agent, config, log, append })
}
