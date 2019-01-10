const { Subject } = require("rxjs")

module.exports = {
  // Returns an Observable of key presses - however Ctrl-C or 'x' terminates the whole process
  getUserInputFromStdin: log => {
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
}
