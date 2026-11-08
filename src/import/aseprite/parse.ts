/**
 * Reader for Aseprite's .aseprite / .ase files: just what the tileset + tilemap
 * importer needs (layers, cels, tilesets, palette, user data of the first
 * frame's objects). Spec: aseprite/docs/ase-file-specs.md.
 */

export class AsepriteError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'AsepriteError'
  }
}

/** RGBA, 0-255 each. */
export type Rgba = readonly [number, number, number, number]

export type ColorDepth = 8 | 16 | 32

export interface AseLayer {
  /** Index in file order (what cels refer to). */
  readonly index: number
  readonly name: string
  readonly kind: 'image' | 'group' | 'tilemap'
  readonly visible: boolean
  /** Tilemap layers: index of their tileset. */
  readonly tilesetIndex?: number
  readonly userData?: string
}

export interface AseTileset {
  readonly id: number
  readonly name: string
  readonly tileWidth: number
  readonly tileHeight: number
  /** Includes tile 0, Aseprite's empty tile. */
  readonly count: number
  /** Tiles live in another file; no pixels here. */
  readonly external: boolean
  /** RGBA, tile i at rows i·tileHeight…, tileWidth wide. Null if external. */
  readonly pixels: Uint8ClampedArray | null
  /** User data text per tile ('' if none), e.g. "solid". */
  readonly tileUserData: ReadonlyArray<string>
}

export interface AseTilemap {
  /** Size in tiles. */
  readonly width: number
  readonly height: number
  /** Tile ids (flip bits removed), row-major. */
  readonly tiles: Uint32Array
  /** How many tiles are flipped or rotated (the C64 can't do this). */
  readonly flipped: number
}

export interface AseCel {
  readonly frame: number
  readonly layer: number
  /** Position on the canvas in pixels. */
  readonly x: number
  readonly y: number
  readonly kind: 'image' | 'linked' | 'tilemap'
  readonly tilemap?: AseTilemap
}

export interface AsepriteDoc {
  readonly width: number
  readonly height: number
  readonly depth: ColorDepth
  readonly frames: number
  /** Indexed images: the palette entry drawn as transparent. */
  readonly transparentIndex: number
  readonly palette: ReadonlyArray<Rgba>
  readonly layers: ReadonlyArray<AseLayer>
  readonly tilesets: ReadonlyArray<AseTileset>
  readonly cels: ReadonlyArray<AseCel>
}

const FILE_MAGIC = 0xa5e0
const FRAME_MAGIC = 0xf1fa

const CHUNK = {
  oldPalette: 0x0004,
  layer: 0x2004,
  cel: 0x2005,
  palette: 0x2019,
  userData: 0x2020,
  tileset: 0x2023,
} as const

/** Inflate zlib data with the platform's DecompressionStream. */
async function inflate(data: Uint8Array): Promise<Uint8Array> {
  try {
    const stream = new Blob([data as BlobPart])
      .stream()
      .pipeThrough(new DecompressionStream('deflate'))
    return new Uint8Array(await new Response(stream).arrayBuffer())
  } catch {
    throw new AsepriteError('Compressed data in the file is damaged')
  }
}

class Reader {
  readonly view: DataView
  constructor(
    readonly bytes: Uint8Array,
    public pos = 0,
  ) {
    this.view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength)
  }
  need(n: number) {
    if (this.pos + n > this.bytes.length)
      throw new AsepriteError('The file is cut short')
  }
  u8() {
    this.need(1)
    return this.view.getUint8(this.pos++)
  }
  u16() {
    this.need(2)
    const v = this.view.getUint16(this.pos, true)
    this.pos += 2
    return v
  }
  i16() {
    this.need(2)
    const v = this.view.getInt16(this.pos, true)
    this.pos += 2
    return v
  }
  u32() {
    this.need(4)
    const v = this.view.getUint32(this.pos, true)
    this.pos += 4
    return v
  }
  skip(n: number) {
    this.need(n)
    this.pos += n
  }
  take(n: number) {
    this.need(n)
    const out = this.bytes.subarray(this.pos, this.pos + n)
    this.pos += n
    return out
  }
  string() {
    return new TextDecoder().decode(this.take(this.u16()))
  }
}

