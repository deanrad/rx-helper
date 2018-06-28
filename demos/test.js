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
//     ①  🍓  💥
//     ②  🍌  🍌  💥
//     ③  🍉  🍉  🍉  💥
// -   ⑨  🥑  🥑  🥑  🥑  🥑   ④  🍍  🍍  🍍  🍍  💥
// +   ⑨  🥑  🥑  🥑  🥑   ④  🍍  🍍  🍍  🍍  💥
//     ⑤  🍏  🍏  🍏  🍏  🍏  💥
// In this case, the 'cutoff' behavior was as expected, but 
// a subtle timing issue caused the interruption to occur
// slightly sooner. In this case, the test did not fail.
// It's best if tests are forgiving at least to 40ms, though
// ideally this should come down to 15ms or less.
const Demos = require("./configs")
const { AntaresProtocol } = require("../src/antares-protocol")

let output = ""
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
  })
  describe("writeFileDemo", () => {
    it("should work synchronously", async () => {
      const [demoFn, config] = Demos.writeFileSync

      await demoFn({ AntaresProtocol, config, log })

      expect(output).toMatchSnapshot()
    })

    it("should work asynchronously", async () => {
      const [demoFn, config] = Demos.writeFileAsync

      await demoFn({ AntaresProtocol, config, log })

      expect(output).toMatchSnapshot()
    })
    it("should work with batching")
  })

  describe("speakUpDemo", () => {
    // wait for others' output to flush
    beforeAll(async () => {
      return await new Promise(resolve => setTimeout(resolve, 200))
    })

    xit("should hear overlapping speakings", async () => {
      if (!process.env.CI) {
        const [demoFn, config] = Demos.doubleSpeak || [() => true, {}]

        try {
          require("say").speak("test")
        } catch (ex) {
          // silence it so it won't ruin CI
          console.error("An error occurred using the speech interface.")
        }

        try {
          require("say").speak("test")
          await demoFn({ AntaresProtocol, config, log })
        } catch (ex) {
          return
        }

        // snapshots wont work for tests that sometimes aren't run - Jest says 'obsolete'!
        // test output is too highly variable
        expect(output).toEqual(expectedSpeak)
      }
    })
  })

  describe("concurrentFruit demo", () => {
    it("should run in parallel", async () => {
      const [demoFn, config] = Demos.concurrentFruit
      await demoFn({ AntaresProtocol, config, log, append })
      expect(output).toMatchSnapshot()
    })
    it("should run in series", async () => {
      const [demoFn, config] = Demos.serialFruit
      await demoFn({ AntaresProtocol, config, log, append })
      expect(output).toMatchSnapshot()
    })
    it("should abort in-flight renders in latest mode", async () => {
      const [demoFn, config] = Demos.freshFruit
      await demoFn({ AntaresProtocol, config, log, append })
      expect(output).toMatchSnapshot()
    })
  })

  describe("batchedWriteDemo", () => {
    it("should run slower without batching", async () => {
      const [demoFn, config] = Demos.batchedWriteFile
      await demoFn({ AntaresProtocol, config, log, append })
      expect(output).toMatchSnapshot()
    })
    it("should run utlimately faster with batching", async () => {
      const [demoFn, config] = Demos.batchedWriteFile
      await demoFn({ AntaresProtocol, config, log, append })
      expect(output).toMatchSnapshot()
    })
  })
})

const expectedSpeak = `> About to process/say: Starbucks
< processing done
> About to process/say: International House of Pancakes
< processing done
•
•
•
•
•
`
