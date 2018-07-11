const { Agent } = require("antares-protocol")
const agent = new Agent()

const writeLine = text => ({
  payload: {
    text,
    encoding: "UTF8",
    path: "../scratch/live-actors.yml"
  }
})

const action = writeLine('Jake Weary')
agent.process(action)
