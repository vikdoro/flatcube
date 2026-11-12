<script setup lang="ts">
// The board, and turning it by hand. Press a sticker and drag: the row or ring the drag runs along lights up with
// its arrows; let go and it turns. A tap without a drag on a side rolls the cube so that side is in the middle.
import { computed, onBeforeUnmount, onMounted, ref, shallowRef, useTemplateRef } from 'vue'
import { arrowPaths } from '../board/arrows'
import { stickerShapes } from '../board/frame'
import { bestOption, COMMIT_PX, directionOf, dragOptions, isOffBoard, isSeam, moveZone, nearestSlot, RING_CUT, ringHalves, rings, ringStart, REACH_PX, scoreOption, SLOP_PX, type DragOption } from '../board/gestures'
import { BOARD_BOUNDS, centroid, LID_PLATE, PLATE_HALF, placements, pointsAttr, slotCentre, UNIT, VIEW_BOX, type Point } from '../board/layout'
import { inLayer, SLOTS, type Face, type Layer, type Move } from '../model'
import { IDENTITY } from '../vec'
import { boardMove, boardMoveName, boardSlotName, facingFace } from '../view'
import type { Board } from './createBoard'

// `turn` is a drag that has been let go to turn; `drag` is a drag in progress (the app hides Undo while it goes)
const { board: cube, debug = false } = defineProps<{ board: Board; debug?: boolean }>()
const emit = defineEmits<{ turn: [move: Move]; drag: [] }>()
const svg = useTemplateRef<SVGSVGElement>('svg')

// as wide as it can be, leaving a row above it for the move's name and one under it for Undo; the margins past the
// lid and under the plate (where the arrows go) are given back, so both centre in the space beside the cube itself
const ROOM = '128px'
const [vbX, vbY, vbW, vbH] = VIEW_BOX.split(' ').map(Number)
const scale = `min(100cqw / ${vbW}, (100cqh - ${ROOM}) / ${vbH})`
const fit = {
  aspectRatio: `${vbW} / ${vbH}`,
  maxHeight: `calc(100cqh - ${ROOM})`,
  marginTop: `calc(${vbY - BOARD_BOUNDS.top} * ${scale})`,
  marginBottom: `calc(${PLATE_HALF - vbY - vbH} * ${scale})`,
}

const sizeOf = (points: readonly Point[]) => {
  const xs = points.map(p => p[0]), ys = points.map(p => p[1])
  return [Math.max(...xs) - Math.min(...xs), Math.max(...ys) - Math.min(...ys)]
}

const FACE_NAME = { U: 'top', D: 'bottom', R: 'right', L: 'left', F: 'front', B: 'back' } as const
const label = computed(() =>
  `The cube as an open box: its ${FACE_NAME[facingFace(cube.view.value)]} face in the middle, four sides around it, the lid hanging open above`)

const shapes = computed(() =>
  stickerShapes(cube.state.value, cube.view.value, cube.turning.value, cube.rolling.value, cube.now.value))

const stickers = computed(() => {
  const live = cube.livePreview.value
  return shapes.value.map(s => ({
    ...s,
    colour: debug && zonePick.value ? '#e6e6e6' : s.colour, // debug zones: neutral stickers, so the zones stand out
    points: pointsAttr(s.points),
    tappable: !cube.rolling.value && s.depth === -1,
    lit: !!live && inLayer(SLOTS[s.slot].pos, live.move.layer),
  }))
})

// debug (?debug in the URL): every sticker labelled with the place it starts on, so the labels travel with the turns.
// A place is named by its face's board name and a number, 1 to 9 in reading order as the face is seen from inside the
// cube, with the cube held as at the start. Each side is read with its rim up, so the row along the rim is 1 2 3; the
// lid with its hinge up (U1 U2 U3 along it); the middle with the far side up (D3 D2 D1 along its top row, since
// looking up at it from inside mirrors it)
const READ_UP: Record<string, Point> = { U: [0, 1], D: [0, -1], B: [0, -1], F: [0, 1], L: [-1, 0], R: [1, 0] }
const START_NAMES = (() => {
  const names: string[] = []
  for (const face of 'UDFBLR') {
    const [ux, uy] = READ_UP[face], up = ([x, y]: Point) => ux * x + uy * y, right = ([x, y]: Point) => uy * x - ux * y
    const rows = SLOTS.filter(s => boardSlotName(IDENTITY, s)[0] === face)
      .map(s => ({ slot: s.index, at: slotCentre(IDENTITY, s.index) }))
      .sort((a, b) => up(b.at) - up(a.at))
    for (let r = 0; r < 3; r++)
      rows.slice(3 * r, 3 * r + 3).sort((a, b) => right(a.at) - right(b.at)).forEach((p, c) => names[p.slot] = face + (3 * r + c + 1))
  }
  return names
})()
const labels = computed(() => {
  if (!debug) return []
  return shapes.value.map(s => {
    const [x, y] = centroid(s.points)
    const [w, h] = sizeOf(s.points)
    // on the left and right sides the stickers are tall and thin, so the label runs along them
    const upright = h > w * 1.3
    const [across, along] = upright ? [w, h] : [h, w]
    const turn = upright ? (x > 0 ? 90 : -90) : 0
    return { slot: s.slot, x, y, turn, text: START_NAMES[cube.state.value[s.slot]], size: Math.min(11, along / 2.6, across / 1.4) }
  })
})

