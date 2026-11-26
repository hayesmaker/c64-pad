import { SPRITE_SHAPE, writePixels } from './bitmap'
import { SPRITE_HEIGHT } from './sprite'
import type { PixelMode } from './bitmap'
import type { C64Color } from './palette'

/**
 * Fitting full-colour 24×21 art (one C64 colour per pixel, -1 = transparent)
 * to a sprite set's rules: choose the set's two shared multicolours so the
 * most sprites show exactly, as hires, multicolour, or multicolour with a
 * hires overlay sprite in front (the usual way to add a fifth colour and
 * single-pixel detail), and say why the rest can't. Used by the Aseprite
 * importer.
 */

export const SPRITE_WIDTH = 24
const PIXELS = SPRITE_WIDTH * SPRITE_HEIGHT

/** The set's multicolours when no sprite needs them (createSpriteSet's). */
const DEFAULT_MULTICOLOR1: C64Color = 11
const DEFAULT_MULTICOLOR2: C64Color = 1
/** Sprite colour of an empty sprite. */
const DEFAULT_COLOR: C64Color = 1

export type SpriteFitKind = 'hires' | 'multicolor' | 'overlay'

export interface SpriteImageFit {
  /** How the image is stored: one sprite, or a multicolour + hires pair. */
  readonly kind: SpriteFitKind
  /** The (base) sprite's own colour. */
  readonly color: C64Color
  /** The overlay sprite's colour (kind 'overlay'). */
  readonly overlayColor: C64Color | null
  /** Why it can't be shown exactly (null = it can). */
  readonly problem: string | null
}

export interface SpriteSetFit {
  readonly multicolor1: C64Color
  readonly multicolor2: C64Color
  readonly sprites: ReadonlyArray<SpriteImageFit>
  /** Images that can't be shown exactly (they're imported best-effort). */
  readonly failures: ReadonlyArray<{ sprite: number; problem: string }>
}

/** Multicolours already decided; the rest are searched for. */
export interface SpriteFitChoice {
  multicolor1?: C64Color
  multicolor2?: C64Color
}

interface ImageStats {
  /** Bit per C64 colour used. */
  mask: number
  counts: Array<number>
  /** Every pixel pair is the same: can be drawn as multicolour. */
  doubleWide: boolean
  /**
   * Overlay splits that work: with colour H moved to a hires sprite in
   * front, every pixel pair left agrees, using the colours in `baseMask`.
   */
  splits: Array<{ overlay: C64Color; baseMask: number }>
}

const bit = (c: C64Color) => 1 << c

function bitCount(mask: number) {
  let n = 0
  for (let m = mask; m; m &= m - 1) n++
  return n
}

const colorsIn = (mask: number) =>
  Array.from({ length: 16 }, (_, c) => c).filter((c) => mask & bit(c))

function stats(image: Int8Array): ImageStats {
  let mask = 0
  const counts = Array<number>(16).fill(0)
  let doubleWide = true
  for (let i = 0; i < image.length; i++) {
    const c = image[i]
    if (c >= 0) {
      mask |= bit(c)
      counts[c]++
    }
    if (i % 2 === 0 && image[i] !== image[i + 1]) doubleWide = false
  }
  const splits: ImageStats['splits'] = []
  if (!doubleWide && bitCount(mask) > 1) {
    // Thin colours first: overlays are usually outlines and highlights.
    const order = colorsIn(mask).sort((a, b) => counts[a] - counts[b])
    for (const h of order) {
      const base = splitBase(image, h)
      if (base !== null) splits.push({ overlay: h, baseMask: base })
    }
  }
  return { mask, counts, doubleWide, splits }
}

/**
 * The colours of the multicolour sprite left when colour `h` moves to a
 * hires sprite in front, or null if some pixel pair would still disagree.
 */
