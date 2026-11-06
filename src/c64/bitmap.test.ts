import { describe, expect, it } from 'vitest'
import {
  CHAR_SHAPE,
  SPRITE_SHAPE,
  blank,
  flipHorizontal,
  flipVertical,
  floodFill,
  getPixel,
  invert,
  pixelWidth,
  readPixels,
  setPixel,
  shift,
  writePixels,
} from './bitmap'

const sprite = () => blank(SPRITE_SHAPE)

describe('shapes', () => {
  it('sprites are 24 hires / 12 multicolour pixels wide, 63 bytes', () => {
    expect(pixelWidth(SPRITE_SHAPE, 'hires')).toBe(24)
    expect(pixelWidth(SPRITE_SHAPE, 'multicolor')).toBe(12)
    expect(sprite()).toHaveLength(63)
  })
  it('chars are 8 hires / 4 multicolour pixels wide', () => {
    expect(pixelWidth(CHAR_SHAPE, 'hires')).toBe(8)
    expect(pixelWidth(CHAR_SHAPE, 'multicolor')).toBe(4)
  })
})

describe('hires pixels', () => {
  it('maps the leftmost pixel to the MSB', () => {
    expect(setPixel(sprite(), SPRITE_SHAPE, 'hires', 0, 0, 1)[0]).toBe(0x80)
    expect(setPixel(sprite(), SPRITE_SHAPE, 'hires', 23, 0, 1)[2]).toBe(0x01)
    expect(setPixel(sprite(), SPRITE_SHAPE, 'hires', 8, 1, 1)[4]).toBe(0x80)
  })
  it('reads back what was written', () => {
    const b = setPixel(sprite(), SPRITE_SHAPE, 'hires', 13, 20, 1)
    expect(getPixel(b, SPRITE_SHAPE, 'hires', 13, 20)).toBe(1)
    expect(getPixel(b, SPRITE_SHAPE, 'hires', 12, 20)).toBe(0)
  })
  it('clears a pixel', () => {
    const b = Uint8Array.of(0xff)
    expect(setPixel(b, CHAR_SHAPE, 'hires', 1, 0, 0)[0]).toBe(0b10111111)
  })
})

describe('multicolour pixels', () => {
  it('stores bit pairs, leftmost pair in the top bits', () => {
    expect(setPixel(sprite(), SPRITE_SHAPE, 'multicolor', 0, 0, 2)[0]).toBe(
      0x80,
    )
    expect(setPixel(sprite(), SPRITE_SHAPE, 'multicolor', 0, 0, 1)[0]).toBe(
      0x40,
    )
    expect(setPixel(sprite(), SPRITE_SHAPE, 'multicolor', 3, 0, 3)[0]).toBe(
      0x03,
    )
    expect(setPixel(sprite(), SPRITE_SHAPE, 'multicolor', 11, 0, 1)[2]).toBe(
      0x01,
    )
  })
  it('overwrites a pair without touching its neighbours', () => {
    const b = Uint8Array.of(0xff)
    expect(setPixel(b, CHAR_SHAPE, 'multicolor', 1, 0, 1)[0]).toBe(0b11011111)
  })
})

describe('mode is only interpretation', () => {
  it('reads the same byte as hires or multicolour pixels', () => {
    const b = Uint8Array.of(0b10110100, 0, 0, 0, 0, 0, 0, 0)
    expect(Array.from(readPixels(b, CHAR_SHAPE, 'hires').slice(0, 8))).toEqual([
      1, 0, 1, 1, 0, 1, 0, 0,
    ])
    expect(
      Array.from(readPixels(b, CHAR_SHAPE, 'multicolor').slice(0, 4)),
    ).toEqual([2, 3, 1, 0])
  })
})

describe('purity and validation', () => {
  it('never mutates the input and returns the same array when unchanged', () => {
    const b = sprite()
    const changed = setPixel(b, SPRITE_SHAPE, 'hires', 0, 0, 1)
    expect(b[0]).toBe(0)
    expect(changed).not.toBe(b)
    expect(setPixel(b, SPRITE_SHAPE, 'hires', 0, 0, 0)).toBe(b)
  })
  it('rejects out-of-range coordinates and values', () => {
    expect(() => getPixel(sprite(), SPRITE_SHAPE, 'hires', 24, 0)).toThrow(
      RangeError,
    )
    expect(() => getPixel(sprite(), SPRITE_SHAPE, 'multicolor', 12, 0)).toThrow(
      RangeError,
    )
    expect(() => getPixel(sprite(), SPRITE_SHAPE, 'hires', 0, 21)).toThrow(
      RangeError,
    )
    expect(() => getPixel(sprite(), SPRITE_SHAPE, 'hires', 1.5, 0)).toThrow(
      RangeError,
    )
    expect(() => setPixel(sprite(), SPRITE_SHAPE, 'hires', 0, 0, 2)).toThrow(
      RangeError,
    )
    expect(() =>
      setPixel(sprite(), SPRITE_SHAPE, 'multicolor', 0, 0, 4),
    ).toThrow(RangeError)
  })
})

