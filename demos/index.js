// this file is to run npm run demos; npm run demos:test uses jest
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
