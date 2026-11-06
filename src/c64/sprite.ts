import {
  SPRITE_SHAPE,
  blank,
  byteLength,
  flipHorizontal,
  flipVertical,
  getPixel,
  invert,
  pixelWidth,
  setPixel,
  shift,
} from './bitmap'
import { assertC64Color } from './palette'
import { newId } from './ids'
import type { PixelMode } from './bitmap'
import type { C64Color } from './palette'

/** Bytes of pixel data per sprite (24×21 bits). */
export const SPRITE_BYTES = byteLength(SPRITE_SHAPE) // 63
/** Bytes per sprite in memory: 63 data + 1 padding, so pointers are address / 64. */
export const SPRITE_STRIDE = 64
export const SPRITE_HEIGHT = SPRITE_SHAPE.rows // 21

/**
 * One hardware sprite. Multicolour pixel values map to:
 * 00 transparent, 01 set multicolour 1 ($D025), 10 sprite colour ($D027+n),
 * 11 set multicolour 2 ($D026). Hires: 0 transparent, 1 sprite colour.
 */
export interface Sprite {
  readonly id: string
  readonly name: string
  readonly notes: string
  readonly mode: PixelMode
  readonly color: C64Color
  readonly data: Uint8Array
  readonly expandX: boolean
  readonly expandY: boolean
  /** Sprite (same set) drawn on top of this one, e.g. hires detail over multicolour. */
  readonly overlayId: string | null
}

export function createSprite(init: Partial<Sprite> = {}): Sprite {
  const sprite: Sprite = {
    id: newId(),
    name: 'Sprite',
    notes: '',
    mode: 'multicolor',
    color: 1,
    data: blank(SPRITE_SHAPE),
    expandX: false,
    expandY: false,
    overlayId: null,
    ...init,
  }
  assertC64Color(sprite.color, 'Sprite colour')
  if (sprite.data.length !== SPRITE_BYTES) {
    throw new RangeError(`Sprite data must be ${SPRITE_BYTES} bytes`)
  }
  return sprite
}

/** Width in pixels of the sprite's mode: 24 hires, 12 multicolour. */
export function spriteWidth(mode: PixelMode): number {
  return pixelWidth(SPRITE_SHAPE, mode)
}

export function getSpritePixel(sprite: Sprite, x: number, y: number): number {
  return getPixel(sprite.data, SPRITE_SHAPE, sprite.mode, x, y)
}

/** Returns the same sprite object when nothing changes. */
export function setSpritePixel(
  sprite: Sprite,
  x: number,
  y: number,
  value: number,
): Sprite {
  const data = setPixel(sprite.data, SPRITE_SHAPE, sprite.mode, x, y, value)
  return data === sprite.data ? sprite : { ...sprite, data }
}

/** Convert a hires-resolution x (e.g. from a pointer) to the mode's pixel x. */
export function spritePixelX(mode: PixelMode, hiresX: number): number {
  return mode === 'multicolor' ? hiresX >> 1 : hiresX
}

/** Change mode without touching the bytes, as the VIC-II would. */
export function setSpriteMode(sprite: Sprite, mode: PixelMode): Sprite {
  return sprite.mode === mode ? sprite : { ...sprite, mode }
}

export function setSpriteColor(sprite: Sprite, color: C64Color): Sprite {
  assertC64Color(color, 'Sprite colour')
  return { ...sprite, color }
}

export function flipSpriteHorizontal(sprite: Sprite): Sprite {
  return {
    ...sprite,
    data: flipHorizontal(sprite.data, SPRITE_SHAPE, sprite.mode),
  }
}

export function flipSpriteVertical(sprite: Sprite): Sprite {
  return {
    ...sprite,
    data: flipVertical(sprite.data, SPRITE_SHAPE, sprite.mode),
  }
}

export function shiftSprite(sprite: Sprite, dx: number, dy: number): Sprite {
  return {
    ...sprite,
    data: shift(sprite.data, SPRITE_SHAPE, sprite.mode, dx, dy),
  }
}

export function invertSprite(sprite: Sprite): Sprite {
  return { ...sprite, data: invert(sprite.data) }
}

export function clearSprite(sprite: Sprite): Sprite {
  return { ...sprite, data: blank(SPRITE_SHAPE) }
}

/** The 64-byte block as it sits in C64 memory (63 bytes + zero pad). */
export function spriteMemoryBlock(sprite: Sprite): Uint8Array {
  const out = new Uint8Array(SPRITE_STRIDE)
  out.set(sprite.data)
  return out
}
