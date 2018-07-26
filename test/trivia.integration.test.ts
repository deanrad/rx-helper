import { Agent } from "../src/antares-protocol"
import { createStore, Reducer } from "redux"

describe("Multi-agent Trivia Game", () => {
  let moderator: Agent // the server
  let player1: Agent // a player
  let emcee: Agent // the real-life game operator

  const reducer: Reducer = (state = {}, action) => state

  beforeAll(() => {
    moderator = new Agent()
    player1 = new Agent()
    emcee = new Agent()

    // All agents have a store
    ;[moderator, player1].forEach(agent => {
      const store = createStore(reducer)
      agent.addFilter(({ action }) => store.dispatch(action))
    })

    // The moderator (server) renders most actions to all clients
    moderator.addFilter(({ action }) => {
      const meta = action.meta || {}
      if (meta["push"] === false) return

      player1.process(action)
      emcee.process(action)
    })
  })

  it("should set up agents", () => {
    expect(moderator).toBeInstanceOf(Agent)
    expect(player1).toBeInstanceOf(Agent)
  })

  it("should send actions from the moderator to others", () => {
    expect.assertions(1)
    let emceeGotIt = emcee.nextOfType("test/foo")

    moderator.process({ type: "test/foo" })

    return emceeGotIt.then(action => {
      expect(action).toMatchObject({ type: "test/foo" })
    })
  })
})
