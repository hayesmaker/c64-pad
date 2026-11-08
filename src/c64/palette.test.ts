import { describe, expect, it } from 'vitest'
import {
  COLOR_NAMES,
  DEFAULT_PALETTE_ID,
  PALETTES,
  PALETTE_IDS,
  colorHex,
  hexToRgb,
  isC64Color,
  isPaletteId,
  matchPalette,
  nearestColor,
  paletteRgb,
} from './palette'

describe('palette', () => {
  it('names 16 colours', () => {
    expect(COLOR_NAMES).toHaveLength(16)
    expect(COLOR_NAMES[6]).toBe('Blue')
  })

  it.each(PALETTE_IDS)('%s has 16 #rrggbb colours', (id) => {
    const palette = PALETTES[id]
    expect(palette.id).toBe(id)
    expect(palette.hex).toHaveLength(16)
    for (const hex of palette.hex) expect(hex).toMatch(/^#[0-9a-f]{6}$/)
  })

  it('keeps Colodore as the default, unchanged', () => {
    expect(DEFAULT_PALETTE_ID).toBe('colodore')
    expect(colorHex(6)).toBe('#2e2c9b')
    expect(colorHex(6, 'pepto')).toBe('#40318d')
    expect(() => colorHex(16)).toThrow(RangeError)
  })

  it('validates colour indices and palette ids', () => {
    expect(isC64Color(0)).toBe(true)
    expect(isC64Color(15)).toBe(true)
    expect(isC64Color(16)).toBe(false)
    expect(isC64Color(-1)).toBe(false)
    expect(isC64Color(1.5)).toBe(false)
    expect(isPaletteId('vice')).toBe(true)
    expect(isPaletteId('toString')).toBe(false)
    expect(isPaletteId(undefined)).toBe(false)
  })

  it('converts hex to RGB, cached per palette', () => {
    expect(hexToRgb('#883932')).toEqual([0x88, 0x39, 0x32])
    expect(paletteRgb('pepto')[2]).toEqual([0x88, 0x39, 0x32])
    expect(paletteRgb('pepto')).toBe(paletteRgb('pepto'))
  })

  it('finds the nearest colour', () => {
    expect(nearestColor([0x88, 0x39, 0x32], 'pepto')).toEqual({
      color: 2,
      distance: 0,
    })
    const { color, distance } = nearestColor([0x88, 0x39, 0x32], 'colodore')
    expect(color).toBe(2)
    expect(distance).toBeGreaterThan(0)
  })

  it('matches the Rainbow Islands Aseprite colours to Pepto exactly', () => {
    // From rainbow-islands-ce island1_round4.aseprite (RGBA tileset).
    const colors = [
      '#000000',
      '#8b5429',
      '#55a049',
      '#bfce72',
      '#40318d',
      '#67b6bd',
      '#ffffff',
    ].map(hexToRgb)
    const [best, next] = matchPalette(colors)
    expect(best).toEqual({ id: 'pepto', exact: true, worst: 0 })
    expect(next.exact).toBe(false)
  })
})
