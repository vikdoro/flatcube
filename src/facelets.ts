import { faceOf, FACES, SLOTS, SOLVED, type CubeState, type Face } from './model'

/** The text is not a cube that can be reached by turning; the message says why. */
export class FaceletError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'FaceletError'
  }
}

/**
 * Facelets are the interchange format of cube solvers: 54 letters, the faces in the order U R F D L B, each read row
 * by row as seen from outside a standard cube (white U, green F). The model has its own frame, where U is the board's
 * middle face: the facelet at a standard place is found by mirroring the place in y, and its letter is the board name
 * of the sticker's face, U and D swapped.
 */
const LETTER: Record<Face, Face> = { U: 'D', D: 'U', R: 'R', L: 'L', F: 'F', B: 'B' }

const slotAt = new Map(SLOTS.map(s => [`${s.pos}|${s.normal}`, s.index]))

/** For each facelet, the model slot that holds it: that of the mirrored place. */
const HOLDER = SLOTS.map(s => slotAt.get(`${[s.pos[0], -s.pos[1], s.pos[2]]}|${[s.normal[0], -s.normal[1], s.normal[2]]}`)!)

export const toFacelets = (state: CubeState) => HOLDER.map(slot => LETTER[faceOf(state[slot])]).join('')

// the facelets of each edge and corner, as in the standard tables: an edge's first facelet is on U or D (or, for the
// middle layer, on F or B), a corner's first is on U or D and the others follow clockwise
const EDGES = [
  [5, 10], [7, 19], [3, 37], [1, 46], [32, 16], [28, 25], [30, 43], [34, 52], [23, 12], [21, 41], [50, 39], [48, 14],
]
const CORNERS = [
  [8, 9, 20], [6, 18, 38], [0, 36, 47], [2, 45, 11], [29, 26, 15], [27, 44, 24], [33, 53, 42], [35, 17, 51],
]

const letterAt = (i: number) => FACES[Math.floor(i / 9)]

/** Which piece sits at each position, and how it is twisted or flipped; null when the stickers are no real piece. */
function read(text: string, pieces: number[][]) {
  const home = pieces.map(p => p.map(letterAt))
  const seen = new Set<number>()
  return pieces.map(position => {
    const letters = position.map(i => text[i])
    const piece = home.findIndex(h => h.every(l => letters.includes(l as Face)))
    const turn = home[piece]?.indexOf(letters[0] as Face)
    // a corner must read clockwise like the piece it is: a mirrored corner is no corner
    if (piece < 0 || seen.has(piece) || letters.some((l, k) => l !== home[piece][(turn + k) % home[piece].length]))
      throw new FaceletError(`stickers ${position.map(i => i + 1).join(', ')} are not one of the cube's pieces, or repeat one`)
    seen.add(piece)
    return { piece, turn }
  })
}

const parity = (perm: number[]) => perm.reduce((odd, p, i) => odd ^ perm.slice(i + 1).filter(q => q < p).length % 2, 0)

/**
 * The state written as facelets. It rejects what no sequence of turns can reach: a wrong length, letters that are not
 * faces, not nine of each, centres out of place, stickers that are no real pieces, a twisted corner, a flipped edge or
 * two pieces swapped.
 */
export function fromFacelets(text: string): CubeState {
  if (text.length !== 54) throw new FaceletError(`expected 54 facelets, got ${text.length}`)
  if ([...text].some(l => !FACES.includes(l as Face))) throw new FaceletError('facelets are letters from URFDLB')
  for (const face of FACES) {
    if ([...text].filter(l => l === face).length !== 9) throw new FaceletError(`not nine ${face} facelets`)
    if (text[FACES.indexOf(face) * 9 + 4] !== face) throw new FaceletError(`the ${face} centre is out of place`)
  }
  const edges = read(text, EDGES), corners = read(text, CORNERS)
  if (corners.reduce((sum, c) => sum + c.turn, 0) % 3) throw new FaceletError('a corner is twisted')
  if (edges.reduce((sum, e) => sum + e.turn, 0) % 2) throw new FaceletError('an edge is flipped')
  if (parity(edges.map(e => e.piece)) !== parity(corners.map(c => c.piece))) throw new FaceletError('two pieces are swapped')
  const state = [...SOLVED]
  const place = (pieces: number[][], found: { piece: number }[]) => pieces.forEach((position, p) =>
    position.forEach(i => { state[HOLDER[i]] = HOLDER[pieces[found[p].piece].find(j => letterAt(j) === text[i])!] }))
  place(EDGES, edges)
  place(CORNERS, corners)
  return state
}
