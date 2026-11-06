import { describe, expect, it } from 'vitest'
import { createSprite, setSpritePixel } from '@/c64/sprite'
import { addAnimation, createSpriteSet, setOverlay } from '@/c64/sprite-set'
import { base64ToBytes } from '@/storage/bytes'
import { spriteViewerPrg } from './stubs/sprite-viewer.gen'
import {
  VIEWER,
  buildViewerPrg,
  spriteSetShowcase,
  toScreenCodes,
} from './sprite-viewer'

const at = (address: number) => 2 + address - VIEWER.LOAD
const cfg = (prg: Uint8Array, offset: number) => prg[at(VIEWER.CONFIG + offset)]

function sampleSet() {
  const sprites = [0, 1, 2].map((i) =>
    setSpritePixel(
      createSprite({ name: `S${i}`, mode: 'hires', color: i + 2 }),
      i,
      0,
      1,
    ),
  )
  return createSpriteSet({
    name: 'Ships',
    multicolor1: 11,
    multicolor2: 1,
    sprites,
  })
}

describe('screen codes', () => {
  it('maps upper/lower case letters, digits and punctuation', () => {
    expect(Array.from(toScreenCodes('Ab1 @!', 6))).toEqual([
      1, 2, 0x31, 0x20, 0, 0x21,
    ])
    expect(toScreenCodes('é')[0]).toBe(0x20)
  })
})

describe('buildViewerPrg', () => {
  it('keeps the stub and places config and sprites at fixed addresses', () => {
    const set = sampleSet()
    const prg = buildViewerPrg(
      spriteSetShowcase(set, { selectedId: set.sprites[0].id, background: 0 }),
    )
    const stub = base64ToBytes(spriteViewerPrg)
    expect(Array.from(prg.slice(0, stub.length))).toEqual(Array.from(stub))
    expect([prg[0], prg[1]]).toEqual([0x01, 0x08])
    // 3 sprites + 1 blank, 64 bytes each, from $2000
    expect(prg.length).toBe(2 + VIEWER.SPRITES + 4 * 64 - VIEWER.LOAD)
    expect(prg[at(VIEWER.SPRITES)]).toBe(0x80) // sprite 0, pixel 0
    expect(prg[at(VIEWER.SPRITES + 64)]).toBe(0x40) // sprite 1, pixel 1
    expect([cfg(prg, 1), cfg(prg, 2), cfg(prg, 3)]).toEqual([0, 11, 1])
  })

  it('writes slot frames: pointer, colour and attribute bits', () => {
    const set = sampleSet()
    const prg = buildViewerPrg(
      spriteSetShowcase(set, { selectedId: set.sprites[1].id }),
    )
    expect(cfg(prg, 4)).toBe(0b111) // main + 2 others
    expect(cfg(prg, 22)).toBe(1) // one frame in slot 0
    expect(cfg(prg, 0x40)).toBe(0x81) // slot 0 shows sprite 1
    expect(cfg(prg, 0x140)).toBe(3) // its colour
    expect(cfg(prg, 0x340)).toBe(0x20) // caption starts with a space
    expect(cfg(prg, 0x341)).toBe(19) // 'S'
  })

  it('rejects too many slots or sprites', () => {
    const set = sampleSet()
    const base = spriteSetShowcase(set, { selectedId: set.sprites[0].id })
    expect(() =>
      buildViewerPrg({ ...base, slots: Array(9).fill(base.slots[0]) }),
    ).toThrow(RangeError)
    expect(() => buildViewerPrg({ ...base, sprites: [] })).toThrow(RangeError)
  })
})

describe('spriteSetShowcase', () => {
  it('puts the overlay in a lower slot so it is drawn on top', () => {
    let set = sampleSet()
    const [a, b] = set.sprites.map((s) => s.id)
    set = setOverlay(set, a, b)
    const config = spriteSetShowcase(set, { selectedId: a })
    expect(config.slots[0].frames[0].sprite).toBe(1) // overlay
    expect(config.slots[1].frames[0].sprite).toBe(0) // base
    expect(config.slots[0].x).toBe(config.slots[1].x)
    expect(config.slots).toHaveLength(3) // overlay, base, one other
  })

  it('animates the main slot with the animation frames, speed and mode', () => {
    let set = sampleSet()
    const ids = set.sprites.map((s) => s.id)
    set = addAnimation(set, {
      name: 'Spin',
      frames: [ids[0], ids[2], ids[1]],
      speed: 6,
      mode: 'pingpong',
    })
    const config = spriteSetShowcase(set, {
      selectedId: ids[0],
      animationId: set.animations[0].id,
    })
    expect(config.slots[0].frames.map((f) => f.sprite)).toEqual([0, 2, 1])
    expect(config.slots[0]).toMatchObject({ delay: 6, pingpong: true })
    expect(config.caption).toContain('Spin')
  })

  it('centres expanded sprites', () => {
    const set = createSpriteSet({
      sprites: [createSprite({ expandX: true, expandY: true })],
    })
    const slot = spriteSetShowcase(set, { selectedId: set.sprites[0].id })
      .slots[0]
    expect([slot.x, slot.y]).toEqual([184 - 24, 128 - 21])
  })
})
