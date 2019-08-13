// @ts-nocheck
import { StoreAgent } from "../src/agent"
import { init as initStore } from "@rematch/core"
import { triviaStoreConfig } from "../demos/trivia/store"

describe("Multi-agent Trivia Game", () => {
  let moderator: StoreAgent // the server
  let player1: StoreAgent // a player
  let emcee: StoreAgent // the real-life game operator
  const pantsQ = { prompt: "Pants?", choices: ["Yes", "No"] }
  const pantsA = { answer: "No" }

  beforeAll(() => {
    moderator = new StoreAgent({ agentId: "moderator" }, initStore(triviaStoreConfig))
    player1 = new StoreAgent({ agentId: "player1" }, initStore(triviaStoreConfig))
    emcee = new StoreAgent({ agentId: "emcee" }, initStore(triviaStoreConfig))

    // The topology defines who sends events to whom
    const topology = {
        player1: [moderator],
        emcee: [moderator],
        moderator: [player1, emcee]
      }

      // Set up agents' properties and relationships to each other
    ;[moderator, player1, emcee].forEach(agent => {
      // Stamp events with agentId
      agent.filter(true, ({ event }) => {
        event.payload.agentId = agent.agentId
      })

      // Agents send events to the others in their topology
      const others = topology[agent.agentId]
      agent.filter(
        () => true,
        ({ event }) => {
          const meta = event.meta || {}

          // events marked meta.push false are not even sent to the server
          if (meta["push"] === false) return

          // We send out events to others but tell them not to push them
          others.forEach(targetAgent => {
            targetAgent.process({
              ...event,
              meta: {
                ...(event.meta || {}),
                // Except, we can tell the moderator to push to all others
                // This will change once diffs of the store are filtered and
                // pushed, instead of the events that caused them.
                push: targetAgent.agentId === "moderator" ? true : false
              }
            })
          })
        }
      )
    })
  })

  it.only("should play the whole game without error", () => {
    // set up questions
    player1.process({ type: "game/addQuestion", payload: pantsQ })
    expect(moderator.state.game).toMatchObject({
      questions: [pantsQ]
    })
    // players join
    player1.process({ type: "game/joinPlayer", payload: { name: "Declan" }, meta: { push: true } })
    const joinedState = {
      players: [{ name: "Declan" }]
    }
    expect(moderator.state.game).toMatchObject(joinedState)
    expect(moderator.state.game).toMatchObject(joinedState)

    // begin game
    emcee.process({ type: "game/nextQuestion", payload: pantsQ, meta: { push: true } })
    const roundUnanswered = (hideAnswers = false) => ({
      game: {
        status: "playing",
        questions: []
      },
      round: {
        question: Object.assign(pantsQ, hideAnswers ? {} : pantsA)
      }
    })
    expect(moderator.state).toMatchObject(roundUnanswered())
    expect(player1.state).toMatchObject(roundUnanswered())
    // players answer when the round changes

    const playerAnswer = { from: player1.agentId, choice: "No" }
    player1.process({
      type: "round/respond",
      payload: playerAnswer
    })

    expect(player1.state.round.responses).toContain(playerAnswer)
    expect(moderator.state.round.responses).toContain(playerAnswer)
    expect(moderator.state.round.summary).toMatchObject({ Yes: 0, No: 1 })

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
})
