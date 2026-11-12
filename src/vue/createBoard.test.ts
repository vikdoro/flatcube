import { afterEach, describe, expect, it, vi } from 'vitest'
import { TURN_MS } from '../board/motion'
import { applyMoves, SOLVED } from '../model'
import { NotationError, parseMove, parseMoves } from '../notation'
import { IDENTITY } from '../vec'
import { facingFace, rollTowards } from '../view'
import { createBoard } from './createBoard'

/*
 * The board controller is one instance per board: no module state, no work at import time. Where there is no
 * document (as under node here) or the tab is hidden, or the user prefers reduced motion, a turn lands at once; the
 * animated path is exercised below with a hand-driven clock.
 */

afterEach(() => {
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
  vi.useRealTimers()
})

describe('createBoard, where nothing animates', () => {
  it('starts solved and held as at the start, or as it is told', () => {
    const board = createBoard()
    expect(board.state.value).toEqual(SOLVED)
    expect(board.view.value).toEqual(IDENTITY)
    const rolled = rollTowards(IDENTITY, [1, 0, 0])
    expect(createBoard({ view: rolled }).view.value).toEqual(rolled)
  })

  it('turns by notation, a move or a list, and the state follows', () => {
    const board = createBoard()
    board.turn("R U'")
    board.turn(parseMove('F'))
    board.turn(parseMoves('D2 L'))
    expect(board.state.value).toEqual(applyMoves(SOLVED, parseMoves("R U' F D2 L")))
    expect(board.busy.value).toBe(false)
  })

  it('reports each turn as it is applied and as it lands, in order, and who made it', () => {
    const board = createBoard(), log: string[] = []
    board.onTurnApplied((move, byPlayer) => log.push(`applied ${JSON.stringify(move)} ${byPlayer}`))
    board.onTurnLanded((move, byPlayer) => log.push(`landed ${JSON.stringify(move)} ${byPlayer}`))
    board.turn('R U', true)
    const [r, u] = parseMoves('R U').map(m => JSON.stringify(m))
    expect(log).toEqual([`applied ${r} true`, `landed ${r} true`, `applied ${u} true`, `landed ${u} true`])
    log.length = 0
    board.turn('R')
    expect(log[0]).toBe(`applied ${r} false`)
  })

  it('turns nothing, and tells nobody, when part of the notation is wrong', () => {
    const board = createBoard(), listener = vi.fn()
    board.onTurnApplied(listener)
    expect(() => board.turn('R X')).toThrow(NotationError)
    expect(board.state.value).toEqual(SOLVED)
    expect(listener).not.toHaveBeenCalled()
  })

  it('puts the cube in a new state with reset, and says so', () => {
    const board = createBoard(), listener = vi.fn()
    board.onReset(listener)
    const next = applyMoves(SOLVED, parseMoves('F2'))
    board.reset(next)
    expect(board.state.value).toEqual(next)
    expect(listener).toHaveBeenCalledTimes(1)
  })

  it('stops calling a listener that has unsubscribed', () => {
    const board = createBoard(), listener = vi.fn()
    const unsubscribe = board.onTurnLanded(listener)
    board.turn('R')
    unsubscribe()
    board.turn('U')
    expect(listener).toHaveBeenCalledTimes(1)
  })

  it('rolls the cube to bring a face to the middle, and can set the view at once', () => {
    const board = createBoard()
    board.roll([1, 0, 0])
    expect(board.view.value).toEqual(rollTowards(IDENTITY, [1, 0, 0]))
    expect(facingFace(board.view.value)).toBe('R')
    board.setView(IDENTITY)
    expect(board.view.value).toEqual(IDENTITY)
  })

  it('shares nothing between boards', () => {
    const a = createBoard(), b = createBoard(), listener = vi.fn()
    b.onTurnApplied(listener)
    a.turn('R')
    a.roll([1, 0, 0])
    expect(b.state.value).toEqual(SOLVED)
    expect(b.view.value).toEqual(IDENTITY)
    expect(listener).not.toHaveBeenCalled()
  })
})

describe('createBoard, animated', () => {
  /** A visible tab with a clock and animation frames that the test drives by hand. */
  function stage() {
    let t = 1000
    const frames: (() => void)[] = []
    vi.stubGlobal('document', { hidden: false })
    vi.stubGlobal('matchMedia', () => ({ matches: false }))
    vi.stubGlobal('requestAnimationFrame', (cb: () => void) => frames.push(cb))
    vi.stubGlobal('cancelAnimationFrame', () => {})
    vi.spyOn(performance, 'now').mockImplementation(() => t)
    return {
      /** Move the clock on and run the frame that is waiting. */
      advance(ms: number) {
        t += ms
        frames.splice(0).forEach(cb => cb())
      },
    }
  }

  it('changes the state as a turn starts and lands it TURN_MS later', () => {
    const clock = stage(), board = createBoard(), landed = vi.fn()
    board.onTurnLanded(landed)
    board.turn('R')
    expect(board.state.value).toEqual(applyMoves(SOLVED, parseMoves('R')))
    expect(board.turning.value).not.toBeNull()
    expect(board.busy.value).toBe(true)
    expect(landed).not.toHaveBeenCalled()
    clock.advance(TURN_MS)
    expect(landed).toHaveBeenCalledTimes(1)
    expect(board.turning.value).toBeNull()
    expect(board.busy.value).toBe(false)
    board.dispose()
  })

  it('plays queued turns one at a time', () => {
    const clock = stage(), board = createBoard()
    board.turn('R U')
    expect(board.state.value).toEqual(applyMoves(SOLVED, parseMoves('R')))
    clock.advance(TURN_MS)
    expect(board.state.value).toEqual(applyMoves(SOLVED, parseMoves('R U')))
    clock.advance(TURN_MS)
    expect(board.busy.value).toBe(false)
    board.dispose()
  })

  it('drops the turns still waiting when the cube is reset', () => {
    stage()
    const board = createBoard()
    board.turn('R U F')
    board.reset(SOLVED)
    expect(board.state.value).toEqual(SOLVED)
    expect(board.turning.value).toBeNull()
    board.dispose()
  })

  it('lands turns at once when the user prefers reduced motion', () => {
    stage()
    vi.stubGlobal('matchMedia', () => ({ matches: true }))
    const board = createBoard()
    board.turn('R')
    expect(board.turning.value).toBeNull()
    expect(board.busy.value).toBe(false)
    board.dispose()
  })
})

describe('createBoard, side effects', () => {
  it('does no work when its module is imported', async () => {
    vi.useFakeTimers()
    vi.stubGlobal('document', { hidden: false })
    vi.resetModules()
    await import('./createBoard')
    expect(vi.getTimerCount()).toBe(0)
  })

  it('leaves nothing running once it is disposed', () => {
    vi.useFakeTimers()
    vi.stubGlobal('document', { hidden: false })
    vi.stubGlobal('matchMedia', () => ({ matches: false }))
    const board = createBoard()
    board.dispose()
    expect(vi.getTimerCount()).toBe(0)
  })
})
