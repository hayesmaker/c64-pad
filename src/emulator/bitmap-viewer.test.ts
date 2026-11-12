import { describe, expect, it } from 'vitest'
import { createCharmap, setCell, setCellColor } from '@/c64/charmap'
import { createCharset, setCharBytes, setCharsetMode } from '@/c64/charset'
import { BITMAP_VIEWER } from './bitmap-viewer'
import { charsetViewerPrg, mapViewerPrg } from './charmap-viewer'

const at = (address: number) => 2 + address - BITMAP_VIEWER.LOAD

describe('bitmap viewer PRG', () => {
  it('lays out config, tiles and the three map arrays', () => {
    let cs = setCharsetMode(createCharset({ background: 6 }), 'bitmap')
    cs = setCharBytes(cs, 5, new Uint8Array(8).fill(0x1b))
    let map = createCharmap({ charsetId: cs.id, width: 80, height: 30 })
    map = setCell(map, 79, 29, 5)
    map = setCellColor(map, 79, 29, 3, 2)
    const { prg, rows, firstRow } = mapViewerPrg(map, cs, { x: 40, y: 5 })
    expect([rows, firstRow]).toEqual([30, 0])
    const n = 80 * 30
    expect(prg).toHaveLength(2 + BITMAP_VIEWER.MAP + 3 * n - BITMAP_VIEWER.LOAD)
    const cfg = (o: number) => prg[at(BITMAP_VIEWER.CONFIG + o)]
    const word = (o: number) => cfg(o) | (cfg(o + 1) << 8)
    expect(cfg(1)).toBe(6) // background
    expect(word(2)).toBe(80) // map width
    expect([cfg(4), cfg(5)]).toEqual([40, 25]) // view
    expect([word(6), word(8)]).toEqual([40, 5]) // scroll range
    expect([word(10), word(12)]).toEqual([40, 5]) // start
    expect([word(14), word(16)]).toEqual([n, 2 * n]) // array offsets
    expect([word(18), word(20)]).toEqual([0x0400, 0x2000])
    expect(prg[at(BITMAP_VIEWER.TILES + 5 * 8)]).toBe(0x1b)
    expect(prg[at(BITMAP_VIEWER.MAP + n - 1)]).toBe(5)
    expect(prg[at(BITMAP_VIEWER.MAP + 2 * n - 1)]).toBe(0xbc) // default MC
    expect(prg[at(BITMAP_VIEWER.MAP + 3 * n - 1)]).toBe(2) // the cell's own
  })

  it('shows a bitmap charset as a centred 16 × 16 grid', () => {
    const cs = setCharsetMode(createCharset(), 'bitmap')
    const { prg } = charsetViewerPrg(cs)
    const cfg = (o: number) => prg[at(BITMAP_VIEWER.CONFIG + o)]
    const word = (o: number) => cfg(o) | (cfg(o + 1) << 8)
    expect([cfg(4), cfg(5)]).toEqual([16, 16])
    expect(word(18)).toBe(0x0400 + 4 * 40 + 12)
    expect(word(20)).toBe(0x2000 + 4 * 320 + 12 * 8)
  })
})
