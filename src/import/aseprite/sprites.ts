import { newId } from '@/c64/ids'
import { encodeSprite } from '@/c64/sprite-fit'
import { SPRITE_HEIGHT, createSprite } from '@/c64/sprite'
import { createSpriteSet } from '@/c64/sprite-set'
import { celAt, layerShown } from './parse'
import type { C64Color } from '@/c64/palette'
import type { SpriteSetFit } from '@/c64/sprite-fit'
import type { Sprite } from '@/c64/sprite'
import type { SpriteAnimation, SpriteSet } from '@/c64/sprite-set'
import type { AsepriteDoc } from './parse'
import type { Check } from './validate'

/**
 * Aseprite art as sprites. Each frame's visible image layers are flattened
 * and cut into 24×21 cells: a 24×21 canvas is one sprite per frame (an
 * animation), a bigger one a sheet of sprites. With Aseprite's 2:1 pixel
 * ratio a cell is 12×21 and every pixel is a double-wide multicolour pixel.
 */

export const SPRITE_W = 24
/** More would not fit the 256 sprite pointers of a VIC bank. */
export const MAX_SPRITES = 256

export interface SpriteGrid {
  /** Cell size in file pixels. */
  readonly cellWidth: number
  readonly cellHeight: number
  /** File pixels are this many sprite pixels wide (2 with a 2:1 ratio). */
  readonly scaleX: number
  readonly columns: number
  readonly rows: number
}

export interface SpriteStructure {
  readonly checks: ReadonlyArray<Check>
  readonly warnings: ReadonlyArray<string>
  readonly ok: boolean
  readonly grid: SpriteGrid | null
  /** Image layers drawn, bottom first. */
  readonly layers: ReadonlyArray<number>
}

const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? '' : 's'}`

/** Can this file be read as sprites? */
export function checkSpriteStructure(doc: AsepriteDoc): SpriteStructure {
  const checks: Array<Check> = []
  const warnings: Array<string> = []
  const layers = doc.layers
    .filter((l) => l.kind === 'image' && layerShown(doc, l.index))
    .map((l) => l.index)
  const drawn = layers.some((l) => doc.cels.some((c) => c.layer === l))
  checks.push({
    ok: drawn,
    text: drawn
      ? `${plural(layers.length, 'visible image layer')}, flattened`
      : 'No visible image layer has anything drawn on it',
  })

  const [rw, rh] = doc.pixelRatio
  const scaleX = rw === 2 && rh === 1 ? 2 : 1
  if (scaleX === 1 && rw !== rh) {
    warnings.push(
      `The pixel ratio is ${rw}:${rh}; it's read as square pixels (only 2:1 means double-wide).`,
    )
  }
  const cellWidth = SPRITE_W / scaleX
  const cellHeight = SPRITE_HEIGHT
  const fits = doc.width % cellWidth === 0 && doc.height % cellHeight === 0
  const columns = doc.width / cellWidth
  const rows = doc.height / cellHeight
  checks.push({
    ok: fits,
    text: fits
      ? columns * rows === 1
        ? `A ${cellWidth}×${cellHeight} canvas: one sprite per frame${scaleX === 2 ? ' (2:1 pixels, so multicolour)' : ''}`
        : `A sheet of ${columns}×${rows} sprites of ${cellWidth}×${cellHeight} px${scaleX === 2 ? ' (2:1 pixels, so multicolour)' : ''}`
      : `The canvas is ${doc.width}×${doc.height} px; sprites need ${cellWidth}×${cellHeight}, or a grid of them (e.g. ${cellWidth * 4}×${cellHeight * 2})`,
  })

  if (doc.layers.some((l) => l.kind === 'tilemap')) {
    warnings.push("Tilemap layers aren't part of the sprites.")
  }
  if (fits && columns * rows > 1 && doc.tags.length > 0) {
    warnings.push(
      "Tags only become animations when each frame is one sprite, so they're left out.",
    )
  }
  const ok = checks.every((c) => c.ok)
  return {
    checks,
    warnings,
    ok,
    grid: ok ? { cellWidth, cellHeight, scaleX, columns, rows } : null,
    layers,
  }
}

