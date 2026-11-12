import { describe, expect, it } from 'vitest'
import {
  applyMove, applyMoves, FACES, inverse, isSolved, permutation, pieceSlots, SLOTS, SOLVED, type Layer, type Move,
} from './model'

const LAYERS: Layer[] = [...FACES, 'M', 'E', 'S']
const parse = (alg: string): Move[] => alg.split(' ').map(t => ({
  layer: t[0] as Layer, amount: t.endsWith("'") ? 3 : t.endsWith('2') ? 2 : 1,
}))

describe('cube model', () => {
  it('has 6 centres, 12 edges and 8 corners', () => {
    const sizes = SLOTS.map(s => pieceSlots(s.index).length)
    expect(sizes.filter(n => n === 1)).toHaveLength(6)
    expect(sizes.filter(n => n === 2)).toHaveLength(24)
    expect(sizes.filter(n => n === 3)).toHaveLength(24)
  })

  it('moves are permutations of the 54 slots', () => {
    for (const layer of LAYERS) expect(new Set(permutation({ layer, amount: 1 })).size).toBe(54)
  })

  it('a face turn moves 20 stickers, a slice turn 12', () => {
    const moved = (layer: Layer) => permutation({ layer, amount: 1 }).filter((to, from) => to !== from).length
    for (const face of FACES) expect(moved(face)).toBe(20)
    for (const slice of ['M', 'E', 'S'] as const) expect(moved(slice)).toBe(12)
  })

  it('four quarter turns of any layer change nothing', () => {
    for (const layer of LAYERS) expect(applyMoves(SOLVED, Array(4).fill({ layer, amount: 1 }))).toEqual(SOLVED)
  })

  it('a move followed by its inverse changes nothing', () => {
    const start = applyMoves(SOLVED, parse("R U F' D2 L B'"))
    for (const layer of LAYERS) {
      for (const amount of [1, 2, 3] as const) {
        expect(applyMove(applyMove(start, { layer, amount }), inverse({ layer, amount }))).toEqual(start)
      }
    }
  })

  it('(R U R′ U′) six times is the identity', () => {
    const sexy = parse("R U R' U'")
    expect(applyMoves(SOLVED, Array(6).fill(sexy).flat())).toEqual(SOLVED)
    expect(isSolved(applyMoves(SOLVED, sexy))).toBe(false)
  })

  it('R turns the front face up', () => {
    // a clockwise R, seen from the right, carries the right column of F to U
    const after = applyMove(SOLVED, { layer: 'R', amount: 1 })
    const upRightColumn = [2, 5, 8].map(slot => Math.floor(after[slot] / 9))
    expect(upRightColumn).toEqual([2, 2, 2]) // F stickers
  })
})
