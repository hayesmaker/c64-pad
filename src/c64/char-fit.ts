import { CHAR_SHAPE, writePixels } from './bitmap'
import { COLOR_NAMES } from './palette'
import type { C64Color } from './palette'

/**
 * Fitting full-colour 8×8 art (one C64 colour per pixel, -1 = transparent)
 * to a charset's rules: choose hires or multicolour and the background /
 * MC1 / MC2 registers so the most chars show exactly, and say why the rest
 * can't. Used by the Aseprite importer and by copying chars between charsets.
 */

const TILE_SIZE = 8

/** Background for transparent tiles, unless another colour fits better. */
export const DEFAULT_BACKGROUND: C64Color = 6

export interface TileFit {
  /** How the char is stored. */
  readonly mode: 'hires' | 'multicolor'
  /** Its colour RAM colour (0-15 in a hires charset, 0-7 in multicolour). */
  readonly color: C64Color
  /** Why it can't be shown exactly (null = it can). */
  readonly problem: string | null
}

export interface CharsetFit {
  readonly mode: 'hires' | 'multicolor'
  readonly background: C64Color
  /** Where the background came from. */
  readonly backgroundFrom: 'choice' | 'file' | 'fit'
  /**
   * Tiles with opaque pixels in the background colour (transparent files
   * only): those pixels are stored as background, so they follow it if the
   * background is changed later.
   */
  readonly backgroundDrawn: ReadonlyArray<number>
  readonly multicolor1: C64Color
  readonly multicolor2: C64Color
  readonly tiles: ReadonlyArray<TileFit>
  /** Tiles that can't be shown exactly (they're imported best-effort). */
  readonly failures: ReadonlyArray<{ tile: number; problem: string }>
}

/** The art to fit: per tile, 64 C64 colours row-major (-1 = transparent). */
export interface FitInput {
  /** Tile 0 is the empty tile: always char 0, blank. */
  readonly tiles: ReadonlyArray<Int8Array>
  /** Some pixels are transparent (they become the background). */
  readonly transparent: boolean
  /** The background the art shows, if known (e.g. an Aseprite file's). */
  readonly fileBackground?: C64Color | null
}

/** Registers (and the mode) already decided; the rest are searched for. */
export interface FitChoice {
  /** Only consider this charset mode. */
  mode?: 'hires' | 'multicolor'
  background?: C64Color
  multicolor1?: C64Color
  multicolor2?: C64Color
}

interface TileStats {
  /** Bit per C64 colour used (opaque pixels). */
  mask: number
  /** Every pixel pair is the same: can be drawn as multicolour. */
  doubleWide: boolean
  counts: Array<number>
}

function stats(tile: Int8Array): TileStats {
  let mask = 0
  const counts = Array<number>(16).fill(0)
  let doubleWide = true
  for (let i = 0; i < tile.length; i++) {
    const c = tile[i]
    if (c >= 0) {
      mask |= 1 << c
      counts[c]++
    }
    if (i % 2 === 0 && tile[i] !== tile[i + 1]) doubleWide = false
  }
  return { mask, doubleWide, counts }
}

function bitCount(mask: number) {
  let n = 0
  for (let m = mask; m; m &= m - 1) n++
  return n
}

const LOW_COLORS = 0x00ff
const bit = (c: C64Color) => 1 << c
const colorsIn = (mask: number) =>
  Array.from({ length: 16 }, (_, c) => c).filter((c) => mask & bit(c))

/** Fits as a hires char: one colour besides the background. */
function hiresFits(s: TileStats, bg: C64Color, mcMode: boolean) {
  const rest = s.mask & ~bit(bg)
  return bitCount(rest) <= 1 && (!mcMode || (rest & ~LOW_COLORS) === 0)
}

