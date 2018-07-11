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
    log("You will be logged out soon..")
  }
  const logout = ({ action }) => {
    log("You have been logged out.")
    allDone.complete() // set that flag
    process.stdin.pause() // release our grip on stdin
  }

  // The setting-up of our renderers
  const agent = new Agent()

  agent.addRenderer(warn, { actionsOfType: "Timeout.warn" })
  agent.addRenderer(logout, { actionsOfType: "Timeout.logout" })

  // Upon recieiving actions, we return an Observable of the following:
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
      name: "SessionTimeout",
      processResults: true, // Render these actions back through agent.process
      concurrency: "cutoff", // If a timeout exists when we're triggered, kill it
      actionsOfType: /^(?!Timeout)/ // Don't trigger a timeout on our Timeout.* actions
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

  // Return our Subject for when we're done
  return allDone.toPromise()

  // If not in interactive mode, we'll use this Observable to drive us.
  function simInput() {
    return concat(
      // two keypresses well within our inactivity interval
      after(inactivityInterval / 2, " "),
      after(inactivityInterval / 2, " "),
      // then we wait a bit longer to enter the inactivity interval
      after(inactivityInterval * 1.1, " "),
      // dont let the warning interval fully elapse yet
      after(warningInterval / 2, " ")
      // Finally, let the chips fall as they may
    )
  }
}
