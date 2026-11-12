import { FACE_NORMAL, FACES, inverse, moveName, type Face, type Move, type Slot } from './model'
import { equals, quarterTurn, thenApply, transform, type Mat3, type Vec3 } from './vec'

/**
 * Which way the cube is held on the board: the rotation from cube coordinates to board coordinates.
 * On the board, +y is the face in the middle (towards you), -z points up the page and +x to the right.
 */
export type View = Mat3

export const toBoard = (view: View, v: Vec3) => transform(view, v)

/** The face that sits in the middle of the board. */
export const facingFace = (view: View): Face => FACES.find(f => toBoard(view, FACE_NORMAL[f])[1] === 1)!

/** The cube face shown at the place on the board where `face` sits when the cube is held straight. */
const boardFace = (view: View, face: Face): Face =>
  FACES.find(f => equals(FACE_NORMAL[f], toBoard(view, FACE_NORMAL[face])))!

/**
 * Moves are named by where their face sits on the board, not by the cube's own faces, as if looking down into the
 * cube from above: the middle is always D, the lid U, the far side (top of the page) B and the near side F. Every face
 * is seen from inside the cube, so a turn that looks clockwise on the board is anticlockwise in the usual notation
 * and gets a prime. Rolling the cube renames its moves.
 */
const BOARD_NAME: Record<Face, Face> = { U: 'D', D: 'U', R: 'R', L: 'L', F: 'F', B: 'B' }

export function boardMoveName(view: View, move: Move) {
  const layer = move.layer
  if (layer === 'M' || layer === 'E' || layer === 'S') return moveName(move)
  return moveName(inverse({ ...move, layer: BOARD_NAME[boardFace(view, layer)] }))
}

/** The move a board name stands for: boardMoveName the other way round. */
export function boardMove(view: View, name: Face, amount: Move['amount']): Move {
  const layer = FACES.find(f => BOARD_NAME[boardFace(view, f)] === name)!
  return inverse({ layer, amount })
}

// the board name of each direction on the board, for naming the places on it
const AT: [Face, Face][] = [['U', 'D'], ['B', 'F'], ['L', 'R']] // [negative, positive] along board y, z, x
const AXES = [1, 2, 0] // name pieces U/D first, then F/B, then R/L

/**
 * A fixed place on the board by its board names, the face it is on first, then the rest of its piece: DFR is the
 * corner sticker on the middle face nearest you on the right, RDF the same corner's sticker on the right side.
 */
export function boardSlotName(view: View, slot: Slot) {
  const pos = toBoard(view, slot.pos), n = toBoard(view, slot.normal)
  const name = (axis: number, sign: number) => AT[AXES.indexOf(axis)][sign > 0 ? 1 : 0]
  const own = AXES.find(a => n[a] !== 0)!
  return name(own, n[own]) + AXES.filter(a => a !== own && pos[a] !== 0).map(a => name(a, pos[a])).join('')
}

/**
 * Roll the cube so that the face whose normal points along `boardNormal` (in board coordinates) comes to the
 * middle: a quarter turn towards you for a side, a half turn for the lid.
 */
export function rollTowards(view: View, boardNormal: Vec3): View {
  const [nx, ny, nz] = boardNormal
  if (ny === 1) return view
  if (ny === -1) return thenApply(view, ([x, y, z]) => [x, -y, -z])
  return thenApply(view, v => quarterTurn(v, [nz, 0, -nx]))
}
