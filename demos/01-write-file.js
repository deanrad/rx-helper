const fs = require("fs")
const { Subject } = require("rxjs")

module.exports = ({ Agent, config = {}, log, interactive = false }) => {
  const fileName = "./demos/scratch/actors.md"
  
  // Allows for signaling completion
  let done = new Subject

  runDemo()

  return done.toPromise()

  async function runDemo() {
    let antares = new Agent()

    // Tell antares we have a renderer to apply
    if (config.processAs === "filter") {
      antares.addFilter(saveActor)
    } else {
      antares.addRenderer(saveActor)
    }

    // going in async mode is a little like doing
    // setTimeout(() => saveActor({action: {payload: {contents: 'Test'}}}), 0)

    // Get a promise for the one action we'll process
    let action = await (interactive ? getPayloadFromStdin() : Promise.resolve(getDemoData()))

    const contents = action.payload.contents
    log(`> Got some data for file ${fileName}: ${contents}`)
    log(`> Processing action ${action.type}`)
  
    let result = antares.process(action)
    // Define what processing it means - Antares makes this super-high-level

    log("< Done processing - No more to do?\nOK Bye!")

    done.complete()
  }

  function getDemoData() {
    return {
      type: "Actor.save",
      payload: {
        contents: "Jake Weary"
      }
    }
  }

  // A Renderer, recieving an item with an FSA on its 'action' property
  function saveActor({ action }) {
    // Who have we been told to save?
    const contents = action.payload.contents

    // Prepare it for rendering
    const markdownLine = "- " + contents + "\n"

    // Do our writing
    fs.appendFileSync(fileName, markdownLine, "utf8")
    log(`\nFile now contains: ${markdownLine}`)
  }

  // Returns a promise for a payload suitable for the Actor.save action
  function getPayloadFromStdin() {
    const inquirer = require("inquirer")
    return Promise.race([
      new Promise((resolve, reject) => setTimeout(reject, 10000)),
      inquirer
        .prompt([
          {
            name: "name",
            message: "Your favorite actor/actress first initials?"
          }
        ])
        .then(({ name }) => {
          return {
            type: "Actor.save",
            payload: {
              contents: name
            }
          }
        })
    ])
  }
}
