import { base64ToBytes } from '@/storage/bytes'
import { exportMapColors, exportMapScreenRam } from '@/export/chars'
import { bitmapViewerPrg } from './stubs/bitmap-viewer.gen'
import type { Charmap } from '@/c64/charmap'
import type { Charset } from '@/c64/charset'
import type { C64Color } from '@/c64/palette'

/** Memory layout shared with stubs/bitmap-viewer.asm. */
export const BITMAP_VIEWER = {
  LOAD: 0x0801,
  CONFIG: 0x0c00,
  TILES: 0x4000,
  MAP: 0x4800,
  SCREEN: 0x0400,
  BITMAP: 0x2000,
  /** The map's three arrays may fill $4800-$cfff. */
  MAP_MAX_BYTES: 0xd000 - 0x4800,
} as const

const SCREEN_W = 40
const SCREEN_H = 25

const OFFSET = {
  border: 0,
  background: 1,
  mapWidth: 2,
  viewWidth: 4,
  viewHeight: 5,
  maxScrollX: 6,
  maxScrollY: 8,
  startX: 10,
  startY: 12,
  screenOffset: 14,
  colourOffset: 16,
  screenAt: 18,
  bitmapAt: 20,
} as const

export interface BitmapView {
  /** Tile (char) per cell, row by row. */
  cells: Uint8Array
  /** Screen RAM per cell (01 high nibble, 10 low). */
  screen: Uint8Array
  /** Colour RAM per cell (11). */
  colours: Uint8Array
  width: number
  height: number
  /** Where a map smaller than the screen goes; default top left. */
  centre?: boolean
  border?: C64Color
  /** Map column and row at the top left of the screen to start with. */
  start?: { x: number; y: number }
}

const clamp = (n: number, max: number) =>
  Math.max(0, Math.min(max, Math.round(n)))

/**
 * Make a runnable PRG showing a bitmap map: the viewer stub with the tiles
 * and the map's tiles and colours, starting at `view.start`. Maps too big
 * for memory keep `rows` rows from `firstRow`, centred on the start screen.
 */
export function buildBitmapViewerPrg(
  cs: Charset,
  view: BitmapView,
): { prg: Uint8Array; rows: number; firstRow: number } {
  const { width } = view
  const rows = Math.min(
    view.height,
    Math.floor(BITMAP_VIEWER.MAP_MAX_BYTES / (3 * width)),
  )
  if (rows < 1) throw new RangeError('The map is too wide for the viewer')
  const startY = clamp(view.start?.y ?? 0, view.height - 1)
  const firstRow = clamp(
    startY - (rows - Math.min(SCREEN_H, rows)) / 2,
    view.height - rows,
  )
  const n = width * rows

  const stub = base64ToBytes(bitmapViewerPrg)
  const end = BITMAP_VIEWER.MAP + 3 * n
  const prg = new Uint8Array(2 + end - BITMAP_VIEWER.LOAD)
  prg.set(stub)
  const at = (address: number) => 2 + address - BITMAP_VIEWER.LOAD
  const cfg = (offset: number, value: number) => {
    prg[at(BITMAP_VIEWER.CONFIG + offset)] = value
  }
  const word = (offset: number, value: number) => {
    cfg(offset, value & 0xff)
    cfg(offset + 1, value >> 8)
  }

  const viewW = Math.min(SCREEN_W, width)
  const viewH = Math.min(SCREEN_H, rows)
  const offX = view.centre ? (SCREEN_W - viewW) >> 1 : 0
  const offY = view.centre ? (SCREEN_H - viewH) >> 1 : 0
  cfg(OFFSET.border, view.border ?? 0)
  cfg(OFFSET.background, cs.background)
  word(OFFSET.mapWidth, width)
  cfg(OFFSET.viewWidth, viewW)
  cfg(OFFSET.viewHeight, viewH)
  word(OFFSET.maxScrollX, width - viewW)
  word(OFFSET.maxScrollY, rows - viewH)
  word(OFFSET.startX, clamp(view.start?.x ?? 0, width - viewW))
  word(OFFSET.startY, clamp(startY - firstRow, rows - viewH))
  word(OFFSET.screenOffset, n)
  word(OFFSET.colourOffset, 2 * n)
  word(OFFSET.screenAt, BITMAP_VIEWER.SCREEN + offY * SCREEN_W + offX)
  word(OFFSET.bitmapAt, BITMAP_VIEWER.BITMAP + offY * 320 + offX * 8)

  const window = (a: Uint8Array) =>
    a.subarray(firstRow * width, (firstRow + rows) * width)
  prg.set(cs.data, at(BITMAP_VIEWER.TILES))
  prg.set(window(view.cells), at(BITMAP_VIEWER.MAP))
  prg.set(window(view.screen), at(BITMAP_VIEWER.MAP + n))
  prg.set(window(view.colours), at(BITMAP_VIEWER.MAP + 2 * n))
  return { prg, rows, firstRow }
}

/** Run a bitmap map from `start`, scrolling with joystick port 2. */
export function bitmapMapViewerPrg(
  map: Charmap,
  cs: Charset,
  start?: { x: number; y: number },
) {
  return buildBitmapViewerPrg(cs, {
    cells: map.cells,
    screen: exportMapScreenRam(map, cs),
    colours: exportMapColors(map, cs),
    width: map.width,
    height: map.height,
    start,
  })
}

/** Run a bitmap charset: all 256 tiles as a 16 × 16 grid in the middle. */
export function bitmapCharsetViewerPrg(cs: Charset) {
  return buildBitmapViewerPrg(cs, {
    cells: Uint8Array.from({ length: 256 }, (_, i) => i),
    screen: cs.screenColors.slice(),
    colours: cs.colors.map((c) => c & 15),
    width: 16,
    height: 16,
    centre: true,
  })
}
