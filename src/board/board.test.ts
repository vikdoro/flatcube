import { describe, expect, it } from 'vitest'
import { FACE_NORMAL, FACES, layerAt, SLOTS, type Face } from '../model'
import { IDENTITY } from '../vec'
import { rollTowards, toBoard } from '../view'
import { arrowPaths } from './arrows'
import { bestOption, directionOf, dragOptions, isSeam, REACH_PX, rings } from './gestures'
import { placements, slotCentre, UNIT, type Point } from './layout'

describe('board layout', () => {
  it('places all 54 stickers as quadrilaterals, 9 of them on the middle face', () => {
    const all = placements(IDENTITY)
    expect(all).toHaveLength(54)
    all.forEach(p => expect(p.points).toHaveLength(4))
    expect(all.filter(p => p.depth === -1)).toHaveLength(9)
  })

  it('draws four arcs for the middle face and the lid, two arrows for a side', () => {
    const count = (face: Face) => arrowPaths(IDENTITY, { layer: face, amount: 1 }).length
    expect(count('U')).toBe(4)
    expect(count('D')).toBe(4)
    for (const face of ['R', 'L', 'F', 'B'] as const) expect(count(face)).toBe(2)
  })
})

describe('reading a drag', () => {
  const drag = (from: Point, to: Point, view = IDENTITY) => {
    const reach = REACH_PX
    const path: Point[] = Array.from({ length: 11 }, (_, i) => [from[0] + (to[0] - from[0]) * i / 10, from[1] + (to[1] - from[1]) * i / 10])
    return bestOption(dragOptions(view, from, reach), path, reach)!
  }

  it('a drag along the top row of the middle face turns the far side', () => {
    const best = drag([-UNIT, -UNIT], [UNIT, -UNIT])
    expect(best.option.layer).toBe('B')
    expect(Math.abs(best.along)).toBeGreaterThan(UNIT)
  })

  it('a drag down the right column turns R, and the opposite way gives the opposite sign', () => {
    const down = drag([UNIT, -UNIT], [UNIT, UNIT]), up = drag([UNIT, UNIT], [UNIT, -UNIT])
    expect(down.option.layer).toBe('R')
    expect(up.option.layer).toBe('R')
    expect(Math.sign(down.along)).toBe(-Math.sign(up.along))
  })

  it('a drag along the middle row is recognised but blocked', () => {
    expect(drag([-UNIT, 0], [UNIT, 0]).option.blocked).toBe(true)
  })

  it('a press on or just over the middle face\'s edge favours R or L, unless the drag clearly follows another move', () => {
    // a little over the seam, on the right side's own column, where its ring turn runs along the same line
    const over: Point = [1.6 * UNIT, 0]
    expect(drag(over, [over[0], over[1] - UNIT]).option.layer).toBe('R')
    expect(drag(over, [over[0] + UNIT / 4, over[1] - UNIT]).option.layer).toBe('R')
    const overLeft: Point = [-over[0], 0]
    expect(drag(overLeft, [overLeft[0], overLeft[1] - UNIT]).option.layer).toBe('L')
    // further over, past a fingertip of the middle face, it is the side's own ring
    const far: Point = [2.0 * UNIT, 0]
    expect(drag(far, [far[0], far[1] - UNIT]).option.layer).toBe('U') // the middle face, which is U in the cube here
    expect(dragOptions(IDENTITY, [1.6 * UNIT, 0], REACH_PX).map(o => o.layer)).not.toContain('U') // not offered where R is favoured
    // along a side, the middle face's ring and the lid's split it at the middle of the blocked middle column
    const inner: Point = [2.3 * UNIT, 0], outer: Point = [2.6 * UNIT, 0]
    expect(drag(inner, [inner[0], inner[1] - UNIT]).option.layer).toBe('U')
    expect(drag(outer, [outer[0], outer[1] - UNIT]).option.layer).toBe('D')
    // with no gap between them: every press along the side's middle row turns one ring or the other
    for (let x = 1.75; x <= 3.15; x += 0.01) { // past R's favoured area
      const at: Point = [x * UNIT, 0]
      expect(['U', 'D']).toContain(drag(at, [at[0], at[1] - UNIT]).option.layer)
    }
    // and along the line between them, across the gaps between stickers too
    for (let y = -1.9; y <= 1.9; y += 0.01) {
      const inside: Point = [2.42 * UNIT, y * UNIT], outside: Point = [2.5 * UNIT, y * UNIT]
      expect(drag(inside, [inside[0], inside[1] - UNIT]).option.layer).toBe('U')
      expect(drag(outside, [outside[0], outside[1] - UNIT]).option.layer).toBe('D')
    }
    // the middle face's ring starts a fingertip out from the middle face, all round: here on B8, next to the middle column
    expect(dragOptions(IDENTITY, [0, -1.6 * UNIT], REACH_PX).map(o => o.layer)).not.toContain('U')
    expect(dragOptions(IDENTITY, [0, -1.8 * UNIT], REACH_PX).map(o => o.layer)).toContain('U')
    // a line running across the rows is not R, wherever it starts
    const top: Point = [1.6 * UNIT, -UNIT]
    expect(drag(top, [top[0] - UNIT, top[1]]).option.layer).not.toBe('R')
  })

  it('a press on a seam sticker favours its ring, unless the drag runs close to the straight turn', () => {
    for (const face of FACES) {
      const view = rollTowards(IDENTITY, toBoard(IDENTITY, FACE_NORMAL[face]))
      const { depth, inner, outer } = rings(view)
      for (const s of SLOTS.filter(s => isSeam(view, s))) {
        const at = slotCentre(view, s.index)
        const axis = [0, 1, 2].find(a => a !== depth && s.normal[a] === 0)!, straight = layerAt(axis, s.pos[axis])
        const ring = s.pos[depth] === 0 ? [inner, outer] : [layerAt(depth, s.pos[depth])]
        // along the straight turn's direction, turned by `deg` towards the ring's
        const [sx, sy] = directionOf(view, s.index, straight), [rx, ry] = directionOf(view, s.index, ring[0])
        const along = (deg: number) => {
          const c = Math.cos(deg * Math.PI / 180), k = Math.sin(deg * Math.PI / 180) * Math.sign(sx * ry - sy * rx || 1)
          const d: Point = [sx * c - sy * k, sx * k + sy * c], len = UNIT / 2
          return drag(at, [at[0] + d[0] * len, at[1] + d[1] * len], view).option.layer
        }
        for (const deg of [0, 20, -20]) expect(along(deg), `${face} ${s.index} ${deg}°`).toBe(straight)
        for (const deg of [45, -45, 90]) expect(ring, `${face} ${s.index} ${deg}°`).toContain(along(deg))
      }
    }
  })

  it('works the same after rolling the cube', () => {
    for (const face of FACES.filter(f => f !== 'U')) {
      const view = rollTowards(IDENTITY, toBoard(IDENTITY, FACE_NORMAL[face]))
      expect(drag([-UNIT, -UNIT], [UNIT, -UNIT], view).option.blocked).toBe(false)
    }
  })
})
