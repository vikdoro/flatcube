import { FACES, type Face, type Move } from './model'
import { IDENTITY } from './vec'
import { boardMove, boardMoveName } from './view'

/** The text could not be read as moves; the message names the token. */
export class NotationError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'NotationError'
  }
}

const AMOUNT = new Map<string, Move['amount']>([['', 1], ["'", 3], ['′', 3], ['’', 3], ['2', 2], ["2'", 2], ['2′', 2], ['2’', 2]])

function refuse(token: string): never {
  const reason =
    /^[urfdlb]/.test(token) || /^[URFDLB]w/.test(token) ? 'wide moves are not supported'
    : /^[MES]/.test(token) ? 'slice moves are not supported'
    : /^[xyz]/.test(token) ? 'rotations are not supported'
    : 'not a move'
  throw new NotationError(`"${token}": ${reason}`)
}

/**
 * One move in standard notation (U D F B L R, ′ or ' for anticlockwise, 2 for a half turn), as on a cube held with
 * white on top and green in front. It means the same whatever the board is showing.
 */
export function parseMove(token: string): Move {
  const face = token[0] as Face, amount = AMOUNT.get(token.slice(1))
  if (!FACES.includes(face) || !amount) refuse(token)
  return boardMove(IDENTITY, face, amount)
}

/** Moves given as notation, one move or a list. */
export const toMoves = (input: string | Move | readonly Move[]): readonly Move[] =>
  typeof input === 'string' ? parseMoves(input) : 'layer' in input ? [input] : input

export const parseMoves = (text: string): Move[] => text.split(/\s+/).filter(Boolean).map(parseMove)

export function formatMove(move: Move) {
  if (move.layer === 'M' || move.layer === 'E' || move.layer === 'S') throw new NotationError(`"${move.layer}": slice moves are not supported`)
  return boardMoveName(IDENTITY, move).replace('′', "'")
}

export const formatMoves = (moves: readonly Move[]) => moves.map(formatMove).join(' ')
