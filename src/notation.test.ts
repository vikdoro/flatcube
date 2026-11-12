import { describe, expect, it } from 'vitest'
import { FACES } from './model'
import { formatMove, formatMoves, NotationError, parseMove, parseMoves } from './notation'
import { IDENTITY } from './vec'
import { boardMove } from './view'

const SUFFIXES = [['', 1], ["'", 3], ['2', 2]] as const

describe('notation', () => {
  it('reads each face turn as the board names it, with the cube held as at the start', () => {
    for (const face of FACES) {
      for (const [suffix, amount] of SUFFIXES) {
        expect(parseMove(face + suffix)).toEqual(boardMove(IDENTITY, face, amount))
      }
    }
  })

  it('accepts the usual spellings of a prime and of a half turn', () => {
    expect(parseMove('R′')).toEqual(parseMove("R'"))
    expect(parseMove('R’')).toEqual(parseMove("R'"))
    expect(parseMove("R2'")).toEqual(parseMove('R2'))
    expect(parseMove('R2′')).toEqual(parseMove('R2'))
  })

  it('reads a sequence, whatever the whitespace between the moves', () => {
    const expected = ['R', 'U', "R'", "U'"].map(parseMove)
    expect(parseMoves("R U R' U'")).toEqual(expected)
    expect(parseMoves("  R\tU\n R'   U' ")).toEqual(expected)
    expect(parseMoves('')).toEqual([])
    expect(parseMoves('   ')).toEqual([])
  })

  it('rejects what it does not understand', () => {
    for (const bad of ['', 'X', 'Q', 'R3', "R''", 'R22', '2R', '(R', 'RU', 'Rw', 'x']) {
      expect(() => parseMove(bad), bad).toThrow(NotationError)
    }
    expect(() => parseMoves("R U Q F'")).toThrow(NotationError)
    expect(() => parseMoves('R U RU')).toThrow(NotationError)
  })

  it('names the token it could not read', () => {
    expect(() => parseMoves("R U Q F'")).toThrow(/Q/)
  })

  it('says why lowercase (wide) moves and slice moves are not supported', () => {
    expect(() => parseMove('r')).toThrow(/wide/i)
    for (const slice of ['M', 'E', 'S']) expect(() => parseMove(slice)).toThrow(/slice/i)
  })

  it('formats with an ASCII prime, and writes a half turn as 2 whichever way it was spelled', () => {
    expect(formatMoves(parseMoves("R  U2'  F′  D2  L’"))).toBe("R U2 F' D2 L'")
    expect(formatMoves([])).toBe('')
  })

  it('round trips every face turn', () => {
    for (const face of FACES) {
      for (const [suffix] of SUFFIXES) {
        const token = face + suffix
        expect(formatMove(parseMove(token))).toBe(token)
      }
    }
  })
})
