/**
 * Pixel access for C64 bitmaps stored as raw bytes, exactly as the VIC-II reads
 * them: rows of bytes, most significant bit = leftmost pixel.
 *
 * - hires: 1 bit per pixel (0 = background/transparent, 1 = foreground)
 * - multicolor: 2 bits per pixel (bit pairs 00/01/10/11), half the horizontal
 *   resolution, so a pixel covers two hires pixels.
 *
 * Switching mode never changes the bytes, only how they are read.
 * All functions are pure: they return new arrays and never mutate inputs.
 */

export type PixelMode = 'hires' | 'multicolor'

export interface BitmapShape {
  readonly bytesPerRow: number
  readonly rows: number
}

/** 24×21 sprite: 3 bytes per row, 63 bytes. */
export const SPRITE_SHAPE: BitmapShape = { bytesPerRow: 3, rows: 21 }
/** 8×8 character: 1 byte per row, 8 bytes. */
export const CHAR_SHAPE: BitmapShape = { bytesPerRow: 1, rows: 8 }

export function byteLength(shape: BitmapShape): number {
  return shape.bytesPerRow * shape.rows
}

/** Width in pixels of the given mode (MC pixels are double-wide). */
export function pixelWidth(shape: BitmapShape, mode: PixelMode): number {
  return shape.bytesPerRow * (mode === 'hires' ? 8 : 4)
}

/** Highest pixel value for the mode: 1 for hires, 3 for multicolour. */
export function maxPixelValue(mode: PixelMode): number {
  return mode === 'hires' ? 1 : 3
}

function bitsPerPixel(mode: PixelMode): number {
  return mode === 'hires' ? 1 : 2
}

function checkCoords(
  shape: BitmapShape,
  mode: PixelMode,
  x: number,
  y: number,
) {
  const w = pixelWidth(shape, mode)
  if (!Number.isInteger(x) || x < 0 || x >= w) {
    throw new RangeError(`x ${x} outside 0-${w - 1} (${mode})`)
  }
  if (!Number.isInteger(y) || y < 0 || y >= shape.rows) {
    throw new RangeError(`y ${y} outside 0-${shape.rows - 1}`)
  }
}

function checkValue(mode: PixelMode, value: number) {
  const max = maxPixelValue(mode)
  if (!Number.isInteger(value) || value < 0 || value > max) {
    throw new RangeError(`Pixel value ${value} outside 0-${max} (${mode})`)
  }
}

function locate(shape: BitmapShape, mode: PixelMode, x: number, y: number) {
  const bpp = bitsPerPixel(mode)
  const bit = x * bpp
  return {
    index: y * shape.bytesPerRow + (bit >> 3),
    offset: 8 - bpp - (bit & 7),
    mask: (1 << bpp) - 1,
  }
}

export function getPixel(
  bytes: Uint8Array,
  shape: BitmapShape,
  mode: PixelMode,
  x: number,
  y: number,
): number {
  checkCoords(shape, mode, x, y)
  const { index, offset, mask } = locate(shape, mode, x, y)
  return (bytes[index] >> offset) & mask
}

/** Returns a new array with the pixel set, or the same array if unchanged. */
export function setPixel(
  bytes: Uint8Array,
  shape: BitmapShape,
  mode: PixelMode,
  x: number,
  y: number,
  value: number,
): Uint8Array {
  checkCoords(shape, mode, x, y)
  checkValue(mode, value)
  const { index, offset, mask } = locate(shape, mode, x, y)
  const next = (bytes[index] & ~(mask << offset)) | (value << offset)
  if (next === bytes[index]) return bytes
  const out = bytes.slice()
  out[index] = next
  return out
}

/** All pixels row by row, in the mode's resolution. */
export function readPixels(
  bytes: Uint8Array,
  shape: BitmapShape,
  mode: PixelMode,
): Uint8Array {
  const w = pixelWidth(shape, mode)
  const out = new Uint8Array(w * shape.rows)
  for (let y = 0; y < shape.rows; y++) {
    for (let x = 0; x < w; x++)
      out[y * w + x] = getPixel(bytes, shape, mode, x, y)
  }
  return out
}

/** Inverse of readPixels. */
export function writePixels(
  pixels: ArrayLike<number>,
  shape: BitmapShape,
  mode: PixelMode,
): Uint8Array {
  const w = pixelWidth(shape, mode)
  if (pixels.length !== w * shape.rows) {
    throw new RangeError(
      `Expected ${w * shape.rows} pixels, got ${pixels.length}`,
    )
  }
  const bpp = bitsPerPixel(mode)
  const out = new Uint8Array(byteLength(shape))
  for (let y = 0; y < shape.rows; y++) {
    for (let x = 0; x < w; x++) {
      const v = pixels[y * w + x]
      checkValue(mode, v)
      const bit = x * bpp
      out[y * shape.bytesPerRow + (bit >> 3)] |= v << (8 - bpp - (bit & 7))
    }
  }
  return out
}

function mapPixels(
  bytes: Uint8Array,
  shape: BitmapShape,
  mode: PixelMode,
  source: (x: number, y: number, w: number) => [number, number],
): Uint8Array {
  const w = pixelWidth(shape, mode)
  const src = readPixels(bytes, shape, mode)
  const dst = new Uint8Array(src.length)
  for (let y = 0; y < shape.rows; y++) {
    for (let x = 0; x < w; x++) {
      const [sx, sy] = source(x, y, w)
      dst[y * w + x] = src[sy * w + sx]
    }
  }
  return writePixels(dst, shape, mode)
}

/** Mirror left-right. In multicolour, bit pairs move as a unit. */
export function flipHorizontal(
  bytes: Uint8Array,
  shape: BitmapShape,
  mode: PixelMode,
): Uint8Array {
  return mapPixels(bytes, shape, mode, (x, y, w) => [w - 1 - x, y])
}

export function flipVertical(
  bytes: Uint8Array,
  shape: BitmapShape,
  mode: PixelMode,
): Uint8Array {
  return mapPixels(bytes, shape, mode, (x, y) => [x, shape.rows - 1 - y])
}

/** Scroll with wrap-around by whole pixels of the mode. */
export function shift(
  bytes: Uint8Array,
  shape: BitmapShape,
  mode: PixelMode,
  dx: number,
  dy: number,
): Uint8Array {
  const wrap = (n: number, m: number) => ((n % m) + m) % m
  return mapPixels(bytes, shape, mode, (x, y, w) => [
    wrap(x - dx, w),
    wrap(y - dy, shape.rows),
  ])
}

/** Flip every bit (hires: swap 0/1; multicolour: 00↔11, 01↔10). */
export function invert(bytes: Uint8Array): Uint8Array {
  return bytes.map((b) => ~b & 0xff)
}

export function blank(shape: BitmapShape): Uint8Array {
  return new Uint8Array(byteLength(shape))
}
