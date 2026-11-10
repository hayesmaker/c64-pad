import { describe, expect, it } from 'vitest'
import { createCharmap, setCell } from '@/c64/charmap'
import {
  createCharset,
  setAttributeName,
  setCharAttribute,
  setCharBytes,
  setCharMulticolor,
  setCharsetMode,
  setCharsetRegisters,
} from '@/c64/charset'
import {
  exportCharAttributes,
  exportCharColors,
  exportCharpadCtm,
  exportCharsetBin,
  exportCharsetKickAss,
  exportMapAttributes,
  exportMapBin,
  exportMapColors,
  exportMapKickAss,
  renderMapImage,
} from './chars'

const sample = () => {
  let cs = createCharset({ name: 'Level tiles' })
  cs = setCharBytes(cs, 1, Uint8Array.of(1, 2, 3, 4, 5, 6, 7, 8))
  cs = setCharsetMode(cs, 'multicolor')
  cs = setCharMulticolor(cs, 1, true)
  cs = setCharsetRegisters(cs, {
    background: 0,
    multicolor1: 9,
    multicolor2: 11,
  })
  let map = createCharmap({
    charsetId: cs.id,
    name: 'Level 1',
    width: 3,
    height: 2,
  })
  map = setCell(map, 1, 0, 1)
  map = setCell(map, 2, 1, 1)
  return { cs, map }
}

describe('charset and map binaries', () => {
  it('writes the charset as the VIC reads it (512 bytes in ECM)', () => {
    const { cs } = sample()
    const bin = exportCharsetBin(cs)
    expect(bin).toHaveLength(2048)
    expect([...bin.subarray(8, 16)]).toEqual([1, 2, 3, 4, 5, 6, 7, 8])
    expect(exportCharsetBin(setCharsetMode(cs, 'ecm'))).toHaveLength(512)
  })

  it('gives colour RAM per screen code, with the multicolour bit', () => {
    const { cs } = sample()
    const colours = exportCharColors(cs)
    expect(colours).toHaveLength(256)
    expect(colours[1] & 8).toBe(8)
    expect(colours[0] & 8).toBe(0)
    const ecm = setCharsetMode(createCharset(), 'ecm')
    // Codes share their shape's colour across the four backgrounds.
    expect(exportCharColors(ecm)[0x41]).toBe(exportCharColors(ecm)[0x01])
  })

  it('writes map cells and their colour RAM row by row', () => {
    const { cs, map } = sample()
    expect([...exportMapBin(map)]).toEqual([0, 1, 0, 0, 0, 1])
    const colours = exportMapColors(map, cs)
    expect(colours[1]).toBe(exportCharColors(cs)[1])
    expect(renderMapImage(map, cs)).toMatchObject({ width: 24, height: 16 })
  })
})

describe('KickAssembler source', () => {
  it('labels registers, chars and colours', () => {
    const { cs } = sample()
    const asm = exportCharsetKickAss(cs, { projectName: 'RI' })
    expect(asm).toContain('.label level_tiles_d022 = 9')
    expect(asm).toContain('.align $800')
    expect(asm).toContain('.byte $01,$02,$03,$04,$05,$06,$07,$08  // char $01')
  })

  it('writes the map with size labels, colours and the charset', () => {
    const { cs, map } = sample()
    const asm = exportMapKickAss(map, cs, { projectName: 'RI' })
    expect(asm).toContain('.label level_1_width = 3')
    expect(asm).toContain('.byte $00,$01,$00  // row 0')
    expect(asm).toContain('level_1_colours:')
    expect(asm).toContain('level_tiles_chars:')
    const bare = exportMapKickAss(map, cs, {
      projectName: 'RI',
      colours: false,
      charset: false,
    })
    expect(bare).not.toContain('_colours:')
    expect(bare).not.toContain('_chars:')
  })
})

