import {
  charColor,
  isCharMulticolor,
  setCharColor,
  setCharsetRegisters,
} from '@/c64/charset'
import { PALETTE } from '@/c64/palette'
import type { Charset } from '@/c64/charset'
import type { C64Color } from '@/c64/palette'
import type { PenDef } from '../pens-panel'

/** Where a pen's colour lives: a VIC register or the char's colour RAM. */
export type CharSlot =
  | 'background'
  | 'multicolor1'
  | 'multicolor2'
  | 'char'
  | 'ecm1'
  | 'ecm2'
  | 'ecm3'

/** The four ECM backgrounds, $D021-$D024. */
export function ecmBackgroundColors(cs: Charset): Array<C64Color> {
  return [cs.background, ...cs.ecmBackgrounds]
}

export function ecmSlot(k: number): CharSlot {
  return k === 0 ? 'background' : (`ecm${k}` as CharSlot)
}

export function slotColor(cs: Charset, index: number, slot: CharSlot) {
  switch (slot) {
    case 'background':
      return cs.background
    case 'multicolor1':
      return cs.multicolor1
    case 'multicolor2':
      return cs.multicolor2
    case 'char':
      return charColor(cs, index)
    default:
      return cs.ecmBackgrounds[Number(slot.slice(3)) - 1]
  }
}

/** The pens for one char: what each pixel value means in the charset's mode. */
export function charPens(cs: Charset, index: number): Array<PenDef<CharSlot>> {
  const cc = charColor(cs, index)
  const own: PenDef<CharSlot> = {
    value: 1,
    code: '1',
    name: `Char colour · ${PALETTE[cc].name}`,
    sub:
      cs.mode === 'multicolor'
        ? 'Colour RAM, 0–7 (hires char)'
        : 'Colour RAM, per screen cell',
    color: cc,
    slot: 'char',
  }
  if (cs.mode === 'ecm') {
    const bgs = ecmBackgroundColors(cs).map((c) => PALETTE[c].hex)
    return [
      {
        value: 0,
        code: '0',
        name: 'Background',
        sub: 'One of 4, picked per screen cell',
        color: null,
        slot: null,
        swatch: `linear-gradient(90deg, ${bgs[0]} 25%, ${bgs[1]} 25% 50%, ${bgs[2]} 50% 75%, ${bgs[3]} 75%)`,
      },
      own,
    ]
  }
  const background: PenDef<CharSlot> = {
    value: 0,
    code: '0',
    name: `Background · ${PALETTE[cs.background].name}`,
    sub: '$D021 · whole screen',
    color: cs.background,
    slot: 'background',
  }
  if (!isCharMulticolor(cs, index)) return [background, own]
  return [
    { ...background, code: '00' },
    {
      value: 1,
      code: '01',
      name: `Multicolour 1 · ${PALETTE[cs.multicolor1].name}`,
      sub: '$D022 · whole screen',
      color: cs.multicolor1,
      slot: 'multicolor1',
    },
    {
      value: 2,
      code: '10',
      name: `Multicolour 2 · ${PALETTE[cs.multicolor2].name}`,
      sub: '$D023 · whole screen',
      color: cs.multicolor2,
      slot: 'multicolor2',
    },
    { ...own, value: 3, code: '11', sub: 'Colour RAM, 0–7' },
  ]
}

/** Set the colour behind a pen slot. */
export function setSlotColor(
  cs: Charset,
  index: number,
  slot: CharSlot,
  color: C64Color,
): Charset {
  switch (slot) {
    case 'char':
      return setCharColor(cs, index, color)
    case 'background':
    case 'multicolor1':
    case 'multicolor2':
      return setCharsetRegisters(cs, { [slot]: color })
    default: {
      const ecm: [C64Color, C64Color, C64Color] = [...cs.ecmBackgrounds]
      ecm[Number(slot.slice(3)) - 1] = color
      return setCharsetRegisters(cs, { ecmBackgrounds: ecm })
    }
  }
}
