const { Agent, after } = require("antares-protocol")
const agent = new Agent()
const log = (...args) => console.log(...args)

// All actions sent through .process pass through filters
agent.addFilter(() => log('Good morning.'))

// Assign a renderer to fire upon events of `type: 'hello'`.
// After 50ms, the agent will log to the console,
// at which point the Promise `result.completed.hello` will resolve.
agent.on('hello', () => after(50, () => {
  log('Hello World!')
}))

// Process an action to set off our renderer
const result = agent.process({ type: 'hello' })
result.completed.then(r => log('Good night.'))
