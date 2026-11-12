import { inLayer, LAYER_AXIS, permutation, SLOTS, type Move } from '../model'
import { dot } from '../vec'
import { toBoard, type View } from '../view'
import { slotCentre, UNIT, RING, type Point } from './layout'

/** SVG path data for the arrows that show a face turn on the board, computed from the move in the current view. */
export function arrowPaths(view: View, move: Move): string[] {
  const perm = permutation(move), axis = LAYER_AXIS[move.layer], boardAxis = toBoard(view, axis)
  const at = (slot: number) => slotCentre(view, slot)

  if (boardAxis[1] !== 0) {
    // the face in the middle or the lid: its layer is one ring of the fan, so four small arcs across its corners
    const depth = boardAxis[1] === 1 ? 0 : 2, mid = (RING[depth] + RING[depth + 1]) / 2 * UNIT
    const slot = SLOTS.find(s => {
      const pos = toBoard(view, s.pos)
      return pos[1] === boardAxis[1] && toBoard(view, s.normal)[1] === 0 && pos[0] === 0
    })!
    const p0 = at(slot.index), p1 = at(perm[slot.index])
    let turned = Math.atan2(p1[1], p1[0]) - Math.atan2(p0[1], p0[0])
    while (turned > Math.PI) turned -= 2 * Math.PI
    while (turned <= -Math.PI) turned += 2 * Math.PI
    const clockwise = turned > 0, k = 0.62 * UNIT
    return [[1, -1], [1, 1], [-1, 1], [-1, -1]].map(([sx, sy]) => {
      // going clockwise: arrive along one edge, turn the corner, leave along the next
      const c = [sx * mid, sy * mid]
      const before = sx === sy ? [c[0], c[1] - sy * k] : [c[0] - sx * k, c[1]]
      const after = sx === sy ? [c[0] - sx * k, c[1]] : [c[0], c[1] - sy * k]
      const [from, to] = clockwise ? [before, after] : [after, before]
      return `M ${from[0]} ${from[1]} Q ${c[0]} ${c[1]} ${to[0]} ${to[1]}`
    })
  }

  // a side face: its layer crosses the board as one column (R, L) or one row (F, B).
  // An arrow outside each end of it on screen: one going in, one coming out.
  const horizontal = boardAxis[2] !== 0
  const rim = SLOTS.filter(s => inLayer(s.pos, move.layer) && dot(s.normal, axis) !== 1).map(s => s.index)
  rim.sort((a, b) => horizontal ? at(a)[0] - at(b)[0] : at(a)[1] - at(b)[1])
  const e0 = at(rim[0]), e1 = at(rim[rim.length - 1])
  // which way it flows: take the sticker that moves the shortest distance (a local step, not a wrap-around)
  let flow = 0, bestLength = Infinity
  for (const slot of rim) {
    const p0 = at(slot), p1 = at(perm[slot])
    const length = Math.hypot(p1[0] - p0[0], p1[1] - p0[1])
    if (length < 1 || length >= bestLength) continue
    bestLength = length
    flow = (p1[0] - p0[0]) * (e1[0] - e0[0]) + (p1[1] - p0[1]) * (e1[1] - e0[1])
  }
  const [inEnd, outEnd] = flow >= 0 ? [e0, e1] : [e1, e0]
  const unit = (p: Point, q: Point): Point => {
    const d = Math.hypot(q[0] - p[0], q[1] - p[1]) || 1
    return [(q[0] - p[0]) / d, (q[1] - p[1]) / d]
  }
  const segment = (p: Point, d: Point, inward: boolean) => {
    const far = [p[0] + d[0] * 0.75 * UNIT, p[1] + d[1] * 0.75 * UNIT], near = [p[0] + d[0] * 0.3 * UNIT, p[1] + d[1] * 0.3 * UNIT]
    return inward ? `M ${far[0]} ${far[1]} L ${near[0]} ${near[1]}` : `M ${near[0]} ${near[1]} L ${far[0]} ${far[1]}`
  }
  return [segment(inEnd, unit(outEnd, inEnd), true), segment(outEnd, unit(inEnd, outEnd), false)]
}
