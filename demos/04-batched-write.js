const { Subject } = require("rxjs")
const { bufferCount, map, tap } = require("rxjs/operators")
const fs = require("fs")
const faker = require("faker")

module.exports = ({ AntaresProtocol, config = {}, log, append, interactive = false }) => {
  const { xform: xformJS = "s => s", count = 3, file: filePath } = config

  const xform = eval(xformJS)

  const antares = new AntaresProtocol()

  // clear out file
  fs.appendFileSync(filePath, "\n") // creates if doesn't exist
  fs.truncateSync(filePath)

  const completed = new Subject()
  let totalProcessed = 0

  // Evaled by config in the batched case
  // Returns one single text writing action from a batch.
  function consolidateWriteActions(batch) {
    log(`writing (${batch.length}) items `)
    totalProcessed += batch.length

    // Reducer to extract and join the text
    const combinedTexts = batch.reduce((joined, { action }) => {
      return joined + ` - ${action.payload.text}\n`
    }, "")

    // Remember to return at least the action property of an ASI
    return {
      action: {
        type: "writeIt",
        payload: {
          text: combinedTexts
        },
        meta: { index: totalProcessed }
      }
    }
  }

  // Write a single action to the file
  const writeToFile = asi => {
    // log(`writing 1 item`)
    const { action } = asi
    fs.appendFileSync(filePath, ` - ${action.payload.text}\n`)

    // shoehorn in a way for our test to know we're done
    if (action.meta.index + 1 >= count) {
      completed.complete()
    }
  }

  // Now set up the renderer, and process
  const renderer = writeToFile
  antares.addRenderer(writeToFile, {
    name: "fileWriter",
    xform
  })

  for (let i = 0; i < count; i++) {
    antares.process({
      type: "writeIt",
      payload: {
        text: faker.company.catchPhrase()
      },
      meta: { index: i }
    })
  }

  // Force jest to wait for us!
  return completed.toPromise()
}