function splitBase(image: Int8Array, h: C64Color): number | null {
  let mask = 0
  for (let i = 0; i < image.length; i += 2) {
    const a = image[i] === h ? null : image[i]
    const b = image[i + 1] === h ? null : image[i + 1]
    if (a !== null && b !== null && a !== b) return null
    const c = a ?? b
    if (c !== null && c >= 0) mask |= bit(c)
  }
  return mask
}

/** The most used colour of `mask`, or -1. */
function mostUsed(s: ImageStats, mask: number) {
  let best = -1
  for (const c of colorsIn(mask))
    if (best < 0 || s.counts[c] > s.counts[best]) best = c
  return best
}

/** How one image fits with these multicolours, if it fits exactly. */
function exactFit(
  s: ImageStats,
  m1: C64Color,
  m2: C64Color,
): SpriteImageFit | null {
  if (bitCount(s.mask) <= 1) {
    const color = s.mask ? colorsIn(s.mask)[0] : DEFAULT_COLOR
    return { kind: 'hires', color, overlayColor: null, problem: null }
  }
  const shared = bit(m1) | bit(m2)
  if (s.doubleWide) {
    const rest = s.mask & ~shared
    if (bitCount(rest) <= 1) {
      const color = rest ? colorsIn(rest)[0] : DEFAULT_COLOR
      return { kind: 'multicolor', color, overlayColor: null, problem: null }
    }
  }
  for (const split of s.splits) {
    const rest = split.baseMask & ~shared
    if (bitCount(rest) <= 1) {
      const color = rest ? colorsIn(rest)[0] : DEFAULT_COLOR
      return {
        kind: 'overlay',
        color,
        overlayColor: split.overlay,
        problem: null,
      }
    }
  }
  return null
}

/** Closest storage for an image that can't be shown exactly. */
function bestEffort(s: ImageStats, m1: C64Color, m2: C64Color): SpriteImageFit {
  const shared = bit(m1) | bit(m2)
  const tooMany = (rest: number) =>
    `${bitCount(rest)} colours besides the two multicolours (a sprite has room for 1)`
  if (s.doubleWide) {
    const rest = s.mask & ~shared
    return {
      kind: 'multicolor',
      color: mostUsed(s, rest),
      overlayColor: null,
      problem: tooMany(rest),
    }
  }
  // An overlay still takes the single pixels; the body is approximated.
  const split = s.splits.at(0)
  if (split) {
    const rest = split.baseMask & ~shared
    return {
      kind: 'overlay',
      color: mostUsed(s, rest),
      overlayColor: split.overlay,
      problem: `${tooMany(rest)}, even with a hi-res overlay`,
    }
  }
  return {
    kind: 'hires',
    color: mostUsed(s, s.mask),
    overlayColor: null,
    problem: `hires pixels in ${bitCount(s.mask)} colours`,
  }
}

/**
 * Choose the set's multicolours so the most images fit exactly (then the
 * fewest overlays), and say how each image is stored. Images are 24×21 at
 * hires resolution; multicolour art has every pixel doubled.
 */
