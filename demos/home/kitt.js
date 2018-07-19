// Set up our references to vars and functions
const { interval } = rxjs
const { map, tap, take, concatMap } = rxjs.operators

// Do a fun animation
const canvas = document.getElementById("c")
const context = canvas.getContext("2d")
context.fillStyle = "red"

const width = 70
const drawKitt = pos => {
  const fromX = 5 + pos * 4
  context.clearRect(0, 0, canvas.width, canvas.height)
  context.fillRect(fromX, 50, 20, 50)
}

const work = interval(16).pipe(
  map(i => {
    const doubleX = i % (width * 2)
    if (doubleX > width) {
      return width * 2 - doubleX
    } else {
      return doubleX
    }
  }),
  tap(pos => drawKitt(pos))
)

work.subscribe() // alias for start()
