let configs = {
  writeFileSync: [require("./01-write-file"), { syncRender: true }],
  writeFileAsync: [require("./01-write-file"), { syncRender: false }],
  concurrentFruit: [
    require("./03-concurrent-fruit"),
    { concurrency: "parallel", outerInterval: 1000, innerInterval: 185 }
  ],
  serialFruit: [
    require("./03-concurrent-fruit"),
    { concurrency: "serial", outerInterval: 1000, innerInterval: 185 }
  ],
  freshFruit: [
    require("./03-concurrent-fruit"),
    { concurrency: "cutoff", outerInterval: 1000, innerInterval: 185 }
  ]
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
