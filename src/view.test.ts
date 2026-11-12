import { describe, expect, it } from 'vitest'
import { applyMove, FACE_NORMAL, FACES, moveName, SLOTS, SOLVED, type CubeState, type Face } from './model'
import { equals, IDENTITY, quarterTurn, type Vec3 } from './vec'
import { boardMove, boardMoveName, boardSlotName, facingFace, rollTowards, toBoard, type View } from './view'

describe('view', () => {
  it('starts with the top face in the middle', () => {
    expect(facingFace(IDENTITY)).toBe('U')
  })

  it('rolling towards a face brings it to the middle, from any view', () => {
    let view = IDENTITY
    for (const step of ['F', 'R', 'D', 'B', 'L', 'U', 'D', 'F']) {
      const face = FACES.find(f => f === step)!
      view = rollTowards(view, toBoard(view, FACE_NORMAL[face]))
      expect(facingFace(view)).toBe(face)
    }
  })

  it('names moves by where their face is on the board', () => {
    let view = IDENTITY
    // the middle is D, seen from inside the cube: clockwise as drawn is D′
    expect(boardMoveName(view, { layer: 'U', amount: 1 })).toBe('D′')
    expect(boardMoveName(view, { layer: 'D', amount: 3 })).toBe('U') // the lid
    view = rollTowards(view, toBoard(view, FACE_NORMAL.F)) // F comes to the middle
    expect(boardMoveName(view, { layer: 'F', amount: 3 })).toBe('D')
    expect(boardMoveName(view, { layer: 'U', amount: 1 })).toBe('B′') // the old top is now the far side
    expect(boardMoveName(view, { layer: 'B', amount: 2 })).toBe('U2') // and the back is the lid
  })

  it('reads a board name back as the move it names, from any view', () => {
    let view = IDENTITY
    for (const step of ['F', 'R', 'D', 'B']) {
      view = rollTowards(view, toBoard(view, FACE_NORMAL[step as Face]))
      for (const name of FACES) {
        for (const amount of [1, 2, 3] as const) {
          expect(boardMoveName(view, boardMove(view, name, amount))).toBe(moveName({ layer: name, amount }))
        }
      }
    }
  })

  it('names each place on the board by where it is', () => {
    const names = SLOTS.map(s => boardSlotName(IDENTITY, s))
    expect(new Set(names).size).toBe(54)
    // the top's corner by the front and right sits in the middle, nearest you on the right
    expect(boardSlotName(IDENTITY, SLOTS.find(s => s.face === 'U' && `${s.pos}` === '1,1,1')!)).toBe('DFR')
    expect(boardSlotName(IDENTITY, SLOTS.find(s => s.face === 'R' && `${s.pos}` === '1,1,1')!)).toBe('RDF')
    expect(boardSlotName(IDENTITY, SLOTS.find(s => s.face === 'D' && `${s.pos}` === '0,-1,0')!)).toBe('U')
  })

  // A real cube held like the board: looking down into the open box, the middle is its bottom (D), the lid its top
  // (U), the far side B and the near side F. Board coordinates have +y towards you, so the real cube's up is -y.
  const real = ([x, y, z]: Vec3): Vec3 => [x, -y, z]
  const ALL_VIEWS = (() => {
    const views: View[] = [IDENTITY]
    for (let i = 0; i < views.length; i++)
      for (const n of [[1, 0, 0], [-1, 0, 0], [0, 0, 1], [0, 0, -1], [0, -1, 0]] as Vec3[]) {
        const next = rollTowards(views[i], n)
        if (!views.some(v => `${v}` === `${next}`)) views.push(next)
      }
    return views
  })()
  const realSlot = (view: View, pos: Vec3, normal: Vec3) =>
    SLOTS.find(s => equals(real(toBoard(view, s.pos)), pos) && equals(real(toBoard(view, s.normal)), normal))!.index
  const playOnBoard = (view: View, state: CubeState, alg: string) => alg.split(' ').reduce((st, t) =>
    applyMove(st, boardMove(view, t[0] as Face, t.endsWith("'") ? 3 : t.endsWith('2') ? 2 : 1)), state)

  it('every board move turns its face like the same move on a real cube, from any view', () => {
    expect(ALL_VIEWS).toHaveLength(24)
    for (const view of ALL_VIEWS) {
      for (const face of FACES) {
        const after = applyMove(SOLVED, boardMove(view, face, 1))
        for (const s of SLOTS) {
          const pos = real(toBoard(view, s.pos)), normal = real(toBoard(view, s.normal)), axis = FACE_NORMAL[face]
          // clockwise looking at the face from outside the real cube
          const to = equals(pos, axis) || pos.some((c, i) => c !== 0 && axis[i] === c)
            ? realSlot(view, quarterTurn(pos, axis), quarterTurn(normal, axis)) : s.index
          expect(after[to]).toBe(s.index)
        }
      }
    }
  })

  it('a T-perm played on the board swaps the same pieces as on a real cube, from any view', () => {
    const at = (view: View, state: CubeState, pos: Vec3, normal: Vec3) => state[realSlot(view, pos, normal)]
    for (const view of ALL_VIEWS) {
      const after = playOnBoard(view, SOLVED, "R U R' U' R' F R2 U' R' U' R U R' F'")
      const moved = SLOTS.filter(s => after[s.index] !== s.index).map(s => `${real(toBoard(view, s.pos))}`)
      // UL and UR edges, UFR and UBR corners, and nothing else
      expect(new Set(moved)).toEqual(new Set(['-1,1,0', '1,1,0', '1,1,1', '1,1,-1']))
      expect(at(view, after, [1, 1, 0], [0, 1, 0])).toBe(at(view, SOLVED, [-1, 1, 0], [0, 1, 0]))
      expect(at(view, after, [1, 1, 1], [0, 1, 0])).toBe(at(view, SOLVED, [1, 1, -1], [0, 1, 0]))
      // the corner keeps its top on top, so it turns: its back sticker comes round to the right, its right to the front
      expect(at(view, after, [1, 1, 1], [1, 0, 0])).toBe(at(view, SOLVED, [1, 1, -1], [0, 0, -1]))
      expect(at(view, after, [1, 1, 1], [0, 0, 1])).toBe(at(view, SOLVED, [1, 1, -1], [1, 0, 0]))
    }
  })

  it('a sexy move played six times on the board leaves it solved, from any view', () => {
    for (const view of ALL_VIEWS)
      expect(playOnBoard(view, SOLVED, Array(6).fill("R U R' U'").join(' '))).toEqual(SOLVED)
  })
})

