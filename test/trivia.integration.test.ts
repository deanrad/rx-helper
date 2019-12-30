// @ts-nocheck
import { StoreAgent } from "../src/agent"
import { init as initStore } from "@rematch/core"
import { triviaStoreConfig } from "../demos/trivia/store"

describe("Multi-agent Trivia Game", () => {
  let server: StoreAgent // the server
  let player1: StoreAgent // a player
  let emcee: StoreAgent // the real-life game operator
  const pantsQ = { prompt: "Pants?", choices: ["Yes", "No"] }
  const pantsA = { answer: "No" }

  it.only("should play the whole game without error", () => {
    // set up questions
    player1.trigger("game/addQuestion", pantsQ)
    expect(server.state.game).toMatchObject({
      questions: [pantsQ]
    })

    // Players joining (on their local device) are known by the server
    player1.trigger("game/joinPlayer", { name: "Declan" })
    const joinedState = {
      players: [{ name: "Declan" }]
    }
    expect(server.state.game).toMatchObject(joinedState)
    expect(server.state.game).toMatchObject(joinedState)

    // begin game
    emcee.process({ type: "game/nextQuestion", payload: pantsQ, meta: { push: true } })
    const roundUnanswered = {
      game: {
        status: "playing",
        questions: []
      },
      round: {
        question: Object.assign(pantsQ, pantsA)
      }
    }
    expect(server.state).toMatchObject(roundUnanswered)
    expect(player1.state).toMatchObject(roundUnanswered)
    // players answer when the round changes

    const playerAnswer = { from: player1.agentId, choice: "No" }
    player1.process({
      type: "round/respond",
      payload: playerAnswer
    })

    expect(player1.state.round.responses).toContain(playerAnswer)
    expect(server.state.round.responses).toContain(playerAnswer)
    expect(server.state.round.summary).toMatchObject({ Yes: 0, No: 1 })

    // Once the next question is chosen by the emcee, saveResponses
    // will process just prior to nextQuestion
    emcee.process({
      type: "root/saveResponses",
      payload: playerAnswer
    })
    expect(emcee.state.game.responses).toContain(playerAnswer)

    emcee.process({
      type: "game/nextQuestion",
      payload: pantsQ
    })
    expect(emcee.state.round.question).toMatchObject(pantsQ)
    expect(emcee.state.round.responses).toHaveLength(0)
  })

  beforeAll(() => {
    server = new StoreAgent(initStore(triviaStoreConfig), { agentId: "server" })
    player1 = new StoreAgent(initStore(triviaStoreConfig), { agentId: "player1" })
    emcee = new StoreAgent(initStore(triviaStoreConfig), { agentId: "emcee" })

    // The topology defines who sends events to whom
    const topology = {
      player1: [server],
      emcee: [server],
      server: [player1, emcee]
    }
    const players = [player1, emcee]

    // Follow the topology.. Each player to the servers, the server to players, emcee
    players.forEach(player => {
      player.filter(["game/addQuestion", "game/joinPlayer", "game/nextQuestion"], ({ event }) => {
        event.relay !== false && server.process(event)
      })
    })

    server.filter(["game/nextQuestion"], ({ event }) => {
      players.forEach(player => player.process({ ...event, relay: false }))
    })
  })
})