describe('readPixels / writePixels', () => {
  it('round-trips arbitrary data in both modes', () => {
    const b = Uint8Array.from({ length: 63 }, (_, i) => (i * 37 + 11) & 0xff)
    for (const mode of ['hires', 'multicolor'] as const) {
      expect(
        writePixels(readPixels(b, SPRITE_SHAPE, mode), SPRITE_SHAPE, mode),
      ).toEqual(b)
    }
  })
  it('rejects the wrong pixel count', () => {
    expect(() => writePixels([0, 1], CHAR_SHAPE, 'hires')).toThrow(RangeError)
  })
})

describe('transforms', () => {
  it('flips hires horizontally bit by bit', () => {
    const b = setPixel(sprite(), SPRITE_SHAPE, 'hires', 0, 0, 1)
    const f = flipHorizontal(b, SPRITE_SHAPE, 'hires')
    expect([f[0], f[2]]).toEqual([0, 0x01])
  })
  it('flips multicolour horizontally keeping bit pairs intact', () => {
    const b = setPixel(sprite(), SPRITE_SHAPE, 'multicolor', 0, 0, 1) // 01 at the left
    const f = flipHorizontal(b, SPRITE_SHAPE, 'multicolor')
    expect(f[2]).toBe(0b00000001) // 01 at the right, not 10
  })
  it('flips vertically', () => {
    const b = setPixel(sprite(), SPRITE_SHAPE, 'hires', 5, 0, 1)
    expect(
      getPixel(
        flipVertical(b, SPRITE_SHAPE, 'hires'),
        SPRITE_SHAPE,
        'hires',
        5,
        20,
      ),
    ).toBe(1)
  })
  it('shifts with wrap-around in whole pixels of the mode', () => {
    const h = setPixel(sprite(), SPRITE_SHAPE, 'hires', 23, 0, 1)
    expect(shift(h, SPRITE_SHAPE, 'hires', 1, 0)[0]).toBe(0x80)
    const m = setPixel(sprite(), SPRITE_SHAPE, 'multicolor', 0, 0, 3)
    expect(shift(m, SPRITE_SHAPE, 'multicolor', 1, 0)[0]).toBe(0b00110000)
    expect(
      getPixel(
        shift(m, SPRITE_SHAPE, 'multicolor', 0, -1),
        SPRITE_SHAPE,
        'multicolor',
        0,
        20,
      ),
    ).toBe(3)
  })
  it('inverts every bit', () => {
    expect(Array.from(invert(Uint8Array.of(0x00, 0xf0)))).toEqual([0xff, 0x0f])
  })
})

describe('floodFill', () => {
  it('fills the connected region only', () => {
    // hires char: left column filled (wall), fill the right side
    const wall = Uint8Array.of(0x80, 0x80, 0x80, 0x80, 0x80, 0x80, 0x80, 0x80)
    const out = floodFill(wall, CHAR_SHAPE, 'hires', 5, 5, 1)
    expect(Array.from(out)).toEqual(Array(8).fill(0xff))
    const box = Uint8Array.of(0xff, 0x81, 0x81, 0xff, 0, 0, 0, 0)
    const inside = floodFill(box, CHAR_SHAPE, 'hires', 3, 1, 1)
    expect(Array.from(inside.slice(0, 5))).toEqual([0xff, 0xff, 0xff, 0xff, 0])
  })
  it('fills multicolour pixels with bit pairs and is a no-op on same value', () => {
    const b = blank(CHAR_SHAPE)
    expect(floodFill(b, CHAR_SHAPE, 'multicolor', 0, 0, 2)[0]).toBe(0b10101010)
    expect(floodFill(b, CHAR_SHAPE, 'multicolor', 0, 0, 0)).toBe(b)
  })
})