/** Fits as a multicolour char: one colour besides bg / MC1 / MC2, and 0-7. */
function mcFits(s: TileStats, bg: C64Color, m1: C64Color, m2: C64Color) {
  const rest = s.mask & ~bit(bg) & ~bit(m1) & ~bit(m2)
  return s.doubleWide && bitCount(rest) <= 1 && (rest & ~LOW_COLORS) === 0
}

/** The most used colour in a mask, preferring ones allowed by `allowed`. */
function mostUsed(s: TileStats, mask: number, allowed = 0xffff) {
  let best = -1
  for (const c of colorsIn(mask)) {
    const better =
      best < 0 ||
      (allowed & bit(c) && !(allowed & bit(best))) ||
      (!!(allowed & bit(c)) === !!(allowed & bit(best)) &&
        s.counts[c] > s.counts[best])
    if (better) best = c
  }
  return best
}

/**
 * Choose the charset mode and background / MC1 / MC2 so the most tiles can be
 * shown exactly, then say how each tile is stored. Transparent pixels are the
 * background: chosen, else the file's own (an indexed file's transparent
 * colour). Otherwise opaque tiles show it (the most used colour wins ties)
 * and hires is preferred when every tile fits it; with transparent tiles it
 * is blue unless another colour fits more tiles (then the least used).
 */
