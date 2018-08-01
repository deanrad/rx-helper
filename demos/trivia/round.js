// The round represents the current question, and any answers
// See https://rematch.gitbooks.io/rematch/docs/api.html#reducers
// Get the action name provided instead of having a magic string.
const { nextQuestion } = require("./game")
module.exports = {
  state: {
    responses: [],
    summary: {} // of answers chosen
  },
  reducers: {
    [nextQuestion]: (state, question) => {
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
