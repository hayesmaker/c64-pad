import { MAX_MAP_SIZE } from '@/c64/charmap'
import { CHARSET_SIZE } from '@/c64/charset'
import { matchPalette, nearestColor } from '@/c64/palette'
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

// The C64 colour fit lives in the model (the charset merge uses it too).
export { DEFAULT_BACKGROUND, fitCharset } from '@/c64/char-fit'
export type { CharsetFit, FitChoice, TileFit } from '@/c64/char-fit'
