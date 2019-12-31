const { init } = require("@rematch/core")
const { StoreAgent } = require("../../src/agent")

const round = {
  state: {
    responses: [],
    summary: {} // of answers chosen
  },
  reducers: {
    "game/nextQuestion": (state, question) => {
      const summary = question.choices.reduce((o, choice) => ({ ...o, [choice]: 0 }), {})
      return {
        ...state,
        summary,
        question,
        responses: [] // responses should have been archived already
      }
    },
    respond: (state, response) => {
      const responses = [...state.responses, response]
      const { choice } = response
      const summary = {
        ...state.summary,
        [choice]: state.summary[choice] + 1
      }
      return {
        ...state,
        responses,
        summary
      }
    }
  }
}

const game = {
  state: {
    players: [],
    questions: [],
    responses: [],
    status: "waiting"
  },
  reducers: {
    addQuestion: (state, question) => {
      const questions = [...state.questions, question]
      return {
        ...state,
        questions
      }
    },
    joinPlayer: (state, player) => {
      const players = [...state.players, player]
      return {
        ...state,
        players
      }
    },
    nextQuestion: (state, question) => {
      const questions = state.questions.filter(q => q.prompt !== question.prompt)
      return {
        ...state,
        questions,
        status: "playing"
      }
    }
  }
}

// Models the store per https://rematch.gitbooks.io/rematch/
const createStore = () =>
  init({
    models: {
      round,
      game
    }
  })

module.exports.createAgents = () => {
  const server = new StoreAgent(createStore(), { agentId: "server" })
  const player1 = new StoreAgent(createStore(), { agentId: "player1" })
  const emcee = new StoreAgent(createStore(), { agentId: "emcee" })

  const clients = [player1, emcee]

  // Follow the topology.. Each player to the servers, the server to clients, emcee
  clients.forEach(client => {
    client.filter(isRelayable, ({ event }) => server.process(event))
  })

  server.filter(["game/nextQuestion"], ({ event }) => {
    clients.forEach(client => client.process({ ...event, relay: false }))
  })
  return { server, player1, emcee }
}

const isRelayable = ({ event }) => {
  if (event.relay === false) return false
  return ["game/addQuestion", "game/joinPlayer", "game/nextQuestion", "round/respond"].includes(
    event.type
  )
}
