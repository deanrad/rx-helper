import camelCase from "lodash.camelcase"
import commonjs from "rollup-plugin-commonjs"
import gzip from "rollup-plugin-gzip"
import json from "rollup-plugin-json"
import resolve from "rollup-plugin-node-resolve"
import sourceMaps from "rollup-plugin-sourcemaps"
import typescript from "rollup-plugin-typescript2"

const pkg = require("./package.json")

const libraryName = "antares-protocol"

export default {
  input: `src/${libraryName}.ts`,
  output: [
    { file: pkg.main, name: camelCase(libraryName), format: "umd" },
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
    // Compile TypeScript files
    typescript({ useTsconfigDeclarationDir: true }),
    // Allow bundling cjs modules (unlike webpack, rollup doesn't understand cjs)
    commonjs(),
    // Allow node_modules resolution, so you can use 'external' to control
    // which external modules to include in the bundle
    // https://github.com/rollup/rollup-plugin-node-resolve#usage
    resolve(),

    // Resolve source maps to the original source
    sourceMaps(),

    // Brings from 846Kb raw, 135Kb gzip down to  618Kb raw, 109Kb gzip !! :)
    // but takes a while.. I've left it disabled as a freebie win 4 later  :)
    // minify(),  // from rollup-plugin-babel-minify

    // Generate gzip
    gzip()
  ]
}
