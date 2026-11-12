import { createRequire } from 'node:module'
import { beforeAll, describe, expect, it } from 'vitest'
import { createCube } from './cube'

/*
 * The point of speaking standard notation and facelets: a solver written for a standard cube solves this one, with
 * nothing translated. cubejs is a Kociemba two-phase solver; it reads a facelet string and answers in notation.
 * (Loaded through require: it is a CommonJS package without types.)
 */
const Cube = createRequire(import.meta.url)('cubejs')

describe('an outside solver', () => {
  // braces: initSolver returns the Cube class, which beforeAll would call as a clean-up function
  beforeAll(() => { Cube.initSolver() }, 60_000)

  for (const scramble of [
    "R U2 F' D B2 L' U R' D2 F U' L2 B R2 D' F2 U B' L D",
    "F2 D' L B2 U R' D2 F' L2 U' B R2 D F2 U2 L' B D2 R F'",
    "B' U2 L D' R2 F U B2 D L' F2 R U' D2 B L2 F' R' U2 D",
  ]) {
    it(`solves the cube from ${scramble}`, () => {
      const cube = createCube()
      cube.apply(scramble)
      expect(cube.isSolved()).toBe(false)
      const solution: string = Cube.fromString(cube.toFacelets()).solve()
      cube.apply(solution)
      expect(cube.isSolved()).toBe(true)
    }, 60_000)
  }
})
