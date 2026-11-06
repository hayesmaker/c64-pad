import { describe, expect, it } from 'vitest'
import { PALETTE, colorHex, isC64Color } from './palette'

describe('palette', () => {
  it('has 16 entries indexed 0-15', () => {
    expect(PALETTE).toHaveLength(16)
    PALETTE.forEach((entry, i) => expect(entry.index).toBe(i))
  })

  it('uses #rrggbb hex values', () => {
    for (const { hex } of PALETTE) expect(hex).toMatch(/^#[0-9a-f]{6}$/)
  })

  it('validates colour indices', () => {
    expect(isC64Color(0)).toBe(true)
    expect(isC64Color(15)).toBe(true)
    expect(isC64Color(16)).toBe(false)
    expect(isC64Color(-1)).toBe(false)
    expect(isC64Color(1.5)).toBe(false)
  })

  it('looks up hex by index', () => {
    expect(colorHex(6)).toBe('#2e2c9b')
    expect(() => colorHex(16)).toThrow(RangeError)
  })
})
