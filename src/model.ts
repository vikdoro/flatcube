import { add, dot, quarterTurn, type Vec3 } from './vec'

/** The six faces, in sticker order: sticker ids 0–8 are on U, 9–17 on R, and so on. */
export const FACES = ['U', 'R', 'F', 'D', 'L', 'B'] as const
export type Face = (typeof FACES)[number]

/** Middle slices. Beginners only turn faces; slices are only used to recognise a drag along a middle row. */
export type Slice = 'M' | 'E' | 'S'
export type Layer = Face | Slice

/** A turn of one layer by 1, 2 or 3 clockwise quarter turns (3 is one anticlockwise turn). */
export interface Move {
  layer: Layer
  amount: 1 | 2 | 3
}

export const FACE_NORMAL: Record<Face, Vec3> = {
  U: [0, 1, 0], R: [1, 0, 0], F: [0, 0, 1], D: [0, -1, 0], L: [-1, 0, 0], B: [0, 0, -1],
}

/**
 * The axis each layer turns about, clockwise when looking along it from outside the cube.
 * The middle slices follow L, D and F, as in standard notation.
 */
export const LAYER_AXIS: Record<Layer, Vec3> = { ...FACE_NORMAL, M: [-1, 0, 0], E: [0, -1, 0], S: [0, 0, 1] }

// how a face's 3×3 grid of stickers lies on the cube: rows step along ROW_STEP, columns along COLUMN_STEP
const ROW_STEP: Record<Face, Vec3> = { U: [0, 0, 1], R: [0, -1, 0], F: [0, -1, 0], D: [0, 0, -1], L: [0, -1, 0], B: [0, -1, 0] }
const COLUMN_STEP: Record<Face, Vec3> = { U: [1, 0, 0], R: [0, 0, -1], F: [1, 0, 0], D: [1, 0, 0], L: [0, 0, 1], B: [-1, 0, 0] }

const isSlice = (layer: Layer): layer is Slice => layer === 'M' || layer === 'E' || layer === 'S'

/** Whether the piece at pos belongs to the layer: a face holds the outer slab of pieces, a slice the middle one. */
export const inLayer = (pos: Vec3, layer: Layer) => dot(pos, LAYER_AXIS[layer]) === (isSlice(layer) ? 0 : 1)

/** The layer that holds the pieces at coordinate c (-1, 0 or 1) along axis 0 (x), 1 (y) or 2 (z). */
export function layerAt(axis: number, c: number): Layer {
  const layers: Layer[][] = [['L', 'M', 'R'], ['D', 'E', 'U'], ['B', 'S', 'F']]
  return layers[axis][c + 1]
}

/** A fixed place for a sticker on the cube: the piece position and the direction the sticker faces. */
export interface Slot {
  index: number
  face: Face
  pos: Vec3
  normal: Vec3
}

/** All 54 slots. Slot i holds sticker i when the cube is solved. */
export const SLOTS: readonly Slot[] = Array.from({ length: 54 }, (_, index) => {
  const face = FACES[Math.floor(index / 9)]
  const row = Math.floor((index % 9) / 3), column = index % 3
  const normal = FACE_NORMAL[face]
  return { index, face, pos: add(add(normal, ROW_STEP[face], row - 1), COLUMN_STEP[face], column - 1), normal }
})

/** Which sticker sits in each slot: state[slot] is a sticker id. */
export type CubeState = readonly number[]

export const SOLVED: CubeState = SLOTS.map(s => s.index)

export const faceOf = (stickerId: number): Face => FACES[Math.floor(stickerId / 9)]

export const isSolved = (state: CubeState) => state.every((id, slot) => faceOf(id) === SLOTS[slot].face)

const slotKey = (pos: Vec3, normal: Vec3) => `${pos}|${normal}`
const slotAt = new Map(SLOTS.map(s => [slotKey(s.pos, s.normal), s.index]))

const PIECES = SLOTS.map(s => SLOTS.filter(t => `${t.pos}` === `${s.pos}`).map(t => t.index))

/** The slots of the piece a slot belongs to: 1 for a centre, 2 for an edge, 3 for a corner. */
export const pieceSlots = (slot: number): readonly number[] => PIECES[slot]

const LAYERS: Layer[] = [...FACES, 'M', 'E', 'S']

// for one clockwise quarter turn of each layer: where the sticker in each slot goes
const QUARTER = Object.fromEntries(LAYERS.map(layer => {
  const axis = LAYER_AXIS[layer]
  return [layer, SLOTS.map(s =>
    inLayer(s.pos, layer) ? slotAt.get(slotKey(quarterTurn(s.pos, axis), quarterTurn(s.normal, axis)))! : s.index)]
})) as Record<Layer, number[]>

const permutations = new Map<string, readonly number[]>()

/** Where the sticker in each slot ends up after the move: it goes from slot i to slot perm[i]. */
export function permutation(move: Move): readonly number[] {
  const key = move.layer + move.amount
  let perm = permutations.get(key)
  if (!perm) {
    let p = SOLVED
    for (let k = 0; k < move.amount; k++) p = p.map(slot => QUARTER[move.layer][slot])
    permutations.set(key, perm = p)
  }
  return perm
}

export function applyMove(state: CubeState, move: Move): CubeState {
  const perm = permutation(move), next = new Array<number>(54)
  state.forEach((id, slot) => { next[perm[slot]] = id })
  return next
}

export const applyMoves = (state: CubeState, moves: readonly Move[]) => moves.reduce(applyMove, state)

export const inverse = (move: Move): Move => ({ layer: move.layer, amount: (4 - move.amount) as Move['amount'] })

export const sameMove = (a: Move, b: Move) => a.layer === b.layer && a.amount === b.amount

/** A move in standard notation: R, R′ (anticlockwise) or R2. */
export const moveName = (move: Move) => move.layer + (move.amount === 3 ? '′' : move.amount === 2 ? '2' : '')
