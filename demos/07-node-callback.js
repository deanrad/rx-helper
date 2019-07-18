const { Subject, Observable, bindNodeCallback } = require("rxjs")
const fs = require("fs")
const { readFile } = fs

// A version that returns an Observable
const notifyOfFileContents = bindNodeCallback(readFile)

// A flag we will set when we've processed our final event (for testing)
const allDone = new Subject()

const FILE_PATH = __dirname + "/07-log.txt"
module.exports = ({
  Agent,
  log /* it is the concatenation of our calls to log that will appear in the snapshot */
}) => {
  // A new agent, where very event the agent sees may be logged
  const agent = new Agent()
  // enable debugging (will be verbose)
  agent.filter(() => true, ({ event }) => console.error(JSON.stringify(event)))

  // The agent will respond to 'load' w/ an event of type 'logLines'
  // containing the files' contents as a string.
  agent.on("load", ({ event: { payload } }) => notifyOfFileContents(payload, "UTF8"), {
    type: "logLines"
  })

  // The agent will return the 'good' lines from the array of matching lines
  // in an Observable of type 'goodLines'
  agent.on(
    "logLines",
    ({ event }) => {
      const { payload: lines } = event
      const goodLines = lines.split("\n").filter(line => line.match(/gandalf/))
      return goodLines
    },
    { type: "goodLines" }
  )

  // Once we know our goodLines, we can create the output file
  agent.on("goodLines", ({ event }) => {
    const lines = event.payload
    lines.forEach(log)

    // This is effectively what bindNodeCallback did for us for the case of fs.readFile
    return new Observable(notify => {
      fs.writeFile(FILE_PATH + ".out", lines.join("\n").toUpperCase(), "UTF8", err => {
        // tell the agent our outcome
        err ? notify.error(err) : notify.complete()
        // tell our test we're done, and our outcome
        allDone.complete()
      })
    })
  })

  // Kick off the agent processing
  const result = agent.process({ type: "load", payload: FILE_PATH })
  return allDone.toPromise()
}
