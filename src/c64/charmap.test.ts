import { describe, expect, it } from 'vitest'
import {
  copyRegion,
  createCharmap,
  decodeEcm,
  encodeEcm,
  fillRect,
  floodFillMap,
  getCell,
  pasteRegion,
  resizeCharmap,
  setCell,
  setMapBlank,
} from './charmap'

const map = () => createCharmap({ charsetId: 'cs' })

describe('charmap', () => {
  it('defaults to one 40×25 screen', () => {
    const m = map()
    expect([m.width, m.height, m.cells.length]).toEqual([40, 25, 1000])
    expect(() => createCharmap({ charsetId: 'cs', width: 0 })).toThrow(
      RangeError,
    )
    expect(() => createCharmap({ charsetId: 'cs', height: 1025 })).toThrow(
      RangeError,
    )
  })

  it('sets and gets screen codes', () => {
    const m = setCell(map(), 39, 24, 255)
    expect(getCell(m, 39, 24)).toBe(255)
    expect(m.cells[999]).toBe(255)
    expect(setCell(m, 39, 24, 255)).toBe(m)
    expect(() => setCell(m, 40, 0, 1)).toThrow(RangeError)
    expect(() => setCell(m, 0, 0, 256)).toThrow(RangeError)
  })

  it('resizes keeping the top-left', () => {
    const m = setCell(setCell(map(), 0, 0, 1), 39, 0, 2)
    const small = resizeCharmap(m, 10, 2, 32)
    expect([getCell(small, 0, 0), getCell(small, 9, 1)]).toEqual([1, 0])
    const big = resizeCharmap(small, 12, 3, 32)
    expect([
      getCell(big, 0, 0),
      getCell(big, 11, 0),
      getCell(big, 0, 2),
    ]).toEqual([1, 32, 32])
  })

  it('fills, copies and pastes rectangles, clipped to the map', () => {
    let m = fillRect(map(), 38, 23, 5, 5, 7)
    expect([getCell(m, 39, 24), getCell(m, 37, 24)]).toEqual([7, 0])
    const region = copyRegion(m, 38, 23, 4, 4)
    expect([region.width, region.height]).toEqual([2, 2])
    m = pasteRegion(m, region, -1, 0)
    expect([getCell(m, 0, 0), getCell(m, 0, 1), getCell(m, 1, 0)]).toEqual([
      7, 7, 0,
    ])
  })

  it('encodes ECM screen codes', () => {
    expect(encodeEcm(1, 3)).toBe(0xc1)
    expect(decodeEcm(0xc1)).toEqual({ char: 1, background: 3 })
    expect(() => encodeEcm(64, 0)).toThrow(RangeError)
    expect(() => encodeEcm(0, 4)).toThrow(RangeError)
  })
})

describe('blank char and flood fill', () => {
  it('erases and grows with the blank char', () => {
    const m = createCharmap({ charsetId: 'cs', width: 2, height: 1, blank: 32 })
    expect([...m.cells]).toEqual([32, 32])
    expect(map().blank).toBe(0)
    const grown = resizeCharmap(setMapBlank(m, 5), 3, 1)
    expect([...grown.cells]).toEqual([32, 32, 5])
    expect(() => setMapBlank(m, 256)).toThrow(RangeError)
  })

  it('fills the connected area only', () => {
    let m = createCharmap({ charsetId: 'cs', width: 4, height: 3 })
    for (let y = 0; y < 3; y++) m = setCell(m, 2, y, 9) // a wall
    const filled = floodFillMap(m, 0, 0, 1)
    expect(getCell(filled, 1, 2)).toBe(1)
    expect(getCell(filled, 3, 0)).toBe(0)
    expect(getCell(filled, 2, 1)).toBe(9)
    expect(floodFillMap(filled, 0, 0, 1)).toBe(filled)
  })
})