export function fitCharset(
  colours: FitInput,
  choice: FitChoice = {},
): CharsetFit {
  // Tile 0 is the empty tile: always char 0, blank.
  const all = colours.tiles.map(stats)
  const used = all.slice(1)
  const total = Array<number>(16).fill(0)
  for (const s of used) s.counts.forEach((n, c) => (total[c] += n))

  const range = Array.from({ length: 16 }, (_, c) => c)
  const fileBackground = colours.fileBackground ?? null
  const backgroundFrom: CharsetFit['backgroundFrom'] =
    choice.background !== undefined
      ? 'choice'
      : fileBackground !== null
        ? 'file'
        : 'fit'
  const backgrounds =
    choice.background !== undefined
      ? [choice.background]
      : fileBackground !== null
        ? [fileBackground]
        : range
  const fixedMc =
    choice.multicolor1 !== undefined || choice.multicolor2 !== undefined

  interface Candidate {
    mode: 'hires' | 'multicolor'
    bg: C64Color
    m1: C64Color
    m2: C64Color
    fails: number
    usage: number
  }
  // Fewest misfits first. Opaque tiles show the background, so then prefer
  // hires and the most used colour. Transparent tiles show it through the
  // gaps, so it's seldom drawn: prefer blue, then the least used colour,
  // over any other background that fits as well (even as all-hires).
  const rank = (c: Candidate) => {
    const hires = c.mode === 'hires' ? 0 : 1
    return colours.transparent
      ? [
          c.fails,
          c.bg === DEFAULT_BACKGROUND ? 0 : 1,
          total[c.bg],
          hires,
          -c.usage,
        ]
      : [c.fails, hires, -total[c.bg], -c.usage]
  }
  const better = (a: Candidate, b: Candidate | null) => {
    if (!b) return true
    const [ra, rb] = [rank(a), rank(b)]
    for (let i = 0; i < ra.length; i++)
      if (ra[i] !== rb[i]) return ra[i] < rb[i]
    return false
  }

  let best: Candidate | null = null
  for (const bg of backgrounds) {
    if (!fixedMc && choice.mode !== 'multicolor') {
      const fails = used.filter((s) => !hiresFits(s, bg, false)).length
      const c: Candidate = {
        mode: 'hires',
        bg,
        m1: 11,
        m2: 12,
        fails,
        usage: 0,
      }
      if (better(c, best)) best = c
    }
    if (choice.mode === 'hires') continue
    // Tiles that need multicolour whatever MC1/MC2 are.
    const needMc = used.filter((s) => !hiresFits(s, bg, true))
    const m1s = choice.multicolor1 !== undefined ? [choice.multicolor1] : range
    const m2s = choice.multicolor2 !== undefined ? [choice.multicolor2] : range
    for (const m1 of m1s) {
      for (const m2 of m2s) {
        if (!fixedMc && m2 <= m1) continue
        if (choice.multicolor1 === undefined && m1 === bg) continue
        if (choice.multicolor2 === undefined && m2 === bg) continue
        let fails = 0
        let usage = 0
        for (const s of needMc) {
          if (!mcFits(s, bg, m1, m2)) fails++
          usage += (s.mask & bit(m1) ? 1 : 0) + (s.mask & bit(m2) ? 1 : 0)
        }
        const c: Candidate = { mode: 'multicolor', bg, m1, m2, fails, usage }
        if (better(c, best)) best = c
      }
    }
  }
  const { mode, bg, m1, m2 } = best!
  const mcMode = mode === 'multicolor'
  const fallback = bg === 1 ? 0 : 1

  const tiles: Array<TileFit> = all.map((s, i) => {
    const rest = s.mask & ~bit(bg)
    if (i === 0 || hiresFits(s, bg, mcMode)) {
      const c = colorsIn(rest)[0] ?? fallback
      return { mode: 'hires', color: c, problem: null }
    }
    if (mcMode && mcFits(s, bg, m1, m2)) {
      const own = colorsIn(rest & ~bit(m1) & ~bit(m2))[0] ?? fallback
      return { mode: 'multicolor', color: own, problem: null }
    }
    // Doesn't fit: say why, and store it as close as possible.
    const name = (c: C64Color) => COLOR_NAMES[c]
    if (mcMode && s.doubleWide) {
      const extra = rest & ~bit(m1) & ~bit(m2)
      const own = mostUsed(s, extra, LOW_COLORS)
      const problem =
        bitCount(extra) > 1
          ? `uses ${colorsIn(extra).map(name).join(', ')} besides the background, MC1 and MC2; only one more fits`
          : `${name(own)} can't be a multicolour char's own colour (only colours 0–7)`
      return { mode: 'multicolor', color: own & 7, problem }
    }
    const own = mostUsed(s, rest, mcMode ? LOW_COLORS : 0xffff)
    const problem =
      bitCount(rest) > 1
        ? `hires pixels in ${colorsIn(rest).map(name).join(', ')}; a hires char has one colour besides the background`
        : `${name(own)} can't be a hires char's colour in a multicolour charset (only colours 0–7)`
    return { mode: 'hires', color: mcMode ? own & 7 : own, problem }
  })

  const backgroundDrawn = colours.transparent
    ? used.flatMap((s, i) => (s.mask & bit(bg) ? [i + 1] : []))
    : []

  return {
    mode,
    background: bg,
    backgroundFrom,
    backgroundDrawn,
    multicolor1: m1,
    multicolor2: m2,
    tiles,
    failures: tiles.flatMap((t, tile) =>
      t.problem ? [{ tile, problem: t.problem }] : [],
    ),
  }
}

/** Encode one tile (64 C64 colours, -1 transparent) as char bytes. */
export function encodeTile(
  tile: Int8Array,
  fit: CharsetFit,
  mode: 'hires' | 'multicolor',
): Uint8Array {
  const bg = fit.background
  if (mode === 'hires') {
    return writePixels(
      Array.from(tile, (c) => (c < 0 || c === bg ? 0 : 1)),
      CHAR_SHAPE,
      'hires',
    )
  }
  // Multicolour: 4×8, from the left pixel of each pair.
  const values: Array<number> = []
  for (let y = 0; y < TILE_SIZE; y++) {
    for (let x = 0; x < TILE_SIZE; x += 2) {
      const c = tile[y * TILE_SIZE + x]
      values.push(
        c < 0 || c === bg
          ? 0
          : c === fit.multicolor1
            ? 1
            : c === fit.multicolor2
              ? 2
              : 3,
      )
    }
  }
  return writePixels(values, CHAR_SHAPE, 'multicolor')
}
