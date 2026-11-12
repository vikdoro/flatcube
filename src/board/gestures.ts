import { LAYER_AXIS, layerAt, SLOTS, type Layer, type Slot } from '../model'
import { add, cross, scale } from '../vec'
import { facingFace, toBoard, type View } from '../view'
import { BOARD_BOUNDS, placements, RING, slotCentre, UNIT, type Point, type Polygon } from './layout'

/**
 * Reading a drag as a turn.
 *
 * Fingers are imprecise, so a press counts for every sticker within a fingertip of it (gaps and arrows included),
 * and the whole line drawn since the press decides among their moves. Each move has a direction at every point of
 * the board (the way its stickers travel there: straight across the face, around a ring), and every bit of the line
 * is checked against the direction where it was drawn. The move the line follows best wins, so a touch-down wobble
 * or a hook at the end counts for little, and following a ring around its curve stays on that ring. Nearer stickers
 * are preferred, and a middle row that can't turn gives way to a neighbouring row that can. It is re-decided on
 * every move, so changing your mind mid-drag works. Distances are in screen pixels so it feels the same at any size.
 */
export const REACH_PX = 32 / 3
/** Movement below this is a tap (or a drag back to where it started). */
export const SLOP_PX = 10
/** How far a drag has to run along its move before letting go turns it. */
export const COMMIT_PX = 22
/** Dragging this far off the board cancels; coming back in resumes the drag. */
const CANCEL_PX = 36
/**
 * Reaching for R or L on the middle face, a finger tends to land on or just over its edge, where the side next to it
 * starts its own ring turn along the same line. A press within reach of an R or L sticker on the middle face favours
 * that move: how well the line fits it counts this much more, and how far the press was is forgiven. A line that runs
 * across it, or clearly follows another move, still goes to that one.
 */
const SIDE_COLUMN_BONUS = 0.5
/**
 * A seam sticker (see cube-terminology.md) lies on a ring and on the straight turn of the side next to it, and across
 * the seam the two run the same way, so a press there could mean either. A press within reach of one favours its
 * ring: how well the line fits it counts this much more, so the straight turn only wins when the line runs within
 * about 30° of it.
 */
const SEAM_RING_BONUS = 0.7

/** One move a drag could mean, with the direction its stickers travel across the board. */
export interface DragOption {
  layer: Layer
  /** Distance from the press to the nearest sticker of this move. */
  dist: number
  field: { centre: Point; dir: Point }[]
  /** Middle slices are recognised but don't turn. */
  blocked: boolean
  /** How much more the fit counts, for an R or L pressed on or near the middle face's side columns (SIDE_COLUMN_BONUS)
   * or a ring pressed on or near a seam sticker (SEAM_RING_BONUS); 0 if it isn't favoured. */
  bonus: number
}

const unit = (x: number, y: number): Point => { const l = Math.hypot(x, y) || 1; return [x / l, y / l] }

/** The screen direction a slot's sticker travels on a clockwise turn of `layer`, from its real 3D motion. */
export function directionOf(view: View, slot: number, layer: Layer): Point {
  // a clockwise turn about axis a moves a point p along -(a × p)
  const s = SLOTS[slot], p = add(s.pos, s.normal, 0.5)
  const v = toBoard(view, scale(cross(LAYER_AXIS[layer], p), -1)), n = toBoard(view, s.normal)
  // board-space motion to screen motion, for each part of the board
  if (n[1] === 1) return unit(v[0], v[2])   // the face in the middle: x right, z down the page
  if (n[1] === -1) return unit(v[0], -v[2]) // the lid: hinged at the top, its front row furthest up
  if (n[0] === 1) return unit(-v[1], v[2])  // right side: going down the cube moves outward
  if (n[0] === -1) return unit(v[1], v[2])  // left side
  if (n[2] === 1) return unit(v[0], -v[1])  // near side (bottom of the board)
  return unit(v[0], v[1])                   // far side (top of the board)
}

/** Distance from a point to a polygon's edge, or 0 inside it. */
function edgeDistance(points: Polygon, [x, y]: Point) {
  let inside = false, best = Infinity
  for (let i = 0, j = points.length - 1; i < points.length; j = i++) {
    const [ax, ay] = points[j], [bx, by] = points[i]
    if ((ay > y) !== (by > y) && x < ax + (y - ay) * (bx - ax) / (by - ay)) inside = !inside
    const ex = bx - ax, ey = by - ay
    const t = Math.max(0, Math.min(1, ((x - ax) * ex + (y - ay) * ey) / (ex * ex + ey * ey || 1)))
    best = Math.min(best, Math.hypot(x - ax - t * ex, y - ay - t * ey))
  }
  return inside ? 0 : best
}

