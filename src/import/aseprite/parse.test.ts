import { describe, expect, it } from 'vitest'
import { AsepriteError, parseAseprite } from './parse'
import { fixture } from './test-fixtures'

describe('parseAseprite', () => {
  it('reads an RGBA file with one tilemap layer', async () => {
    const doc = await parseAseprite(fixture('island1_round4'))
    expect([doc.width, doc.height, doc.depth, doc.frames]).toEqual([
      320, 1272, 32, 1,
    ])
    expect(doc.layers).toEqual([
      expect.objectContaining({
        name: 'Layer 0',
        kind: 'tilemap',
        tilesetIndex: 0,
      }),
    ])
    const [ts] = doc.tilesets
    expect([ts.count, ts.tileWidth, ts.tileHeight, ts.external]).toEqual([
      69,
      8,
      8,
      false,
    ])
    expect(ts.pixels).toHaveLength(69 * 64 * 4)
    // Tile 0 is Aseprite's empty tile.
    expect(ts.pixels!.slice(0, 256).every((v) => v === 0)).toBe(true)
    const cel = doc.cels.find((c) => c.kind === 'tilemap')!
    expect([cel.x, cel.y, cel.tilemap!.width, cel.tilemap!.height]).toEqual([
      0, 0, 40, 159,
    ])
    expect(cel.tilemap!.flipped).toBe(0)
    expect(Math.max(...cel.tilemap!.tiles)).toBe(68)
  })

  it('reads an indexed file: palette, transparency, offset cel, tile data', async () => {
    const doc = await parseAseprite(fixture('island-8-1_test'))
    expect(doc.depth).toBe(8)
    expect(doc.transparentIndex).toBe(8)
    expect(doc.palette).toHaveLength(16)
    expect(doc.palette[2]).toEqual([0x88, 0x39, 0x32, 255])
    expect(doc.layers.map((l) => [l.name, l.kind])).toEqual([
      ['Background', 'image'],
      ['Tilemap 1', 'tilemap'],
    ])
    const cel = doc.cels.find((c) => c.kind === 'tilemap')!
    expect([cel.x, cel.y, cel.tilemap!.width, cel.tilemap!.height]).toEqual([
      0, 272, 40, 222,
    ])
    const ts = doc.tilesets[0]
    expect(ts.tileUserData[3]).toBe('solid')
    expect(ts.tileUserData.filter(Boolean)).toEqual(['solid'])
    // Index 8 is transparent, so no pixel is opaque orange.
    const px = ts.pixels!
    for (let i = 0; i < px.length; i += 4) {
      if (px[i + 3] > 0)
        expect([px[i], px[i + 1], px[i + 2]]).not.toEqual([0x8b, 0x54, 0x29])
    }
  })

  it('rejects files that are not Aseprite', async () => {
    await expect(parseAseprite(new Uint8Array(10))).rejects.toThrow(
      AsepriteError,
    )
    await expect(parseAseprite(new Uint8Array(200))).rejects.toThrow(
      'Not an Aseprite file',
    )
    const cut = fixture('island-8-2_test').slice(0, 400)
    await expect(parseAseprite(cut)).rejects.toThrow(AsepriteError)
  })
})
