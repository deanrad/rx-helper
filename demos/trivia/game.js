// The game has the players, the questions that can be asked, and a status.
// See https://rematch.gitbooks.io/rematch/docs/api.html#reducers
module.exports = {
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
  },
  // Actions other reducers will refer to are listed below
  nextQuestion: "game/nextQuestion"
}
