import type { Charmap } from '@/c64/charmap'
import type { GridTracing, Placement } from './placement'

/**
 * Char tracing: the Character Worksheet borrows a Screen's tracing paper,
 * showing the 8 × 8 part under one map cell. Nothing is cut from the image;
 * the map's placement is shifted so that cell lands on the char grid, so
 * nudging or replacing the map's image carries through.
 */

/** A map cell a char is traced from. */
export interface CharTraceSpot {
  mapId: string
  x: number
  y: number
}

/** Where a char is traced from: its pin, if any, then where it's placed. */
export interface CharTraceSource extends CharTraceSpot {
  pinned: boolean
}

/** Char number of a screen code: ECM keeps the shape in the low 6 bits. */
export const charOfCode = (code: number, ecm: boolean) =>
  ecm ? code & 63 : code

/** At most this many placements are listed (a char can fill a big map). */
export const MAX_SPOTS = 999

/**
 * Cells holding `char` on these maps, in map order then row by row. Cells
 * that hold the map's Blank Char are skipped: that's empty space, not a
 * drawing of the char.
 */
export function charSpots(
  maps: ReadonlyArray<Charmap>,
  char: number,
  ecm: boolean,
  limit = MAX_SPOTS,
): Array<CharTraceSpot> {
  const out: Array<CharTraceSpot> = []
  for (const map of maps) {
    const { cells, width, blank } = map
    for (let i = 0; i < cells.length; i++) {
      const code = cells[i]
      if (code === blank || charOfCode(code, ecm) !== char) continue
      out.push({ mapId: map.id, x: i % width, y: Math.floor(i / width) })
      if (out.length >= limit) return out
    }
  }
  return out
}

/** The pin first (if its map still has that cell), then the placements. */
export function traceSources(
  maps: ReadonlyArray<Charmap>,
  char: number,
  ecm: boolean,
  pin: CharTraceSpot | undefined,
): Array<CharTraceSource> {
  const spots = charSpots(maps, char, ecm)
  const pinMap = pin && maps.find((m) => m.id === pin.mapId)
  const pinOk = pin && pinMap && pin.x < pinMap.width && pin.y < pinMap.height
  const rest = spots
    .filter(
      (s) => !pinOk || s.mapId !== pin.mapId || s.x !== pin.x || s.y !== pin.y,
    )
    .map((s) => ({ ...s, pinned: false }))
  return pinOk ? [{ ...pin, pinned: true }, ...rest] : rest
}

/** A map's placement moved so cell (x, y) sits at the origin. */
export function shiftToCell(
  placement: Placement,
  x: number,
  y: number,
): Placement {
  const t = placement.target
  return {
    ...placement,
    target: { ...t, x: t.x - x * 8, y: t.y - y * 8 },
  }
}

/**
 * Pixels for a char grid with tracing under its empty pixels: background
 * pixels become transparent (-1) so the image shows through them.
 */
export function clearBackground(
  pixels: ArrayLike<number>,
  background: number,
): Int8Array {
  return Int8Array.from(pixels, (c) => (c === background ? -1 : c))
}

/** Per-charset char tracing prefs: pins and how the image is shown. */
export interface CharTracingPrefs {
  /** Char number → the cell it's pinned to. */
  pins: Record<number, CharTraceSpot>
  opacity: number
  layer: GridTracing['layer']
  visible: boolean
}

export const DEFAULT_CHAR_TRACING: CharTracingPrefs = {
  pins: {},
  opacity: 0.5,
  layer: 'over',
  visible: true,
}

const key = (charsetId: string) => `c64pad:char-tracing:${charsetId}`

function isSpot(v: unknown): v is CharTraceSpot {
  if (typeof v !== 'object' || v === null) return false
  const { mapId, x, y } = v as Record<string, unknown>
  return (
    typeof mapId === 'string' &&
    Number.isInteger(x) &&
    Number.isInteger(y) &&
    (x as number) >= 0 &&
    (y as number) >= 0
  )
}

/**
 * Read a charset's prefs from this device (localStorage, like the tracing
 * images: never in projects). Anything unreadable falls back to defaults.
 */
export function loadCharTracing(charsetId: string): CharTracingPrefs {
  try {
    const raw = localStorage.getItem(key(charsetId))
    const v = (raw ? JSON.parse(raw) : null) as Record<string, unknown> | null
    if (!v || typeof v !== 'object') return DEFAULT_CHAR_TRACING
    const pins: Record<number, CharTraceSpot> = {}
    if (v.pins && typeof v.pins === 'object') {
      for (const [k, spot] of Object.entries(v.pins)) {
        const char = Number(k)
        if (Number.isInteger(char) && char >= 0 && char < 256 && isSpot(spot))
          pins[char] = { mapId: spot.mapId, x: spot.x, y: spot.y }
      }
    }
    const opacity =
      typeof v.opacity === 'number' && v.opacity >= 0.1 && v.opacity <= 1
        ? v.opacity
        : DEFAULT_CHAR_TRACING.opacity
    return {
      pins,
      opacity,
      layer: v.layer === 'under' ? 'under' : 'over',
      visible: v.visible !== false,
    }
  } catch {
    return DEFAULT_CHAR_TRACING
  }
}

export function saveCharTracing(charsetId: string, prefs: CharTracingPrefs) {
  try {
    localStorage.setItem(key(charsetId), JSON.stringify(prefs))
  } catch {
    // Full or blocked storage: kept for this session only.
  }
}

/**
 * Pin the chars of a brush (one char or a block) to the map cells it
 * covers when stamped at (x, y). Blank Char cells and cells off the map are
 * left out. Returns the new prefs and how many chars were pinned.
 */
export function pinBrush(
  prefs: CharTracingPrefs,
  map: Charmap,
  brush: { width: number; height: number; cells: Uint8Array },
  x: number,
  y: number,
  ecm: boolean,
): { prefs: CharTracingPrefs; pinned: Array<number> } {
  const pins = { ...prefs.pins }
  const pinned: Array<number> = []
  for (let by = 0; by < brush.height; by++) {
    for (let bx = 0; bx < brush.width; bx++) {
      const mx = x + bx
      const my = y + by
      if (mx >= map.width || my >= map.height) continue
      const code = brush.cells[by * brush.width + bx]
      if (code === map.blank) continue
      const char = charOfCode(code, ecm)
      pins[char] = { mapId: map.id, x: mx, y: my }
      if (!pinned.includes(char)) pinned.push(char)
    }
  }
  return { prefs: { ...prefs, pins }, pinned }
}
