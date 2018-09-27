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
agent.addRenderer(
  ({ action, context = {} }) => {
    const { res } = context
    const { payload } = action
    // we dont have different endpoints yet
    if (payload.path.includes("api")) {
      res.json({ id: randomId(6) })
      return
    } else if (payload.path === "/") {
      res.sendFile("index.html", { root: "." })
      return
    } else {
      res.sendFile(payload.path, { root: "./demos/express/" })
      return
    }
  },
  { actionsOfType: "http/get" }
)
app.use(bodyParser.urlencoded({ extended: true }))
app.use(express.static("."))
app.use(morgan("dev"))

// Unlike a regular express router, our sole job here is to put an action
// on the stream with sufficient context for a renderer to respond.
app.get("*", function(req, res) {
  const { query, body, path } = req
  const payload = { query, body, path }

  const type = "http/" + req.method.toLowerCase()
  const action = { type, payload }

  agent.process(action, { req, res })

  console.log(payload)
})

app.listen(port, () => console.log(`Listening on radio FM http://localhost:${port}`))
