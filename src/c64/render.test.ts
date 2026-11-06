import { describe, expect, it } from 'vitest'
import { createCharmap, encodeEcm, setCell } from './charmap'
import { createCharset, setCharBytes } from './charset'
import { renderCharmap, renderCharsetSheet } from './render'

const solid = Uint8Array.of(255, 255, 255, 255, 255, 255, 255, 255)

describe('renderCharsetSheet', () => {
  it('lays chars out 16 per row', () => {
    const cs = setCharBytes(createCharset({ background: 0 }), 17, solid)
    const img = renderCharsetSheet(cs)
    expect([img.width, img.height]).toEqual([128, 128])
    expect(img.pixels[8 * 128 + 8]).toBe(14) // char 17 = row 1, col 1, colour 14
    expect(img.pixels[0]).toBe(0)
  })

  it('shows only 64 chars in ECM', () => {
    expect(renderCharsetSheet(createCharset({ mode: 'ecm' })).height).toBe(32)
  })
})

describe('renderCharmap', () => {
  it('draws the top-left screen by default, transparent outside the map', () => {
    const cs = setCharBytes(createCharset({ background: 0 }), 1, solid)
    const map = setCell(
      createCharmap({ charsetId: cs.id, width: 2, height: 1 }),
      1,
      0,
      1,
    )
    const img = renderCharmap(map, cs)
    expect([img.width, img.height]).toEqual([320, 200])
    expect([img.pixels[0], img.pixels[8], img.pixels[16]]).toEqual([0, 14, -1])
  })

  it('uses ECM backgrounds from the screen code', () => {
    const cs = createCharset({
      mode: 'ecm',
      background: 0,
      ecmBackgrounds: [2, 5, 7],
    })
    const map = setCell(
      createCharmap({ charsetId: cs.id }),
      0,
      0,
      encodeEcm(0, 2),
    )
    expect(renderCharmap(map, cs).pixels[0]).toBe(5)
  })
})
