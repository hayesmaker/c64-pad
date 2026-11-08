import { MAX_MAP_SIZE } from '@/c64/charmap'
import { CHARSET_SIZE } from '@/c64/charset'
import { COLOR_NAMES, matchPalette, nearestColor } from '@/c64/palette'
import type { C64Color, PaletteId, PaletteMatch } from '@/c64/palette'
import type {
  AseCel,
  AseLayer,
  AseTilemap,
  AseTileset,
  AsepriteDoc,
} from './parse'

/** Chars are 8×8. */
export const TILE_SIZE = 8

/** Background for transparent tiles, unless another colour fits better. */
export const DEFAULT_BACKGROUND: C64Color = 6

// ---------------------------------------------------------------- structure

/** A tilemap layer with its cel (frame 1) and tileset: one importable map. */
export interface TilemapSource {
  readonly layer: AseLayer
  readonly cel: AseCel
  readonly tilemap: AseTilemap
  readonly tileset: AseTileset
}

export interface Check {
  readonly ok: boolean
  readonly text: string
}

export interface StructureReport {
  /** Importable tilemap layers, in file order. */
  readonly sources: ReadonlyArray<TilemapSource>
  /** The source the checks are about (null if there is none). */
  readonly source: TilemapSource | null
  /** ✓ / ✗ lines; any ✗ blocks the import. */
  readonly checks: ReadonlyArray<Check>
  /** Things that are left out; the import still goes ahead. */
  readonly warnings: ReadonlyArray<string>
  readonly ok: boolean
}

/** Map size in chars: the whole canvas (tilemaps are not cropped). */
export function mapSize(doc: AsepriteDoc) {
  return {
    width: Math.ceil(doc.width / TILE_SIZE),
    height: Math.ceil(doc.height / TILE_SIZE),
  }
}

export function findSources(doc: AsepriteDoc): Array<TilemapSource> {
  const sources: Array<TilemapSource> = []
  for (const layer of doc.layers) {
    if (layer.kind !== 'tilemap' || layer.tilesetIndex === undefined) continue
    const cel = doc.cels.find(
      (c) => c.frame === 0 && c.layer === layer.index && c.tilemap,
    )
    const tileset = doc.tilesets[layer.tilesetIndex] as AseTileset | undefined
    if (cel?.tilemap && tileset)
      sources.push({ layer, cel, tilemap: cel.tilemap, tileset })
  }
  return sources
}

const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? '' : 's'}`

/**
 * Can this file be imported as a charset + map? `layerIndex` picks the
 * tilemap layer when there are several (default: the first).
 */
export function checkStructure(
  doc: AsepriteDoc,
  layerIndex?: number,
): StructureReport {
  const sources = findSources(doc)
  const source: TilemapSource | null =
    sources.find((s) => s.layer.index === layerIndex) ??
    (sources.length > 0 ? sources[0] : null)
  const checks: Array<Check> = []
  const warnings: Array<string> = []

  if (!source) {
    const hasLayer = doc.layers.some((l) => l.kind === 'tilemap')
    checks.push({
      ok: false,
      text: hasLayer
        ? 'The tilemap layer is empty in frame 1'
        : 'No tilemap layer found (add one in Aseprite with Layer › New › New Tilemap Layer)',
    })
    return { sources, source, checks, warnings, ok: false }
  }

  const { tileset, tilemap, cel } = source
  const square =
    tileset.tileWidth === TILE_SIZE && tileset.tileHeight === TILE_SIZE
  checks.push({
    ok: square,
    text: square
      ? `Tileset of ${plural(tileset.count, 'tile')}, 8×8`
      : `Tiles are ${tileset.tileWidth}×${tileset.tileHeight}; only 8×8 is supported`,
  })
  if (tileset.external || !tileset.pixels) {
    checks.push({
      ok: false,
      text: 'The tileset is stored in another file; embed it in this one',
    })
  }
  checks.push({
    ok: tileset.count <= CHARSET_SIZE,
    text:
      tileset.count <= CHARSET_SIZE
        ? `Fits in one charset (${tileset.count} of 256 chars, including the empty tile 0)`
        : `${tileset.count} tiles; a charset holds 256 (including the empty tile 0)`,
  })
  checks.push({
    ok: tilemap.flipped === 0,
    text:
      tilemap.flipped === 0
        ? 'No flipped or rotated tiles'
        : `${plural(tilemap.flipped, 'map cell')} use flipped or rotated tiles; the C64 can't flip chars`,
  })
  const highest = tilemap.tiles.reduce((m, t) => Math.max(m, t), 0)
  if (highest >= tileset.count) {
    checks.push({
      ok: false,
      text: `The map uses tile ${highest}, but the tileset only has ${tileset.count}`,
    })
  }
  const size = mapSize(doc)
  const fits = size.width <= MAX_MAP_SIZE && size.height <= MAX_MAP_SIZE
  const aligned = cel.x % TILE_SIZE === 0 && cel.y % TILE_SIZE === 0
  checks.push({
    ok: fits && aligned,
    text: !fits
      ? `The canvas is ${size.width}×${size.height} chars; maps can be up to ${MAX_MAP_SIZE}×${MAX_MAP_SIZE}`
      : !aligned
        ? `The tilemap is at ${cel.x},${cel.y} px, off the 8 px grid`
        : `Tilemap of ${tilemap.width}×${tilemap.height} tiles → a ${size.width}×${size.height} screen map`,
  })

  if (sources.length > 1) {
    warnings.push(
      `The file has ${sources.length} tilemap layers; pick which one to import.`,
    )
  }
  const images = doc.layers.filter((l) => l.kind === 'image')
  if (images.length > 0) {
    warnings.push(
      `Image layers aren't imported: ${images.map((l) => `“${l.name}”`).join(', ')}.`,
    )
  }
  if (doc.frames > 1) {
    warnings.push(`Only frame 1 is imported (the file has ${doc.frames}).`)
  }
  const tagged = new Map<string, Array<number>>()
  tileset.tileUserData.forEach((text, i) => {
    if (text) tagged.set(text, [...(tagged.get(text) ?? []), i])
  })
  for (const [text, tiles] of tagged) {
    warnings.push(
      `Tile properties aren't imported yet: ${plural(tiles.length, 'tile')} tagged “${text}” (${tiles.length === 1 ? 'tile' : 'tiles'} ${tiles.join(', ')}).`,
    )
  }

  return {
    sources,
    source,
    checks,
    warnings,
    ok: checks.every((c) => c.ok),
  }
}