/** One frame's visible image layers, drawn over each other (RGBA, canvas size). */
export function flattenFrame(
  doc: AsepriteDoc,
  frame: number,
  layers: ReadonlyArray<number>,
): Uint8ClampedArray {
  const out = new Uint8ClampedArray(doc.width * doc.height * 4)
  for (const index of layers) {
    const cel = celAt(doc, frame, index)
    const image = cel?.image
    if (!cel || !image) continue
    const alpha = (cel.opacity / 255) * (doc.layers[index].opacity / 255)
    for (let y = 0; y < image.height; y++) {
      const cy = cel.y + y
      if (cy < 0 || cy >= doc.height) continue
      for (let x = 0; x < image.width; x++) {
        const cx = cel.x + x
        if (cx < 0 || cx >= doc.width) continue
        const i = (y * image.width + x) * 4
        // The C64 has no half-transparent pixels: a pixel is there or not.
        if (image.pixels[i + 3] * alpha < 128) continue
        const o = (cy * doc.width + cx) * 4
        out.set(image.pixels.subarray(i, i + 3), o)
        out[o + 3] = 255
      }
    }
  }
  return out
}

export interface SpriteCell {
  readonly frame: number
  readonly column: number
  readonly row: number
  /** RGBA at sprite resolution, 24×21. */
  readonly rgba: Uint8ClampedArray
}

/** Every cell of every frame, frame by frame, left to right, top to bottom. */
export function readSpriteCells(
  doc: AsepriteDoc,
  structure: SpriteStructure,
): Array<SpriteCell> {
  const grid = structure.grid
  if (!grid) return []
  const cells: Array<SpriteCell> = []
  for (let frame = 0; frame < doc.frames; frame++) {
    const canvas = flattenFrame(doc, frame, structure.layers)
    for (let row = 0; row < grid.rows; row++) {
      for (let column = 0; column < grid.columns; column++) {
        const rgba = new Uint8ClampedArray(SPRITE_W * SPRITE_HEIGHT * 4)
        for (let y = 0; y < SPRITE_HEIGHT; y++) {
          for (let x = 0; x < SPRITE_W; x++) {
            const fx = column * grid.cellWidth + Math.floor(x / grid.scaleX)
            const fy = row * grid.cellHeight + y
            const i = (fy * doc.width + fx) * 4
            rgba.set(canvas.subarray(i, i + 4), (y * SPRITE_W + x) * 4)
          }
        }
        cells.push({ frame, column, row, rgba })
      }
    }
  }
  return cells
}

/**
 * The colour to read as see-through when the art has no transparent pixels
 * (an opaque background): the most common colour in the cells' corners.
 */
export function guessTransparent(
  images: ReadonlyArray<Int8Array>,
): C64Color | null {
  // Empty cells (all see-through) say nothing about the drawn ones.
  const drawn = images.filter((img) => img.some((c) => c >= 0))
  if (drawn.length === 0 || drawn.some((img) => img.includes(-1))) return null
  const counts = Array<number>(16).fill(0)
  const corners = [
    0,
    SPRITE_W - 1,
    (SPRITE_HEIGHT - 1) * SPRITE_W,
    SPRITE_HEIGHT * SPRITE_W - 1,
  ]
  for (const img of drawn) for (const i of corners) counts[img[i]]++
  return counts.indexOf(Math.max(...counts))
}

export interface SpriteSheet {
  /** The distinct, non-empty images, in order of first appearance. */
  readonly images: ReadonlyArray<Int8Array>
  /** For each cell, its image (null = empty). */
  readonly cellImage: ReadonlyArray<number | null>
  readonly empty: number
  readonly duplicates: number
}

