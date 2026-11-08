import { CHAR_SHAPE, writePixels } from '@/c64/bitmap'
import { createCharmap } from '@/c64/charmap'
import { CHARSET_BYTES, CHAR_BYTES, createCharset } from '@/c64/charset'
import { TILE_SIZE, mapSize } from './validate'
import type { Charmap } from '@/c64/charmap'
import type { Charset } from '@/c64/charset'
import type { AsepriteDoc } from './parse'
import type { CharsetFit, ColourReport, TilemapSource } from './validate'

/** `base`, or `base 2`, `base 3`… if a name is already taken. */
export function uniqueName(
  base: string,
  existing: ReadonlyArray<{ name: string }>,
): string {
  const taken = new Set(existing.map((a) => a.name))
  if (!taken.has(base)) return base
  for (let n = 2; ; n++) if (!taken.has(`${base} ${n}`)) return `${base} ${n}`
}

/** Encode one tile (64 C64 colours, -1 transparent) as char bytes. */
function encodeTile(
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

/** The tileset as a charset: tile n → char n, chars after the tiles blank. */
export function buildCharset(
  name: string,
  colours: Pick<ColourReport, 'tiles'>,
  fit: CharsetFit,
): Charset {
  const data = new Uint8Array(CHARSET_BYTES)
  const blank = createCharset()
  const colors = blank.colors.slice()
  colours.tiles.forEach((tile, i) => {
    const t = fit.tiles[i]
    data.set(encodeTile(tile, fit, t.mode), i * CHAR_BYTES)
    // In a multicolour charset, colour RAM bit 3 marks a multicolour char.
    colors[i] =
      fit.mode === 'multicolor' && t.mode === 'multicolor'
        ? 8 | (t.color & 7)
        : t.color
  })
  if (fit.mode === 'multicolor') {
    // Unused chars: hires, in a colour multicolour mode can show.
    for (let i = colours.tiles.length; i < colors.length; i++) colors[i] &= 7
  }
  return createCharset({
    name,
    mode: fit.mode,
    data,
    colors,
    background: fit.background,
    multicolor1: fit.multicolor1,
    multicolor2: fit.multicolor2,
  })
}

/**
 * The tilemap as a screen map the size of the whole canvas, with the tilemap
 * at its position; cells outside it are char 0 (the empty tile).
 */
export function buildMap(
  name: string,
  doc: AsepriteDoc,
  source: TilemapSource,
  charsetId: string,
): Charmap {
  const { width, height } = mapSize(doc)
  const cells = new Uint8Array(width * height)
  const { tilemap, cel } = source
  const ox = cel.x / TILE_SIZE
  const oy = cel.y / TILE_SIZE
  for (let ty = 0; ty < tilemap.height; ty++) {
    const y = oy + ty
    if (y < 0 || y >= height) continue
    for (let tx = 0; tx < tilemap.width; tx++) {
      const x = ox + tx
      if (x < 0 || x >= width) continue
      cells[y * width + x] = tilemap.tiles[ty * tilemap.width + tx]
    }
  }
  return createCharmap({ name, charsetId, width, height, cells, blank: 0 })
}

/** "island1_round4.aseprite" → "island1_round4". */
export function baseName(fileName: string): string {
  return fileName.replace(/\.(aseprite|ase)$/i, '') || 'Imported'
}
