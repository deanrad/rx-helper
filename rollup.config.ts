import commonjs from "rollup-plugin-commonjs"
import gzip from "rollup-plugin-gzip"
import json from "rollup-plugin-json"
import resolve from "rollup-plugin-node-resolve"
import sourceMaps from "rollup-plugin-sourcemaps"
import typescript from "rollup-plugin-typescript2"
import minify from "rollup-plugin-babel-minify"

const pkg = require("./package.json")

const libraryName = "antares-protocol"

// Our custom steps - order is important!
const customSteps = [typescript({ useTsconfigDeclarationDir: true }), commonjs(), resolve()]

export default {
  input: `src/${libraryName}.ts`,
  output: [
    { file: pkg.main, name: "AntaresProtocol", format: "umd" },
    { file: pkg.module, format: "es" }
  ],
  sourcemap: true,
  // Indicate here external modules you don't wanna include in your bundle (i.e.: 'lodash')
  external: [],
  watch: {
    include: "src/**"
  },
  plugins: [
    // Allow json resolution
    json(),

    // Insert our steps here
    ...customSteps,

    // Resolve source maps to the original source
    sourceMaps(),

    minify(),

    // Generate gzip
    gzip()
  ]
}