describe('CharPad .ctm (version 7)', () => {
  it('writes the header, chars, attributes and a word map in marked blocks', () => {
    const { cs, map } = sample()
    const { bytes, warnings } = exportCharpadCtm(map, cs)
    expect(warnings).toEqual([])
    expect([...bytes.subarray(0, 4)]).toEqual([0x43, 0x54, 0x4d, 7])
    // $d021-$d024, char colour, per-char colouring, multicolour text, no tiles
    expect([...bytes.subarray(4, 12)]).toEqual([0, 9, 11, 0, 1, 2, 1, 0])
    let at = 12
    expect([...bytes.subarray(at, at + 4)]).toEqual([0xda, 0xb0, 0xff, 0x00])
    at += 4 + 2048
    expect([bytes[at], bytes[at + 1]]).toEqual([0xda, 0xb1])
    expect(bytes[at + 2 + 1]).toBe(exportCharColors(cs)[1])
    at += 2 + 256
    expect([...bytes.subarray(at, at + 6)]).toEqual([0xda, 0xb2, 3, 0, 2, 0])
    at += 6
    // Cells as words: 0, 1, 0 / 0, 0, 1
    expect([...bytes.subarray(at, at + 12)]).toEqual([
      0, 0, 1, 0, 0, 0, 0, 0, 0, 0, 1, 0,
    ])
    expect(bytes.length).toBe(at + 12)
  })

  it('warns that ECM needs CharPad 2.8', () => {
    const { cs, map } = sample()
    expect(
      exportCharpadCtm(map, setCharsetMode(cs, 'ecm')).warnings,
    ).toHaveLength(1)
  })
})

describe('char attributes', () => {
  const tagged = () => {
    const { cs, map } = sample()
    let next = setCharAttribute(cs, 1, 2)
    next = setAttributeName(next, 2, 'Solid wall')
    next = setAttributeName(next, 3, 'Solid wall')
    return { cs: next, map }
  }

  it('gives an attribute per screen code and per map cell', () => {
    const { cs, map } = tagged()
    const table = exportCharAttributes(cs)
    expect(table).toHaveLength(256)
    expect([table[0], table[1]]).toEqual([0, 2])
    expect([...exportMapAttributes(map, cs)]).toEqual([0, 2, 0, 0, 0, 2])
    // ECM: codes 64 and up share their shape's attribute.
    const ecm = setCharAttribute(createCharset({ mode: 'ecm' }), 1, 5)
    expect(exportCharAttributes(ecm)[64 + 1]).toBe(5)
  })

  it('adds attribute labels and a table to KickAss source only when used', () => {
    const { cs } = sample()
    expect(exportCharsetKickAss(cs, { projectName: 'P' })).not.toContain(
      '_attributes',
    )
    const asm = exportCharsetKickAss(tagged().cs, { projectName: 'P' })
    expect(asm).toContain(
      '.label level_tiles_attr_solid_wall = 2  // Solid wall',
    )
    // Same name twice: the second label gets its number.
    expect(asm).toContain('.label level_tiles_attr_solid_wall_3 = 3')
    expect(asm).toContain('level_tiles_attributes:')
    expect(asm).toContain('    .byte $00,$02,$00')
  })

  it('writes attributes per map cell in KickAss when asked', () => {
    const { cs, map } = tagged()
    const opts = { projectName: 'P', charset: false }
    expect(exportMapKickAss(map, cs, opts)).not.toContain('level_1_attributes')
    const asm = exportMapKickAss(map, cs, { ...opts, attributes: true })
    expect(asm).toContain(
      'level_1_attributes:\n    .byte $00,$02,$00  // row 0',
    )
  })

  it('puts the attribute in the high nibble of the .ctm char attribute', () => {
    const { cs, map } = tagged()
    const { bytes } = exportCharpadCtm(map, cs)
    const at = 12 + 4 + 2048 + 2
    expect(bytes[at + 1]).toBe((2 << 4) | exportCharColors(cs)[1])
    expect(bytes[at]).toBe(exportCharColors(cs)[0])
  })
})
