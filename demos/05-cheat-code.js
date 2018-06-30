const { interval, of, Subject } = require("rxjs")
const {
  timestamp,
  scan,
  take,
  concat,
  tap,
  delay,
  map,
  mapTo,
  bufferCount,
  filter,
  throttleTime
} = require("rxjs/operators")
const clocks = ["🕛", "🕐", "🕑", "🕒", "🕓", "🕔", "🕕", "🕖", "🕗", "🕘", "🕙", "🕚"]
module.exports = ({ AntaresProtocol, config = {}, log, append }) => {
  const prompt = "Press a key five times in a second to get a star (✨🌟✨), or 'x' to eXit:"
  const interactive = !!process.env.INTERACTIVE
  const antares = new AntaresProtocol()

  antares.addRenderer(
    () => {
      append("  ✨🌟✨!")
    },
    {
      xform: s => {
        return s.pipe(
          // just worry about the payload
          map(asi => asi.action.payload),
          // group them into 5, allowing a new 1 in each group each time
          bufferCount(5, 1),
          // only create events with sufficiently close spacing
          filter(fiveBlock => fiveBlock[4].timestamp - fiveBlock[0].timestamp < 1000),
          // dont allow a 6-click to trigger 2 in close succession
          throttleTime(1200)
        )
      }
    }
  )

  log(prompt)

  let firstTime
  let firstOffset
  let firstSecond
  let lastTime

  // The chain of functionality to display clocks, per their timing
  var displayClocks = [
    timestamp(),
    scan(
      (acc, { timestamp, value }) => {
        const firstTime = acc.firstTime || timestamp
        return {
          firstTime,
          lastTime: timestamp,
          value,
          timestamp,
          second: Math.floor((timestamp - firstTime) / 1000),
          delta: timestamp - acc.lastTime
        }
      },
      {
        delta: 0,
        lastTime: -1
      }
    ),
    tap(({ value, timestamp, second, delta }) => {
      const smallEnough = delta < 300
      append((smallEnough ? " " : "\n") + clocks[second % 12] + " ")
    }),
    tap(info => {
      antares.process({ payload: info })
    })
  ]

  function getActions(interactive) {
    return interactive ? getUserInputFromStdin() : getScriptedActions()
  }

  function getScriptedActions() {
    return interval(1000).pipe(
      take(5),
      concat(
        interval(150).pipe(
          delay(2500),
          take(5)
        ),
        of(1).pipe(delay(1000))
      )
    )
  }

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
        return process.exit()
      }
      s.next()
    })

    return s.asObservable()
  }

  // the promise to be awaited by the runner
  let result = getActions(interactive)
    .pipe(...displayClocks)
    .toPromise()
  return result
}
