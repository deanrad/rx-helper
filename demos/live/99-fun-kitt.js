const { interval } = require("rxjs")
const { map } = require("rxjs/operators")
const { stdout } = require('process')

// writes a line to stdout with XX at pos
//           pos
//           XX   
const width=50       
const drawKitt = (pos, glyph="-O-") => {
    let line = ""
    for(let i=0; i < pos; i++) {
        line += " "
    }
    line += glyph
    for(let i=width; i > width-pos; i--) {
        line += " "
    }
    stdout.write(line + "\n")
}

const work = interval(16).pipe(
    map(i => {
        const doubleX = i % (width*2)
        if (doubleX > width) {
            return (width*2) - doubleX
        } else {
            return doubleX
        }
    }),
    map(pos => drawKitt(pos))
)

work.subscribe() // alias for start()

