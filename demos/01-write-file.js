module.exports = ({ AntaresProtocol, config = {}, log, interactive = false }) => {
  const fileName = "./demos/scratch/actors.md"

  return runDemo()

  function runDemo() {
    let antares = new AntaresProtocol()

    // Tell antares we have a renderer to apply
    if (config.syncRender) {
      antares.addFilter(saveActor)
    } else {
      antares.addRenderer(saveActor)
    }

    // going in async mode is a little like doing
    // setTimeout(() => saveActor({action: {payload: {contents: 'Test'}}}), 0)

    // Get a promise for the one action we'll process
    let action = interactive ? getPayloadFromStdin() : Promise.resolve(getDemoData())

    // Define what processing it means - Antares makes this super-high-level
    function processAction(action) {
      const contents = action.payload.contents
      log(`> Got some data for file ${fileName}: ${contents}`)
      log(`> Processing action ${action.type}`)

      // Now that processing is started, will the renderer messages print out
      // before or after the log that follows? Depends on rendering mode sync|async
      let result = antares.process(action)
      log("< Done processing - No more to do?\nOK Bye!")

      return result
    }

    // Process it
    return (
      action
        .then(processAction)
        //.then(({ action }) => log(action.results))
        .catch(ex => {
          // We can expect our renderers to have picked it up now
          console.log("\nA problem occurred, sorry: ", ex, "\nBye!")
          process.exit(1)
        })
    )
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
  function saveActor({ action: { type, payload } }) {
    // Get our fields
    const { contents } = payload

    // Apply specific knowledge that only the renderer knows
    const markdownLine = "- " + contents + "\n"

    // Do our writing
    const fs = require("fs")

    fs.appendFileSync(fileName, markdownLine, "utf8")
    const msg = `File now contains: ${markdownLine}`
    log(msg)
    return msg
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
