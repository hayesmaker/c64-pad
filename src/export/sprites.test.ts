import { describe, expect, it } from 'vitest'
import { createSprite, setSpritePixel } from '@/c64/sprite'
import { addAnimation, createSpriteSet, setOverlay } from '@/c64/sprite-set'
import {
  asmLabel,
  exportSpritesBin,
  exportSpritesKickAss,
  exportSpritesSpd,
  renderSpriteSheet,
  spriteAttributeByte,
} from './sprites'

function sampleSet() {
  const a = setSpritePixel(
    createSprite({ name: 'Ship', mode: 'hires', color: 2 }),
    0,
    0,
    1,
  )
  const b = setSpritePixel(
    createSprite({
      name: 'Flame',
      mode: 'multicolor',
      color: 7,
      expandX: true,
    }),
    11,
    20,
    3,
  )
  const c = createSprite({ name: 'Blank', mode: 'hires', color: 1 })
  return createSpriteSet({
    name: 'Ships',
    multicolor1: 11,
    multicolor2: 1,
    sprites: [a, b, c],
  })
}

describe('attribute byte', () => {
  it('packs colour, overlay, expand and multicolour bits', () => {
    const s = createSprite({
      mode: 'multicolor',
      color: 10,
      expandX: true,
      expandY: true,
    })
    expect(spriteAttributeByte(s)).toBe(0x80 | 0x40 | 0x20 | 10)
    expect(
      spriteAttributeByte(
        { ...s, mode: 'hires', expandX: false, expandY: false },
        true,
      ),
    ).toBe(0x10 | 10)
  })
})

describe('raw .bin', () => {
  it('writes 64 bytes per sprite with zero padding', () => {
    const bin = exportSpritesBin(sampleSet())
    expect(bin).toHaveLength(192)
    expect([bin[0], bin[63], bin[64 + 62], bin[127]]).toEqual([
      0x80, 0, 0x03, 0,
    ])
  })

  it('exports a range and can put attributes in byte 64', () => {
    const bin = exportSpritesBin(sampleSet(), { from: 1, to: 1 }, 'attributes')
    expect(bin).toHaveLength(64)
    expect(bin[63]).toBe(0x80 | 0x20 | 7)
    expect(() => exportSpritesBin(sampleSet(), { from: 2, to: 3 })).toThrow(
      RangeError,
    )
  })
})

describe('KickAssembler source', () => {
  it('makes safe labels', () => {
    expect(asmLabel('Fighter Ship #1')).toBe('fighter_ship_1')
    expect(asmLabel('9 lives')).toBe('_9_lives')
    expect(asmLabel('!!!', 'sprites')).toBe('sprites')
  })

  it('emits aligned labelled .byte rows with pictures and colour constants', () => {
    const src = exportSpritesKickAss(sampleSet(), {
      projectName: 'Star Patrol',
    })
    expect(src).toContain('.align $40')
    expect(src).toContain('ships_0:')
    expect(src).toContain('.label ships_mc1 = 11 // Dark Grey')
    expect(src).toContain('  .byte $80, $00, $00  // #.......................')
    // multicolour pixel 11 = value 3 at the right edge, drawn double width
    expect(src).toContain('  .byte $00, $00, $03  // ......................33')
    const dataLines = src
      .split('\n')
      .filter((l) => l.trimStart().startsWith('.byte'))
    expect(dataLines).toHaveLength(3 * 22)
  })
})

describe('SpritePad SPD V1', () => {
  it('writes the header, sprites with attributes and a disabled placeholder animation', () => {
    const { bytes, warnings } = exportSpritesSpd(sampleSet(), 6)
    expect(warnings).toEqual([])
    expect(Array.from(bytes.slice(0, 9))).toEqual([
      0x53, 0x50, 0x44, 1, 2, 0, 6, 11, 1,
    ])
    expect(bytes).toHaveLength(9 + 64 * 3 + 4)
    expect(bytes[9]).toBe(0x80)
    expect(bytes[9 + 63]).toBe(2) // hires, colour 2
    expect(bytes[9 + 64 + 63]).toBe(0x80 | 0x20 | 7)
    expect(bytes[9 + 64 * 3 + 3]).toBe(0) // placeholder animation disabled
  })

  it('stores next-sprite overlays and consecutive animations, warns about the rest', () => {
    let set = sampleSet()
    const [a, b, c] = set.sprites.map((s) => s.id)
    set = setOverlay(set, a, b)
    set = setOverlay(set, c, b) // sprite 2 overlaid by sprite 1: not "next", dropped
    set = addAnimation(set, {
      name: 'Run',
      frames: [b, c],
      speed: 5,
      mode: 'pingpong',
    })
    set = addAnimation(set, { name: 'Jumbled', frames: [c, a] })
    const { bytes, warnings } = exportSpritesSpd(set)
    expect(bytes[9 + 63] & 0x10).toBe(0x10)
    expect(bytes[9 + 128 + 63] & 0x10).toBe(0)
    expect(warnings).toHaveLength(2)
    const base = 9 + 64 * 3
    expect(bytes[5]).toBe(0) // one animation stored
    expect(Array.from(bytes.slice(base, base + 4))).toEqual([1, 2, 5, 0x90])
  })
})

describe('sprite sheet', () => {
  it('lays sprites out in columns', () => {
    const img = renderSpriteSheet(sampleSet(), { columns: 2, gap: 1 })
    expect([img.width, img.height]).toEqual([49, 43])
    expect(img.pixels[0]).toBe(2)
    expect(img.pixels[1]).toBe(-1)
  })
})
