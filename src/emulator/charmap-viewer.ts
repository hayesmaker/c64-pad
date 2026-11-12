import { base64ToBytes } from '@/storage/bytes'
import { charCount } from '@/c64/charset'
import { charsetRegisters, exportCharColors } from '@/export/chars'
import { charmapViewerPrg } from './stubs/charmap-viewer.gen'
import type { Charmap } from '@/c64/charmap'
import type { Charset } from '@/c64/charset'
import type { C64Color } from '@/c64/palette'

/** Memory layout shared with stubs/charmap-viewer.asm. */
export const CHARMAP_VIEWER = {
  LOAD: 0x0801,
  CONFIG: 0x0c00,
  COLOURS: 0x0d00,
  CHARSET: 0x2000,
  MAP: 0x2800,
  /** The map may fill $2800-$cfff. */
  MAP_MAX_BYTES: 0xd000 - 0x2800,
} as const

const SCREEN_W = 40
const SCREEN_H = 25

const OFFSET = {
  border: 0,
  background: 1,
  d022: 2,
  d023: 3,
  d024: 4,
  mode: 5,
  mapWidth: 6,
  viewWidth: 10,
  viewHeight: 11,
  offsetX: 12,
  offsetY: 13,
  maxScrollX: 14,
  maxScrollY: 16,
  fillCode: 18,
  fillColour: 19,
  startX: 20,
  startY: 22,
} as const

export interface CharmapView {
  /** Screen codes, row by row. */
  cells: Uint8Array
  width: number
  height: number
  /** Where a map smaller than the screen goes; default top left. */
  centre?: boolean
  /** Screen code around a small map; default the first empty char. */
  fillCode?: number
  border?: C64Color
  /** Map column and row at the top left of the screen to start with. */
  start?: { x: number; y: number }
}

/** First char with no pixels set, else 0. */
function emptyChar(cs: Charset): number {
  for (let i = 0; i < charCount(cs.mode); i++) {
    if (cs.data.subarray(i * 8, i * 8 + 8).every((b) => b === 0)) return i
  }
  return 0
}

const clamp = (n: number, max: number) =>
  Math.max(0, Math.min(max, Math.round(n)))

/**
 * Make a runnable PRG: the viewer stub with the charset, its colours and the
 * map, starting at `view.start`. Maps too big for memory keep `rows` rows
 * from `firstRow`, centred on the start screen.
 */
export function buildCharmapViewerPrg(
  cs: Charset,
  view: CharmapView,
): { prg: Uint8Array; rows: number; firstRow: number } {
  const { width } = view
  const rows = Math.min(
    view.height,
    Math.floor(CHARMAP_VIEWER.MAP_MAX_BYTES / width),
  )
  if (rows < 1) throw new RangeError('The map is too wide for the viewer')
  const startY = clamp(view.start?.y ?? 0, view.height - 1)
  // Rows kept round the start screen, so it scrolls both ways from there.
  const firstRow = clamp(
    startY - (rows - Math.min(SCREEN_H, rows)) / 2,
    view.height - rows,
  )

  const stub = base64ToBytes(charmapViewerPrg)
  const end = CHARMAP_VIEWER.MAP + width * rows
  const prg = new Uint8Array(2 + end - CHARMAP_VIEWER.LOAD)
  prg.set(stub)
  const at = (address: number) => 2 + address - CHARMAP_VIEWER.LOAD
  const cfg = (offset: number, value: number) => {
    prg[at(CHARMAP_VIEWER.CONFIG + offset)] = value
  }
  const word = (offset: number, value: number) => {
    cfg(offset, value & 0xff)
    cfg(offset + 1, value >> 8)
  }

  const r = charsetRegisters(cs)
  const colours = exportCharColors(cs)
  const viewW = Math.min(SCREEN_W, width)
  const viewH = Math.min(SCREEN_H, rows)
  const fillCode = view.fillCode ?? emptyChar(cs)
  cfg(OFFSET.border, view.border ?? 14)
  cfg(OFFSET.background, r.d021)
  cfg(OFFSET.d022, r.d022)
  cfg(OFFSET.d023, r.d023)
  cfg(OFFSET.d024, r.d024)
  cfg(OFFSET.mode, { hires: 0, multicolor: 1, ecm: 2 }[cs.mode])
  word(OFFSET.mapWidth, width)
  cfg(OFFSET.viewWidth, viewW)
  cfg(OFFSET.viewHeight, viewH)
  cfg(OFFSET.offsetX, view.centre ? (SCREEN_W - viewW) >> 1 : 0)
  cfg(OFFSET.offsetY, view.centre ? (SCREEN_H - viewH) >> 1 : 0)
  word(OFFSET.maxScrollX, width - viewW)
  word(OFFSET.maxScrollY, rows - viewH)
  word(OFFSET.startX, clamp(view.start?.x ?? 0, width - viewW))
  word(OFFSET.startY, clamp(startY - firstRow, rows - viewH))
  cfg(OFFSET.fillCode, fillCode)
  cfg(OFFSET.fillColour, colours[fillCode])

  prg.set(colours, at(CHARMAP_VIEWER.COLOURS))
  prg.set(cs.data, at(CHARMAP_VIEWER.CHARSET))
  prg.set(
    view.cells.subarray(firstRow * width, (firstRow + rows) * width),
    at(CHARMAP_VIEWER.MAP),
  )
  return { prg, rows, firstRow }
}

/**
 * Run a map: the screen at `start` (map column and row at its top left;
 * default the top-left screen), scrolling with joystick port 2.
 */
export function mapViewerPrg(
  map: Charmap,
  cs: Charset,
  start?: { x: number; y: number },
) {
  return buildCharmapViewerPrg(cs, {
    cells: map.cells,
    width: map.width,
    height: map.height,
    fillCode: map.blank,
    start,
  })
}

/** Run a charset: all 256 codes as a 16 × 16 grid in the middle. */
export function charsetViewerPrg(cs: Charset) {
  return buildCharmapViewerPrg(cs, {
    cells: Uint8Array.from({ length: 256 }, (_, i) => i),
    width: 16,
    height: 16,
    centre: true,
  })
}
