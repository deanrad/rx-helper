let configs = {
  writeFileAsFilter: [require("./01-write-file"), { processAs: "filter" }],
  writeFileAsRenderer: [require("./01-write-file"), { processAs: "renderer" }],
  parallelFruit: [
    require("./03-concurrent-fruit"),
    { concurrency: "parallel", outerInterval: 280, innerInterval: 50 }
  ],
  serialFruit: [
    require("./03-concurrent-fruit"),
    { concurrency: "serial", outerInterval: 280, innerInterval: 45 }
  ],
  freshFruit: [
    require("./03-concurrent-fruit"),
    { concurrency: "cutoff", outerInterval: 280, innerInterval: 50 }
  ],
  muteFruit: [
    require("./03-concurrent-fruit"),
    { concurrency: "mute", outerInterval: 280, innerInterval: 50 }
  ],
  batchedWriteFile: [
    require("./04-batched-write"),
    {
      count: 3000,
      file: "./demos/scratch/04-batched.yml",
      xform: "s => s.pipe(bufferCount(1000), map(consolidateWriteActions))"
    }
  ],
  unBatchedWriteFile: [
    require("./04-batched-write"),
    { count: 3000, file: "./demos/scratch/04-unbatched.yml", xform: "s => s" }
  ],
  cheatCode: [require("./05-cheat-code"), { xform: "s => s /* TODO test timing */" }]
}

const failsInCI = {
  doubleSpeak: [require("./02-speak-up"), { count: 2 }],
  patientSpeak: [require("./02-speak-up"), { count: 2, concurrency: "serial" }],
  interruptingSpeak: [require("./02-speak-up"), { count: 2, concurrency: "cutoff" }]
}

if (!process.env.CI) {
  configs = Object.assign(configs, failsInCI)
}
module.exports = configs
