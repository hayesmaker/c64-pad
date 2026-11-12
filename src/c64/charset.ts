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
 * Char attributes (CharPad's "materials"): a 0-15 value per char for game
 * logic (solid, ladder, hazard, …). 0 means none. Each charset can name the
 * values 1-15; `attributeNames[0]` is always ''.
 */
export const ATTRIBUTE_COUNT = 16
export const MAX_ATTRIBUTE_NAME = 24

/**
 * Text modes:
 * - hires: 8×8, 1bpp; per-char colour 0-15.
 * - multicolor: per-char colour bit 3 set (8-15) = multicolour char, drawn
 *   4×8 with 00 background ($D021), 01 MC1 ($D022), 10 MC2 ($D023),
 *   11 colour & 7. Bit 3 clear = hires char in colour 0-7.
 * - ecm: extended background colour; only 64 chars, the top two bits of the
 *   screen code pick one of four backgrounds ($D021-$D024).
 * - bitmap: multicolour bitmap. Each char is a 4×8 tile copied into an 8×8
 *   cell of the bitmap: 00 background ($D021), 01 screen RAM high nibble,
 *   10 screen RAM low nibble, 11 colour RAM. Those three colours belong to
 *   the cell; each char has its own (`screenColors`, `colors`), which a map
 *   can override per cell.
 */
export type CharsetMode = 'hires' | 'multicolor' | 'ecm' | 'bitmap'

export interface Charset {
  readonly id: string
  readonly name: string
  readonly notes: string
  readonly mode: CharsetMode
  /** 256 chars × 8 bytes. */
  readonly data: Uint8Array
  /** Colour RAM value per char (colouring is per char, not per map cell). */
  readonly colors: Uint8Array
  /**
   * Bitmap mode: screen RAM value per char, colour of 01 in the high nibble
   * and of 10 in the low one.
   */
  readonly screenColors: Uint8Array
  /** Attribute 0-15 per char (0 = none). */
  readonly attributes: Uint8Array
  /** Names of attributes 0-15 ('' = unnamed; 0 is always ''). */
  readonly attributeNames: ReadonlyArray<string>
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
    // Projects from before attributes (format 2) have none.
    attributes: init.attributes ?? new Uint8Array(CHARSET_SIZE),
    // Projects from before bitmap mode (format 3): the default MC colours.
    screenColors:
      init.screenColors ??
      new Uint8Array(CHARSET_SIZE).fill(
        ((init.multicolor1 ?? 11) << 4) | (init.multicolor2 ?? 12),
      ),
    attributeNames: normaliseNames(init.attributeNames),
  }
  if (charset.data.length !== CHARSET_BYTES) {
    throw new RangeError(`Charset data must be ${CHARSET_BYTES} bytes`)
  }
  if (charset.colors.length !== CHARSET_SIZE) {
    throw new RangeError(`Charset colours must have ${CHARSET_SIZE} entries`)
  }
  charset.colors.forEach((c) => assertC64Color(c, 'Char colour'))
  if (charset.attributes.length !== CHARSET_SIZE) {
    throw new RangeError(`Charset attributes must have ${CHARSET_SIZE} entries`)
  }
  charset.attributes.forEach((a) => assertAttribute(a))
  if (charset.screenColors.length !== CHARSET_SIZE) {
    throw new RangeError(
      `Charset screen colours must have ${CHARSET_SIZE} entries`,
    )
  }
  checkRegisters(charset)
  return charset
}

function normaliseNames(names: unknown): Array<string> {
  const list = Array.isArray(names) ? names : []
  return Array.from({ length: ATTRIBUTE_COUNT }, (_, v) =>
    v === 0
      ? ''
      : String(list[v] ?? '')
          .trim()
          .slice(0, MAX_ATTRIBUTE_NAME),
  )
}

