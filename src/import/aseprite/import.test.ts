import { describe, expect, it } from 'vitest'
import { getCell } from '@/c64/charmap'
import { isCharMulticolor, renderChar } from '@/c64/charset'
import { parseAseprite } from './parse'
import { analyseColours, checkStructure, fitCharset, mapSize } from './validate'
import { baseName, buildCharset, buildMap, uniqueName } from './convert'
import { fixture } from './test-fixtures'
import type { FixtureName } from './test-fixtures'
import type { AsepriteDoc } from './parse'

async function load(name: FixtureName) {
  const doc = await parseAseprite(fixture(name))
  const structure = checkStructure(doc)
  const colours = analyseColours(structure.source!.tileset, 'colodore')
  return { doc, structure, colours, fit: fitCharset(colours) }
}

describe('checkStructure', () => {
  it('passes the three sample files', async () => {
    for (const name of [
      'island1_round4',
      'island-8-1_test',
      'island-8-2_test',
    ] as const) {
      const { structure } = await load(name)
      expect(structure.ok, name).toBe(true)
      expect(structure.sources).toHaveLength(1)
    }
  })

  it('warns about what is left out', async () => {
    const { structure } = await load('island-8-1_test')
    expect(structure.warnings).toEqual([
      'Image layers aren’t imported: “Background”.'.replace('’', "'"),
      "Tile properties aren't imported yet: 1 tile tagged “solid” (tile 3).",
    ])
  })

  it('blocks files without a usable tilemap', async () => {
    const { doc } = await load('island-8-2_test')
    const noTilemap: AsepriteDoc = {
      ...doc,
      layers: doc.layers.filter((l) => l.kind !== 'tilemap'),
    }
    const report = checkStructure(noTilemap)
    expect(report.ok).toBe(false)
    expect(report.checks[0].text).toMatch(/No tilemap layer/)

    const big: AsepriteDoc = {
      ...doc,
      tilesets: [{ ...doc.tilesets[0], tileWidth: 16, tileHeight: 16 }],
    }
    expect(checkStructure(big).checks.find((c) => !c.ok)?.text).toBe(
      'Tiles are 16×16; only 8×8 is supported',
    )
  })
})

describe('analyseColours', () => {
  it('finds the Pepto palette and reads indices with it', async () => {
    const { colours } = await load('island1_round4')
    expect(colours.verdict).toBe('other-exact')
    expect(colours.palette).toBe('pepto')
    expect(colours.worst).toBe(0)
    expect(colours.transparent).toBe(false)
    expect(colours.tiles).toHaveLength(69)
  })

  it('is exact for a Pepto project', async () => {
    const { structure } = await load('island-8-2_test')
    const colours = analyseColours(structure.source!.tileset, 'pepto')
    expect(colours.verdict).toBe('project')
    expect(colours.transparent).toBe(true)
  })
})

describe('fitCharset', () => {
  it('fits every sample tile into one multicolour charset', async () => {
    const round4 = (await load('island1_round4')).fit
    expect(round4.mode).toBe('multicolor')
    expect([round4.background, round4.multicolor1, round4.multicolor2]).toEqual(
      [6, 7, 8],
    )
    expect(round4.failures).toEqual([])

    const t81 = (await load('island-8-1_test')).fit
    expect(t81.background).toBe(6) // transparent, and blue fits: blue
    expect(t81.failures).toEqual([])
    // Tile 1 is black and yellow on transparent: only a black background fits.
    const t82 = (await load('island-8-2_test')).fit
    expect(t82.background).toBe(0)
    expect(t82.failures).toEqual([])
  })

  it('keeps chosen registers and explains tiles that no longer fit', async () => {
    const { colours } = await load('island1_round4')
    const fit = fitCharset(colours, {
      background: 6,
      multicolor1: 7,
      multicolor2: 1,
    })
    expect([fit.multicolor1, fit.multicolor2]).toEqual([7, 1])
    expect(fit.failures.length).toBeGreaterThan(0)
    expect(fit.failures.some((f) => /Orange/.test(f.problem))).toBe(true)
  })

  it('uses a hires charset when every tile is hires', () => {
    const tile = new Int8Array(64).fill(-1)
    tile[0] = 13 // light green: fine in hires mode
    const fit = fitCharset({
      tiles: [new Int8Array(64).fill(-1), tile],
      transparent: true,
    })
    expect(fit.mode).toBe('hires')
    expect(fit.tiles[1]).toEqual({ mode: 'hires', color: 13, problem: null })
  })
})

describe('buildCharset / buildMap', () => {
  it.each(['island1_round4', 'island-8-1_test', 'island-8-2_test'] as const)(
    '%s: every char draws exactly like its tile',
    async (name) => {
      const { colours, fit } = await load(name)
      const cs = buildCharset('Test', colours, fit)
      expect(cs.mode).toBe(fit.mode)
      colours.tiles.forEach((tile, i) => {
        const expected = Array.from(tile, (c) => (c < 0 ? fit.background : c))
        expect(Array.from(renderChar(cs, i)), `tile ${i}`).toEqual(expected)
      })
      expect(colours.tiles.some((_, i) => isCharMulticolor(cs, i))).toBe(true)
    },
  )

  it('places an offset tilemap on the whole canvas', async () => {
    const { doc, structure } = await load('island-8-1_test')
    const source = structure.source!
    const map = buildMap('Map', doc, source, 'cs')
    expect([map.width, map.height]).toEqual([40, 256])
    expect(mapSize(doc)).toEqual({ width: 40, height: 256 })
    // Rows above the tilemap (y < 34) are char 0.
    expect(map.cells.slice(0, 34 * 40).every((c) => c === 0)).toBe(true)
    expect(getCell(map, 5, 34 + 10)).toBe(
      source.tilemap.tiles[10 * source.tilemap.width + 5],
    )
  })

  it('names imports after the file, without taking existing names', () => {
    expect(baseName('island1_round4.aseprite')).toBe('island1_round4')
    expect(baseName('x.ASE')).toBe('x')
    expect(uniqueName('a', [{ name: 'b' }])).toBe('a')
    expect(uniqueName('a', [{ name: 'a' }, { name: 'a 2' }])).toBe('a 3')
  })
})