/** Drop empty cells and share repeated ones. */
export function collectSprites(
  cellImages: ReadonlyArray<Int8Array>,
  transparent: C64Color | null,
): SpriteSheet {
  const images: Array<Int8Array> = []
  const seen = new Map<string, number>()
  let empty = 0
  let duplicates = 0
  const cellImage = cellImages.map((source) => {
    const img =
      transparent === null
        ? source
        : source.map((c) => (c === transparent ? -1 : c))
    if (img.every((c) => c < 0)) {
      empty++
      return null
    }
    const key = img.join(',')
    const known = seen.get(key)
    if (known !== undefined) {
      duplicates++
      return known
    }
    seen.set(key, images.length)
    images.push(img)
    return images.length - 1
  })
  return { images, cellImage, empty, duplicates }
}

/** One PAL frame is 20 ms. */
const PAL_FRAME_MS = 20

/** Sprites (and overlays) the set will hold. */
export function spriteCount(fit: SpriteSetFit) {
  return fit.sprites.reduce((n, s) => n + (s.kind === 'overlay' ? 2 : 1), 0)
}

/**
 * The sprite set: one sprite per image (a multicolour sprite and its hires
 * overlay right after it, where the fit split one), and when each frame is
 * one sprite, an animation per tag (or one of all the frames).
 */
export function buildSpriteSet(
  name: string,
  doc: AsepriteDoc,
  structure: SpriteStructure,
  sheet: SpriteSheet,
  fit: SpriteSetFit,
): SpriteSet {
  const perFrame =
    structure.grid && structure.grid.columns * structure.grid.rows === 1
  const firstFrame = (image: number) => sheet.cellImage.indexOf(image)
  const nameOf = (image: number) => {
    if (perFrame) {
      const frame = firstFrame(image)
      const tag = doc.tags.find((t) => frame >= t.from && frame <= t.to)
      if (tag?.name) return `${tag.name} ${frame - tag.from}`
    }
    return `Sprite ${image}`
  }

  const sprites: Array<Sprite> = []
  const ids: Array<string> = []
  sheet.images.forEach((image, i) => {
    const encoded = encodeSprite(image, fit.sprites[i], fit)
    const overlay =
      encoded.overlay &&
      createSprite({ name: `${nameOf(i)} overlay`, ...encoded.overlay })
    const sprite = createSprite({
      name: nameOf(i),
      ...encoded.sprite,
      overlayId: overlay?.id ?? null,
    })
    ids.push(sprite.id)
    sprites.push(sprite)
    if (overlay) sprites.push(overlay)
  })

  const animations: Array<SpriteAnimation> = []
  if (perFrame && doc.frames > 1) {
    const runs =
      doc.tags.length > 0
        ? doc.tags
        : [
            {
              name: 'Animation',
              from: 0,
              to: doc.frames - 1,
              direction: 'forward' as const,
            },
          ]
    for (const tag of runs) {
      const frames: Array<string> = []
      for (let f = tag.from; f <= tag.to && f < doc.frames; f++) {
        const image = sheet.cellImage[f]
        if (image !== null) frames.push(ids[image])
      }
      if (frames.length === 0) continue
      const reversed =
        tag.direction === 'reverse' || tag.direction === 'pingpong-reverse'
      const ms = doc.durations.slice(tag.from, tag.to + 1)
      const mean = ms.reduce((a, b) => a + b, 0) / Math.max(1, ms.length)
      animations.push({
        id: newId(),
        name: tag.name || 'Animation',
        frames: reversed ? frames.reverse() : frames,
        speed: Math.min(255, Math.max(1, Math.round(mean / PAL_FRAME_MS))),
        mode: tag.direction.startsWith('pingpong') ? 'pingpong' : 'loop',
      })
    }
  }

  return createSpriteSet({
    name,
    sprites,
    animations,
    multicolor1: fit.multicolor1,
    multicolor2: fit.multicolor2,
  })
}
