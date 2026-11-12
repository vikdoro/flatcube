import { toFacelets } from './facelets'
import { applyMove, isSolved, SOLVED, type CubeState, type Move } from './model'
import { toMoves } from './notation'

export type CubeEvent = { type: 'move'; move: Move } | { type: 'reset' }

/** A cube with no board: its state, and the turns made on it. */
export interface Cube {
  /** A snapshot: never changed afterwards. */
  readonly state: CubeState
  /** Notation or moves, all or nothing: notation that cannot be read applies nothing and tells nobody. */
  apply(input: string | Move | readonly Move[]): void
  /** Put the cube in a new state (solved by default). */
  reset(state?: CubeState): void
  isSolved(): boolean
  toFacelets(): string
  /** Called for each move, in order, and for a reset. Returns the function that stops it. */
  subscribe(fn: (event: CubeEvent) => void): () => void
}

export function createCube(initial: CubeState = SOLVED): Cube {
  let state = initial
  const listeners = new Set<(event: CubeEvent) => void>()
  const tell = (event: CubeEvent) => listeners.forEach(fn => fn(event))
  return {
    get state() { return state },
    apply(input) {
      for (const move of toMoves(input)) {
        state = applyMove(state, move)
        tell({ type: 'move', move })
      }
    },
    reset(next = SOLVED) {
      state = next
      tell({ type: 'reset' })
    },
    isSolved: () => isSolved(state),
    toFacelets: () => toFacelets(state),
    subscribe(fn) {
      listeners.add(fn)
      return () => { listeners.delete(fn) }
    },
  }
}
