import {
  CELL_COLOR_NONE,
  SCREEN_HEIGHT,
  SCREEN_WIDTH,
  decodeEcm,
} from './charmap'
import { charCount, charPixelColors, renderChar, renderCharIn } from './charset'
import type { Charmap } from './charmap'
import type { Charset } from './charset'

/** A rendered image as C64 colour indices; -1 = transparent. */
export interface IndexedImage {
  width: number
  height: number
  pixels: Int8Array
}

/**
 * The usable chars (or the first `limit`) as a grid sheet, 16 per row by
 * default.
 */
export function renderCharsetSheet(
  cs: Charset,
  columns = 16,
  limit = Infinity,
): IndexedImage {
  const count = Math.min(charCount(cs.mode), limit)
  const rows = Math.ceil(count / columns)
  const width = columns * 8
  const pixels = new Int8Array(width * rows * 8)
  for (let i = 0; i < count; i++) {
    const char = renderChar(cs, i)
    const ox = (i % columns) * 8
    const oy = Math.floor(i / columns) * 8
    for (let y = 0; y < 8; y++) {
      for (let x = 0; x < 8; x++)
        pixels[(oy + y) * width + ox + x] = char[y * 8 + x]
    }
  }
  return { width, height: rows * 8, pixels }
}

/**
 * Bitmap mode: the cell's colour per pixel value (background, 01, 10, 11),
 * its char's own with the map's cell colours over them. Null when the cell
 * has no colours of its own (or the charset isn't bitmap).
 */
export function cellPixelColors(
  map: Charmap,
  cs: Charset,
  index: number,
): Array<number> | null {
  const set = map.cellColors
  if (cs.mode !== 'bitmap' || !set) return null
  const o = index * 3
  if (
    set[o] === CELL_COLOR_NONE &&
    set[o + 1] === CELL_COLOR_NONE &&
    set[o + 2] === CELL_COLOR_NONE
  )
    return null
  const colors = charPixelColors(cs, map.cells[index])
  for (let k = 0; k < 3; k++)
    if (set[o + k] !== CELL_COLOR_NONE) colors[k + 1] = set[o + k]
  return colors
}

/** The cell's colours per pixel value, whether set on the cell or not. */
export function cellColorsOf(
  map: Charmap,
  cs: Charset,
  index: number,
): Array<number> {
  return (
    cellPixelColors(map, cs, index) ?? charPixelColors(cs, map.cells[index])
  )
}

/**
 * A window of the map drawn with its charset (default: the top-left screen).
 * Cells outside the map are left transparent.
 */
export function renderCharmap(
  map: Charmap,
  cs: Charset,
  view = { x: 0, y: 0, width: SCREEN_WIDTH, height: SCREEN_HEIGHT },
): IndexedImage {
  const width = view.width * 8
  const height = view.height * 8
  const pixels = new Int8Array(width * height).fill(-1)
  const cache = new Map<number, Uint8Array>()
  for (let cy = 0; cy < view.height; cy++) {
    for (let cx = 0; cx < view.width; cx++) {
      const mx = view.x + cx
      const my = view.y + cy
      if (mx < 0 || my < 0 || mx >= map.width || my >= map.height) continue
      const code = map.cells[my * map.width + mx]
      const own = cellPixelColors(map, cs, my * map.width + mx)
      let char = own ? renderCharIn(cs, code, own) : cache.get(code)
      if (!char) {
        char =
          cs.mode === 'ecm'
            ? renderChar(cs, decodeEcm(code).char, decodeEcm(code).background)
            : renderChar(cs, code)
        cache.set(code, char)
      }
      for (let y = 0; y < 8; y++) {
        for (let x = 0; x < 8; x++) {
          pixels[(cy * 8 + y) * width + cx * 8 + x] = char[y * 8 + x]
        }
      }
    }
  }
  return { width, height, pixels }
}
