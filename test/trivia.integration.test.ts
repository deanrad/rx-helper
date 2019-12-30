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
    emcee.process({ type: "game/nextQuestion", payload: pantsQ })
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
    player1.process({
      type: "round/respond",
      payload: playerAnswer
    })

    expect(player1.state.round.responses).toContain(playerAnswer)
    expect(server.state.round.responses).toContain(playerAnswer)
    expect(server.state.round.summary).toMatchObject({ Yes: 0, No: 1 })

    // Once the next question is chosen by the emcee, saveResponses
    // will process just prior to nextQuestion
    // LEFTOFF- check the rematch/core API for why this isn't right with 1.3.0
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
      player.filter(
        ["game/addQuestion", "game/joinPlayer", "game/nextQuestion", "round/respond"],
        ({ event }) => {
          event.relay !== false && server.process(event)
        }
      )
    })

    server.filter(["game/nextQuestion"], ({ event }) => {
      players.forEach(player => player.process({ ...event, relay: false }))
    })
  })
})
