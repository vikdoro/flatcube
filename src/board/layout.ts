import { SLOTS, type Slot } from '../model'
import { toBoard, type View } from '../view'

/**
 * The board is an open box seen from above: the face in the middle, the four sides fanned out around it three
 * rows deep, and the far face hanging open above like a lid, hinged on the top edge, so all six faces are in view.
 * All lengths are in board units; one sticker of the middle face is one unit wide.
 */
export type Point = readonly [number, number]
export type Polygon = readonly Point[]

/** SVG user units per board unit. */
export const UNIT = 40

/** The fan's rings: the middle face reaches RING[0], and the three rows of each side lie between the next radii. */
export const RING = [1.5, 2.18, 2.74, 3.2]

// the lid: its hinge is LID_Y, its rows get shorter and narrower away from the hinge, like a face tilted away
const LID_Y = -(RING[3] + 0.26)
const LID_ROWS = [0.95, 0.82, 0.7]
const LID_HEIGHT = LID_ROWS[0] + LID_ROWS[1] + LID_ROWS[2]
const LID_FAR_HALF_WIDTH = 2.05
const lidHalfWidth = (y: number) => RING[3] + (LID_FAR_HALF_WIDTH - RING[3]) * (LID_Y - y) / LID_HEIGHT

const P = (x: number, y: number): Point => [x * UNIT, y * UNIT]

/** Just the board plus the arrows that stick out past it (they reach 3.82 at the sides and bottom, 6.43 at the top). */
export const VIEW_BOX = (() => {
  const side = 3.9 * UNIT, top = 6.5 * UNIT, bottom = 3.9 * UNIT
  return `${-side} ${-top} ${2 * side} ${top + bottom}`
})()

/** The dark plates the stickers sit on: a square behind the fan and a trapezoid behind the lid. */
export const PLATE_HALF = (RING[3] + 0.12) * UNIT
export const LID_PLATE: Polygon = (() => {
  const m = 0.12, yNear = LID_Y + m, yFar = LID_Y - LID_HEIGHT - m
  const wNear = lidHalfWidth(LID_Y) + m, wFar = lidHalfWidth(LID_Y - LID_HEIGHT) + m
  return [P(-wFar, yFar), P(wFar, yFar), P(wNear, yNear), P(-wNear, yNear)]
})()

/** The whole box (plate and lid), for telling when a drag has left the board. */
export const BOARD_BOUNDS = {
  left: -PLATE_HALF, right: PLATE_HALF, top: (LID_Y - LID_HEIGHT - 0.12) * UNIT, bottom: PLATE_HALF,
}

/** Where a slot is drawn. depth is -1 on the middle face and 0–2 for the rows of a side, counting outwards. */
export interface Placement {
  points: Polygon
  depth: number
}

function place(view: View, slot: Slot): Placement {
  const pos = toBoard(view, slot.pos), n = toBoard(view, slot.normal)
  if (n[1] === -1) {
    // the lid: hinged on the back edge, its back row next to the hinge and its front row furthest away;
    // left and right are unchanged
    const row = 1 + pos[2], column = 1 + pos[0]
    const edges = [LID_Y, LID_Y - LID_ROWS[0], LID_Y - LID_ROWS[0] - LID_ROWS[1], LID_Y - LID_HEIGHT]
    const near = edges[row], far = edges[row + 1]
    const xs = (y: number) => { const w = lidHalfWidth(y); return [-w + column * 2 * w / 3, -w + (column + 1) * 2 * w / 3] }
    const [nearLeft, nearRight] = xs(near), [farLeft, farRight] = xs(far)
    return { points: [P(farLeft, far), P(farRight, far), P(nearRight, near), P(nearLeft, near)], depth: 0 }
  }
  if (n[1] === 1) {
    const x0 = pos[0] - 0.5, y0 = pos[2] - 0.5
    return { points: [P(x0, y0), P(x0 + 1, y0), P(x0 + 1, y0 + 1), P(x0, y0 + 1)], depth: -1 }
  }
  // a side: its rows are the rings of the fan, the top row (next to the middle face) innermost
  const depth = 1 - pos[1]
  const inner = RING[depth], outer = RING[depth + 1]
  const span = (r: number, k: number) => [-r + k * 2 * r / 3, -r + (k + 1) * 2 * r / 3]
  const along = n[2] !== 0 ? 1 + pos[0] : 1 + pos[2]
  const [i0, i1] = span(inner, along), [o0, o1] = span(outer, along)
  const points: Point[] =
    n[2] === -1 ? [[o0, -outer], [o1, -outer], [i1, -inner], [i0, -inner]]
    : n[2] === 1 ? [[i0, inner], [i1, inner], [o1, outer], [o0, outer]]
    : n[0] === -1 ? [[-outer, o0], [-inner, i0], [-inner, i1], [-outer, o1]]
    : [[inner, i0], [outer, o0], [outer, o1], [inner, i1]]
  return { points: points.map(([x, y]) => P(x, y)), depth }
}

export const centroid = (points: Polygon): Point => [
  points.reduce((a, p) => a + p[0], 0) / points.length,
  points.reduce((a, p) => a + p[1], 0) / points.length,
]

/**
 * Move every edge d inwards, leaving a gap between neighbouring stickers. Each edge stays parallel to where it was,
 * so the gaps along a line running through several stickers stay straight.
 */
function shrink(points: Polygon, d: number): Polygon {
  const n = points.length
  const area = points.reduce((a, [x, y], i) => { const [x2, y2] = points[(i + 1) % n]; return a + x * y2 - x2 * y }, 0)
  const s = Math.sign(area) || 1
  // the inward unit normal of the edge from corner i to corner i + 1
  const normals = points.map(([x, y], i) => {
    const [x2, y2] = points[(i + 1) % n], l = Math.hypot(x2 - x, y2 - y) || 1
    return [-(y2 - y) / l * s, (x2 - x) / l * s]
  })
  return points.map(([x, y], i) => {
    const a = normals[(i + n - 1) % n], b = normals[i], k = d / (1 + a[0] * b[0] + a[1] * b[1])
    return [x + (a[0] + b[0]) * k, y + (a[1] + b[1]) * k]
  })
}

export const lerpPolygon = (a: Polygon, b: Polygon, t: number): Polygon =>
  a.map((p, i) => [p[0] + (b[i][0] - p[0]) * t, p[1] + (b[i][1] - p[1]) * t])

export function scalePolygon(points: Polygon, k: number): Polygon {
  const [cx, cy] = centroid(points)
  return points.map(([x, y]) => [cx + (x - cx) * k, cy + (y - cy) * k])
}

export const pointsAttr = (points: Polygon) => points.map(p => p[0].toFixed(1) + ',' + p[1].toFixed(1)).join(' ')

const cache = new Map<string, readonly Placement[]>()

/** Where every slot is drawn when the cube is held in this view, indexed by slot. */
export function placements(view: View): readonly Placement[] {
  const key = view.flat().join()
  let result = cache.get(key)
  if (!result) {
    result = SLOTS.map(s => { const p = place(view, s); return { ...p, points: shrink(p.points, 2.1) } })
    cache.set(key, result)
  }
  return result
}

/** The middle of a slot on the board. */
export const slotCentre = (view: View, slot: number) => centroid(placements(view)[slot].points)
