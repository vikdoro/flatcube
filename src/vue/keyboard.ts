import type { Face, Move } from '../model'
import type { Vec3 } from '../vec'
import { boardMove, type View } from '../view'

// the keys around S are laid out like the board, S the middle (D), W the far side (B), X the near side (F), A and D
// the sides (L, R) and Q the lid (U); Shift turns the other way. Z or ⌘Z / Ctrl+Z undoes. Keys go by where they sit on
// the keyboard, so the layout holds on AZERTY or Dvorak too. The arrow keys roll the side that way to the middle and
// Space brings up the lid, as tapping them does
const KEY_FACE: Record<string, Face> = { KeyS: 'D', KeyW: 'B', KeyX: 'F', KeyA: 'L', KeyD: 'R', KeyQ: 'U' }
const KEY_ROLL: Record<string, Vec3> = { ArrowUp: [0, 0, -1], ArrowDown: [0, 0, 1], ArrowLeft: [-1, 0, 0], ArrowRight: [1, 0, 0], Space: [0, -1, 0] }

export type KeyAction =
  | { type: 'turn'; move: Move }
  | { type: 'undo' }
  | { type: 'roll'; towards: Vec3 }

type Key = Pick<KeyboardEvent, 'code' | 'key' | 'shiftKey' | 'metaKey' | 'ctrlKey' | 'altKey'>

/** What a key press means, or null if it means nothing. Turns are named by the board, so they follow the view. */
export function keyToAction(e: Key, view: View): KeyAction | null {
  if ((e.metaKey || e.ctrlKey) && !e.shiftKey && e.key.toLowerCase() === 'z') return { type: 'undo' }
  if (e.metaKey || e.ctrlKey || e.altKey) return null
  if (e.code === 'KeyZ') return { type: 'undo' }
  const face = KEY_FACE[e.code], towards = KEY_ROLL[e.code]
  if (face) return { type: 'turn', move: boardMove(view, face, e.shiftKey ? 3 : 1) }
  if (towards) return { type: 'roll', towards }
  return null
}

export interface KeyboardOptions {
  /** Where to listen; the document by default. */
  target?: Pick<EventTarget, 'addEventListener' | 'removeEventListener'>
  getView: () => View
  onAction: (action: KeyAction) => void
  /** Keys are ignored while this says no, e.g. while a sheet is open. */
  enabled?: () => boolean
}

/** Listen for keys and report what they mean; returns the function that stops listening. */
export function attachKeyboard({ target = document, getView, onAction, enabled }: KeyboardOptions) {
  const onKeyDown = (e: Event) => {
    const key = e as KeyboardEvent
    if (enabled && !enabled()) return
    const action = keyToAction(key, getView())
    if (!action) return
    // no scrolling, and Space doesn't press a focused button; ⌘Z is not the browser's undo
    if (action.type === 'roll' || (action.type === 'undo' && (key.metaKey || key.ctrlKey))) key.preventDefault()
    onAction(action)
  }
  target.addEventListener('keydown', onKeyDown)
  return () => target.removeEventListener('keydown', onKeyDown)
}
