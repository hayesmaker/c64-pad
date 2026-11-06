import { SPRITE_SHAPE, readPixels } from './bitmap'
import { ModelError } from './errors'
import { newId } from './ids'
import { assertC64Color } from './palette'
import { SPRITE_HEIGHT, createSprite } from './sprite'
import type { C64Color } from './palette'
import type { Sprite } from './sprite'

/** Hires-resolution sprite width; renders are always 24×21. */
export const SPRITE_RENDER_WIDTH = 24

export type AnimationMode = 'loop' | 'pingpong'

export interface SpriteAnimation {
  readonly id: string
  readonly name: string
  /** Sprite ids in play order; a sprite may appear more than once. */
  readonly frames: ReadonlyArray<string>
  /** Display frames (1/50 s on PAL) per animation step, 1-255. */
  readonly speed: number
  readonly mode: AnimationMode
}

/**
 * A group of sprites sharing the two multicolour registers ($D025/$D026),
 * which the hardware shares across all sprites.
 */
export interface SpriteSet {
  readonly id: string
  readonly name: string
  readonly notes: string
  readonly multicolor1: C64Color
  readonly multicolor2: C64Color
  readonly sprites: ReadonlyArray<Sprite>
  readonly animations: ReadonlyArray<SpriteAnimation>
}

export function createSpriteSet(init: Partial<SpriteSet> = {}): SpriteSet {
  const set: SpriteSet = {
    id: newId(),
    name: 'Sprites',
    notes: '',
    multicolor1: 11, // dark grey
    multicolor2: 1, // white
    sprites: [createSprite({ name: 'Sprite 0' })],
    animations: [],
    ...init,
  }
  assertC64Color(set.multicolor1, 'Multicolour 1')
  assertC64Color(set.multicolor2, 'Multicolour 2')
  return set
}

export function findSprite(set: SpriteSet, id: string): Sprite | undefined {
  return set.sprites.find((s) => s.id === id)
}

function requireSprite(set: SpriteSet, id: string): Sprite {
  const sprite = findSprite(set, id)
  if (!sprite) throw new ModelError(`No sprite ${id} in set ${set.name}`)
  return sprite
}

export function setMulticolors(
  set: SpriteSet,
  colors: { multicolor1?: C64Color; multicolor2?: C64Color },
): SpriteSet {
  const next = { ...set, ...colors }
  assertC64Color(next.multicolor1, 'Multicolour 1')
  assertC64Color(next.multicolor2, 'Multicolour 2')
  return next
}

/** Insert a sprite (default: blank, at the end). */
export function addSprite(
  set: SpriteSet,
  sprite: Sprite = createSprite({ name: `Sprite ${set.sprites.length}` }),
  index = set.sprites.length,
): SpriteSet {
  if (findSprite(set, sprite.id))
    throw new ModelError(`Sprite ${sprite.id} already in set`)
  const sprites = [...set.sprites]
  sprites.splice(index, 0, sprite)
  return { ...set, sprites }
}

/** Copy a sprite (new id, no overlay link) and insert it after the original. */
export function duplicateSprite(set: SpriteSet, id: string): SpriteSet {
  const original = requireSprite(set, id)
  const copy: Sprite = {
    ...original,
    id: newId(),
    name: `${original.name} copy`,
    data: original.data.slice(),
    overlayId: null,
  }
  return addSprite(set, copy, set.sprites.indexOf(original) + 1)
}

/** Remove a sprite and every reference to it (animation frames, overlay links). */
export function removeSprite(set: SpriteSet, id: string): SpriteSet {
  requireSprite(set, id)
  return {
    ...set,
    sprites: set.sprites
      .filter((s) => s.id !== id)
      .map((s) => (s.overlayId === id ? { ...s, overlayId: null } : s)),
    animations: set.animations.map((a) =>
      a.frames.includes(id)
        ? { ...a, frames: a.frames.filter((f) => f !== id) }
        : a,
    ),
  }
}

export function moveSprite(
  set: SpriteSet,
  from: number,
  to: number,
): SpriteSet {
  const n = set.sprites.length
  if (from < 0 || from >= n || to < 0 || to >= n) {
    throw new RangeError(`Cannot move sprite ${from} to ${to} (0-${n - 1})`)
  }
  const sprites = [...set.sprites]
  const [moved] = sprites.splice(from, 1)
  sprites.splice(to, 0, moved)
  return { ...set, sprites }
}

