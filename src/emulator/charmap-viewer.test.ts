import { describe, expect, it } from 'vitest'
import { createCharmap, setCell } from '@/c64/charmap'
import { createCharset, setCharBytes, setCharsetMode } from '@/c64/charset'
import {
  CHARMAP_VIEWER,
  buildCharmapViewerPrg,
  charsetViewerPrg,
  mapViewerPrg,
} from './charmap-viewer'

const at = (address: number) => 2 + address - CHARMAP_VIEWER.LOAD

describe('charmap viewer PRG', () => {
  it('lays out config, colours, charset and map', () => {
    let cs = setCharsetMode(createCharset({ background: 0 }), 'multicolor')
    cs = setCharBytes(cs, 5, Uint8Array.of(9, 9, 9, 9, 9, 9, 9, 9))
    let map = createCharmap({
      charsetId: cs.id,
      width: 80,
      height: 30,
      blank: 5,
    })
    map = setCell(map, 79, 29, 7)
    const { prg, rows } = mapViewerPrg(map, cs)
    expect(rows).toBe(30)
    expect([prg[0], prg[1]]).toEqual([0x01, 0x08])
    expect(prg).toHaveLength(
      2 + CHARMAP_VIEWER.MAP + 80 * 30 - CHARMAP_VIEWER.LOAD,
    )
    const cfg = (o: number) => prg[at(CHARMAP_VIEWER.CONFIG + o)]
    expect(cfg(1)).toBe(0) // background
    expect(cfg(5)).toBe(1) // multicolour
    expect([cfg(6), cfg(7)]).toEqual([80, 0]) // map width
    expect([cfg(10), cfg(11)]).toEqual([40, 25]) // view
    expect([cfg(14), cfg(16)]).toEqual([40, 5]) // scroll range
    expect(cfg(18)).toBe(5) // blank char fills outside
    expect(prg[at(CHARMAP_VIEWER.CHARSET + 5 * 8)]).toBe(9)
    expect(prg[at(CHARMAP_VIEWER.MAP + 80 * 30 - 1)]).toBe(7)
  })

  it('centres a charset as 16 × 16 codes', () => {
    const { prg } = charsetViewerPrg(createCharset())
    const cfg = (o: number) => prg[at(CHARMAP_VIEWER.CONFIG + o)]
    expect([cfg(10), cfg(11), cfg(12), cfg(13)]).toEqual([16, 16, 12, 4])
    expect(prg[at(CHARMAP_VIEWER.MAP + 255)]).toBe(255)
  })

  it('keeps the first rows of a map too big for memory', () => {
    const cs = createCharset()
    const { rows } = buildCharmapViewerPrg(cs, {
      cells: new Uint8Array(1024 * 1024),
      width: 1024,
      height: 1024,
    })
    expect(rows).toBe(Math.floor(CHARMAP_VIEWER.MAP_MAX_BYTES / 1024))
  })

  it('starts at the given screen, kept inside the scroll range', () => {
    const cs = createCharset()
    const map = createCharmap({ charsetId: cs.id, width: 80, height: 60 })
    const start = (x: number, y: number) => {
      const { prg } = mapViewerPrg(map, cs, { x, y })
      const cfg = (o: number) => prg[at(CHARMAP_VIEWER.CONFIG + o)]
      return [cfg(20) | (cfg(21) << 8), cfg(22) | (cfg(23) << 8)]
    }
    expect(start(0, 0)).toEqual([0, 0])
    expect(start(12, 30)).toEqual([12, 30])
    expect(start(70, 50)).toEqual([40, 35]) // the last screen
    expect(start(-3, -1)).toEqual([0, 0])
    expect(mapViewerPrg(map, cs).prg[at(CHARMAP_VIEWER.CONFIG + 22)]).toBe(0)
  })

  it('keeps the rows round the start screen of a map too big for memory', () => {
    const cs = createCharset()
    const cells = new Uint8Array(1024 * 1024)
    for (let y = 0; y < 1024; y++) cells[y * 1024] = y & 0xff
    const fit = Math.floor(CHARMAP_VIEWER.MAP_MAX_BYTES / 1024)
    const build = (y: number) =>
      buildCharmapViewerPrg(cs, {
        cells,
        width: 1024,
        height: 1024,
        start: { x: 0, y },
      })
    const { prg, rows, firstRow } = build(600)
    expect(rows).toBe(fit)
    expect(firstRow).toBe(Math.round(600 - (fit - 25) / 2))
    const cfg = (o: number) => prg[at(CHARMAP_VIEWER.CONFIG + o)]
    // Starts at row 600 of the map, which is row 600 - firstRow in memory.
    expect(cfg(22) | (cfg(23) << 8)).toBe(600 - firstRow)
    expect(prg[at(CHARMAP_VIEWER.MAP)]).toBe(firstRow & 0xff)
    // Near either end the window stops at the map's edge.
    expect(build(3).firstRow).toBe(0)
    expect(build(1020).firstRow).toBe(1024 - fit)
  })
})
