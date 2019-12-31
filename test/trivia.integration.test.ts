// @ts-nocheck
import { StoreAgent } from "../src/agent"
import { createAgents } from "../demos/trivia/store"

describe("Multi-agent Trivia Game", () => {
  let server: StoreAgent // the server
  let player1: StoreAgent // a player
  let emcee: StoreAgent // the real-life game operator
  const pantsQ = { prompt: "Pants?", choices: ["Yes", "No"] }
  const pantsA = { answer: "No" }

  it.only("should play the whole game without error", () => {
    // It is the emcee that sets up the questions of a game
    let expetectedState = {
      questions: [pantsQ]
    }
    emcee.trigger("game/addQuestion", pantsQ)
    expect(server.state.game).toMatchObject(expetectedState)

    // Players joining (on their local device) are known by the server
    const joinedState = {
      players: [{ name: "Declan" }]
    }
    player1.trigger("game/joinPlayer", { name: "Declan" })
    expect(server.state.game).toMatchObject(joinedState)
    expect(server.state.game).toMatchObject(joinedState)

    // begin game
    emcee.trigger("game/nextQuestion", pantsQ)
    expetectedState = {
      game: {
        status: "playing",
        questions: []
      },
      round: {
        question: Object.assign(pantsQ, pantsA)
      }
    }
    expect(server.state).toMatchObject(expetectedState)
    expect(player1.state).toMatchObject(expetectedState)
    // players answer when the round changes

    const playerAnswer = { from: player1.agentId, choice: "No" }
    player1.trigger("round/respond", playerAnswer)

    expect(player1.state.round.responses).toContain(playerAnswer)
    expect(server.state.round.responses).toContain(playerAnswer)
    expect(server.state.round.summary).toMatchObject({ Yes: 0, No: 1 })

    emcee.trigger("game/nextQuestion", pantsQ)
    expect(emcee.state.round.question).toMatchObject(pantsQ)
    expect(emcee.state.round.responses).toHaveLength(0)
  })

  beforeAll(() => {
    const agents = createAgents()
    server = agents.server
    emcee = agents.emcee
    player1 = agents.player1
  })
})