export function fitSprites(
  images: ReadonlyArray<Int8Array>,
  choice: SpriteFitChoice = {},
): SpriteSetFit {
  const all = images.map(stats)
  const used = all.reduce((m, s) => m | s.mask, 0)
  const total = Array<number>(16).fill(0)
  for (const s of all) s.counts.forEach((n, c) => (total[c] += n))

  const { multicolor1: fixed1, multicolor2: fixed2 } = choice
  const pairs: Array<[C64Color, C64Color]> = []
  if (fixed1 !== undefined && fixed2 !== undefined) {
    pairs.push([fixed1, fixed2])
  } else if (fixed1 !== undefined) {
    for (const c of colorsIn(used)) if (c !== fixed1) pairs.push([fixed1, c])
  } else if (fixed2 !== undefined) {
    for (const c of colorsIn(used)) if (c !== fixed2) pairs.push([c, fixed2])
  } else {
    const colors = colorsIn(used)
    for (const a of colors)
      for (const b of colors) if (a < b) pairs.push([a, b])
  }
  if (pairs.length === 0) {
    const m1 =
      fixed1 ??
      (fixed2 === DEFAULT_MULTICOLOR1
        ? DEFAULT_MULTICOLOR2
        : DEFAULT_MULTICOLOR1)
    const m2 =
      fixed2 ??
      (m1 === DEFAULT_MULTICOLOR2 ? DEFAULT_MULTICOLOR1 : DEFAULT_MULTICOLOR2)
    pairs.push([m1, m2])
  }

  // Does any image need the multicolours? If not, keep the defaults.
  const needsShared = all.some((s) => bitCount(s.mask) > 1)
  let best = {
    m1: pairs[0][0],
    m2: pairs[0][1],
    exact: -1,
    overlays: Infinity,
    weight: -1,
  }
  if (!needsShared && fixed1 === undefined && fixed2 === undefined) {
    best = { ...best, m1: DEFAULT_MULTICOLOR1, m2: DEFAULT_MULTICOLOR2 }
  } else {
    for (const [m1, m2] of pairs) {
      let exact = 0
      let overlays = 0
      for (const s of all) {
        const f = exactFit(s, m1, m2)
        if (f) {
          exact++
          if (f.kind === 'overlay') overlays++
        }
      }
      const weight = total[m1] + total[m2]
      if (
        exact > best.exact ||
        (exact === best.exact && overlays < best.overlays) ||
        (exact === best.exact &&
          overlays === best.overlays &&
          weight > best.weight)
      )
        best = { m1, m2, exact, overlays, weight }
    }
  }

  const sprites = all.map(
    (s) => exactFit(s, best.m1, best.m2) ?? bestEffort(s, best.m1, best.m2),
  )
  const failures = sprites.flatMap((f, sprite) =>
    f.problem ? [{ sprite, problem: f.problem }] : [],
  )
  return {
    multicolor1: best.m1,
    multicolor2: best.m2,
    sprites,
    failures,
  }
}

export interface EncodedSprite {
  readonly mode: PixelMode
  readonly color: C64Color
  readonly data: Uint8Array
}

/**
 * Sprite data for one image as fitted: the sprite, and for kind 'overlay'
 * the hires sprite drawn in front of it.
 */
export function encodeSprite(
  image: Int8Array,
  fit: SpriteImageFit,
  set: Pick<SpriteSetFit, 'multicolor1' | 'multicolor2'>,
): { sprite: EncodedSprite; overlay: EncodedSprite | null } {
  if (image.length !== PIXELS)
    throw new RangeError(`Expected ${PIXELS} pixels, got ${image.length}`)
  if (fit.kind === 'hires') {
    const pixels = Array.from(image, (c) => (c >= 0 ? 1 : 0))
    return {
      sprite: {
        mode: 'hires',
        color: fit.color,
        data: writePixels(pixels, SPRITE_SHAPE, 'hires'),
      },
      overlay: null,
    }
  }
  const front = fit.kind === 'overlay' ? fit.overlayColor : null
  const pen = (c: number) =>
    c < 0 ? 0 : c === set.multicolor1 ? 1 : c === set.multicolor2 ? 3 : 2
  const pairs: Array<number> = []
  for (let i = 0; i < PIXELS; i += 2) {
    const a = image[i] === front ? null : image[i]
    const b = image[i + 1] === front ? null : image[i + 1]
    // Best effort: the left pixel, unless it's see-through.
    const c = a === null ? (b ?? -1) : a < 0 && b !== null ? b : a
    pairs.push(pen(c))
  }
  const sprite: EncodedSprite = {
    mode: 'multicolor',
    color: fit.color,
    data: writePixels(pairs, SPRITE_SHAPE, 'multicolor'),
  }
  if (front === null) return { sprite, overlay: null }
  return {
    sprite,
    overlay: {
      mode: 'hires',
      color: front,
      data: writePixels(
        Array.from(image, (c) => (c === front ? 1 : 0)),
        SPRITE_SHAPE,
        'hires',
      ),
    },
  }
}
