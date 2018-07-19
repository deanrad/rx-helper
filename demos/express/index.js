const bodyParser = require("body-parser")
const express = require("express")
const morgan = require("morgan")
const { Agent, randomId, randomIdFilter } = require("antares-protocol")
const app = express()
const port = process.env.PORT || 3120
const { storeFilter } = require("./store")

const agent = new Agent({ agentId: `http://localhost:${port}` })
agent.addFilter(storeFilter)
agent.addFilter(randomIdFilter)

app.use(bodyParser.urlencoded({ extended: true }))
app.use(express.static("."))
app.use(morgan("dev"))

app.get("*", function(req, res) {
  const { query, body, path } = req
  const payload = { query, body, path }

  const type = "http/" + req.method.toLowerCase()
  const action = { type, payload }
  agent.process(action)

  console.log(payload)

  // we dont have different endpoints yet
  if (req.path.includes("api")) {
    res.json({ id: randomId() })
    return
  } else {
    res.sendFile("index.html", { root: "." })
    return
  }
})

app.listen(port, () => console.log(`Listening on radio FM http://localhost:${port}`))
