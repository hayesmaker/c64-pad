import {
  CHAR_SHAPE,
  byteLength,
  flipHorizontal,
  flipVertical,
  getPixel,
  invert,
  readPixels,
  setPixel,
  shift,
} from './bitmap'
import { base64ToBytes } from '@/storage/bytes'
import { ModelError } from './errors'
import { chargenRom } from './rom/chargen.gen'
import { newId } from './ids'
import { assertC64Color } from './palette'
import type { PixelMode } from './bitmap'
import type { C64Color } from './palette'

export const CHAR_BYTES = byteLength(CHAR_SHAPE) // 8
export const CHARSET_SIZE = 256
export const CHARSET_BYTES = CHAR_BYTES * CHARSET_SIZE // 2048

/**
 * Text modes:
 * - hires: 8×8, 1bpp; per-char colour 0-15.
 * - multicolor: per-char colour bit 3 set (8-15) = multicolour char, drawn
 *   4×8 with 00 background ($D021), 01 MC1 ($D022), 10 MC2 ($D023),
 *   11 colour & 7. Bit 3 clear = hires char in colour 0-7.
 * - ecm: extended background colour; only 64 chars, the top two bits of the
 *   screen code pick one of four backgrounds ($D021-$D024).
 */
export type CharsetMode = 'hires' | 'multicolor' | 'ecm'

export interface Charset {
  readonly id: string
  readonly name: string
  readonly notes: string
  readonly mode: CharsetMode
  /** 256 chars × 8 bytes. */
  readonly data: Uint8Array
  /** Colour RAM value per char (colouring is per char, not per map cell). */
  readonly colors: Uint8Array
  readonly background: C64Color
  readonly multicolor1: C64Color
  readonly multicolor2: C64Color
  /** ECM backgrounds 1-3 ($D022-$D024); background 0 is `background`. */
  readonly ecmBackgrounds: readonly [C64Color, C64Color, C64Color]
}

export function createCharset(init: Partial<Charset> = {}): Charset {
  const charset: Charset = {
    id: newId(),
    name: 'Charset',
    notes: '',
    mode: 'hires',
    data: new Uint8Array(CHARSET_BYTES),
    colors: new Uint8Array(CHARSET_SIZE).fill(14), // light blue, the C64 default text colour
    background: 6, // blue
    multicolor1: 11,
    multicolor2: 12,
    ecmBackgrounds: [2, 5, 7],
    ...init,
  }
  if (charset.data.length !== CHARSET_BYTES) {
    throw new RangeError(`Charset data must be ${CHARSET_BYTES} bytes`)
  }
  if (charset.colors.length !== CHARSET_SIZE) {
    throw new RangeError(`Charset colours must have ${CHARSET_SIZE} entries`)
  }
  charset.colors.forEach((c) => assertC64Color(c, 'Char colour'))
  checkRegisters(charset)
  return charset
}

function checkRegisters(cs: Charset) {
  assertC64Color(cs.background, 'Background')
  assertC64Color(cs.multicolor1, 'Multicolour 1')
  assertC64Color(cs.multicolor2, 'Multicolour 2')
  cs.ecmBackgrounds.forEach((c) => assertC64Color(c, 'ECM background'))
}

/** Usable characters in the mode: 64 in ECM, otherwise 256. */
export function charCount(mode: CharsetMode): number {
  return mode === 'ecm' ? 64 : CHARSET_SIZE
}

function checkIndex(cs: Charset, index: number) {
  const n = charCount(cs.mode)
  if (!Number.isInteger(index) || index < 0 || index >= n) {
    throw new RangeError(`Char ${index} outside 0-${n - 1} (${cs.mode})`)
  }
}

export function isCharMulticolor(cs: Charset, index: number): boolean {
  checkIndex(cs, index)
  return cs.mode === 'multicolor' && cs.colors[index] >= 8
}

/** How this char's pixels are read. */
export function charPixelMode(cs: Charset, index: number): PixelMode {
  return isCharMulticolor(cs, index) ? 'multicolor' : 'hires'
}

