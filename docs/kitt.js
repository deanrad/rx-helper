// Set up our references to vars and functions
const { interval, timer, of, animationFrameScheduler } = rxjs
const { catchError, map, filter, tap, take, takeUntil, concatMap } = rxjs.operators

// Do a fun animation
// Notice we dont bother to create Antares actions and process them.
// This works simply as raw RxJS code
const canvas = document.getElementById("c")
const context = canvas.getContext("2d")
context.fillStyle = "red"

const width = 70

// Still we have a function that serves like a renderer - it takes
// data objects, and makes calls that produce side-effects in the
// environment. (This renderer is synchronous, however)
const drawKitt = pos => {
  const fromX = 5 + pos * 4
  context.clearRect(0, 0, canvas.width, canvas.height)
  context.fillRect(fromX, 0, 10, canvas.height)
}

// Approximately 60fps, update the position, moving back and forth across the width
const work = interval(16).pipe(
  map(i => {
    const doubleX = i % (width * 2)
    if (doubleX > width) {
      return width * 2 - doubleX
    } else {
      return doubleX
    }
  })
)
// An RxJS 'Observer', as the argument to subscribe,
// is similar to an Antares Renderer
// work.subscribe(pos => drawKitt(pos))

// experiment
const period = 3000
const startTime = animationFrameScheduler.now()
interval(0, animationFrameScheduler)
  .pipe(
    // uncomment to drop frames - every other
    // filter(i => i % 2 === 0),
    // filter(i => Math.random() > 0.3),
    // turn elapsed time into a decimal expressed as 0..1 part of the period
    map(() => animationFrameScheduler.now() - startTime),
    map(delta => (delta % period) / period),
    // wrap the period around at 0.5 to make it reverse
    map(phase => 2 * width * (phase < 0.5 ? phase : 1 - phase))
    // stop after a while
    // takeUntil(timer(10000))
  )
  .subscribe(pos => drawKitt(pos))
