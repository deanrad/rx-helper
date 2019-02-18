let configs = {
  parallelFruit: [
    require("./03-concurrent-fruit"),
    { concurrency: "parallel", outer: 280, inner: 50, pause: 280 }
  ],
  serialFruit: [
    require("./03-concurrent-fruit"),
    { concurrency: "serial", outer: 280, inner: 50, pause: 280 }
  ],
  cutoffFruit: [
    require("./03-concurrent-fruit"),
    { concurrency: "cutoff", outer: 280, inner: 50, pause: 280 }
  ],
  muteFruit: [
    require("./03-concurrent-fruit"),
    { concurrency: "mute", outer: 280, inner: 50, pause: 280 }
  ],
  cheatCode: [require("./05-cheat-code"), {}],
  sessionTimeout: [
    require("./06-session-timeout"),
    { inactivityInterval: 300, warningInterval: 100 }
  ],
  nodeCallback: [
    require("./07-node-callback"),
    {}
  ]
}

const failsInCI = {
  doubleSpeak: [require("./02-speak-up"), { count: 2, concurrency: "parallel" }],
  patientSpeak: [require("./02-speak-up"), { count: 2, concurrency: "serial" }],
  interruptingSpeak: [require("./02-speak-up"), { count: 2, concurrency: "cutoff" }]
}

if (!process.env.CI) {
  configs = Object.assign(configs, failsInCI)
}
module.exports = configs
