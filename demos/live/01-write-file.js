const fs = require("fs")

const names = ["Jake Weary", "ScarJo", "Chris Hemsworth", "Mark Ruffalo"]

for (let name of names) {
  fs.appendFileSync("../scratch/live-actors.yml", name + "\n", "UTF8")
}
