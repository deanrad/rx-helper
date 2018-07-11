const path = require("path")

module.exports = {
  entry: "./src/antares-protocol.ts",
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
    library: "AntaresProtocol",
    libraryTarget: "umd",
    globalObject: "this",
    filename: "antares-protocol.js",
    path: path.resolve(__dirname, "dist")
  }
}
