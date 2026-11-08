import { SCREEN_HEIGHT, SCREEN_WIDTH, decodeEcm } from './charmap'
import { charCount, renderChar } from './charset'
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
      let char = cache.get(code)
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