function assertAttribute(value: number) {
  if (!Number.isInteger(value) || value < 0 || value >= ATTRIBUTE_COUNT) {
    throw new RangeError(`Char attribute ${value} outside 0-15`)
  }
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
  return (
    cs.mode === 'bitmap' || (cs.mode === 'multicolor' && cs.colors[index] >= 8)
  )
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

/** Bitmap mode: the char's two screen RAM colours (pixel values 01, 10). */
export function charScreenColors(
  cs: Charset,
  index: number,
): [C64Color, C64Color] {
  checkIndex(cs, index)
  const v = cs.screenColors[index]
  return [v >> 4, v & 15]
}

/** Set screen RAM colour 1 (01, high nibble) or 2 (10, low nibble). */
export function setCharScreenColor(
  cs: Charset,
  index: number,
  which: 1 | 2,
  color: C64Color,
): Charset {
  checkIndex(cs, index)
  assertC64Color(color, 'Screen colour')
  const old = cs.screenColors[index]
  const value = which === 1 ? (color << 4) | (old & 15) : (old & 0xf0) | color
  if (value === old) return cs
  const screenColors = cs.screenColors.slice()
  screenColors[index] = value
  return { ...cs, screenColors }
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

/** The char's attribute, 0-15 (0 = none). */
export function charAttribute(cs: Charset, index: number): number {
  checkIndex(cs, index)
  return cs.attributes[index]
}

export function setCharAttribute(
  cs: Charset,
  index: number,
  value: number,
): Charset {
  checkIndex(cs, index)
  assertAttribute(value)
  if (cs.attributes[index] === value) return cs
  const attributes = cs.attributes.slice()
  attributes[index] = value
  return { ...cs, attributes }
}

/** Name attribute 1-15 ('' clears the name). */
export function setAttributeName(
  cs: Charset,
  value: number,
  name: string,
): Charset {
  assertAttribute(value)
  if (value === 0) throw new ModelError('Attribute 0 means none')
  const attributeNames = cs.attributeNames.slice()
  attributeNames[value] = name.trim().slice(0, MAX_ATTRIBUTE_NAME)
  return { ...cs, attributeNames }
}

/** "None", the attribute's name, or its number in hex ("A") if unnamed. */
export function attributeLabel(cs: Charset, value: number): string {
  if (value === 0) return 'None'
  return cs.attributeNames[value] || value.toString(16).toUpperCase()
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
    // Multicolour chars into bitmap keep their look: 01 and 10 were the
    // shared multicolours.
    screenColors:
      mode === 'bitmap' && cs.mode === 'multicolor'
        ? new Uint8Array(CHARSET_SIZE).fill(
            (cs.multicolor1 << 4) | cs.multicolor2,
          )
        : cs.screenColors,
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

/** Copy char `from` (pixels, colours and attribute) onto char `to`. */
export function copyChar(cs: Charset, from: number, to: number): Charset {
  checkIndex(cs, to)
  const next = setCharBytes(cs, to, getCharBytes(cs, from))
  const colors = next.colors.slice()
  colors[to] = cs.colors[from]
  const screenColors = next.screenColors.slice()
  screenColors[to] = cs.screenColors[from]
  const attributes = next.attributes.slice()
  attributes[to] = cs.attributes[from]
  return { ...next, colors, screenColors, attributes }
}

/**
 * Swap two chars (pixels, colours and attributes). Maps referencing them are
 * not changed.
 */
export function swapChars(cs: Charset, a: number, b: number): Charset {
  const bytesA = getCharBytes(cs, a)
  const bytesB = getCharBytes(cs, b)
  const next = setCharBytes(setCharBytes(cs, a, bytesB), b, bytesA)
  const colors = cs.colors.slice()
  colors[a] = cs.colors[b]
  colors[b] = cs.colors[a]
  const screenColors = cs.screenColors.slice()
  screenColors[a] = cs.screenColors[b]
  screenColors[b] = cs.screenColors[a]
  const attributes = cs.attributes.slice()
  attributes[a] = cs.attributes[b]
  attributes[b] = cs.attributes[a]
  return { ...next, colors, screenColors, attributes }
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
  if (cs.mode === 'bitmap') {
    return [bg, ...charScreenColors(cs, index), charColor(cs, index)]
  }
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
  return renderCharIn(cs, index, charPixelColors(cs, index, ecmBackground))
}

/** The char drawn with the given colour per pixel value (a bitmap cell's). */
export function renderCharIn(
  cs: Charset,
  index: number,
  colors: ReadonlyArray<C64Color>,
): Uint8Array {
  const mode = charPixelMode(cs, index)
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
