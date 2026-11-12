import { describe, expect, it } from 'vitest'
import { parseMove } from '../notation'
import { IDENTITY } from '../vec'
import { boardMove, rollTowards } from '../view'
import { keyToAction } from './keyboard'

/*
 * The keys around S are laid out like the board: S the middle (D), W the far side (B), X the near side (F), A and D
 * the sides (L, R), Q the lid (U). Shift turns the other way. Keys go by where they sit (e.code), so the layout holds
 * on AZERTY or Dvorak. Turns follow what is drawn: they are named by the board, so rolling the cube renames them.
 */

const key = (code: string, extra: Partial<{ key: string; shiftKey: boolean; metaKey: boolean; ctrlKey: boolean; altKey: boolean }> = {}) =>
  ({ code, key: '', shiftKey: false, metaKey: false, ctrlKey: false, altKey: false, ...extra })

describe('keyToAction', () => {
  it('turns the face where the key sits, held as at the start', () => {
    const faces = { KeyS: 'D', KeyW: 'B', KeyX: 'F', KeyA: 'L', KeyD: 'R', KeyQ: 'U' }
    for (const [code, face] of Object.entries(faces)) {
      expect(keyToAction(key(code), IDENTITY)).toEqual({ type: 'turn', move: parseMove(face) })
      expect(keyToAction(key(code, { shiftKey: true }), IDENTITY)).toEqual({ type: 'turn', move: parseMove(face + "'") })
    }
  })

  it('names the turn by the board, so a rolled cube is turned by the same keys', () => {
    const rolled = rollTowards(IDENTITY, [0, 0, 1])
    const action = keyToAction(key('KeyS'), rolled)
    expect(action).toEqual({ type: 'turn', move: boardMove(rolled, 'D', 1) })
    expect(action).not.toEqual({ type: 'turn', move: parseMove('D') })
  })

  it('rolls with the arrow keys and Space', () => {
    expect(keyToAction(key('ArrowUp'), IDENTITY)).toEqual({ type: 'roll', towards: [0, 0, -1] })
    expect(keyToAction(key('ArrowDown'), IDENTITY)).toEqual({ type: 'roll', towards: [0, 0, 1] })
    expect(keyToAction(key('ArrowLeft'), IDENTITY)).toEqual({ type: 'roll', towards: [-1, 0, 0] })
    expect(keyToAction(key('ArrowRight'), IDENTITY)).toEqual({ type: 'roll', towards: [1, 0, 0] })
    expect(keyToAction(key('Space'), IDENTITY)).toEqual({ type: 'roll', towards: [0, -1, 0] })
  })

  it('undoes with Z, Ctrl+Z or ⌘Z', () => {
    expect(keyToAction(key('KeyZ'), IDENTITY)).toEqual({ type: 'undo' })
    expect(keyToAction(key('KeyZ', { key: 'z', ctrlKey: true }), IDENTITY)).toEqual({ type: 'undo' })
    expect(keyToAction(key('KeyZ', { key: 'z', metaKey: true }), IDENTITY)).toEqual({ type: 'undo' })
  })

  it('leaves alone anything else, and every shortcut with a modifier', () => {
    expect(keyToAction(key('KeyP'), IDENTITY)).toBeNull()
    expect(keyToAction(key('KeyS', { metaKey: true }), IDENTITY)).toBeNull()
    expect(keyToAction(key('KeyS', { ctrlKey: true }), IDENTITY)).toBeNull()
    expect(keyToAction(key('KeyS', { altKey: true }), IDENTITY)).toBeNull()
    expect(keyToAction(key('KeyZ', { key: 'z', metaKey: true, shiftKey: true }), IDENTITY)).toBeNull()
  })
})
