/** C64 colour index, 0-15. */
export type C64Color = number

export interface PaletteEntry {
  index: C64Color
  name: string
  hex: string
}

/** Colodore palette (Pepto, 2017). */
export const PALETTE: ReadonlyArray<PaletteEntry> = [
  { index: 0, name: 'Black', hex: '#000000' },
  { index: 1, name: 'White', hex: '#ffffff' },
  { index: 2, name: 'Red', hex: '#813338' },
  { index: 3, name: 'Cyan', hex: '#75cec8' },
  { index: 4, name: 'Purple', hex: '#8e3c97' },
  { index: 5, name: 'Green', hex: '#56ac4d' },
  { index: 6, name: 'Blue', hex: '#2e2c9b' },
  { index: 7, name: 'Yellow', hex: '#edf171' },
  { index: 8, name: 'Orange', hex: '#8e5029' },
  { index: 9, name: 'Brown', hex: '#553800' },
  { index: 10, name: 'Light Red', hex: '#c46c71' },
  { index: 11, name: 'Dark Grey', hex: '#4a4a4a' },
  { index: 12, name: 'Grey', hex: '#7b7b7b' },
  { index: 13, name: 'Light Green', hex: '#a9ff9f' },
  { index: 14, name: 'Light Blue', hex: '#706deb' },
  { index: 15, name: 'Light Grey', hex: '#b2b2b2' },
]

export function isC64Color(value: number): value is C64Color {
  return Number.isInteger(value) && value >= 0 && value <= 15
}

export function colorHex(color: C64Color): string {
  if (!isC64Color(color)) throw new RangeError(`Not a C64 colour: ${color}`)
  return PALETTE[color].hex
}
