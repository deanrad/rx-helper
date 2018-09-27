const { Observable, Subject, concat, of, empty } = require("rxjs")
const { after, getUserInputFromStdin } = require("./utils")

// A flag we will set when we've processed our final action (for testing)
const allDone = new Subject()

module.exports = ({ Agent, config = {}, log, append, interactive = false }) => {
  const { inactivityInterval, warningInterval } = config

  // The stream of keypresses we'll send through the program
  const keyPresses$ = process.env.INTERACTIVE ? getUserInputFromStdin(log) : simInput()

  // Action creators
  const Actions = {
    warn: () => ({ type: "Timeout.warn" }),
    logout: () => ({ type: "Timeout.logout" })
  }

  // Renderers for those actions
  const warn = ({ action }) => {
    log("You are being logged out..")
  }
  const logout = ({ action }) => {
    log("You have been logged out.")
    allDone.complete() // set that flag
    process.stdin.pause() // release our grip on stdin
  }

  // The setting-up of our renderers
  const agent = new Agent()

  // Using the simple API
  agent.on("Timeout.warn", warn)
  agent.on("Timeout.logout", logout)

  // An observable resembling the following is created and started
  // after every action. 'Cutoff' concurrency mode means it terminates
  // any preceeding one, thus potentially no warn or logout ever occurs
  // if actions occur within the specified inactivityInterval
  //                 warn     logout
  // |---------------|--------|----->|
  //    inactivity     warning
  agent.addRenderer(
    ({ action }) => {
      return concat(
        after(inactivityInterval, Actions.warn()),
        after(warningInterval, Actions.logout())
      )
    },
    {
      actionsOfType: "keyPress", // Upon every one of these
      concurrency: "cutoff", // If a timeout exists when we're triggered, replace it with this new one
      processResults: true // Obviates our need to call agent.process explicitly
    }
  )

  // Greet the user and kick something off to begin our initial timeout
  log("Your session will timeout in 5 seconds. Keep pressing keys to keep it alive", config)
  agent.process({})

  // Whether our keypresses are real or from user, process each one.
  // Cuts off any existing timeout, and causes a new one to start
  keyPresses$.subscribe(action => {
    log("Got a keypress")
    agent.process({ type: "keyPress" })
  })

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
