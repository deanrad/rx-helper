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

const storeFilter = ({ action }) => store.dispatch(action)
store.subscribe(() => console.log("> ", store.getState()))

module.exports = {
  store,
  storeFilter
}
