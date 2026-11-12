import { faceOf, inverse, permutation, SLOTS, type CubeState, type Face, type Move } from '../model'
import type { View } from '../view'
import { lerpPolygon, placements, type Polygon } from './layout'
import { easeInOut, ROLL_MS, TURN_MS } from './motion'

// a standard cube held as the board shows it: yellow in the middle (its bottom), white on the lid, green near, red right
const COLOURS: Record<Face, string> = { U: '#ffd60a', R: '#ea3a30', F: '#2fb357', D: '#f4f4f6', L: '#ff8f1f', B: '#1f6fe5' }

/** A turn on its way: the stickers slide from where they were to where the move puts them. */
export interface Turning {
  move: Move
  start: number
  byPlayer: boolean
}

/** The cube rolling to show another face: every sticker slides from its place in the old view to the new one. */
export interface Rolling {
  from: View
  start: number
}

export interface StickerShape {
  slot: number
  points: Polygon
  colour: string
  /** -1 on the middle face, 0–2 for the rows of a side (deeper rows are shaded). */
  depth: number
}

/** Every sticker as drawn at time `now`. `state` is the cube after any turn in progress. */
export function stickerShapes(state: CubeState, view: View, turning: Turning | null, rolling: Rolling | null, now: number): StickerShape[] {
  const here = placements(view)
  const colour = (slot: number) => COLOURS[faceOf(state[slot])]

  if (rolling) {
    const t = Math.min(1, (now - rolling.start) / ROLL_MS), from = placements(rolling.from)
    return SLOTS.map(({ index: slot }) => ({
      slot,
      points: lerpPolygon(from[slot].points, here[slot].points, easeInOut(t)),
      colour: colour(slot),
      depth: from[slot].depth + (here[slot].depth - from[slot].depth) * t,
    }))
  }

  const t = turning ? easeInOut(Math.min(1, (now - turning.start) / TURN_MS)) : 1
  // for each slot, the slot its sticker came from
  const source = turning ? permutation(inverse(turning.move)) : null
  return SLOTS.map(({ index: slot }) => ({
    slot,
    points: source ? lerpPolygon(here[source[slot]].points, here[slot].points, t) : here[slot].points,
    colour: colour(slot),
    depth: here[slot].depth,
  }))
}
