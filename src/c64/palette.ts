/** C64 colour index, 0-15. */
export type C64Color = number

/** The 16 colour names, by index. Fixed; palettes only change the RGB. */
export const COLOR_NAMES: ReadonlyArray<string> = [
  'Black',
  'White',
  'Red',
  'Cyan',
  'Purple',
  'Green',
  'Blue',
  'Yellow',
  'Orange',
  'Brown',
  'Light Red',
  'Dark Grey',
  'Grey',
  'Light Green',
  'Light Blue',
  'Light Grey',
]

export type PaletteId =
  'colodore' | 'pepto' | 'vice' | 'ccs64' | 'frodo' | 'c64hq' | 'community'

export interface Palette {
  readonly id: PaletteId
  readonly name: string
  /** Where the values come from. */
  readonly source: string
  /** 16 × '#rrggbb', by colour index. */
  readonly hex: ReadonlyArray<string>
}

/**
 * How a project's colours are shown. Projects store colour indices, so the
 * palette never changes data or exports, only what is drawn.
 */
export const PALETTES: Readonly<Record<PaletteId, Palette>> = {
  colodore: {
    id: 'colodore',
    name: 'Colodore',
    source: 'colodore.com default settings (Pepto, 2017)',
    // prettier-ignore
    hex: ['#000000', '#ffffff', '#813338', '#75cec8', '#8e3c97', '#56ac4d', '#2e2c9b', '#edf171',
          '#8e5029', '#553800', '#c46c71', '#4a4a4a', '#7b7b7b', '#a9ff9f', '#706deb', '#b2b2b2'],
  },
  pepto: {
    id: 'pepto',
    name: 'Pepto',
    source: 'pepto.de colorvic (2001); Aseprite’s Commodore 64 palette',
    // prettier-ignore
    hex: ['#000000', '#ffffff', '#883932', '#67b6bd', '#8b3f96', '#55a049', '#40318d', '#bfce72',
          '#8b5429', '#574200', '#b86962', '#505050', '#787878', '#94e089', '#7869c4', '#9f9f9f'],
  },
  vice: {
    id: 'vice',
    name: 'VICE',
    source: 'VICE 3.7 vice.vpl',
    // prettier-ignore
    hex: ['#000000', '#fdfefc', '#be1a24', '#30e6c6', '#b41ae2', '#1fd21e', '#211bae', '#dff60a',
          '#b84104', '#6a3304', '#fe4a57', '#424540', '#70746f', '#59fe59', '#5f53fe', '#a4a7a2'],
  },
  ccs64: {
    id: 'ccs64',
    name: 'CCS64',
    source: 'VICE 3.7 ccs64.vpl',
    // prettier-ignore
    hex: ['#101010', '#ffffff', '#e04040', '#60ffff', '#e060e0', '#40e040', '#4040e0', '#ffff40',
          '#e0a040', '#9c7448', '#ffa0a0', '#545454', '#888888', '#a0ffa0', '#a0a0ff', '#c0c0c0'],
  },
  frodo: {
    id: 'frodo',
    name: 'Frodo',
    source: 'VICE 3.7 frodo.vpl',
    // prettier-ignore
    hex: ['#000000', '#ffffff', '#cc0000', '#00ffcc', '#ff00ff', '#00cc00', '#0000cc', '#ffff00',
          '#ff8800', '#884400', '#ff8888', '#444444', '#888888', '#88ff88', '#8888ff', '#cccccc'],
  },
  c64hq: {
    id: 'c64hq',
    name: 'C64HQ',
    source: 'VICE 3.7 c64hq.vpl',
    // prettier-ignore
    hex: ['#0a0a0a', '#fff8ff', '#851f02', '#65cda8', '#a73b9f', '#4dab19', '#1a0c92', '#ebe353',
          '#a94b02', '#441e00', '#d28074', '#464646', '#8b8b8b', '#8ef68e', '#4d91d1', '#bababa'],
  },
  community: {
    id: 'community',
    name: 'Community Colors',
    source: 'C64 Community Colors v1.2a (p1x3l.net), via VICE 3.7',
    // prettier-ignore
    hex: ['#000000', '#ffffff', '#af2a29', '#62d8cc', '#b03fb6', '#4ac64a', '#3739c4', '#e4ed4e',
          '#b6591c', '#683808', '#ea746c', '#4d4d4d', '#848484', '#a6fa9e', '#707ce6', '#b6b6b5'],
  },
}

export const PALETTE_IDS = Object.keys(PALETTES) as ReadonlyArray<PaletteId>

/** New projects (and projects saved before palettes existed) use this. */
export const DEFAULT_PALETTE_ID: PaletteId = 'colodore'

export function isPaletteId(value: unknown): value is PaletteId {
  return typeof value === 'string' && Object.hasOwn(PALETTES, value)
}

export function isC64Color(value: number): value is C64Color {
  return Number.isInteger(value) && value >= 0 && value <= 15
}

/** Throws unless value is a C64 colour index. */
export function assertC64Color(value: number, what = 'Colour'): C64Color {
  if (!isC64Color(value)) throw new RangeError(`${what} ${value} is not 0-15`)
  return value
}

export function colorHex(
  color: C64Color,
  palette: PaletteId = DEFAULT_PALETTE_ID,
): string {
  assertC64Color(color)
  return PALETTES[palette].hex[color]
}

export type Rgb = readonly [number, number, number]

export function hexToRgb(hex: string): Rgb {
  return [
    parseInt(hex.slice(1, 3), 16),
    parseInt(hex.slice(3, 5), 16),
    parseInt(hex.slice(5, 7), 16),
  ]
}

const rgbCache = new Map<PaletteId, ReadonlyArray<Rgb>>()

/** The palette as RGB triples by colour index (cached), for canvas drawing. */
export function paletteRgb(id: PaletteId): ReadonlyArray<Rgb> {
  let rgb = rgbCache.get(id)
  if (!rgb) {
    rgb = PALETTES[id].hex.map(hexToRgb)
    rgbCache.set(id, rgb)
  }
  return rgb
}

/** Squared RGB distance. */
function distance2(a: Rgb, b: Rgb): number {
  return (a[0] - b[0]) ** 2 + (a[1] - b[1]) ** 2 + (a[2] - b[2]) ** 2
}

/** The colour in the palette closest to an RGB value, and how far off it is. */
export function nearestColor(
  rgb: Rgb,
  id: PaletteId,
): { color: C64Color; distance: number } {
  let color = 0
  let best = Infinity
  paletteRgb(id).forEach((entry, i) => {
    const d = distance2(rgb, entry)
    if (d < best) {
      best = d
      color = i
    }
  })
  return { color, distance: Math.sqrt(best) }
}

export interface PaletteMatch {
  readonly id: PaletteId
  /** Every colour is exactly a colour of this palette. */
  readonly exact: boolean
  /** Largest RGB distance from a colour to its nearest palette colour. */
  readonly worst: number
}

/**
 * How well a set of colours (e.g. an imported image's) fits each palette,
 * best first: exact matches, then by worst-case distance.
 */
export function matchPalette(colors: ReadonlyArray<Rgb>): Array<PaletteMatch> {
  return PALETTE_IDS.map((id) => {
    const worst = colors.reduce(
      (w, c) => Math.max(w, nearestColor(c, id).distance),
      0,
    )
    return { id, exact: worst === 0, worst }
  }).sort((a, b) => a.worst - b.worst)
}
