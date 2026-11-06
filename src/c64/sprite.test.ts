import { describe, expect, it } from 'vitest'
import {
  SPRITE_BYTES,
  createSprite,
  getSpritePixel,
  setSpriteColor,
  setSpriteMode,
  setSpritePixel,
  spriteMemoryBlock,
  spritePixelX,
  spriteWidth,
} from './sprite'

describe('sprite', () => {
  it('starts blank, multicolour, 63 bytes', () => {
    const s = createSprite()
    expect(s.data).toHaveLength(SPRITE_BYTES)
    expect(s.data.every((b) => b === 0)).toBe(true)
    expect(s.mode).toBe('multicolor')
    expect(s.id).toMatch(/[0-9a-f-]{36}/)
  })

  it('validates colour and data size', () => {
    expect(() => createSprite({ color: 16 })).toThrow(RangeError)
    expect(() => createSprite({ data: new Uint8Array(64) })).toThrow(RangeError)
    expect(() => setSpriteColor(createSprite(), -1)).toThrow(RangeError)
  })

  it('has mode-dependent width', () => {
    expect(spriteWidth('hires')).toBe(24)
    expect(spriteWidth('multicolor')).toBe(12)
  })

  it('paints in the sprite mode and keeps identity when unchanged', () => {
    const s = createSprite({ mode: 'multicolor' })
    const p = setSpritePixel(s, 11, 20, 3)
    expect(getSpritePixel(p, 11, 20)).toBe(3)
    expect(p.data[62]).toBe(0x03)
    expect(setSpritePixel(p, 11, 20, 3)).toBe(p)
    expect(() => setSpritePixel(s, 12, 0, 1)).toThrow(RangeError)
  })

  it('switching mode reinterprets the same bytes', () => {
    const mc = setSpritePixel(createSprite({ mode: 'multicolor' }), 0, 0, 2) // 10
    const hi = setSpriteMode(mc, 'hires')
    expect(hi.data).toBe(mc.data)
    expect([getSpritePixel(hi, 0, 0), getSpritePixel(hi, 1, 0)]).toEqual([1, 0])
  })

  it('snaps hires x to multicolour pixels', () => {
    expect(spritePixelX('multicolor', 5)).toBe(2)
    expect(spritePixelX('hires', 5)).toBe(5)
  })

  it('pads to a 64-byte memory block', () => {
    const s = setSpritePixel(createSprite({ mode: 'hires' }), 23, 20, 1)
    const block = spriteMemoryBlock(s)
    expect(block).toHaveLength(64)
    expect([block[62], block[63]]).toEqual([1, 0])
  })
})
