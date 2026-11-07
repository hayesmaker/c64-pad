import { describe, expect, it } from 'vitest'
import { ModelError } from './errors'
import { createSprite, setSpritePixel } from './sprite'
import {
  addOverlaySprite,
  frameSprites,
  overlayBase,
  addAnimation,
  addSprite,
  animationSequence,
  createSpriteSet,
  duplicateSprite,
  moveSprite,
  removeSprite,
  renderSprite,
  setMulticolors,
  setOverlay,
  spritePixelColors,
  updateAnimation,
  updateSprite,
} from './sprite-set'

const setWith = (n: number) => {
  const sprites = Array.from({ length: n }, (_, i) =>
    createSprite({ name: `S${i}` }),
  )
  return createSpriteSet({ sprites })
}

describe('sprite set', () => {
  it('starts with one blank sprite and valid multicolours', () => {
    const set = createSpriteSet()
    expect(set.sprites).toHaveLength(1)
    expect(() => createSpriteSet({ multicolor1: 16 })).toThrow(RangeError)
    expect(() => setMulticolors(set, { multicolor2: 99 })).toThrow(RangeError)
    expect(setMulticolors(set, { multicolor1: 7 }).multicolor1).toBe(7)
  })

  it('adds, duplicates and moves sprites', () => {
    let set = setWith(2)
    set = addSprite(set)
    expect(set.sprites.map((s) => s.name)).toEqual(['S0', 'S1', 'Sprite 2'])
    expect(() => addSprite(set, set.sprites[0])).toThrow(ModelError)
    set = duplicateSprite(set, set.sprites[0].id)
    expect(set.sprites[1].name).toBe('S0 copy')
    expect(set.sprites[1].id).not.toBe(set.sprites[0].id)
    expect(set.sprites[1].data).not.toBe(set.sprites[0].data)
    set = moveSprite(set, 0, 3)
    expect(set.sprites.map((s) => s.name)).toEqual([
      'S0 copy',
      'S1',
      'Sprite 2',
      'S0',
    ])
    expect(() => moveSprite(set, 0, 4)).toThrow(RangeError)
  })

  it('updates a sprite but not its id', () => {
    const set = setWith(1)
    const id = set.sprites[0].id
    expect(updateSprite(set, id, (s) => s)).toBe(set)
    expect(
      updateSprite(set, id, (s) => ({ ...s, name: 'X' })).sprites[0].name,
    ).toBe('X')
    expect(() => updateSprite(set, id, (s) => ({ ...s, id: 'other' }))).toThrow(
      ModelError,
    )
    expect(() => updateSprite(set, 'missing', (s) => s)).toThrow(ModelError)
  })

  it('removing a sprite clears overlay links and animation frames', () => {
    let set = setWith(3)
    const [a, b, c] = set.sprites.map((s) => s.id)
    set = setOverlay(set, a, b)
    set = addAnimation(set, { frames: [a, b, c, b] })
    set = removeSprite(set, b)
    expect(set.sprites[0].overlayId).toBeNull()
    expect(set.animations[0].frames).toEqual([a, c])
  })

  it('enforces overlay rules', () => {
    let set = setWith(3)
    const [a, b, c] = set.sprites.map((s) => s.id)
    expect(() => setOverlay(set, a, a)).toThrow(ModelError)
    expect(() => setOverlay(set, a, 'missing')).toThrow(ModelError)
    set = setOverlay(set, a, b)
    expect(() => setOverlay(set, c, a)).toThrow(ModelError) // a has an overlay
    expect(() => setOverlay(set, b, c)).toThrow(ModelError) // b is an overlay
    expect(setOverlay(set, a, null).sprites[0].overlayId).toBeNull()
  })

  it('validates animations', () => {
    const set = setWith(2)
    const [a, b] = set.sprites.map((s) => s.id)
    expect(() => addAnimation(set, { speed: 0 })).toThrow(RangeError)
    expect(() => addAnimation(set, { frames: ['nope'] })).toThrow(ModelError)
    const withAnim = addAnimation(set, { frames: [a, b] })
    const id = withAnim.animations[0].id
    expect(
      updateAnimation(withAnim, id, (x) => ({ ...x, speed: 2 })).animations[0]
        .speed,
    ).toBe(2)
    expect(() =>
      updateAnimation(withAnim, id, (x) => ({ ...x, speed: 256 })),
    ).toThrow(RangeError)
  })

  it('plays pingpong without repeating the end frames', () => {
    const anim = {
      id: 'x',
      name: 'x',
      speed: 1,
      mode: 'pingpong' as const,
      frames: ['1', '2', '3', '4'],
    }
    expect(animationSequence(anim)).toEqual(['1', '2', '3', '4', '3', '2'])
    expect(animationSequence({ ...anim, mode: 'loop' })).toEqual([
      '1',
      '2',
      '3',
      '4',
    ])
  })
})

