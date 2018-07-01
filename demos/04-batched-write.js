const { Subject } = require("rxjs")
const { bufferCount, map, tap } = require("rxjs/operators")
const fs = require("fs")
const faker = require("faker")
const filePath = "./demos/scratch/04-batched.yml"

module.exports = ({ AntaresProtocol, config = {}, log, append, interactive = false }) => {
  const { xform: xformJS = "s => s", count = 3 } = config

  const xform = eval(xformJS)

  const antares = new AntaresProtocol()

  // clear out file
  fs.appendFileSync(filePath, "\n") // creates if doesn't exist
  fs.truncateSync(filePath)

  const completed = new Subject()

  // Use one of these two approaches
  const writeToFile = asi => {
    // log(`writing 1 item`)
    const { action } = asi
    fs.appendFileSync(filePath, ` - ${action.payload.text}\n`)

    // shoehorn in a way for our test to know we're done
    if (action.meta.index + 1 === count) {
      completed.complete()
    }
  }

  const writeBatchToFile = batch => {
    log(`writing (${batch.length}) items `)
    const combinedString = batch.reduce((joined, { action }) => {
      // shoehorn in a way for our test to know we're done
      action.meta.index + 1 === count && completed.complete()

      return joined + ` - ${action.payload.text}\n`
    }, "")
    fs.appendFileSync(filePath, combinedString)
  }

  // use the batched renderer?
  const renderer = xformJS === "s => s" ? writeToFile : writeBatchToFile
  antares.addRenderer(renderer, {
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