/** The colour the char is drawn in (in multicolour mode, without the MC flag). */
export function charColor(cs: Charset, index: number): C64Color {
  checkIndex(cs, index)
  return cs.mode === 'multicolor' ? cs.colors[index] & 7 : cs.colors[index]
}

/**
 * Set a char's colour. In multicolour mode only 0-7 can be shown (bit 3 is the
 * multicolour flag), so 8-15 is rejected and the char's flag is kept.
 */
export function setCharColor(
  cs: Charset,
  index: number,
  color: C64Color,
): Charset {
  checkIndex(cs, index)
  assertC64Color(color, 'Char colour')
  let value = color
  if (cs.mode === 'multicolor') {
    if (color > 7) {
      throw new ModelError('In multicolour mode chars can only use colours 0-7')
    }
    value = (cs.colors[index] & 8) | color
  }
  const colors = cs.colors.slice()
  colors[index] = value
  return { ...cs, colors }
}

/** Turn a char's multicolour flag on or off (multicolour mode only). */
export function setCharMulticolor(
  cs: Charset,
  index: number,
  on: boolean,
): Charset {
  checkIndex(cs, index)
  if (cs.mode !== 'multicolor') {
    throw new ModelError('Chars can only be multicolour in multicolour mode')
  }
  const colors = cs.colors.slice()
  colors[index] = (cs.colors[index] & 7) | (on ? 8 : 0)
  return { ...cs, colors }
}

/**
 * Change mode, keeping pixel data. Colours are reduced to 0-7 when entering or
 * leaving multicolour mode, so every char starts (or ends up) as a hires char.
 * A colour that would then match the background (light blue on blue, the C64
 * default) becomes white, or black on a white background, so chars stay visible.
 */
export function setCharsetMode(cs: Charset, mode: CharsetMode): Charset {
  if (cs.mode === mode) return cs
  const touchesMc = mode === 'multicolor' || cs.mode === 'multicolor'
  const visible = (c: number) => {
    const low = c & 7
    if (low !== cs.background) return low
    return cs.background === 1 ? 0 : 1
  }
  return {
    ...cs,
    mode,
    colors: touchesMc ? cs.colors.map(visible) : cs.colors,
  }
}

export function setCharsetRegisters(
  cs: Charset,
  registers: Partial<
    Pick<
      Charset,
      'background' | 'multicolor1' | 'multicolor2' | 'ecmBackgrounds'
    >
  >,
): Charset {
  const next = { ...cs, ...registers }
  checkRegisters(next)
  return next
}

export function getCharBytes(cs: Charset, index: number): Uint8Array {
  checkIndex(cs, index)
  return cs.data.slice(index * CHAR_BYTES, (index + 1) * CHAR_BYTES)
}

/** Replace one char's 8 bytes. */
export function setCharBytes(
  cs: Charset,
  index: number,
  bytes: Uint8Array,
): Charset {
  checkIndex(cs, index)
  if (bytes.length !== CHAR_BYTES) throw new RangeError('A char is 8 bytes')
  const data = cs.data.slice()
  data.set(bytes, index * CHAR_BYTES)
  return { ...cs, data }
}

export function getCharPixel(
  cs: Charset,
  index: number,
  x: number,
  y: number,
): number {
  return getPixel(
    getCharBytes(cs, index),
    CHAR_SHAPE,
    charPixelMode(cs, index),
    x,
    y,
  )
}

export function setCharPixel(
  cs: Charset,
  index: number,
  x: number,
  y: number,
  value: number,
): Charset {
  const bytes = getCharBytes(cs, index)
  const next = setPixel(
    bytes,
    CHAR_SHAPE,
    charPixelMode(cs, index),
    x,
    y,
    value,
  )
  return next === bytes ? cs : setCharBytes(cs, index, next)
}

function transformChar(
  cs: Charset,
  index: number,
  fn: (bytes: Uint8Array, mode: PixelMode) => Uint8Array,
): Charset {
  return setCharBytes(
    cs,
    index,
    fn(getCharBytes(cs, index), charPixelMode(cs, index)),
  )
}

