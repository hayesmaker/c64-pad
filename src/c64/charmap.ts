import { newId } from './ids'

export const MAX_MAP_SIZE = 1024
/** Visible text screen. */
export const SCREEN_WIDTH = 40
export const SCREEN_HEIGHT = 25

/**
 * A map of screen codes (0-255), any size; a 40×25 window of it is one C64
 * screen. Colours come from the charset (per-char colouring).
 */
export interface Charmap {
  readonly id: string
  readonly name: string
  readonly notes: string
  readonly charsetId: string
  readonly width: number
  readonly height: number
  /** Row-major screen codes, width × height. */
  readonly cells: Uint8Array
  /** Screen code the eraser writes (and new cells get): $00 unless changed. */
  readonly blank: number
}

function checkSize(width: number, height: number) {
  for (const [label, v] of [
    ['Width', width],
    ['Height', height],
  ] as const) {
    if (!Number.isInteger(v) || v < 1 || v > MAX_MAP_SIZE) {
      throw new RangeError(`${label} ${v} outside 1-${MAX_MAP_SIZE}`)
    }
  }
}

function checkCode(code: number) {
  if (!Number.isInteger(code) || code < 0 || code > 255) {
    throw new RangeError(`Screen code ${code} outside 0-255`)
  }
}

export function createCharmap(
  init: Partial<Charmap> & Pick<Charmap, 'charsetId'>,
): Charmap {
  const width = init.width ?? SCREEN_WIDTH
  const height = init.height ?? SCREEN_HEIGHT
  checkSize(width, height)
  const map: Charmap = {
    id: newId(),
    name: 'Map',
    notes: '',
    cells: new Uint8Array(width * height).fill(init.blank ?? 0),
    blank: 0,
    ...init,
    width,
    height,
  }
  if (map.cells.length !== width * height) {
    throw new RangeError(`Map cells must have ${width * height} entries`)
  }
  checkCode(map.blank)
  return map
}

function checkCoords(map: Charmap, x: number, y: number) {
  if (!Number.isInteger(x) || x < 0 || x >= map.width) {
    throw new RangeError(`x ${x} outside 0-${map.width - 1}`)
  }
  if (!Number.isInteger(y) || y < 0 || y >= map.height) {
    throw new RangeError(`y ${y} outside 0-${map.height - 1}`)
  }
}

export function getCell(map: Charmap, x: number, y: number): number {
  checkCoords(map, x, y)
  return map.cells[y * map.width + x]
}

/** Returns the same map when nothing changes. */
export function setCell(
  map: Charmap,
  x: number,
  y: number,
  code: number,
): Charmap {
  checkCoords(map, x, y)
  checkCode(code)
  const i = y * map.width + x
  if (map.cells[i] === code) return map
  const cells = map.cells.slice()
  cells[i] = code
  return { ...map, cells }
}

/** Resize keeping the top-left content; new cells get `fill` (the blank char). */
export function resizeCharmap(
  map: Charmap,
  width: number,
  height: number,
  fill = map.blank,
): Charmap {
  checkSize(width, height)
  checkCode(fill)
  const cells = new Uint8Array(width * height).fill(fill)
  for (let y = 0; y < Math.min(height, map.height); y++) {
    const row = map.cells.subarray(
      y * map.width,
      y * map.width + Math.min(width, map.width),
    )
    cells.set(row, y * width)
  }
  return { ...map, width, height, cells }
}

export interface Region {
  readonly width: number
  readonly height: number
  readonly cells: Uint8Array
}

/** Rectangle clipped to the map; empty sizes give an empty region. */
function clip(map: Charmap, x: number, y: number, w: number, h: number) {
  const x0 = Math.max(0, x)
  const y0 = Math.max(0, y)
  const x1 = Math.min(map.width, x + w)
  const y1 = Math.min(map.height, y + h)
  return { x0, y0, x1, y1 }
}

export function fillRect(
  map: Charmap,
  x: number,
  y: number,
  w: number,
  h: number,
  code: number,
): Charmap {
  checkCode(code)
  const { x0, y0, x1, y1 } = clip(map, x, y, w, h)
  if (x0 >= x1 || y0 >= y1) return map
  const cells = map.cells.slice()
  for (let yy = y0; yy < y1; yy++)
    cells.fill(code, yy * map.width + x0, yy * map.width + x1)
  return { ...map, cells }
}

/** Copy a rectangle (clipped to the map). */
export function copyRegion(
  map: Charmap,
  x: number,
  y: number,
  w: number,
  h: number,
): Region {
  const { x0, y0, x1, y1 } = clip(map, x, y, w, h)
  const width = Math.max(0, x1 - x0)
  const height = Math.max(0, y1 - y0)
  const cells = new Uint8Array(width * height)
  for (let yy = 0; yy < height; yy++) {
    cells.set(
      map.cells.subarray(
        (y0 + yy) * map.width + x0,
        (y0 + yy) * map.width + x1,
      ),
      yy * width,
    )
  }
  return { width, height, cells }
}

/** Paste a region with its top-left at (x, y); parts outside the map are dropped. */
export function pasteRegion(
  map: Charmap,
  region: Region,
  x: number,
  y: number,
): Charmap {
  const cells = map.cells.slice()
  for (let ry = 0; ry < region.height; ry++) {
    for (let rx = 0; rx < region.width; rx++) {
      const mx = x + rx
      const my = y + ry
      if (mx >= 0 && my >= 0 && mx < map.width && my < map.height) {
        cells[my * map.width + mx] = region.cells[ry * region.width + rx]
      }
    }
  }
  return { ...map, cells }
}

/** ECM screen code: char 0-63 in the low bits, background 0-3 in the top two. */
export function encodeEcm(char: number, background: number): number {
  if (!Number.isInteger(char) || char < 0 || char > 63) {
    throw new RangeError(`ECM char ${char} outside 0-63`)
  }
  if (!Number.isInteger(background) || background < 0 || background > 3) {
    throw new RangeError(`ECM background ${background} outside 0-3`)
  }
  return (background << 6) | char
}

export function decodeEcm(code: number): { char: number; background: number } {
  checkCode(code)
  return { char: code & 63, background: code >> 6 }
}

export function setMapBlank(map: Charmap, blank: number): Charmap {
  checkCode(blank)
  return blank === map.blank ? map : { ...map, blank }
}

/** Flood-fill the 4-connected area of equal codes at (x, y) with `code`. */
export function floodFillMap(
  map: Charmap,
  x: number,
  y: number,
  code: number,
): Charmap {
  checkCoords(map, x, y)
  checkCode(code)
  const target = map.cells[y * map.width + x]
  if (target === code) return map
  const cells = map.cells.slice()
  const stack = [y * map.width + x]
  while (stack.length > 0) {
    const i = stack.pop()!
    if (cells[i] !== target) continue
    cells[i] = code
    const cx = i % map.width
    if (cx > 0) stack.push(i - 1)
    if (cx < map.width - 1) stack.push(i + 1)
    if (i >= map.width) stack.push(i - map.width)
    if (i + map.width < cells.length) stack.push(i + map.width)
  }
  return { ...map, cells }
}