/** The slot nearest to a point: what a tap lands on. */
export function nearestSlot(view: View, point: Point) {
  const all = placements(view)
  let nearest = 0, best = Infinity
  all.forEach((p, slot) => { const d = edgeDistance(p.points, point); if (d < best) { best = d; nearest = slot } })
  return nearest
}

/** The axis the middle face turns about: along it lie the middle face's ring, the slice that can't turn, and the lid's. */
const depthAxis = (view: View) => LAYER_AXIS[facingFace(view)].findIndex(v => v !== 0)

/** Whether a sticker is a seam sticker: on a side, in the column next to where it meets the next side. */
export function isSeam(view: View, s: Slot) {
  const depth = depthAxis(view)
  return s.normal[depth] === 0 && [0, 1, 2].some(a => a !== depth && s.normal[a] === 0 && s.pos[a] !== 0)
}

/**
 * How much a press on this sticker favours turning `axis` through it: an R or L (by where it sits on the board) from
 * the middle face, or a ring from a seam sticker.
 */
function bonusOf(view: View, s: Slot, axis: number) {
  if (axis === depthAxis(view)) return isSeam(view, s) ? SEAM_RING_BONUS : 0
  const sideColumn = toBoard(view, s.normal)[1] === 1 && s.pos[axis] !== 0 && toBoard(view, LAYER_AXIS[layerAt(axis, s.pos[axis])])[0] !== 0
  return sideColumn ? SIDE_COLUMN_BONUS : 0
}

/** The part of a polygon on the near side of a straight line: where `out`·p is at most `limit`. */
function clip(points: Polygon, out: Point, limit: number): Polygon {
  const kept: Point[] = [], over = (p: Point) => out[0] * p[0] + out[1] * p[1] - limit
  points.forEach((p, i) => {
    const q = points[(i + 1) % points.length], a = over(p), b = over(q)
    if (a <= 0) kept.push(p)
    if ((a < 0 && b > 0) || (a > 0 && b < 0)) kept.push([p[0] + (q[0] - p[0]) * a / (a - b), p[1] + (q[1] - p[1]) * a / (a - b)])
  })
  return kept
}

/**
 * The sides' middle column can't turn on its own, so the rings either side of it split it with one straight line
 * round the board, halfway across the column: inside the line the middle face's ring, outside it the lid's.
 */
export const RING_CUT = (RING[1] + RING[2]) / 2

/** The middle face's ring and the lid's: the moves that go round the sides. */
export function rings(view: View) {
  const depth = depthAxis(view), middle = LAYER_AXIS[facingFace(view)][depth]
  return { depth, middle, inner: layerAt(depth, middle), outer: layerAt(depth, -middle) }
}

/** Each middle-column sticker cut in two along RING_CUT, each part going to the ring on its side. */
export function ringHalves(view: View) {
  const { depth, middle } = rings(view), all = placements(view), cut = RING_CUT * UNIT
  return SLOTS.filter(s => s.normal[depth] === 0 && s.pos[depth] === 0).flatMap(s => {
    const n = toBoard(view, s.normal), out: Point = [n[0], n[2]] // away from the middle, on the page
    return [
      { slot: s.index, layer: layerAt(depth, middle), axis: depth, coord: middle, points: clip(all[s.index].points, out, cut) },
      { slot: s.index, layer: layerAt(depth, -middle), axis: depth, coord: -middle, points: clip(all[s.index].points, [-out[0], -out[1]], -cut) },
    ]
  })
}

/** Every sticker whose press could start `layer`, and whether it is one that favours it (ringHalves adds to this). */
export function moveZone(view: View, layer: Layer) {
  const axis = LAYER_AXIS[layer].findIndex(v => v !== 0), depth = depthAxis(view)
  return SLOTS.filter(s => s.normal[axis] === 0 && layerAt(axis, s.pos[axis]) === layer)
    .filter(s => !(axis === depth && s.pos[axis] === 0)) // the slice between the rings: split up by them instead
    .map(s => ({ slot: s.index, favoured: bonusOf(view, s, axis) > 0 }))
}

/**
 * Where the middle face's ring starts: a fingertip out from the middle face's edge, all the way round, so a press that
 * could mean one of the middle face's own moves never turns the ring instead.
 */
