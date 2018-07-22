const { Subject, interval } = require("rxjs")
const { startWith, endWith, map, mapTo, take, tap } = require("rxjs/operators")

const circleCharacter = { 1: "①", 2: "②", 3: "③", 4: "④", 5: "⑤", 6: "⑥", 7: "⑦", 8: "⑧", 9: "⑨" }
const fruitCharacter = {
  1: "🍓",
  2: "🍌",
  3: "🍉",
  4: "🍍",
  5: "🍏",
  6: "🍓",
  7: "🥝",
  8: "🍒",
  9: "🥑"
}

module.exports = async ({ Agent, config = {}, log, append, interactive = false }) => {
  const { outerInterval, innerInterval, concurrency } = config

  const numArray = config.numArray ? eval(config.numArray) : [1, 2, 3, 9, 4, 5]
  return runDemo()

  async function runDemo() {
    showPrompt()

    // allows us to signal multiple processes to start at once
    // with pkill -SIGUSR2 node, if started with WAIT_FOR=SIGUSR2
    const signalToWaitOn = process.env.WAIT_FOR
    if (signalToWaitOn && signalToWaitOn.startsWith("SIG")) {
      // console.log("Waiting for you to signal us with pkill -" + signalToWaitOn)
      process.stdin.resume()

      let gotSignal = new Promise(resolve => process.on(signalToWaitOn, resolve))
      await gotSignal
    }

    const antares = new Agent()

    // Add a renderer which returns a process (Observable) that, when
    // Antares subscribes to it, will pull values through the pipe of
    // computation with the specified timing. Example:
    // > ⑤ 5 5 5 5 5 💥 (over ~1000 msec)
    //
    antares.addRenderer(
      ({ action: { payload: digit } }) => {
        append("  " + circleCharacter[digit] + " ")
        return repeatTheNumber(digit)
      },
      { name: "repeater", concurrency }
    )

    const inputStream = interactive ? getUserInputFromStdin() : simulatedUserInput()
    // wait till our subscription has ended (and its last renderer)
    let result
    return new Promise(resolve => {
      // for each keypress, process it
      inputStream.subscribe(
        n => {
          result = antares.process({ type: "digit", payload: n })
        },
        undefined,
        () => result && result.completed.then(resolve)
      )
    })

    // This function returns an object (an Observable) that, when
    // Antares subscribes to it, will pull values through the pipe of computation
    // with the specified timing.
    // More simply put, given a variable called digit, (example 5)
    // will call log to produce:
    // > ⑤ 5 5 5 5 5 💥
    // over a duration of ~1000 msec
    function repeatTheNumber(digit) {
      return interval(innerInterval).pipe(
        take(digit),
        map(() => " " + fruitCharacter[digit] + " "),
        endWith(" 💥\n"),
        tap(digit => {
          append(digit)
        })
      )
    }
  }

  // an observable of numbers every second
  function simulatedUserInput() {
    return interval(outerInterval).pipe(
      map(i => numArray[i]),
      take(numArray.length)
    )
  }

  // Utility functions
  function showPrompt() {
    let prompt = ""
    for (i = 1; i <= 9; i++) {
      prompt += circleCharacter[i] + " :" + fruitCharacter[i] + "  "
    }
    log(
      `Press a number to download a fruit (higher numbers take longer). 'x' to eXit.
  ${prompt}
      `
    )
  }
  // get a stream - like a promise that keeps emitting events over time
  // which you get via subscribing
  function getUserInputFromStdin() {
    // set up stdin
    const keypress = require("keypress")
    keypress(process.stdin)
    process.stdin.setRawMode(true)
    process.stdin.resume()

    // A Subject is something that you can push values at, and
    // it can be subscribed to as an Observable of those values
    const s = new Subject()

    // set up handler and return the stream as Observable
    process.stdin.on("keypress", (ch, key = {}) => {
      if (key.name == "x" || (key && key.ctrl && key.name == "c")) {
        process.stdin.pause()
        s.complete()
        log("\nBye!")
        process.exit()
      }
      if (ch === "0" || Number(ch)) {
        s.next(Number(ch))
      } else {
        process.stdin.pause()
        log("Not 0-9.\nBye!")
        s.complete()
      }
    })

    return s.asObservable()
  }
}
