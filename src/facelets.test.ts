import { describe, expect, it } from 'vitest'
import { FaceletError, fromFacelets, toFacelets } from './facelets'
import { applyMoves, inverse, isSolved, SOLVED } from './model'
import { parseMoves } from './notation'

/*
 * Facelet strings are the de-facto interchange format of cube solvers (Kociemba order): 54 letters, the faces in the
 * order U R F D L B, each read row by row as seen from outside the cube, U with B at the top, D with F at the top.
 * Every expectation below is the standard result of the move on a standard cube (white U, green F), so a solver
 * that reads the string can be trusted with the board's cube.
 */
const faces = (u: string, r: string, f: string, d: string, l: string, b: string) => u + r + f + d + l + b

const after = (algorithm: string) => toFacelets(applyMoves(SOLVED, parseMoves(algorithm)))

const SOLVED_FACELETS = faces('UUUUUUUUU', 'RRRRRRRRR', 'FFFFFFFFF', 'DDDDDDDDD', 'LLLLLLLLL', 'BBBBBBBBB')
const SUPERFLIP = 'UBULURUFURURFRBRDRFUFLFRFDFDFDLDRDBDLULBLFLDLBUBRBLBDB'
const SUPERFLIP_ALGORITHM = "U R2 F B R B2 R U2 L B2 R U' D' R2 F R' L B2 U2 F2"

const swap = (s: string, i: number, j: number) => {
  const a = [...s]
  ;[a[i], a[j]] = [a[j], a[i]]
  return a.join('')
}

describe('toFacelets', () => {
  it('writes the solved cube', () => {
    expect(toFacelets(SOLVED)).toBe(SOLVED_FACELETS)
  })

  it('writes R as a standard cube shows it', () => {
    expect(after('R')).toBe(faces('UUFUUFUUF', 'RRRRRRRRR', 'FFDFFDFFD', 'DDBDDBDDB', 'LLLLLLLLL', 'UBBUBBUBB'))
  })

  it('writes U as a standard cube shows it', () => {
    expect(after('U')).toBe(faces('UUUUUUUUU', 'BBBRRRRRR', 'RRRFFFFFF', 'DDDDDDDDD', 'FFFLLLLLL', 'LLLBBBBBB'))
  })

  it('writes D as a standard cube shows it', () => {
    expect(after('D')).toBe(faces('UUUUUUUUU', 'RRRRRRFFF', 'FFFFFFLLL', 'DDDDDDDDD', 'LLLLLLBBB', 'BBBBBBRRR'))
  })

  it('writes the superflip', () => {
    expect(after(SUPERFLIP_ALGORITHM)).toBe(SUPERFLIP)
  })

  it('has a turn and its prime cancel, and four quarter turns come home', () => {
    expect(after("R R'")).toBe(SOLVED_FACELETS)
    expect(after('F F F F')).toBe(SOLVED_FACELETS)
    expect(after('B2 B2')).toBe(SOLVED_FACELETS)
  })

  it("brings R U R' U' round to solved after six goes", () => {
    expect(after("R U R' U' ".repeat(6))).toBe(SOLVED_FACELETS)
    expect(after("R U R' U' ".repeat(5))).not.toBe(SOLVED_FACELETS)
  })
})

describe('fromFacelets', () => {
  it('reads the solved cube', () => {
    expect(fromFacelets(SOLVED_FACELETS)).toEqual(SOLVED)
  })

  it('gives back the very state a string was written from', () => {
    for (const algorithm of ["R U R' U'", SUPERFLIP_ALGORITHM, "F2 D' L B2 U R' D2 F' L2 U' B R2 D F2 U2 L'"]) {
      const state = applyMoves(SOLVED, parseMoves(algorithm))
      expect(fromFacelets(toFacelets(state))).toEqual(state)
    }
  })

  it('can be undone by the inverse of the algorithm it was scrambled with', () => {
    const algorithm = parseMoves("L' B2 D R U2 F' D' L2 B R'")
    const state = fromFacelets(toFacelets(applyMoves(SOLVED, algorithm)))
    expect(isSolved(applyMoves(state, algorithm.map(inverse).reverse()))).toBe(true)
  })

  it('rejects a string of the wrong length or with letters that are not faces', () => {
    expect(() => fromFacelets(SOLVED_FACELETS.slice(1))).toThrow(FaceletError)
    expect(() => fromFacelets(SOLVED_FACELETS + 'U')).toThrow(FaceletError)
    expect(() => fromFacelets('X' + SOLVED_FACELETS.slice(1))).toThrow(FaceletError)
    expect(() => fromFacelets(SOLVED_FACELETS.toLowerCase())).toThrow(FaceletError)
  })

  it('rejects colours that are not nine of each', () => {
    expect(() => fromFacelets('R' + SOLVED_FACELETS.slice(1))).toThrow(FaceletError)
  })

  it('rejects stickers that do not form real pieces', () => {
    // U2 (the UB edge) traded with R2 (the UR edge): UR reads (U, U) and UB reads (R, B)
    expect(() => fromFacelets(swap(SOLVED_FACELETS, 1, 10))).toThrow(FaceletError)
  })

  it('rejects a cube that cannot be reached by turning: one flipped edge', () => {
    // U6 and R2 are the two stickers of the UR edge
    expect(() => fromFacelets(swap(SOLVED_FACELETS, 5, 10))).toThrow(FaceletError)
  })

  it('rejects a cube that cannot be reached by turning: one twisted corner', () => {
    const a = [...SOLVED_FACELETS]
    // the URF corner is U9 R1 F3: read it as (R, F, U), a twist
    a[8] = 'R'
    a[9] = 'F'
    a[20] = 'U'
    expect(() => fromFacelets(a.join(''))).toThrow(FaceletError)
  })

  it('rejects a cube that cannot be reached by turning: two edges swapped', () => {
    // UF and UR trade places, each keeping its orientation
    expect(() => fromFacelets(swap(swap(SOLVED_FACELETS, 7, 5), 19, 10))).toThrow(FaceletError)
  })
})
