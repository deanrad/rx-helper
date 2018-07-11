const { Agent, after } = require("antares-protocol")
const agent = new Agent()

const writeLine = text => ({
  payload: {
    text,
    encoding: "UTF8",
    path: "./demos/scratch/live-actors.yml"
  }
})

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
agent.addRenderer(fileRenderer)
agent.addRenderer(logger)

const action = writeLine("Jake Weary")

const actions = [
  writeLine("Jake Weary"),
  writeLine("ScarJo"),
  writeLine("Chris Hemsworth"),
  writeLine("Mark Ruffalo")
]

actions.forEach(action => agent.process(action))
