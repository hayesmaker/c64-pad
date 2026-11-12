import { describe, expect, it } from 'vitest'
import {
  CELL_COLOR_NONE,
  createCharmap,
  getCellColor,
  resizeCharmap,
  setCell,
  setCellColor,
} from './charmap'
import {
  charPixelColors,
  charPixelMode,
  charScreenColors,
  copyChar,
  createCharset,
  setCharBytes,
  setCharColor,
  setCharScreenColor,
  setCharsetMode,
  swapChars,
} from './charset'
import { cellColorsOf, renderCharmap } from './render'
import {
  bitmapScreen,
  exportKoala,
  exportMapColors,
  exportMapScreenRam,
} from '@/export/chars'

const bitmapSet = () =>
  setCharsetMode(createCharset({ background: 0 }), 'bitmap')

describe('multicolour bitmap charsets', () => {
  it('reads every char as 4 × 8 with its own three colours', () => {
    let cs = bitmapSet()
    expect(charPixelMode(cs, 0)).toBe('multicolor')
    expect(charScreenColors(cs, 7)).toEqual([11, 12]) // the default MC colours
    cs = setCharScreenColor(cs, 7, 1, 2)
    cs = setCharScreenColor(cs, 7, 2, 5)
    cs = setCharColor(cs, 7, 13) // all 16 colours, unlike MC chars
    expect(cs.screenColors[7]).toBe(0x25)
    expect(charPixelColors(cs, 7)).toEqual([0, 2, 5, 13])
    expect(charPixelColors(cs, 8)).toEqual([0, 11, 12, 14])
  })

  it('keeps how multicolour chars looked when switched to bitmap', () => {
    const mc = setCharsetMode(
      createCharset({ multicolor1: 3, multicolor2: 4 }),
      'multicolor',
    )
    expect(charScreenColors(setCharsetMode(mc, 'bitmap'), 0)).toEqual([3, 4])
  })

  it('copies and swaps screen colours with the chars', () => {
    let cs = setCharScreenColor(bitmapSet(), 1, 1, 9)
    cs = copyChar(cs, 1, 2)
    expect(charScreenColors(cs, 2)[0]).toBe(9)
    cs = swapChars(cs, 2, 3)
    expect(charScreenColors(cs, 3)[0]).toBe(9)
    expect(charScreenColors(cs, 2)[0]).toBe(11)
  })

  it('rejects screen colours of the wrong size', () => {
    expect(() => createCharset({ screenColors: new Uint8Array(3) })).toThrow()
  })
})

describe('cell colours', () => {
  it('sets, reads and clears a cell’s own colours', () => {
    let map = createCharmap({ charsetId: 'x', width: 4, height: 3 })
    expect(map.cellColors).toBeNull()
    expect(setCellColor(map, 1, 1, 2, null)).toBe(map)
    map = setCellColor(map, 1, 1, 2, 6)
    expect(getCellColor(map, 1, 1, 2)).toBe(6)
    expect(getCellColor(map, 1, 1, 1)).toBeNull()
    expect(setCellColor(map, 1, 1, 2, 6)).toBe(map)
    map = setCellColor(map, 0, 0, 3, 7, 10, 10) // clipped to the map
    expect(getCellColor(map, 3, 2, 3)).toBe(7)
    map = setCellColor(map, 1, 1, 2, null)
    expect(getCellColor(map, 1, 1, 2)).toBeNull()
  })

  it('keeps cell colours through a resize', () => {
    let map = createCharmap({ charsetId: 'x', width: 4, height: 3 })
    map = setCellColor(map, 2, 1, 1, 9)
    const big = resizeCharmap(map, 6, 5)
    expect(getCellColor(big, 2, 1, 1)).toBe(9)
    expect(big.cellColors?.[(4 * 6 + 5) * 3]).toBe(CELL_COLOR_NONE)
    const small = resizeCharmap(map, 2, 2)
    expect(small.cellColors).toHaveLength(2 * 2 * 3)
  })

  it('draws, exports and makes a Koala picture with them', () => {
    let cs = bitmapSet()
    cs = setCharBytes(cs, 1, new Uint8Array(8).fill(0b00_01_10_11))
    cs = setCharScreenColor(cs, 1, 1, 2)
    cs = setCharScreenColor(cs, 1, 2, 5)
    cs = setCharColor(cs, 1, 7)
    let map = createCharmap({ charsetId: cs.id, width: 2, height: 1 })
    map = setCell(setCell(map, 0, 0, 1), 1, 0, 1)
    map = setCellColor(map, 1, 0, 1, 10)
    expect(cellColorsOf(map, cs, 0)).toEqual([0, 2, 5, 7])
    expect(cellColorsOf(map, cs, 1)).toEqual([0, 10, 5, 7])

    const image = renderCharmap(map, cs, { x: 0, y: 0, width: 2, height: 1 })
    // Pixel pairs 00, 01, 10, 11 across each cell.
    expect([...image.pixels.slice(0, 8)]).toEqual([0, 0, 2, 2, 5, 5, 7, 7])
    expect([...image.pixels.slice(8, 16)]).toEqual([0, 0, 10, 10, 5, 5, 7, 7])

    expect([...exportMapScreenRam(map, cs)]).toEqual([0x25, 0xa5])
    expect([...exportMapColors(map, cs)]).toEqual([7, 7])

    const kla = exportKoala(map, cs)
    expect(kla).toHaveLength(10003)
    expect([kla[0], kla[1]]).toEqual([0x00, 0x60])
    expect(kla[2 + 8]).toBe(0b00_01_10_11) // second cell's first byte
    expect([kla[8002], kla[8003]]).toEqual([0x25, 0xa5])
    expect(kla[9003]).toBe(7)
    expect(kla[10002]).toBe(0)
  })

  it('takes a Koala screen from where it starts, clipped to the map', () => {
    const cs = bitmapSet()
    let map = createCharmap({ charsetId: cs.id, width: 50, height: 30 })
    map = setCell(map, 49, 29, 3)
    const { bitmap } = bitmapScreen(map, cs, { x: 99, y: 99 })
    // The bottom-right screen: (49, 29) is its last cell.
    expect(bitmap.subarray(999 * 8, 1000 * 8)).toEqual(
      cs.data.subarray(3 * 8, 4 * 8),
    )
  })
})
