import { describe, expect, it } from 'vitest'
import {
  discardGroup,
  canRedo,
  canUndo,
  closeGroup,
  createHistory,
  record,
  redo,
  undo,
} from './history'

describe('history', () => {
  it('records, undoes and redoes', () => {
    let h = createHistory(0)
    h = record(h, 1)
    h = record(h, 2)
    expect(h.present).toBe(2)
    h = undo(h)
    expect([h.present, canRedo(h)]).toEqual([1, true])
    h = redo(h)
    expect(h.present).toBe(2)
    h = undo(undo(h))
    expect([h.present, canUndo(h)]).toEqual([0, false])
    expect(undo(h)).toBe(h)
  })

  it('a new change clears redo', () => {
    let h = record(record(createHistory('a'), 'b'), 'c')
    h = record(undo(h), 'd')
    expect([h.present, canRedo(h)]).toEqual(['d', false])
  })

  it('ignores no-op changes', () => {
    const h = createHistory({ x: 1 })
    expect(record(h, h.present)).toBe(h)
  })

  it('coalesces a stroke into one undo step', () => {
    let h = createHistory(0)
    h = record(h, 1, { group: 'stroke-1' })
    h = record(h, 2, { group: 'stroke-1' })
    h = record(h, 3, { group: 'stroke-1' })
    h = closeGroup(h)
    h = record(h, 4, { group: 'stroke-1' }) // same key after close = new step
    expect(h.past).toEqual([0, 3])
    expect(undo(h).present).toBe(3)
    expect(undo(undo(h)).present).toBe(0)
  })

  it('keeps at most `limit` undo steps', () => {
    let h = createHistory(0)
    for (let i = 1; i <= 5; i++) h = record(h, i, { limit: 3 })
    expect(h.past).toEqual([2, 3, 4])
  })
})

describe('discardGroup', () => {
  it('drops a cancelled stroke without leaving a redo step', () => {
    let h = record(createHistory(0), 1)
    h = record(closeGroup(h), 2, { group: 's' })
    h = record(h, 3, { group: 's' })
    const d = discardGroup(h)
    expect(d.present).toBe(1)
    expect(canRedo(d)).toBe(false)
    expect(d.past).toEqual([0])
  })

  it('does nothing when the stroke changed nothing', () => {
    const h = closeGroup(record(createHistory(0), 1))
    expect(discardGroup(h)).toBe(h)
  })
})
