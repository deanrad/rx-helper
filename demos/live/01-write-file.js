const { after } = require('../utils')
const { Agent } = require('antares-protocol')
const agent = new Agent()

// |---------*->|
const fileRenderer = ({ action }) => {
    return after(2000, () => {
        const {text, encoding, path} = action.payload
        const fs = require('fs')
        const line = ' - ' + text + '\n'
        fs.appendFileSync(path, line, encoding)
    })
}

let counter = 0
const incrementer = () => counter++

const logger = ({ action }) => {
    console.log(`Got ${action.payload.text}`)
}

agent.addRenderer(fileRenderer, { concurrency: "serial" })
agent.addRenderer(logger)
agent.addFilter(incrementer)

const writeLine = text => ({
    payload: {
        text,
        encoding: 'UTF8',
        path: '../scratch/live-actors.yml'
    }})

const actions = [
    writeLine('Jake Weary'),
    writeLine('ScarJo'),
    writeLine('Jake Weary'),
    writeLine('ScarJo'),
    writeLine('Jake Weary'),
    writeLine('ScarJo'),
]

actions.forEach(action => agent.process(action))
console.log(`Processed ${counter} actions. Bye!`)
/*
1. Initialize antares
2. Define and process an action
3. Add a renderer to file
Point: Has a Reduxy feel 
4. Add a 2nd renderer
Point: Keeps renderers separate (can be tuned separately)
5. Write as real YML
Point: Keeps the how separate from the What
6. Factor as actionCreator
7. Show array of writings

Next: Sync or async? 

1. Define a counter, and incrementer fn
2. Attach as renderer
3. Why 0 ?
4. Convert to filter
Point: Filters are for validation, updating 
  a store - not for side-effects

5. Loook at after function for renderer
6. Show concurrency
Point: Concurrency needs should be simple parameters

Next: Real scenario? (SessionTimeout Slides)

Toward: rate limiting, throttle/debounce
*/

