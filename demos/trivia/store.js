const round = require("./round")
const game = require("./game")
// Models the store per https://rematch.gitbooks.io/rematch/docs/api.html#reducers
module.exports.triviaStoreConfig = {
  models: {
    round,
    game
  },
  redux: {
    rootReducers: {
      "root/saveResponses": state => {
        const responses = state.round.responses
        const game = state.game
        return {
          ...state,
          game: {
            ...game,
            responses: [...game.responses, ...responses]
          }
        }
      }
    }
  }
}
