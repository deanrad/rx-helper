const { Agent, after } = require("antares-protocol")
const { bufferCount, map } = require("rxjs/operators")
const fs = require("fs")

// Instantiate this helper object
const agent = new Agent()

// Create a big array of writeFileRequests, having the agent process each.
// Then define a function our agent can call once fully configured.
const names = ["Jake Weary", "ScarJo", "Chris Hemsworth", "Mark Ruffalo"]
const writeFileRequests = Array.from(Array(100).keys()) // 0..99
  .map(i => writeFileRequest(names[i % names.length]))

// Given some text, return an action fully describing whats
// needed to write it to a file somewhere
function writeFileRequest(text) {
  return {
    type: "writeFile",
    payload: {
      text,
      encoding: "UTF8",
      path: "../scratch/live-actors.yml"
    }
  }
}

function processAll() {
  writeFileRequests.forEach(action => {
    agent.process(action)
  })
  console.log("Agent has all our requests! Rendering in progress...")
}

// Given an action fully describing what and where to write,
// do the actual writing.
const writeFileRenderer = ({ action }) => {
  return after(1000, () => {
    const { text, encoding, path } = action.payload
    const line = " - " + text + "\n"
    fs.appendFileSync(path, line, encoding)
  })
}

// Still we log before every action
agent.addFilter(({ action }) => console.log(`Writing ${action.payload.text}`))

// Tell our agent the writeFileRenderer is responsible for actions of type "writeFile"
agent.addRenderer(writeFileRenderer, {
  concurrency: "serial",
  xform: actionStream =>
    actionStream.pipe(
      bufferCount(25),
      map(consolidator)
    )
})

function consolidator(batch) {
  // Make modifications to the first action in the batch and return it.

  const [first, ...rest] = batch
  const firstAction = first.action
  rest.forEach(({ action }) => {
    firstAction.payload.text += "\n - " + action.payload.text
  })
  firstAction.payload.text += "\n"

  return first
}

// We've set up our agent - now process all actions!
processAll()
