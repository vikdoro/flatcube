# flatcube

[![CI](https://github.com/vikdoro/flatcube/actions/workflows/ci.yml/badge.svg)](https://github.com/vikdoro/flatcube/actions/workflows/ci.yml)

A 3×3 cube laid out flat as an open box (one face in the middle, the four sides fanned around it, the far face hanging
open above like a lid), controllable from anything: notation, a keyboard, a drag, a solver.
Terms for the board are in [cube-terminology.md](cube-terminology.md).

## Use

```ts
import { createBoard, attachKeyboard, CubeBoard } from 'flatcube/vue'

const board = createBoard()
board.turn("R U R' U'")          // notation, a move or a list of moves; the board animates them in turn
board.onTurnLanded(move => console.log('landed', move))

// in a Vue component: <CubeBoard :board="board" @turn="move => board.turn(move, true)" />
const detach = attachKeyboard({
  getView: () => board.view.value,
  onAction: a => a.type === 'turn' ? board.turn(a.move, true) : a.type === 'roll' ? board.roll(a.towards) : undefined,
})
// detach() stops the keys; board.dispose() stops the clock
```

## Notation

Moves are standard notation (`U D F B L R`, `'` for anticlockwise, `2` for a half turn), as on a cube held with white on
top and green in front, clockwise as seen from outside the cube. `parseMove('D')` means the same turn whatever the board
is showing; only the keyboard and the board's move label follow how the cube is held. A new cube starts with a white lid
and a yellow middle face.

Not supported: slices (`M E S`), wide moves (`r`, `Rw`) and rotations (`x y z`). They throw a `NotationError`.

## Facelets and solvers

`toFacelets` and `fromFacelets` read and write the 54-letter Kociemba facelet string, so a solver written for a standard
cube needs nothing translated:

```ts
import { createCube } from 'flatcube'
import Cube from 'cubejs'

Cube.initSolver()
const cube = createCube()
cube.apply("R U2 F' D B2 L' U R' D2 F U' L2 B R2 D' F2 U B' L D")
cube.apply(Cube.fromString(cube.toFacelets()).solve())
cube.isSolved() // true
```

`fromFacelets` rejects strings that no sequence of turns can reach (a twisted corner, a flipped edge, two pieces swapped).

## Entry points

- `flatcube`: the model, notation, facelets and the headless cube (`createCube`). No Vue, no DOM.
- `flatcube/board`: the board's geometry: layout, arrows, frame, gestures, motion. No Vue.
- `flatcube/vue`: `createBoard`, the `CubeBoard` component and the keyboard. Needs Vue 3.5.

## Development

```bash
npm install
npm run check   # vue-tsc, then the tests
```

The package ships TypeScript source, not a build: a Vite app compiles it, `CubeBoard.vue` included, through
`@vitejs/plugin-vue`. Releases are git tags (`v0.1.0`), which an app pins as `github:vikdoro/flatcube#v0.1.0`.

## License

MIT