/** Apply a change to one sprite. The id cannot be changed. */
export function updateSprite(
  set: SpriteSet,
  id: string,
  change: (sprite: Sprite) => Sprite,
): SpriteSet {
  const current = requireSprite(set, id)
  const next = change(current)
  if (next === current) return set
  if (next.id !== id)
    throw new ModelError('updateSprite cannot change a sprite id')
  return { ...set, sprites: set.sprites.map((s) => (s.id === id ? next : s)) }
}

/**
 * Draw `overlayId` on top of `baseId`, or clear with null. The overlay must be
 * another sprite in the set and must not itself have an overlay (no chains).
 * On real hardware the overlay needs the lower sprite number to appear on top.
 */
export function setOverlay(
  set: SpriteSet,
  baseId: string,
  overlayId: string | null,
) {
  requireSprite(set, baseId)
  if (overlayId !== null) {
    if (overlayId === baseId)
      throw new ModelError('A sprite cannot overlay itself')
    const overlay = requireSprite(set, overlayId)
    if (overlay.overlayId !== null) {
      throw new ModelError('An overlay sprite cannot have its own overlay')
    }
    if (set.sprites.some((s) => s.overlayId === baseId)) {
      throw new ModelError('A sprite used as an overlay cannot have an overlay')
    }
  }
  return updateSprite(set, baseId, (s) => ({ ...s, overlayId }))
}

function checkAnimation(set: SpriteSet, anim: SpriteAnimation) {
  if (!Number.isInteger(anim.speed) || anim.speed < 1 || anim.speed > 255) {
    throw new RangeError(`Animation speed ${anim.speed} outside 1-255`)
  }
  for (const frame of anim.frames) requireSprite(set, frame)
}

export function addAnimation(
  set: SpriteSet,
  init: Partial<SpriteAnimation> = {},
): SpriteSet {
  const anim: SpriteAnimation = {
    id: newId(),
    name: 'Animation',
    frames: [],
    speed: 8,
    mode: 'loop',
    ...init,
  }
  checkAnimation(set, anim)
  return { ...set, animations: [...set.animations, anim] }
}

export function updateAnimation(
  set: SpriteSet,
  id: string,
  change: (anim: SpriteAnimation) => SpriteAnimation,
): SpriteSet {
  const current = set.animations.find((a) => a.id === id)
  if (!current) throw new ModelError(`No animation ${id}`)
  const next = change(current)
  if (next.id !== id)
    throw new ModelError('updateAnimation cannot change an id')
  checkAnimation(set, next)
  return {
    ...set,
    animations: set.animations.map((a) => (a.id === id ? next : a)),
  }
}

export function removeAnimation(set: SpriteSet, id: string): SpriteSet {
  return { ...set, animations: set.animations.filter((a) => a.id !== id) }
}

/** Frame sequence for one full cycle (pingpong plays back without repeating the ends). */
export function animationSequence(anim: SpriteAnimation): Array<string> {
  if (anim.mode === 'loop' || anim.frames.length < 3) return [...anim.frames]
  return [...anim.frames, ...anim.frames.slice(1, -1).reverse()]
}

/** C64 colour for each pixel value of the sprite's mode; null = transparent. */
export function spritePixelColors(
  set: SpriteSet,
  sprite: Sprite,
): Array<C64Color | null> {
  return sprite.mode === 'multicolor'
    ? [null, set.multicolor1, sprite.color, set.multicolor2]
    : [null, sprite.color]
}

/**
 * Colour indices at hires resolution (24×21, row-major), -1 = transparent.
 * Multicolour pixels fill two columns. Includes the overlay if `withOverlay`.
 */
export function renderSprite(
  set: SpriteSet,
  sprite: Sprite,
  { withOverlay = true }: { withOverlay?: boolean } = {},
): Int8Array {
  const out = new Int8Array(SPRITE_RENDER_WIDTH * SPRITE_HEIGHT).fill(-1)
  const layers = [sprite]
  const overlay =
    withOverlay && sprite.overlayId
      ? findSprite(set, sprite.overlayId)
      : undefined
  if (overlay) layers.push(overlay)
  for (const layer of layers) {
    const colors = spritePixelColors(set, layer)
    const pixels = readPixels(layer.data, SPRITE_SHAPE, layer.mode)
    const scale = layer.mode === 'multicolor' ? 2 : 1
    const w = SPRITE_RENDER_WIDTH / scale
    for (let y = 0; y < SPRITE_HEIGHT; y++) {
      for (let x = 0; x < SPRITE_RENDER_WIDTH; x++) {
        const color = colors[pixels[y * w + Math.floor(x / scale)]]
        if (color !== null) out[y * SPRITE_RENDER_WIDTH + x] = color
      }
    }
  }
  return out
}