export const flipCharHorizontal = (cs: Charset, i: number) =>
  transformChar(cs, i, (b, m) => flipHorizontal(b, CHAR_SHAPE, m))
export const flipCharVertical = (cs: Charset, i: number) =>
  transformChar(cs, i, (b, m) => flipVertical(b, CHAR_SHAPE, m))
export const shiftChar = (cs: Charset, i: number, dx: number, dy: number) =>
  transformChar(cs, i, (b, m) => shift(b, CHAR_SHAPE, m, dx, dy))
export const invertChar = (cs: Charset, i: number) =>
  transformChar(cs, i, invert)
export const clearChar = (cs: Charset, i: number) =>
  setCharBytes(cs, i, new Uint8Array(CHAR_BYTES))

/** Rotate 90° clockwise (hires chars only; multicolour pixels aren't square). */
export function rotateCharClockwise(cs: Charset, index: number): Charset {
  if (charPixelMode(cs, index) !== 'hires') {
    throw new ModelError('Only hires chars can be rotated')
  }
  const src = getCharBytes(cs, index)
  const out = new Uint8Array(CHAR_BYTES)
  for (let y = 0; y < 8; y++) {
    for (let x = 0; x < 8; x++) {
      // new(x, y) = old(y, 7 - x)
      if (getPixel(src, CHAR_SHAPE, 'hires', y, 7 - x)) out[y] |= 0x80 >> x
    }
  }
  return setCharBytes(cs, index, out)
}

/** Copy char `from` (pixels and colour) onto char `to`. */
export function copyChar(cs: Charset, from: number, to: number): Charset {
  checkIndex(cs, to)
  const next = setCharBytes(cs, to, getCharBytes(cs, from))
  const colors = next.colors.slice()
  colors[to] = cs.colors[from]
  return { ...next, colors }
}

/** Swap two chars (pixels and colours). Maps referencing them are not changed. */
export function swapChars(cs: Charset, a: number, b: number): Charset {
  const bytesA = getCharBytes(cs, a)
  const bytesB = getCharBytes(cs, b)
  const next = setCharBytes(setCharBytes(cs, a, bytesB), b, bytesA)
  const colors = cs.colors.slice()
  colors[a] = cs.colors[b]
  colors[b] = cs.colors[a]
  return { ...next, colors }
}

/** C64 colour for each pixel value of the char; `ecmBackground` 0-3 in ECM. */
export function charPixelColors(
  cs: Charset,
  index: number,
  ecmBackground = 0,
): Array<C64Color> {
  const bg =
    cs.mode === 'ecm' && ecmBackground > 0
      ? cs.ecmBackgrounds[ecmBackground - 1]
      : cs.background
  if (isCharMulticolor(cs, index)) {
    return [bg, cs.multicolor1, cs.multicolor2, charColor(cs, index)]
  }
  return [bg, charColor(cs, index)]
}

/** Colour indices at hires resolution (8×8 row-major). */
export function renderChar(
  cs: Charset,
  index: number,
  ecmBackground = 0,
): Uint8Array {
  const mode = charPixelMode(cs, index)
  const colors = charPixelColors(cs, index, ecmBackground)
  const pixels = readPixels(getCharBytes(cs, index), CHAR_SHAPE, mode)
  const scale = mode === 'multicolor' ? 2 : 1
  const out = new Uint8Array(64)
  for (let y = 0; y < 8; y++) {
    for (let x = 0; x < 8; x++) {
      out[y * 8 + x] = colors[pixels[y * (8 / scale) + Math.floor(x / scale)]]
    }
  }
  return out
}

export type PetsciiSet = 'upper' | 'lower'

/**
 * Pixels for a PETSCII starter: one of the two sets in the C64 character ROM
 * (upper case / graphics, or lower / upper case), as 2048 bytes.
 */
export function petsciiData(set: PetsciiSet): Uint8Array {
  const rom = base64ToBytes(chargenRom)
  const start = set === 'upper' ? 0 : CHARSET_BYTES
  return rom.slice(start, start + CHARSET_BYTES)
}