// ---------------------------------------------------------------- colours

/** Below this RGB distance a colour counts as "close" to a palette colour. */
export const NEAR_DISTANCE = 32

export type PaletteVerdict =
  /** Every colour is exactly a colour of the project's palette. */
  | 'project'
  /** Exactly another palette's colours (e.g. Pepto from Aseprite). */
  | 'other-exact'
  /** Close to a palette, not exact. */
  | 'near'
  /** Nothing close: colours are guessed. */
  | 'far'

export interface ColourReport {
  readonly verdict: PaletteVerdict
  /** The palette the file's colours are read with. */
  readonly palette: PaletteId
  /** Largest distance from a file colour to its C64 colour (0 = exact). */
  readonly worst: number
  readonly matches: ReadonlyArray<PaletteMatch>
  /** Colours far from any C64 colour, as #rrggbb (verdict 'far'). */
  readonly guessed: ReadonlyArray<string>
  /** Per tile, 64 C64 colour indices row-major; -1 = transparent. */
  readonly tiles: ReadonlyArray<Int8Array>
  /** Some tile pixels are transparent (they become the background). */
  readonly transparent: boolean
  /**
   * The background the file shows: an indexed file's transparent colour, when
   * tiles have transparent pixels and it's a C64 colour. Null if unknown.
   */
  readonly fileBackground: C64Color | null
}

const hex = (r: number, g: number, b: number) =>
  '#' + [r, g, b].map((v) => v.toString(16).padStart(2, '0')).join('')

/** Read the tileset's colours as C64 colours, matching them to a palette. */
export function analyseColours(
  doc: Pick<AsepriteDoc, 'depth' | 'palette' | 'transparentIndex'>,
  tileset: AseTileset,
  projectPalette: PaletteId,
): ColourReport {
  const px = tileset.pixels ?? new Uint8ClampedArray()
  const distinct = new Map<number, readonly [number, number, number]>()
  for (let i = 0; i < px.length; i += 4) {
    if (px[i + 3] < 128) continue
    const key = (px[i] << 16) | (px[i + 1] << 8) | px[i + 2]
    distinct.set(key, [px[i], px[i + 1], px[i + 2]])
  }
  const colors = [...distinct.values()]
  const matches = matchPalette(colors)
  const own = matches.find((m) => m.id === projectPalette)!
  const best = matches[0]
  const verdict: PaletteVerdict = own.exact
    ? 'project'
    : best.exact
      ? 'other-exact'
      : best.worst <= NEAR_DISTANCE
        ? 'near'
        : 'far'
  const palette =
    verdict === 'project' || verdict === 'far' ? projectPalette : best.id

  const lookup = new Map<number, C64Color>()
  const guessed: Array<string> = []
  let worst = 0
  for (const [key, rgb] of distinct) {
    const { color, distance } = nearestColor(rgb, palette)
    lookup.set(key, color)
    worst = Math.max(worst, distance)
    if (distance > NEAR_DISTANCE) guessed.push(hex(...rgb))
  }

  const pixelsPerTile = TILE_SIZE * TILE_SIZE
  const tiles: Array<Int8Array> = []
  let transparent = false
  for (let t = 0; t < tileset.count; t++) {
    const tile = new Int8Array(pixelsPerTile)
    for (let i = 0; i < pixelsPerTile; i++) {
      const o = (t * pixelsPerTile + i) * 4
      if (o + 3 >= px.length || px[o + 3] < 128) {
        tile[i] = -1
        // Tile 0 is Aseprite's empty tile; it doesn't say anything.
        if (t > 0) transparent = true
      } else {
        tile[i] = lookup.get((px[o] << 16) | (px[o + 1] << 8) | px[o + 2])!
      }
    }
    tiles.push(tile)
  }
  // Indexed files draw transparent pixels in the transparent index's colour
  // (e.g. Rainbow Islands' orange): that's the background, if it's a C64 one.
  let fileBackground: C64Color | null = null
  const clear =
    doc.depth === 8 && doc.transparentIndex < doc.palette.length
      ? doc.palette[doc.transparentIndex]
      : null
  if (transparent && clear) {
    const near = nearestColor([clear[0], clear[1], clear[2]], palette)
    if (near.distance <= NEAR_DISTANCE) fileBackground = near.color
  }
  return {
    verdict,
    palette,
    worst,
    matches,
    guessed,
    tiles,
    transparent,
    fileBackground,
  }
}

// ---------------------------------------------------------------- C64 fit

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

/** Registers the user has chosen; the rest are searched for. */
export interface FitChoice {
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
  colours: Pick<ColourReport, 'tiles' | 'transparent'> &
    Partial<Pick<ColourReport, 'fileBackground'>>,
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
    if (!fixedMc) {
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
