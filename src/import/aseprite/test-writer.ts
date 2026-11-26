/**
 * Writes small RGBA .aseprite files for tests (spec:
 * aseprite/docs/ase-file-specs.md): image layers, raw or linked cels, tags,
 * frame durations and the pixel ratio.
 */

export interface TestLayer {
  name: string
  visible?: boolean
  childLevel?: number
  opacity?: number
  group?: boolean
}

export type TestCel =
  | {
      frame: number
      layer: number
      x?: number
      y?: number
      /** Rows of RGBA pixels, `null` = transparent. */
      pixels: ReadonlyArray<
        ReadonlyArray<readonly [number, number, number] | null>
      >
    }
  | { frame: number; layer: number; linkedTo: number }

export interface TestFile {
  width: number
  height: number
  frames?: number
  durations?: ReadonlyArray<number>
  pixelRatio?: readonly [number, number]
  layers: ReadonlyArray<TestLayer>
  cels: ReadonlyArray<TestCel>
  tags?: ReadonlyArray<{
    name: string
    from: number
    to: number
    direction?: 0 | 1 | 2 | 3
  }>
}

class Writer {
  bytes: Array<number> = []
  u8(v: number) {
    this.bytes.push(v & 0xff)
  }
  u16(v: number) {
    this.u8(v)
    this.u8(v >> 8)
  }
  u32(v: number) {
    this.u16(v & 0xffff)
    this.u16(v >>> 16)
  }
  zeros(n: number) {
    for (let i = 0; i < n; i++) this.u8(0)
  }
  string(s: string) {
    const b = new TextEncoder().encode(s)
    this.u16(b.length)
    b.forEach((v) => this.u8(v))
  }
}

function chunk(type: number, body: (w: Writer) => void): Array<number> {
  const w = new Writer()
  body(w)
  const out = new Writer()
  out.u32(w.bytes.length + 6)
  out.u16(type)
  return [...out.bytes, ...w.bytes]
}

export function writeAseprite(file: TestFile): Uint8Array {
  const frames = file.frames ?? 1
  const body: Array<number> = []
  for (let f = 0; f < frames; f++) {
    const chunks: Array<Array<number>> = []
    if (f === 0) {
      for (const layer of file.layers) {
        chunks.push(
          chunk(0x2004, (w) => {
            w.u16(layer.visible === false ? 0 : 1)
            w.u16(layer.group ? 1 : 0)
            w.u16(layer.childLevel ?? 0)
            w.u16(0)
            w.u16(0)
            w.u16(0) // blend mode
            w.u8(layer.opacity ?? 255)
            w.zeros(3)
            w.string(layer.name)
          }),
        )
      }
      if (file.tags?.length) {
        chunks.push(
          chunk(0x2018, (w) => {
            w.u16(file.tags!.length)
            w.zeros(8)
            for (const t of file.tags!) {
              w.u16(t.from)
              w.u16(t.to)
              w.u8(t.direction ?? 0)
              w.u16(0)
              w.zeros(6 + 3 + 1)
              w.string(t.name)
            }
          }),
        )
      }
    }
    for (const cel of file.cels.filter((c) => c.frame === f)) {
      chunks.push(
        chunk(0x2005, (w) => {
          w.u16(cel.layer)
          w.u16('pixels' in cel ? (cel.x ?? 0) : 0)
          w.u16('pixels' in cel ? (cel.y ?? 0) : 0)
          w.u8(255)
          if ('linkedTo' in cel) {
            w.u16(1)
            w.zeros(2 + 5)
            w.u16(cel.linkedTo)
            return
          }
          w.u16(0)
          w.zeros(2 + 5)
          const h = cel.pixels.length
          const wd = cel.pixels[0]?.length ?? 0
          w.u16(wd)
          w.u16(h)
          for (const row of cel.pixels) {
            for (const px of row) {
              if (px) {
                w.u8(px[0])
                w.u8(px[1])
                w.u8(px[2])
                w.u8(255)
              } else w.zeros(4)
            }
          }
        }),
      )
    }
    const frame = new Writer()
    const size = 16 + chunks.reduce((n, c) => n + c.length, 0)
    frame.u32(size)
    frame.u16(0xf1fa)
    frame.u16(chunks.length)
    frame.u16(file.durations?.[f] ?? 100)
    frame.zeros(2)
    frame.u32(chunks.length)
    body.push(...frame.bytes, ...chunks.flat())
  }

  const header = new Writer()
  header.u32(128 + body.length)
  header.u16(0xa5e0)
  header.u16(frames)
  header.u16(file.width)
  header.u16(file.height)
  header.u16(32)
  header.u32(1) // layer opacity is valid
  header.u16(100)
  header.zeros(8)
  header.u8(0) // transparent index
  header.zeros(3)
  header.u16(0)
  header.u8(file.pixelRatio?.[0] ?? 1)
  header.u8(file.pixelRatio?.[1] ?? 1)
  header.zeros(128 - header.bytes.length)
  return new Uint8Array([...header.bytes, ...body])
}

/** Colodore RGB for a C64 colour, as the tests draw with it. */
export const COLODORE: ReadonlyArray<readonly [number, number, number]> = [
  '#000000',
  '#ffffff',
  '#813338',
  '#75cec8',
  '#8e3c97',
  '#56ac4d',
  '#2e2c9b',
  '#edf171',
  '#8e5029',
  '#553800',
  '#c46c71',
  '#4a4a4a',
  '#7b7b7b',
  '#a9ff9f',
  '#706deb',
  '#b2b2b2',
].map(
  (h) =>
    [
      parseInt(h.slice(1, 3), 16),
      parseInt(h.slice(3, 5), 16),
      parseInt(h.slice(5, 7), 16),
    ] as const,
)

/**
 * Pixels from strings: one character per pixel, '.' transparent, '0'-'9' and
 * 'a'-'f' a C64 colour (Colodore).
 */
export function art(rows: ReadonlyArray<string>) {
  return rows.map((row) =>
    [...row].map((ch) => (ch === '.' ? null : COLODORE[parseInt(ch, 16)])),
  )
}

/** A w × h block of one character, for `art`. */
export function fill(w: number, h: number, ch: string) {
  return Array.from({ length: h }, () => ch.repeat(w))
}
