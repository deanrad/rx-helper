const { interval, Observable, Subject, from } = require("rxjs")
const { map, take } = require("rxjs/operators")

const sayings = ["International House of Pancakes", "Starbucks"]

/*
    The flow of this demo is:
    - show a single spoken action
    - show sequentially processed overlapping actions speak simultaneously
        (these are mode:sync renderers that kick off async processes)
    - discuss the implications of promisifying - argue you need
        a stream of renderings you can control
    - option A: If you had a promise for the rendering, you could await it in renderer
*/
module.exports = ({ AntaresProtocol, log, config }) => {
  const interactive = !!process.env.INTERACTIVE
  const infinite = !!process.env.INFINITE
  const { count, concurrency = "parallel" } = config
  doIt()
  return startTick()

  function doIt() {
    let antares = new AntaresProtocol()

    // This one speaks things
    antares.addRenderer(speakIt, { concurrency })

    // process our actions
    getActions(interactive).subscribe(action => {
      log(`> Processing action: Actor.save(${action.payload.toSpeak})`)
      antares.process(action)
      log("< Done Processing")
    })
  }

  function getActions(interactive) {
    return getDemoActions() // XXX interactive mode is busted
    // return interactive ? from(getUserActions()) : getDemoActions()
  }

  // By returning an Observable, we can either hand back a static array
  // or an infinite stream over time (every 60 seconds)
  function getDemoActions() {
    if (infinite) {
      const faker = require("faker")
      return interval(1000).pipe(
        map(() => ({
          payload: {
            toSpeak: faker.company.catchPhrase()
          }
        }))
      )
    }

    const sayingsAsActions = sayings
      .slice(0, count || 2)
      .map(saying => ({ payload: { toSpeak: saying } }))
    return interval(250).pipe(
      map(i => sayingsAsActions[i]),
      take(2)
    )
  }

  function getUserActions() {
    const inquirer = require("inquirer")
    return Promise.race([
      new Promise((resolve, reject) => setTimeout(reject, 10000)),
      inquirer
        .prompt([
          {
            name: "say1",
            message: "Type your 1st thing to say:"
          },
          {
            name: "say2",
            message: "Type your 2nd thing to say:"
          }
        ])
        .then(({ say1, say2 }) => {
          return [
            {
              payload: {
                toSpeak: say1
              }
            },
            {
              payload: {
                toSpeak: say2
              }
            }
          ]
        })
    ])
  }

  function startTick() {
    // overall timing to show us where we're at and exit tidily
    let tick = setInterval(() => log("•"), 250)
    return new Promise(resolve =>
      setTimeout(() => {
        clearInterval(tick)
        resolve()
      }, 1500)
    )
  }

  // Return an observable that begins when subscribe is called,
  // and completes when say.speak ends
  function speakIt({ action }) {
    const { toSpeak } = action.payload

    // Remember: unlike Promises, which share a similar construction,
    // the observable function is not run until the Observable recieves
    // a subscribe() call.
    return new Observable(observer => {
      try {
        const say = require("say")
        say.speak(toSpeak, null, null, () => {
          log("Done rendering")
          observer.complete()
        })

        // An Observable allows for cancellation by returning a
        // cancellation function
        return () => {
          say.stop()
        }
      } catch (error) {
        log("-- speech synthesis not available --")
        observer.error()
      }
    })
  }
}
