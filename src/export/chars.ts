import { CHAR_BYTES, charCount } from '@/c64/charset'
import { renderCharmap } from '@/c64/render'
import { asmLabel } from './sprites'
import type { Charmap } from '@/c64/charmap'
import type { Charset } from '@/c64/charset'
import type { IndexedImage } from '@/c64/render'

/**
 * Exports for charsets and maps. Byte layouts are those a C64 program uses
 * directly: the charset as the VIC reads it, colour RAM values per screen code
 * (bit 3 = multicolour), the map one screen code per cell, row by row.
 */

const hex2 = (n: number) => '$' + n.toString(16).padStart(2, '0')

/** VIC register values for the charset's mode ($D021-$D024). */
export function charsetRegisters(cs: Charset): {
  d021: number
  d022: number
  d023: number
  d024: number
} {
  if (cs.mode === 'ecm') {
    const [b1, b2, b3] = cs.ecmBackgrounds
    return { d021: cs.background, d022: b1, d023: b2, d024: b3 }
  }
  return {
    d021: cs.background,
    d022: cs.multicolor1,
    d023: cs.multicolor2,
    d024: 0,
  }
}

/**
 * The charset as the VIC reads it: 8 bytes per char, 256 chars (2048 bytes);
 * in ECM only the 64 shapes the VIC can show (512 bytes).
 */
export function exportCharsetBin(cs: Charset): Uint8Array {
  return cs.data.slice(0, charCount(cs.mode) * CHAR_BYTES)
}

/**
 * Colour RAM value for each screen code 0-255 (a lookup table for drawing a
 * map): the char's colour, with bit 3 set for multicolour chars. In ECM a
 * code uses the colour of its shape (code & 63).
 */
export function exportCharColors(cs: Charset): Uint8Array {
  const out = new Uint8Array(256)
  for (let code = 0; code < 256; code++) {
    out[code] = cs.colors[cs.mode === 'ecm' ? code & 63 : code] & 0x0f
  }
  return out
}

/**
 * Attribute (0-15) for each screen code 0-255, as a lookup table like the
 * colours; in ECM a code uses the attribute of its shape (code & 63).
 */
export function exportCharAttributes(cs: Charset): Uint8Array {
  const out = new Uint8Array(256)
  for (let code = 0; code < 256; code++) {
    out[code] = cs.attributes[cs.mode === 'ecm' ? code & 63 : code] & 0x0f
  }
  return out
}

/** Whether any usable char has an attribute or any attribute is named. */
export function hasAttributes(cs: Charset): boolean {
  return (
    cs.attributes.subarray(0, charCount(cs.mode)).some((a) => a !== 0) ||
    cs.attributeNames.some(Boolean)
  )
}

/** Attribute per map cell, one byte each, row by row like the map. */
export function exportMapAttributes(map: Charmap, cs: Charset): Uint8Array {
  const table = exportCharAttributes(cs)
  return map.cells.map((code) => table[code])
}

/** `.label`s for the named attributes (`<prefix>_attr_<name> = n`). */
function attributeLabels(cs: Charset, prefix: string): Array<string> {
  const taken = new Set<string>()
  const lines: Array<string> = []
  cs.attributeNames.forEach((name, v) => {
    if (v === 0 || !name) return
    let label = `${prefix}_attr_${asmLabel(name, String(v)).replace(/^_/, '')}`
    if (taken.has(label)) label = `${label}_${v}`
    taken.add(label)
    lines.push(`.label ${label} = ${v}  // ${name.replace(/[\r\n]/g, ' ')}`)
  })
  return lines
}

/** Screen codes, one byte per cell, left to right then top to bottom. */
export function exportMapBin(map: Charmap): Uint8Array {
  return map.cells.slice()
}

/** Colour RAM for every map cell (what goes to $D800 for a screen). */
export function exportMapColors(map: Charmap, cs: Charset): Uint8Array {
  const table = exportCharColors(cs)
  return map.cells.map((code) => table[code])
}

function byteLines(
  bytes: Uint8Array,
  perLine: number,
  comment?: (line: number) => string,
): Array<string> {
  const lines: Array<string> = []
  for (let i = 0; i < bytes.length; i += perLine) {
    const values = [...bytes.subarray(i, i + perLine)].map(hex2).join(',')
    const text = comment?.(i / perLine)
    const note = text ? `  // ${text}` : ''
    lines.push(`    .byte ${values}${note}`)
  }
  return lines
}

const MODE_NAME = {
  hires: 'hires',
  multicolor: 'multicolour',
  ecm: 'ECM (extended background colour)',
} as const

function charsetSource(cs: Charset, prefix: string): Array<string> {
  const r = charsetRegisters(cs)
  const lines = [
    `// Charset "${cs.name}", ${MODE_NAME[cs.mode]}`,
    `.label ${prefix}_d021 = ${r.d021}  // background`,
  ]
  if (cs.mode === 'multicolor') {
    lines.push(
      `.label ${prefix}_d022 = ${r.d022}  // multicolour 1`,
      `.label ${prefix}_d023 = ${r.d023}  // multicolour 2`,
    )
  }
  if (cs.mode === 'ecm') {
    lines.push(
      `.label ${prefix}_d022 = ${r.d022}  // ECM background 1`,
      `.label ${prefix}_d023 = ${r.d023}  // ECM background 2`,
      `.label ${prefix}_d024 = ${r.d024}  // ECM background 3`,
    )
  }
  const data = exportCharsetBin(cs)
  lines.push(
    '',
    `// ${data.length} bytes; the VIC needs it on a $800 boundary`,
    '.align $800',
    `${prefix}_chars:`,
    ...byteLines(data, CHAR_BYTES, (i) => `char ${hex2(i)}`),
    '',
    `// Colour RAM value per screen code${cs.mode === 'multicolor' ? ' (8-15 = multicolour char)' : ''}`,
    `${prefix}_colours:`,
    ...byteLines(exportCharColors(cs), 16, (i) => `${hex2(i * 16)}-`),
  )
  if (hasAttributes(cs)) {
    lines.push(
      '',
      '// Attribute (0-15, 0 = none) per screen code',
      ...attributeLabels(cs, prefix),
      `${prefix}_attributes:`,
      ...byteLines(exportCharAttributes(cs), 16, (i) => `${hex2(i * 16)}-`),
    )
  }
  return lines
}

