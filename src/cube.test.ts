import { describe, expect, it, vi } from 'vitest'
import { createCube } from './cube'
import { toFacelets } from './facelets'
import { applyMoves, SOLVED } from './model'
import { NotationError, parseMove, parseMoves } from './notation'

describe('createCube', () => {
  it('starts solved, or from the state it is given', () => {
    expect(createCube().state).toEqual(SOLVED)
    expect(createCube().isSolved()).toBe(true)
    const scrambled = applyMoves(SOLVED, parseMoves("R U R' U'"))
    const cube = createCube(scrambled)
    expect(cube.state).toEqual(scrambled)
    expect(cube.isSolved()).toBe(false)
  })

  it('applies notation, a move, or a list of moves, all the same', () => {
    const viaString = createCube(), viaMove = createCube(), viaList = createCube()
    viaString.apply("R U' F2")
    for (const move of parseMoves("R U' F2")) viaMove.apply(move)
    viaList.apply(parseMoves("R U' F2"))
    expect(viaMove.state).toEqual(viaString.state)
    expect(viaList.state).toEqual(viaString.state)
    expect(viaString.state).toEqual(applyMoves(SOLVED, parseMoves("R U' F2")))
  })

  it('is solved again after an algorithm and its reverse', () => {
    const cube = createCube()
    cube.apply("R U F' L2 D'")
    expect(cube.isSolved()).toBe(false)
    cube.apply("D L2 F U' R'")
    expect(cube.isSolved()).toBe(true)
  })

  it('applies nothing at all when part of the notation is wrong', () => {
    const cube = createCube(), listener = vi.fn()
    cube.subscribe(listener)
    expect(() => cube.apply('R U Q')).toThrow(NotationError)
    expect(cube.state).toEqual(SOLVED)
    expect(listener).not.toHaveBeenCalled()
  })

  it('hands out snapshots: a state it gave earlier does not change', () => {
    const cube = createCube(), before = cube.state
    cube.apply('R')
    expect(before).toEqual(SOLVED)
    expect(cube.state).not.toEqual(SOLVED)
  })

  it('tells subscribers about each move in order, and about a reset', () => {
    const cube = createCube(), events: unknown[] = []
    cube.subscribe(event => events.push(event))
    cube.apply('R U')
    cube.reset()
    expect(events).toEqual([
      { type: 'move', move: parseMove('R') },
      { type: 'move', move: parseMove('U') },
      { type: 'reset' },
    ])
    expect(cube.isSolved()).toBe(true)
  })

  it('can be reset to any state', () => {
    const cube = createCube(), state = applyMoves(SOLVED, parseMoves('F2 D'))
    cube.reset(state)
    expect(cube.state).toEqual(state)
  })

  it('stops telling a subscriber that has unsubscribed', () => {
    const cube = createCube(), listener = vi.fn()
    const unsubscribe = cube.subscribe(listener)
    cube.apply('R')
    unsubscribe()
    cube.apply('U')
    expect(listener).toHaveBeenCalledTimes(1)
  })

  it('writes its state as facelets', () => {
    const cube = createCube()
    cube.apply("R U R' U'")
    expect(cube.toFacelets()).toBe(toFacelets(cube.state))
  })

  it('shares nothing between cubes', () => {
    const a = createCube(), b = createCube()
    a.apply('R')
    expect(b.isSolved()).toBe(true)
  })
})