// debug, while pressing or dragging (and after, until the next press): the fingertip's reach, the line drawn, and for
// every move it could mean its direction at each of its stickers, with how well the line fits and the score that
// ranks them. The leader is bold; a * marks a move favoured by where the press started
// moves are named by the board's own names, as the badge does: the middle face is D, the lid U
const LAYER_HUE: Record<string, number> = { U: 50, D: 25, R: 0, L: 300, F: 130, B: 210, M: 270, E: 170, S: 90 }
const BOARD_LAYERS = ['D', 'U', 'R', 'L', 'F', 'B', 'M', 'E', 'S']
const boardName = (layer: Layer) => boardMoveName(cube.view.value, { layer, amount: 1 }).replace(/['2]/g, '')

// debug zones: pick a move (or all) to see, with no touch, every place a press could start it. The area is the
// stickers of the move grown by the fingertip's reach; the stronger part is where it is favoured, and the ticks show
// the way each sticker travels on a clockwise turn
const zonePick = ref('R')
const pxPerUnit = ref(1)
const measure = () => { if (svg.value) pxPerUnit.value = svg.value.getScreenCTM()!.a }
let sizeWatch: ResizeObserver | undefined
onMounted(() => { if (!debug) return; measure(); sizeWatch = new ResizeObserver(measure); sizeWatch.observe(svg.value!) })
onBeforeUnmount(() => sizeWatch?.disconnect())
const zones = computed(() => {
  if (!debug || !zonePick.value) return []
  const view = cube.view.value, all = placements(view)
  return (zonePick.value === 'all' ? BOARD_LAYERS : [zonePick.value]).map(name => {
    const layer: Layer = 'MES'.includes(name) ? name as Layer : boardMove(view, name as Face, 1).layer
    const zone = moveZone(view, layer)
    return {
      name, hue: LAYER_HUE[name],
      // the rings keep to their straight bands (see dragOptions)
      clip: layer === rings(view).inner ? 'url(#inner-ring)' : layer === rings(view).outer ? 'url(#outer-ring)' : undefined,
      near: zone.filter(z => !z.favoured).map(z => pointsAttr(all[z.slot].points)),
      // its part of the sides' middle column
      halves: ringHalves(view).filter(h => h.layer === layer && !isSeam(view, SLOTS[h.slot])).map(h => pointsAttr(h.points)),
      favoured: [
        ...zone.filter(z => z.favoured).map(z => all[z.slot].points),
        ...ringHalves(view).filter(h => h.layer === layer && isSeam(view, SLOTS[h.slot])).map(h => h.points),
      ].map(pointsAttr),
      ticks: zone.map(z => {
        const [x, y] = slotCentre(view, z.slot), [dx, dy] = directionOf(view, z.slot, layer)
        return `M${x} ${y}l${dx * 12} ${dy * 12}`
      }).join(''),
    }
  })
})
const reachWidth = computed(() => 2 * REACH_PX / pxPerUnit.value)
const square = (half: number) => `M${-half} ${-half}H${half}V${half}H${-half}Z`
const innerBand = computed(() => square(RING_CUT * UNIT) + square(ringStart(cube.view.value, reachWidth.value / 2)))
const outerBand = `M${vbX - 100} ${vbY - 100}h${vbW + 200}v${vbH + 200}h${-vbW - 200}Z` + square(RING_CUT * UNIT)
const trace = shallowRef<{
  start: Point
  reach: number
  path: Point[]
  rows: { layer: string; hue: number; fit: number; dist: number; score: number; star: boolean; best: boolean; blocked: boolean; ticks: string }[]
} | null>(null)
function updateTrace(d: Drag) {
  if (!debug) return
  const rows = d.options.map(o => ({ o, ...scoreOption(o, d.path, d.reach) })).sort((a, b) => b.score - a.score)
  trace.value = {
    start: d.start, reach: d.reach, path: [...d.path],
    rows: rows.map(({ o, fit, score }, i) => ({
      layer: boardName(o.layer), hue: LAYER_HUE[boardName(o.layer)], fit, dist: o.dist / d.reach, score, star: o.bonus > 0, best: i === 0, blocked: o.blocked,
      ticks: o.field.map(f => `M${f.centre[0]} ${f.centre[1]}l${f.dir[0] * 12} ${f.dir[1] * 12}`).join(''),
    })),
  }
}

const arrows = computed(() => {
  const a = cube.arrows.value
  return a && { paths: arrowPaths(cube.view.value, a.move), alpha: a.alpha }
})

// ---------- dragging ----------
interface Drag {
  pointerId: number
  start: Point
  path: Point[]
  /** Screen pixels per SVG unit, fixed for the drag. */
  pxPerUnit: number
  reach: number
  options: DragOption[]
  tapSlot: number
  moved: boolean
}
let drag: Drag | null = null

function svgPoint(e: PointerEvent): Point {
  const p = new DOMPoint(e.clientX, e.clientY).matrixTransform(svg.value!.getScreenCTM()!.inverse())
  return [p.x, p.y]
}

function onPointerDown(e: PointerEvent) {
  if (drag || cube.rolling.value) return // one finger at a time; a second touch or a resting palm is ignored
  const pxPerUnit = svg.value!.getScreenCTM()!.a, reach = REACH_PX / pxPerUnit, start = svgPoint(e)
  const options = dragOptions(cube.view.value, start, reach)
  if (!options.length) return
  drag = { pointerId: e.pointerId, start, path: [start], pxPerUnit, reach, options, tapSlot: nearestSlot(cube.view.value, start), moved: false }
  svg.value!.setPointerCapture(e.pointerId)
  updateTrace(drag)
}

function onPointerMove(e: PointerEvent) {
  if (!drag || e.pointerId !== drag.pointerId) return
  const p = svgPoint(e)
  drag.path.push(p)
  updateTrace(drag)
  if (!drag.moved && Math.hypot(p[0] - drag.start[0], p[1] - drag.start[1]) * drag.pxPerUnit < SLOP_PX) return
  drag.moved = true
  cube.hideArrows()
  emit('drag')
  if (isOffBoard(p, drag.pxPerUnit)) return cube.setPreview({ kind: 'cancel' })
  const best = bestOption(drag.options, drag.path, drag.reach)!
  const along = best.along * drag.pxPerUnit
  cube.setPreview(Math.abs(along) < SLOP_PX ? null : { // dragged back to where it started: cancelled
    kind: 'turn',
    move: { layer: best.option.layer, amount: along > 0 ? 1 : 3 },
    blocked: best.option.blocked,
    ready: Math.abs(along) >= COMMIT_PX,
  })
}

function endDrag(e: PointerEvent, commit: boolean) {
  if (!drag || e.pointerId !== drag.pointerId) return
  const d = drag, p = cube.preview.value
  drag = null
  if (commit && d.moved && p?.kind === 'turn' && !p.blocked && p.ready) emit('turn', p.move)
  else if (commit && !d.moved) cube.rollToSlot(d.tapSlot)
  cube.setPreview(null)
}
</script>

<template>
  <svg
    ref="svg" :viewBox="VIEW_BOX" :style="fit" role="img" :aria-label="label"
    @pointerdown="onPointerDown" @pointermove="onPointerMove"
    @pointerup="endDrag($event, true)" @pointercancel="endDrag($event, false)"
  >
    <defs>
      <marker id="arrowhead" viewBox="0 0 10 10" refX="6" refY="5" markerWidth="3.2" markerHeight="3.2" orient="auto">
        <path d="M 0 0 L 10 5 L 0 10 z" class="arrowhead" />
      </marker>
    </defs>
    <rect class="plate" :x="-PLATE_HALF" :y="-PLATE_HALF" :width="2 * PLATE_HALF" :height="2 * PLATE_HALF" rx="14" />
    <polygon class="plate lid" :points="pointsAttr(LID_PLATE)" />

    <template v-for="s in stickers" :key="s.slot">
      <polygon
        class="sticker" :class="{ tappable: s.tappable, lit: s.lit }"
        :points="s.points" :fill="s.colour" :stroke="s.colour"
      />
      <!-- deeper rows of the sides are shaded a little, like walls going down -->
      <polygon v-if="s.depth > 0" :points="s.points" class="shade" :opacity="0.05 * s.depth" />
    </template>

    <clipPath id="inner-ring"><path :d="innerBand" clip-rule="evenodd" /></clipPath>
    <clipPath id="outer-ring"><path :d="outerBand" clip-rule="evenodd" /></clipPath>
    <g v-for="z in zones" :key="'zone' + z.name" :clip-path="z.clip">
      <g class="zone" :style="{ '--hue': z.hue }">
        <g class="area" :stroke-width="reachWidth">
          <polygon v-for="(p, i) in z.near" :key="'n' + i" :points="p" />
          <polygon v-for="(p, i) in z.halves" :key="'h' + i" :points="p" />
        </g>
        <g class="area strong" :stroke-width="reachWidth">
          <polygon v-for="(p, i) in z.favoured" :key="'f' + i" :points="p" />
        </g>
        <path :d="z.ticks" class="ticks" />
      </g>
    </g>

    <text
      v-for="l in labels" :key="'label' + l.slot" class="label"
      :x="l.x" :y="l.y" :font-size="l.size" :transform="l.turn ? `rotate(${l.turn} ${l.x} ${l.y})` : undefined"
    >{{ l.text }}</text>

    <g v-if="trace" class="trace">
      <path v-for="r in trace.rows" :key="'ticks' + r.layer" :d="r.ticks" fill="none" :stroke="`hsl(${r.hue} 90% 40%)`"
        :stroke-width="r.best ? 2.4 : 1" :opacity="r.best ? 1 : 0.55" :stroke-dasharray="r.blocked ? '3 2' : undefined" />
      <circle :cx="trace.start[0]" :cy="trace.start[1]" :r="trace.reach" class="reach" />
      <polyline :points="pointsAttr(trace.path)" class="line" />
      <text v-for="(r, i) in trace.rows" :key="'row' + r.layer" :x="vbX + 6" :y="vbY + 14 + 12 * i" class="score"
        :font-weight="r.best ? 800 : 500" :fill="`hsl(${r.hue} 90% 30%)`"
      >{{ r.layer }}{{ r.star ? '*' : '' }}  fit {{ r.fit.toFixed(2) }}  dist {{ r.dist.toFixed(2) }}  score {{ r.score.toFixed(2) }}</text>
    </g>

    <template v-if="arrows">
      <path v-for="(d, i) in arrows.paths" :key="'halo' + i" :d="d" class="arrow-halo" :opacity="arrows.alpha" />
      <path v-for="(d, i) in arrows.paths" :key="'arrow' + i" :d="d" class="arrow" :opacity="arrows.alpha" marker-end="url(#arrowhead)" />
    </template>
  </svg>
  <Teleport v-if="debug" to="body">
    <div class="zonebar">
      <button v-for="n in ['', 'all', ...BOARD_LAYERS]" :key="n" :class="{ on: zonePick === n }" @click="zonePick = n">{{ n || 'off' }}</button>
    </div>
  </Teleport>
</template>

<style scoped>
svg { flex: none; width: 100%; display: block; touch-action: none; user-select: none; -webkit-user-select: none; }
.plate { fill: var(--plate); }
.lid { stroke: var(--plate); stroke-width: 8; stroke-linejoin: round; }
.sticker { stroke-width: 1.6; stroke-linejoin: round; }
.sticker.tappable { cursor: pointer; }
.sticker.lit { stroke: var(--accent); stroke-width: 3; }
.shade { fill: #000; pointer-events: none; }
.label { fill: #000; stroke: rgba(255,255,255,0.85); stroke-width: 2.4; paint-order: stroke; font-family: var(--round); font-weight: 700; text-anchor: middle; dominant-baseline: central; pointer-events: none; }
.zone { pointer-events: none; --c: hsl(var(--hue) 90% 45%); }
.area { fill: var(--c); stroke: var(--c); stroke-linejoin: round; opacity: 0.4; }
.area.strong { opacity: 0.85; }
.ticks { fill: none; stroke: hsl(var(--hue) 90% 20%); stroke-width: 2.6; stroke-linecap: round; }
.trace { pointer-events: none; }
.reach { fill: rgba(255,255,255,0.15); stroke: #000; stroke-width: 1; stroke-dasharray: 4 3; }
.line { fill: none; stroke: #e0007a; stroke-width: 2; stroke-linejoin: round; stroke-linecap: round; }
.score { font-family: monospace; font-size: 10px; white-space: pre; stroke: rgba(255,255,255,0.9); stroke-width: 2.4; paint-order: stroke; }
.arrowhead { fill: var(--accent); }
.arrow { fill: none; stroke: var(--accent); stroke-width: 3; stroke-linecap: round; stroke-linejoin: round; }
.arrow-halo { fill: none; stroke: var(--halo); stroke-width: 7; stroke-linecap: round; stroke-linejoin: round; }
</style>

<style>
.zonebar { position: fixed; left: 8px; bottom: 8px; z-index: 10; display: flex; flex-wrap: wrap; gap: 4px; max-width: calc(100vw - 16px); }
.zonebar button { font: 700 12px monospace; padding: 3px 7px; border: 1px solid #000; border-radius: 4px; background: #fff; color: #000; }
.zonebar button.on { background: #000; color: #fff; }
</style>