export function ringStart(view: View, reach: number) {
  const all = placements(view)
  const edge = Math.max(...SLOTS.filter(s => toBoard(view, s.normal)[1] === 1)
    .flatMap(s => all[s.index].points.map(([x, y]) => Math.max(Math.abs(x), Math.abs(y)))))
  return edge + reach
}

/** The moves a press at `point` could start: those of every sticker within `reach`. */
export function dragOptions(view: View, point: Point, reach: number): DragOption[] {
  const options = new Map<Layer, DragOption>(), depth = depthAxis(view)
  const offer = (axis: number, coord: number, dist: number, bonus: number) => {
    const layer = layerAt(axis, coord), known = options.get(layer)
    if (known) { known.dist = Math.min(known.dist, dist); known.bonus = Math.max(known.bonus, bonus); return }
    // where the stickers of this move sit, and which way each travels
    const field = SLOTS.filter(t => t.normal[axis] === 0 && t.pos[axis] === coord)
      .map(t => ({ centre: slotCentre(view, t.index), dir: directionOf(view, t.index, layer) }))
    options.set(layer, { layer, dist, field, blocked: layer === 'M' || layer === 'E' || layer === 'S', bonus })
  }
  placements(view).forEach((placement, slot) => {
    const dist = edgeDistance(placement.points, point)
    if (dist > reach) return
    const s = SLOTS[slot]
    for (let axis = 0; axis < 3; axis++) {
      if (s.normal[axis] !== 0) continue // turning about the axis it faces would only spin it in place
      if (axis === depth && s.pos[axis] === 0) continue // the slice between the rings: see ringHalves
      offer(axis, s.pos[axis], dist, bonusOf(view, s, axis))
    }
  })
  for (const h of ringHalves(view)) {
    const dist = edgeDistance(h.points, point)
    if (dist <= reach) offer(h.axis, h.coord, dist, isSeam(view, SLOTS[h.slot]) ? SEAM_RING_BONUS : 0)
  }
  // the rings own straight bands round the board, edges and gaps included: the middle face's from ringStart out to
  // RING_CUT, the lid's from there outward
  const { inner, outer } = rings(view), r = Math.max(Math.abs(point[0]), Math.abs(point[1])), cut = RING_CUT * UNIT
  if (r < ringStart(view, reach) || r > cut) options.delete(inner)
  if (r < cut) options.delete(outer)
  return [...options.values()]
}

const directionAt = (field: DragOption['field'], [x, y]: Point) => field.reduce(
  (a, f) => { const d = (f.centre[0] - x) ** 2 + (f.centre[1] - y) ** 2; return d < a.d ? { d, dir: f.dir } : a },
  { d: Infinity, dir: [0, 0] as Point },
).dir

/** How far the line has travelled along a move (signed), and how much of its length went that way (0..1). */
function follow(option: DragOption, path: readonly Point[]) {
  let along = 0, total = 0
  for (let i = 1; i < path.length; i++) {
    const [x0, y0] = path[i - 1], [x1, y1] = path[i], sx = x1 - x0, sy = y1 - y0
    const dir = directionAt(option.field, [(x0 + x1) / 2, (y0 + y1) / 2])
    along += sx * dir[0] + sy * dir[1]
    total += Math.hypot(sx, sy)
  }
  return { along, fit: total ? Math.abs(along) / total : 0 }
}

/** How well the drawn line fits a move: `fit` (0..1), how far along it went, and the `score` moves are ranked by. */
export function scoreOption(option: DragOption, path: readonly Point[], reach: number) {
  const f = follow(option, path)
  const score = option.bonus ? f.fit * (1 + option.bonus)
    : f.fit - 0.5 * option.dist / reach - (option.blocked ? 0.5 : 0)
  return { ...f, score }
}

/** The move the drawn line follows best, and how far along it the line has gone (positive is clockwise). */
export function bestOption(options: readonly DragOption[], path: readonly Point[], reach: number) {
  let best: { option: DragOption; along: number; score: number } | null = null
  for (const option of options) {
    const { along, score } = scoreOption(option, path, reach)
    if (!best || score > best.score) best = { option, along, score }
  }
  return best
}

/** Whether a point is well off the board; pxPerUnit converts the margin from screen pixels. */
export function isOffBoard([x, y]: Point, pxPerUnit: number) {
  const m = CANCEL_PX / pxPerUnit, b = BOARD_BOUNDS
  return x < b.left - m || x > b.right + m || y < b.top - m || y > b.bottom + m
}
