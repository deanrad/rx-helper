const path = require("path")

module.exports = {
  entry: "./src/rx-helper.ts",
  mode: "production",
  module: {
    rules: [
      {
        test: /\.tsx?$/,
        use: "ts-loader",
        exclude: /node_modules/
      }
    ]
  },
  resolve: {
    extensions: [".tsx", ".ts", ".js"]
  },
  output: {
    library: "RxHelper",
    libraryTarget: "umd",
    globalObject: "this",
    filename: "rx-helper.js",
    path: path.resolve(__dirname, "dist")
  }
}
