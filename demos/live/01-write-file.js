const fs = require("fs")

// These are the names we want to write to the file in various combinations

const names = ["Jake Weary", "ScarJo", "Chris Hemsworth", "Mark Ruffalo"]

names.forEach(name => {
  fs.appendFileSync("../scratch/live-actors.yml", name + "\n", "UTF8")
})