/** KickAssembler source: register values, the charset and its colours. */
export function exportCharsetKickAss(
  cs: Charset,
  { projectName }: { projectName: string },
): string {
  const prefix = asmLabel(cs.name, 'charset')
  return [
    `// ${projectName} · made with C64-Pad`,
    ...charsetSource(cs, prefix),
    '',
  ].join('\n')
}

/**
 * KickAssembler source for a map: its size, the screen codes row by row,
 * optionally colour RAM per cell and the charset.
 */
export function exportMapKickAss(
  map: Charmap,
  cs: Charset,
  {
    projectName,
    colours = true,
    attributes = false,
    charset = true,
  }: {
    projectName: string
    colours?: boolean
    /** Attribute per cell (from each char's attribute). */
    attributes?: boolean
    charset?: boolean
  },
): string {
  const prefix = asmLabel(map.name, 'map')
  const perLine = Math.min(map.width, 40)
  const rowNote = (line: number) => {
    const linesPerRow = Math.ceil(map.width / perLine)
    const row = Math.floor(line / linesPerRow)
    return linesPerRow === 1 || line % linesPerRow === 0 ? `row ${row}` : ''
  }
  const lines = [
    `// ${projectName} · made with C64-Pad`,
    `// Map "${map.name}", ${map.width} x ${map.height} chars, one screen code per cell`,
    `.label ${prefix}_width = ${map.width}`,
    `.label ${prefix}_height = ${map.height}`,
    '',
    `${prefix}_data:`,
    ...byteLines(map.cells, perLine, rowNote),
  ]
  if (colours) {
    lines.push(
      '',
      '// Colour RAM per cell (copy a screen of it to $D800)',
      `${prefix}_colours:`,
      ...byteLines(exportMapColors(map, cs), perLine, rowNote),
    )
  }
  if (attributes) {
    lines.push(
      '',
      '// Attribute (0-15, 0 = none) per cell',
      `${prefix}_attributes:`,
      ...byteLines(exportMapAttributes(map, cs), perLine, rowNote),
    )
  }
  if (charset)
    lines.push('', ...charsetSource(cs, asmLabel(cs.name, 'charset')))
  lines.push('')
  return lines.join('\n')
}

/**
 * A CharPad project (.ctm version 7, as CharPad Free 2.86 saves and every
 * later CharPad reads): the charset with a colour per char, no tiles, and the
 * map as char numbers. Layout from batchpad's docs/charpad.md.
 */
export function exportCharpadCtm(
  map: Charmap,
  cs: Charset,
): { bytes: Uint8Array; warnings: Array<string> } {
  const warnings: Array<string> = []
  const r = charsetRegisters(cs)
  const displayMode = { hires: 0, multicolor: 1, ecm: 2 }[cs.mode]
  if (cs.mode === 'ecm') {
    warnings.push(
      'ECM needs CharPad 2.8 or later (Free 2.86 opens ECM as hires).',
    )
  }
  const colours = exportCharColors(cs)
  const attributes = exportCharAttributes(cs)
  const header = [
    ...[0x43, 0x54, 0x4d], // "CTM"
    7,
    r.d021,
    r.d022,
    r.d023,
    r.d024,
    1, // char colour when colouring per project (unused: per char)
    2, // colouring method: per char
    displayMode,
    0, // flags: tile system off
  ]
  const blocks: Array<Array<number>> = []
  const block = (data: Array<number>) =>
    blocks.push([0xda, 0xb0 | blocks.length, ...data])
  // Chars: count - 1 (word), then 8 bytes each. All 256, as CharPad keeps them.
  block([0xff, 0x00, ...cs.data])
  // Attribute per char: material (high nibble) and colour (low nibble).
  block([...colours].map((c, i) => (attributes[i] << 4) | c))
  // Map: width, height (words), then a word per cell.
  const cells: Array<number> = []
  for (const code of map.cells) cells.push(code, 0)
  block([
    map.width & 0xff,
    map.width >> 8,
    map.height & 0xff,
    map.height >> 8,
    ...cells,
  ])
  const total = header.length + blocks.reduce((n, b) => n + b.length, 0)
  const bytes = new Uint8Array(total)
  bytes.set(header)
  let at = header.length
  for (const b of blocks) {
    bytes.set(b, at)
    at += b.length
  }
  return { bytes, warnings }
}

/** The whole map as an image (8 × 8 px per cell). */
export function renderMapImage(map: Charmap, cs: Charset): IndexedImage {
  return renderCharmap(map, cs, {
    x: 0,
    y: 0,
    width: map.width,
    height: map.height,
  })
}
