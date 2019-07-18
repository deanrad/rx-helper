const { init } = require("@rematch/core")

const store = init({
  models: {
    http: {
      state: {
        requestCount: 0
      },
      reducers: {
        get: (state, _) => {
          return { requestCount: state.requestCount + 1 }
        }
      }
    }
  }
})

const storeFilter = ({ event }) => store.dispatch(event)
store.subscribe(() => console.log("> ", store.getState()))

module.exports = {
  store,
  storeFilter
}
