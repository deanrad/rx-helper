const bodyParser = require("body-parser")
const express = require("express")
const morgan = require("morgan")
const { Agent, randomIdFilter } = require("rx-helper")
const app = express()
const port = process.env.PORT || 3120
const { storeFilter } = require("./store")

const agent = new Agent({ agentId: `http://localhost:${port}` })
agent.addFilter(storeFilter)
agent.addFilter(randomIdFilter())
agent.on("http/get",
  ({ action, context }) => {
    // Get some fields from the action itself
    const {
      payload: { query, path },
      meta: { actionId } // the randomId filter put this property here for us
    } = action

    // And get our response object from the context so we can write to it
    const { res } = context
    // we dont have different endpoints yet
    if (path.includes("api")) {
      res.json({ path, query, actionId })
      return
    } else if (path === "/") {
      res.sendFile("index.html", { root: "." })
      return
    } else if (path === "/demos/home/kitt.js") {
      res.sendFile("kitt.js", { root: "./docs/" })
    } else {
      res.sendFile(path, { root: "./demos/express/" })
      return
    }
  }
)
app.use(bodyParser.urlencoded({ extended: true }))
app.use(express.static("."))
app.use(morgan("dev"))

// Unlike a regular express router, our sole job here is to put an action
// on the stream with sufficient context for a renderer to respond.
app.get("*", function(req, res) {
  const { path, query } = req
  const payload = { path, query }

  const type = "http/" + req.method.toLowerCase()
  const action = { type, payload }

  // Provide the response object in the 2nd parameter 'context'
  agent.process(action, { res })

  console.log(payload)
})

app.listen(port, () => console.log(`Listening on radio FM http://localhost:${port}`))