describe('colours and rendering', () => {
  it('maps multicolour bit pairs to set and sprite colours', () => {
    const set = createSpriteSet({ multicolor1: 11, multicolor2: 7 })
    const mc = createSprite({ mode: 'multicolor', color: 2 })
    expect(spritePixelColors(set, mc)).toEqual([null, 11, 2, 7])
    expect(spritePixelColors(set, { ...mc, mode: 'hires' })).toEqual([null, 2])
  })

  it('renders multicolour pixels double width, transparent as -1', () => {
    let sprite = createSprite({ mode: 'multicolor', color: 2 })
    sprite = setSpritePixel(sprite, 1, 0, 3)
    const set = createSpriteSet({ multicolor2: 7, sprites: [sprite] })
    const out = renderSprite(set, sprite)
    expect(Array.from(out.slice(0, 4))).toEqual([-1, -1, 7, 7])
    expect(out).toHaveLength(24 * 21)
  })

  it('draws the overlay on top of the base sprite', () => {
    let base = createSprite({ mode: 'multicolor', color: 2 })
    base = setSpritePixel(base, 0, 0, 2) // red at hires x 0-1
    let over = createSprite({ mode: 'hires', color: 0 })
    over = setSpritePixel(over, 1, 0, 1) // black at hires x 1
    let set = createSpriteSet({ sprites: [base, over] })
    set = setOverlay(set, base.id, over.id)
    const linked = set.sprites[0]
    expect(Array.from(renderSprite(set, linked).slice(0, 3))).toEqual([
      2, 0, -1,
    ])
    expect(
      Array.from(renderSprite(set, linked, { withOverlay: false }).slice(0, 3)),
    ).toEqual([2, 2, -1])
  })
})

describe('addOverlaySprite', () => {
  it('adds a black hi-res sprite after the base and links it', () => {
    let set = createSpriteSet()
    const base = set.sprites[0]
    set = addSprite(set, createSprite({ name: 'Other' }))
    const { set: next, overlayId } = addOverlaySprite(set, base.id)
    expect(next.sprites.map((s) => s.name)).toEqual([
      base.name,
      `${base.name} overlay`,
      'Other',
    ])
    const overlay = next.sprites[1]
    expect(overlay.id).toBe(overlayId)
    expect([overlay.mode, overlay.color]).toEqual(['hires', 0])
    expect(next.sprites[0].overlayId).toBe(overlayId)
    expect(() => addOverlaySprite(next, base.id)).toThrow()
    expect(() => addOverlaySprite(next, overlayId)).toThrow()
  })
})

describe('frames and overlays', () => {
  it('leaves overlay sprites out of animation frames', () => {
    let set = createSpriteSet()
    const base = set.sprites[0]
    set = addSprite(set, createSprite({ name: 'Walk 2' }))
    const { set: next, overlayId } = addOverlaySprite(set, base.id)
    expect(overlayBase(next, overlayId)?.id).toBe(base.id)
    expect(overlayBase(next, base.id)).toBeUndefined()
    expect(frameSprites(next).map((s) => s.name)).toEqual([base.name, 'Walk 2'])
  })
})