/** Raw pixels of the file's colour depth → RGBA. */
function toRgba(
  raw: Uint8Array,
  depth: ColorDepth,
  palette: ReadonlyArray<Rgba>,
  transparentIndex: number,
): Uint8ClampedArray {
  const bpp = depth / 8
  const n = Math.floor(raw.length / bpp)
  const out = new Uint8ClampedArray(n * 4)
  for (let i = 0; i < n; i++) {
    let rgba: Rgba
    if (depth === 32) {
      rgba = [raw[i * 4], raw[i * 4 + 1], raw[i * 4 + 2], raw[i * 4 + 3]]
    } else if (depth === 16) {
      const v = raw[i * 2]
      rgba = [v, v, v, raw[i * 2 + 1]]
    } else {
      const index = raw[i]
      rgba =
        index === transparentIndex
          ? [0, 0, 0, 0]
          : (palette[index] ?? [0, 0, 0, 255])
    }
    out.set(rgba, i * 4)
  }
  return out
}

interface PendingTileset {
  id: number
  name: string
  tileWidth: number
  tileHeight: number
  count: number
  external: boolean
  compressed: Uint8Array | null
  tileUserData: Array<string>
}

/** Parse an Aseprite file. Throws AsepriteError if it isn't one. */
export async function parseAseprite(bytes: Uint8Array): Promise<AsepriteDoc> {
  if (bytes.length < 128) throw new AsepriteError('Not an Aseprite file')
  const r = new Reader(bytes)
  r.u32() // file size
  if (r.u16() !== FILE_MAGIC) throw new AsepriteError('Not an Aseprite file')
  const frames = r.u16()
  const width = r.u16()
  const height = r.u16()
  const depth = r.u16()
  if (depth !== 8 && depth !== 16 && depth !== 32) {
    throw new AsepriteError(`Unsupported colour depth ${depth}`)
  }
  const layersHaveUuid = (r.view.getUint32(14, true) & 4) !== 0
  const transparentIndex = r.view.getUint8(28)
  r.pos = 128

  const palette: Array<Rgba> = []
  let sawNewPalette = false
  const layers: Array<AseLayer> = []
  const tilesets: Array<PendingTileset> = []
  const cels: Array<AseCel> = []
  const pendingTilemaps: Array<{
    cel: Omit<AseCel, 'tilemap'>
    width: number
    height: number
    idMask: number
    flipMask: number
    data: Uint8Array
  }> = []

  // User data chunks attach to the chunk before them; after a tileset, the
  // first is the tileset's own and the next ones belong to its tiles in order.
  type Target =
    | { kind: 'layer'; index: number }
    | { kind: 'tileset'; tileset: PendingTileset; next: number }
    | null
  let target: Target = null

  for (let frame = 0; frame < frames; frame++) {
    const frameStart = r.pos
    const frameSize = r.u32()
    if (r.u16() !== FRAME_MAGIC) throw new AsepriteError('Damaged frame')
    const oldChunks = r.u16()
    r.skip(4) // duration, reserved
    const newChunks = r.u32()
    const chunkCount = newChunks || oldChunks

    for (let c = 0; c < chunkCount; c++) {
      const chunkStart = r.pos
      const size = r.u32()
      const type = r.u16()
      if (size < 6) throw new AsepriteError('Damaged chunk')
      r.need(size - 6)
      const end = chunkStart + size

      if (type === CHUNK.palette) {
        sawNewPalette = true
        const total = r.u32()
        const from = r.u32()
        const to = r.u32()
        r.skip(8)
        if (palette.length < total) palette.length = total
        for (let i = from; i <= to; i++) {
          const flags = r.u16()
          palette[i] = [r.u8(), r.u8(), r.u8(), r.u8()]
          if (flags & 1) r.string()
        }
        target = null
      } else if (type === CHUNK.oldPalette && !sawNewPalette) {
        const packets = r.u16()
        let index = 0
        for (let p = 0; p < packets; p++) {
          index += r.u8()
          const count = r.u8() || 256
          for (let i = 0; i < count; i++)
            palette[index++] = [r.u8(), r.u8(), r.u8(), 255]
        }
        target = null
      } else if (type === CHUNK.layer) {
        const flags = r.u16()
        const kindCode = r.u16()
        r.skip(2 + 2 + 2 + 2 + 1 + 3) // child level, size, blend, opacity, reserved
        const name = r.string()
        const kind =
          kindCode === 1 ? 'group' : kindCode === 2 ? 'tilemap' : 'image'
        const tilesetIndex = kind === 'tilemap' ? r.u32() : undefined
        if (layersHaveUuid) r.skip(Math.min(16, end - r.pos))
        layers.push({
          index: layers.length,
          name,
          kind,
          visible: (flags & 1) !== 0,
          tilesetIndex,
        })
        target = { kind: 'layer', index: layers.length - 1 }
      } else if (type === CHUNK.cel) {
        const layer = r.u16()
        const x = r.i16()
        const y = r.i16()
        r.skip(1) // opacity
        const celType = r.u16()
        r.skip(2 + 5) // z-index, reserved
        const base = { frame, layer, x, y }
        if (celType === 3) {
          const w = r.u16()
          const h = r.u16()
          const bitsPerTile = r.u16()
          const idMask = r.u32()
          const xFlip = r.u32()
          const yFlip = r.u32()
          const diagonal = r.u32()
          r.skip(10)
          if (bitsPerTile !== 32) {
            throw new AsepriteError(`Unsupported tilemap (${bitsPerTile}-bit)`)
          }
          pendingTilemaps.push({
            cel: { ...base, kind: 'tilemap' },
            width: w,
            height: h,
            idMask,
            flipMask: xFlip | yFlip | diagonal,
            data: r.take(end - r.pos),
          })
        } else {
          cels.push({ ...base, kind: celType === 1 ? 'linked' : 'image' })
        }
        target = null
      } else if (type === CHUNK.tileset) {
        const id = r.u32()
        const flags = r.u32()
        const count = r.u32()
        const tileWidth = r.u16()
        const tileHeight = r.u16()
        r.skip(2 + 14) // base index, reserved
        const name = r.string()
        const external = (flags & 1) !== 0
        if (external) r.skip(8)
        let compressed: Uint8Array | null = null
        if (flags & 2) compressed = r.take(r.u32())
        const tileset: PendingTileset = {
          id,
          name,
          tileWidth,
          tileHeight,
          count,
          external: external && !compressed,
          compressed,
          tileUserData: Array<string>(count).fill(''),
        }
        tilesets.push(tileset)
        target = { kind: 'tileset', tileset, next: -1 }
      } else if (type === CHUNK.userData) {
        const flags = r.u32()
        const text = flags & 1 ? r.string() : ''
        if (target?.kind === 'layer') {
          layers[target.index] = { ...layers[target.index], userData: text }
          target = null
        } else if (target?.kind === 'tileset') {
          if (target.next >= 0 && target.next < target.tileset.count)
            target.tileset.tileUserData[target.next] = text
          target.next++
        }
      } else {
        target = null
      }
      r.pos = end
    }
    r.pos = frameStart + frameSize
  }

  const finishedTilesets: Array<AseTileset> = []
  for (const t of tilesets) {
    finishedTilesets.push({
      id: t.id,
      name: t.name,
      tileWidth: t.tileWidth,
      tileHeight: t.tileHeight,
      count: t.count,
      external: t.external,
      pixels: t.compressed
        ? toRgba(await inflate(t.compressed), depth, palette, transparentIndex)
        : null,
      tileUserData: t.tileUserData,
    })
  }

  for (const t of pendingTilemaps) {
    const raw = await inflate(t.data)
    const n = t.width * t.height
    if (raw.length < n * 4) throw new AsepriteError('Damaged tilemap')
    const view = new DataView(raw.buffer, raw.byteOffset, raw.byteLength)
    const tiles = new Uint32Array(n)
    let flipped = 0
    for (let i = 0; i < n; i++) {
      const v = view.getUint32(i * 4, true)
      tiles[i] = (v & t.idMask) >>> 0
      if (v & t.flipMask) flipped++
    }
    cels.push({
      ...t.cel,
      tilemap: { width: t.width, height: t.height, tiles, flipped },
    })
  }

  return {
    width,
    height,
    depth,
    frames,
    transparentIndex,
    palette,
    layers,
    tilesets: finishedTilesets,
    cels,
  }
}
