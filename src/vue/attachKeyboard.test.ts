import { describe, expect, it, vi } from 'vitest'
import { IDENTITY } from '../vec'
import { attachKeyboard } from './keyboard'

/** A stand-in for the document: it keeps the listeners and lets the test press keys. */
function fakeTarget() {
  const listeners = new Set<(e: Event) => void>()
  return {
    listeners,
    addEventListener: (_type: string, fn: (e: Event) => void) => { listeners.add(fn) },
    removeEventListener: (_type: string, fn: (e: Event) => void) => { listeners.delete(fn) },
    press(code: string, extra: object = {}) {
      const e = { code, key: '', shiftKey: false, metaKey: false, ctrlKey: false, altKey: false, preventDefault: vi.fn(), ...extra }
      listeners.forEach(fn => fn(e as unknown as Event))
      return e
    },
  }
}

describe('attachKeyboard', () => {
  it('reports what each key means, and stops when detached', () => {
    const target = fakeTarget(), onAction = vi.fn()
    const detach = attachKeyboard({ target, getView: () => IDENTITY, onAction })
    target.press('KeyZ')
    expect(onAction).toHaveBeenCalledWith({ type: 'undo' })
    detach()
    target.press('KeyZ')
    expect(onAction).toHaveBeenCalledTimes(1)
    expect(target.listeners.size).toBe(0)
  })

  it('keeps the browser out of rolling and of ⌘Z, and out of everything else', () => {
    const target = fakeTarget()
    attachKeyboard({ target, getView: () => IDENTITY, onAction: () => {} })
    expect(target.press('Space').preventDefault).toHaveBeenCalled()
    expect(target.press('ArrowLeft').preventDefault).toHaveBeenCalled()
    expect(target.press('KeyZ', { key: 'z', metaKey: true }).preventDefault).toHaveBeenCalled()
    expect(target.press('KeyS').preventDefault).not.toHaveBeenCalled()
    expect(target.press('KeyP').preventDefault).not.toHaveBeenCalled()
  })

  it('ignores keys while it is not enabled, and reads the view as it is when a key is pressed', () => {
    const target = fakeTarget(), onAction = vi.fn(), getView = vi.fn(() => IDENTITY)
    let on = false
    attachKeyboard({ target, getView, onAction, enabled: () => on })
    target.press('KeyS')
    expect(onAction).not.toHaveBeenCalled()
    on = true
    target.press('KeyS')
    expect(onAction).toHaveBeenCalledTimes(1)
    expect(getView).toHaveBeenCalledTimes(1)
  })
})
