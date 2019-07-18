const { Subject, concat } = require("rxjs")
const { after, getUserInputFromStdin } = require("./utils")

// A flag we will set when we've processed our final event (for testing)
const allDone = new Subject()

module.exports = ({ agent, after, config = {}, log }) => {
  const { inactivityInterval, warningInterval } = config

  // The stream of keypresses we'll send through the program
  const keyPresses$ = process.env.INTERACTIVE ? getUserInputFromStdin(log) : simInput()

  // See every event processed
  // agent.filter(() => true, asi => console.log({ asi }))

  // The setting-up of our handlers, which needn't be Observables
  agent.on("Timeout.warn", warn)
  agent.on("Timeout.logout", logout)
  function warn() {
    log("You are being logged out..")
  }
  function logout() {
    log("You have been logged out.")
    allDone.complete() // set that flag
    process.stdin.pause() // release our grip on stdin
  }

  // An observable resembling the following is created and started
  // after every event. 'Cutoff' concurrency mode means it terminates
  // any preceeding one, thus potentially no warn or logout ever occurs
  // if events occur within the specified inactivityInterval
  //                 warn     logout
  // |---------------|--------|----->|
  //    inactivity     warning
  agent.on(
    "keyPress",
    () => {
      return concat(
        after(inactivityInterval, { type: "Timeout.warn" }),
        after(warningInterval, { type: "Timeout.logout" })
      )
    },
    {
      concurrency: "cutoff", // If a timeout exists when we're triggered, replace it with this new one
      processResults: true // Obviates our need to call agent.process explicitly
    }
  )

  // Greet the user and kick something off to begin our initial timeout
  log("Your session will timeout in 5 seconds. Keep pressing keys to keep it alive", config)

  // Whether our keypresses are real or from user, process each one.
  // keyPresses$.subscribe(key => {
  //   log("Got a keypress")
  //   agent.process({ type: "keyPress", payload: key })
  // })
  // Alternate style:
  agent.filter("keyPress", () => log("Got a keypress"))
  agent.subscribe(keyPresses$, { type: "keyPress" })

  const dotsTickInterval = setInterval(() => {
    log("•")
  }, inactivityInterval / 5.0)

  // Return our Subject for when we're done
  return allDone.toPromise().then(() => clearInterval(dotsTickInterval))

  // If not in interactive mode, we'll use this Observable to drive us.
  function simInput() {
    return concat(
      // two keypresses well within our inactivity interval
      after(inactivityInterval * 0.5, "x"),
      after(inactivityInterval * 0.5, "x"),
      // then we wait a bit longer to enter the inactivity interval
      after(inactivityInterval * 1.1, "x"),
      // dont let the warning interval fully elapse yet
      after(warningInterval * 0.5, "x")
      // Finally, let the chips fall as they may
    )
  }
}
