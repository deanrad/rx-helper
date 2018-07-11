const { Agent, after } = require("antares-protocol")
const agent = new Agent()

const writeLine = text => ({
  payload: {
    text,
    encoding: "UTF8",
    path: "./demos/scratch/live-actors.yml"
  }
})

// Returns a single action from a batch
const consolidator = batch => {
  let combinedNames = ""
  for(let item of batch) {
    const { action } = item
    combinedNames += `${action.payload.text}\n - `
  }
  combinedNames = combinedNames.replace(/\s-\s$/, "")
    
  // The returned object should match what a renderer expects
  return {
    action: writeLine(combinedNames)
  }
}

const fileRenderer = ({ action }) => {
  return after(2000, () => {
    const { path, text, encoding } = action.payload
    const line = " - " + text + "\n"

    const fs = require("fs")
    fs.appendFileSync(path, line, encoding)
  })
}
const logger = ({ action }) => {
  console.log(`Got ${action.payload.text}`)
}

// Make the fileRenderer responsible for certain actions
agent.addFilter(logger)
agent.addRenderer(fileRenderer, {
  concurrency: "serial"
})

const action = writeLine("Jake Weary")

const names = ["Jake Weary", "ScarJo", "Chris Hemsworth", "Mark Ruffalo"]
// prettier-ignore
const actions = Array
  .from(Array(100).keys())
  .map(i => writeLine(names[i % names.length]))

actions.forEach(action => agent.process(action))
