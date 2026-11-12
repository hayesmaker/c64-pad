import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createCharmap } from '@/c64/charmap'
import {
  DEFAULT_CHAR_TRACING,
  charSpots,
  clearBackground,
  loadCharTracing,
  pinBrush,
  saveCharTracing,
  shiftToCell,
  traceSources,
} from './char-tracing'
import { DEFAULT_TRACING, placeTracing } from './placement'

const map = (id: string, width: number, height: number, cells: Array<number>) =>
  createCharmap({
    id,
    charsetId: 'cs',
    width,
    height,
    cells: Uint8Array.from(cells),
  })

describe('charSpots', () => {
  it('finds a char row by row, map by map, skipping the Blank Char', () => {
    const a = map('a', 3, 2, [0, 5, 0, 5, 0, 0])
    const b = map('b', 2, 1, [0, 5])
    expect(charSpots([a, b], 5, false)).toEqual([
      { mapId: 'a', x: 1, y: 0 },
      { mapId: 'a', x: 0, y: 1 },
      { mapId: 'b', x: 1, y: 0 },
    ])
    // The blank char itself is never a drawing of it.
    expect(charSpots([a], 0, false)).toEqual([])
  })

  it('matches ECM codes on any background', () => {
    const m = map('m', 3, 1, [0, 5 + 64, 5 + 192])
    expect(charSpots([m], 5, true)).toHaveLength(2)
    expect(charSpots([m], 5, false)).toHaveLength(0)
  })

  it('stops at the limit', () => {
    const m = map('m', 4, 1, [7, 7, 7, 7])
    expect(charSpots([m], 7, false, 2)).toHaveLength(2)
  })
})

describe('traceSources', () => {
  const m = map('m', 3, 1, [0, 5, 5])
  it('puts the pin first and drops its duplicate', () => {
    expect(traceSources([m], 5, false, { mapId: 'm', x: 2, y: 0 })).toEqual([
      { mapId: 'm', x: 2, y: 0, pinned: true },
      { mapId: 'm', x: 1, y: 0, pinned: false },
    ])
  })
  it('keeps a pin to a cell holding something else', () => {
    expect(traceSources([m], 9, false, { mapId: 'm', x: 0, y: 0 })).toEqual([
      { mapId: 'm', x: 0, y: 0, pinned: true },
    ])
  })
  it('ignores a pin to a missing map or a cell off the map', () => {
    expect(traceSources([m], 9, false, { mapId: 'x', x: 0, y: 0 })).toEqual([])
    expect(traceSources([m], 9, false, { mapId: 'm', x: 3, y: 0 })).toEqual([])
  })
})

it('shiftToCell moves the image so the cell sits at the origin', () => {
  const p = placeTracing(
    { width: 40, height: 16 },
    { width: 40, height: 16 },
    { ...DEFAULT_TRACING, nudge: { x: 2, y: 1 } },
  )
  expect(shiftToCell(p, 3, 1).target).toEqual({
    x: 2 - 24,
    y: 1 - 8,
    width: 40,
    height: 16,
  })
})

it('clearBackground makes background pixels transparent', () => {
  expect([...clearBackground([6, 1, 6, 2], 6)]).toEqual([-1, 1, -1, 2])
})

describe('pinBrush', () => {
  const m = map('m', 4, 2, [0, 0, 0, 0, 0, 0, 0, 0])
  it('pins each char of a block brush to its cell', () => {
    const brush = { width: 2, height: 2, cells: Uint8Array.of(1, 2, 0, 3) }
    const { prefs, pinned } = pinBrush(
      DEFAULT_CHAR_TRACING,
      m,
      brush,
      2,
      0,
      false,
    )
    expect(pinned).toEqual([1, 2, 3])
    expect(prefs.pins).toEqual({
      1: { mapId: 'm', x: 2, y: 0 },
      2: { mapId: 'm', x: 3, y: 0 },
      3: { mapId: 'm', x: 3, y: 1 },
    })
  })
  it('skips cells off the map and pins ECM codes by char', () => {
    const brush = { width: 2, height: 1, cells: Uint8Array.of(65, 66) }
    const { pinned } = pinBrush(DEFAULT_CHAR_TRACING, m, brush, 3, 0, true)
    expect(pinned).toEqual([1])
  })
})

describe('stored prefs', () => {
  beforeEach(() => {
    const store = new Map<string, string>()
    vi.stubGlobal('localStorage', {
      getItem: (k: string) => store.get(k) ?? null,
      setItem: (k: string, v: string) => void store.set(k, v),
    })
    return () => vi.unstubAllGlobals()
  })
  it('round-trips and falls back on junk', () => {
    const prefs = {
      ...DEFAULT_CHAR_TRACING,
      pins: { 4: { mapId: 'm', x: 1, y: 2 } },
      opacity: 0.8,
      layer: 'under' as const,
    }
    saveCharTracing('cs', prefs)
    expect(loadCharTracing('cs')).toEqual(prefs)
    localStorage.setItem('c64pad:char-tracing:cs', '{bad')
    expect(loadCharTracing('cs')).toEqual(DEFAULT_CHAR_TRACING)
    localStorage.setItem(
      'c64pad:char-tracing:cs',
      JSON.stringify({
        pins: { 1: { mapId: 3 }, 2: { mapId: 'm', x: 0, y: 0 } },
      }),
    )
    expect(loadCharTracing('cs').pins).toEqual({
      2: { mapId: 'm', x: 0, y: 0 },
    })
  })
})
