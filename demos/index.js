// This file is to run all demos+configs specified in configs.js
// Example: npm run demos     # run them all, building the JS first
//          node demos/index  # run them to skip the build if no antares change made
//
//          # Only demos whos key in config matches 'Fruit'
//          cross-env DEMO=Fruit npm run demos
//
//          # Substitutes an Observable taken from user input for a hard-coded one
//          cross-env DEMO=Speak INTERACTIVE=1 npm run demos 
// See also: npm run demos:test (uses jest)
// See alse: ./configs.js
const Demos = require("./configs")
const process = require("process")
const { stdout } = process
const log = s => stdout.write(s + "\n")
const append = s => stdout.write(s)
const interactive = !!process.env.INTERACTIVE
const whichDemo = process.env.DEMO
const { AntaresProtocol } = require("../dist/antares-protocol.umd")

async function sequentiallyRun() {
  for (let key of Object.keys(Demos)) {
    if (whichDemo && !key.includes(whichDemo)) continue

    const [demoFn, config] = Demos[key]

    // pick up CLI overrides
    for(let key of Object.keys(config)) {
      if (process.env[key]) {
        config[key] = process.env[key]
      }
    }

    log("\n" + `Demo ${key} (${JSON.stringify(config)})` + "\n--------")
    await demoFn({ AntaresProtocol, config, stdout, log, append, interactive })
    // give some time to flush
    await new Promise(resolve => setTimeout(resolve, 200))
  }
  console.log("\nBye!\n")
}

sequentiallyRun()
