import { describe, expect, it } from 'vitest'
import { ModelError } from './errors'
import {
  CHARSET_BYTES,
  charColor,
  charCount,
  charPixelColors,
  charPixelMode,
  copyChar,
  createCharset,
  getCharBytes,
  getCharPixel,
  isCharMulticolor,
  renderChar,
  rotateCharClockwise,
  setCharBytes,
  setCharColor,
  setCharMulticolor,
  setCharPixel,
  setCharsetMode,
  setCharsetRegisters,
  swapChars,
  petsciiData,
} from './charset'

describe('charset basics', () => {
  it('has 256 chars of 8 bytes and one colour per char', () => {
    const cs = createCharset()
    expect(cs.data).toHaveLength(CHARSET_BYTES)
    expect(cs.colors).toHaveLength(256)
    expect(() => createCharset({ data: new Uint8Array(10) })).toThrow(
      RangeError,
    )
    expect(() => createCharset({ background: 16 })).toThrow(RangeError)
  })

  it('limits ECM to 64 chars', () => {
    expect(charCount('hires')).toBe(256)
    expect(charCount('ecm')).toBe(64)
    const ecm = createCharset({ mode: 'ecm' })
    expect(() => getCharBytes(ecm, 64)).toThrow(RangeError)
    expect(() => getCharBytes(ecm, 63)).not.toThrow()
  })

  it('paints hires chars into the right byte', () => {
    const cs = setCharPixel(createCharset(), 1, 0, 7, 1)
    expect(cs.data[8 + 7]).toBe(0x80)
    expect(getCharPixel(cs, 1, 0, 7)).toBe(1)
  })

  it('validates register colours', () => {
    const cs = createCharset()
    expect(() => setCharsetRegisters(cs, { multicolor1: 16 })).toThrow(
      RangeError,
    )
    expect(setCharsetRegisters(cs, { background: 0 }).background).toBe(0)
  })
})

describe('multicolour mode', () => {
  const mc = () =>
    createCharset({ mode: 'multicolor', colors: new Uint8Array(256).fill(1) })

  it('colour bit 3 makes a char multicolour', () => {
    let cs = mc()
    expect(isCharMulticolor(cs, 0)).toBe(false)
    expect(charPixelMode(cs, 0)).toBe('hires')
    cs = setCharMulticolor(cs, 0, true)
    expect(cs.colors[0]).toBe(9)
    expect(isCharMulticolor(cs, 0)).toBe(true)
    expect(charColor(cs, 0)).toBe(1)
  })

  it('only allows colours 0-7 and keeps the multicolour flag', () => {
    let cs = setCharMulticolor(mc(), 0, true)
    expect(() => setCharColor(cs, 0, 8)).toThrow(ModelError)
    cs = setCharColor(cs, 0, 5)
    expect(cs.colors[0]).toBe(13)
  })

  it('hires mode allows all 16 colours and no multicolour flag', () => {
    const cs = createCharset()
    expect(setCharColor(cs, 0, 15).colors[0]).toBe(15)
    expect(() => setCharMulticolor(cs, 0, true)).toThrow(ModelError)
  })

  it('switching in or out of multicolour drops colours to 0-7, keeping pixels', () => {
    const hires = setCharBytes(
      createCharset({ colors: new Uint8Array(256).fill(14) }),
      0,
      Uint8Array.of(1, 2, 3, 4, 5, 6, 7, 8),
    )
    const toMc = setCharsetMode(hires, 'multicolor')
    // Light blue & 7 is blue, the background: white keeps it visible.
    expect(toMc.colors[0]).toBe(1)
    expect(isCharMulticolor(toMc, 0)).toBe(false)
    expect(toMc.data).toEqual(hires.data)
    const back = setCharsetMode(setCharMulticolor(toMc, 0, true), 'hires')
    expect(back.colors[0]).toBe(1)
    expect(setCharsetMode(hires, 'ecm').colors[0]).toBe(14)
  })

  it('keeps reduced colours that differ from the background', () => {
    const cs = createCharset({ colors: new Uint8Array(256).fill(10) })
    expect(setCharsetMode(cs, 'multicolor').colors[0]).toBe(2)
    const onWhite = createCharset({
      background: 1,
      colors: new Uint8Array(256).fill(9),
    })
    expect(setCharsetMode(onWhite, 'multicolor').colors[0]).toBe(0)
  })

  it('maps pixel values to background, MC1, MC2 and char colour', () => {
    let cs = createCharset({
      mode: 'multicolor',
      background: 0,
      multicolor1: 11,
      multicolor2: 12,
    })
    cs = setCharColor(setCharMulticolor(cs, 3, true), 3, 2)
    expect(charPixelColors(cs, 3)).toEqual([0, 11, 12, 2])
    cs = setCharPixel(cs, 3, 0, 0, 3)
    expect(Array.from(renderChar(cs, 3).slice(0, 3))).toEqual([2, 2, 0])
  })
})

describe('ECM colours', () => {
  it('picks the background from the screen code', () => {
    const cs = createCharset({
      mode: 'ecm',
      background: 6,
      ecmBackgrounds: [2, 5, 7],
    })
    expect(charPixelColors(cs, 0, 0)[0]).toBe(6)
    expect(charPixelColors(cs, 0, 3)[0]).toBe(7)
  })
})

describe('char transforms', () => {
  it('rotates hires chars clockwise', () => {
    // top row filled -> right column filled
    const cs = setCharBytes(
      createCharset(),
      0,
      Uint8Array.of(0xff, 0, 0, 0, 0, 0, 0, 0),
    )
    expect(Array.from(getCharBytes(rotateCharClockwise(cs, 0), 0))).toEqual(
      Array(8).fill(1),
    )
    const mc = setCharMulticolor(createCharset({ mode: 'multicolor' }), 0, true)
    expect(() => rotateCharClockwise(mc, 0)).toThrow(ModelError)
  })

  it('copies and swaps chars with their colours', () => {
    let cs = createCharset()
    cs = setCharColor(
      setCharBytes(cs, 1, Uint8Array.of(1, 1, 1, 1, 1, 1, 1, 1)),
      1,
      2,
    )
    const copied = copyChar(cs, 1, 2)
    expect(getCharBytes(copied, 2)[0]).toBe(1)
    expect(copied.colors[2]).toBe(2)
    const swapped = swapChars(cs, 0, 1)
    expect(getCharBytes(swapped, 0)[0]).toBe(1)
    expect(getCharBytes(swapped, 1)[0]).toBe(0)
    expect([swapped.colors[0], swapped.colors[1]]).toEqual([2, 14])
  })
})

describe('petsciiData', () => {
  it('takes the upper case / graphics set from the ROM', () => {
    const data = petsciiData('upper')
    expect(data).toHaveLength(2048)
    // Screen code 1 is "A".
    expect([...data.subarray(8, 16)]).toEqual([
      0x18, 0x3c, 0x66, 0x7e, 0x66, 0x66, 0x66, 0x00,
    ])
  })

  it('takes the lower case set from the second half', () => {
    // Screen code 1 is "a".
    expect([...petsciiData('lower').subarray(8, 16)]).toEqual([
      0x00, 0x00, 0x3c, 0x06, 0x3e, 0x66, 0x3e, 0x00,
    ])
  })
})
