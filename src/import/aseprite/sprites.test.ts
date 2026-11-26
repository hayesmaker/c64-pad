import { describe, expect, it } from 'vitest'
import { fitSprites } from '@/c64/sprite-fit'
import { renderSprite } from '@/c64/sprite-set'
import { layerShown, parseAseprite } from './parse'
import {
  buildSpriteSet,
  checkSpriteStructure,
  collectSprites,
  guessTransparent,
  readSpriteCells,
} from './sprites'
import { analysePixels } from './validate'
import { art, fill, writeAseprite } from './test-writer'
import type { TestFile } from './test-writer'

/** The whole import, as the dialog runs it. */
async function importSprites(file: TestFile) {
  const doc = await parseAseprite(writeAseprite(file))
  const structure = checkSpriteStructure(doc)
  const cells = readSpriteCells(doc, structure)
  const colours = analysePixels(
    doc,
    cells.map((c) => c.rgba),
    'colodore',
  )
  const transparent = guessTransparent(colours.images)
  const sheet = collectSprites(colours.images, transparent)
  const fit = fitSprites(sheet.images)
  const set = buildSpriteSet('Hero', doc, structure, sheet, fit)
  return { doc, structure, colours, transparent, sheet, fit, set }
}

/** A 24×21 multicolour frame: wide pixels in 0 / 1 / own, on transparent. */
function frame(own: string, shift = 0) {
  return art(
    Array.from({ length: 21 }, (_, y) =>
      Array.from({ length: 12 }, (__, px) => {
        const p = (px + shift) % 12
        const c = y < 3 ? '.' : p < 3 ? '0' : p < 6 ? '1' : p < 9 ? own : '.'
        return c + c
      }).join(''),
    ),
  )
}

describe('sprite import', () => {
  it('reads frames, shares linked frames and turns tags into animations', async () => {
    const { structure, sheet, fit, set } = await importSprites({
      width: 24,
      height: 21,
      frames: 3,
      durations: [100, 100, 100],
      layers: [{ name: 'Hero' }],
      cels: [
        { frame: 0, layer: 0, pixels: frame('2') },
        { frame: 1, layer: 0, pixels: frame('2', 1) },
        { frame: 2, layer: 0, linkedTo: 0 },
      ],
      tags: [{ name: 'walk', from: 0, to: 2, direction: 2 }],
    })
    expect(structure.ok).toBe(true)
    expect(structure.checks[1].text).toBe(
      'A 24×21 canvas: one sprite per frame',
    )
    expect([sheet.images.length, sheet.duplicates, sheet.empty]).toEqual([
      2, 1, 0,
    ])
    expect(fit.failures).toEqual([])
    expect(set.sprites.map((s) => [s.name, s.mode, s.color])).toEqual([
      ['walk 0', 'multicolor', 2],
      ['walk 1', 'multicolor', 2],
    ])
    const [a, b] = set.sprites.map((s) => s.id)
    expect(set.animations).toEqual([
      expect.objectContaining({
        name: 'walk',
        frames: [a, b, a],
        speed: 5,
        mode: 'pingpong',
      }),
    ])
  })

  it('reads 2:1 pixels as multicolour, one file pixel per sprite pixel pair', async () => {
    const rows = frame('3').map((row) => row.filter((_, x) => x % 2 === 0))
    const { structure, set, colours } = await importSprites({
      width: 12,
      height: 21,
      pixelRatio: [2, 1],
      layers: [{ name: 'Layer 1' }],
      cels: [{ frame: 0, layer: 0, pixels: rows }],
    })
    expect(structure.grid).toMatchObject({ cellWidth: 12, scaleX: 2 })
    expect(set.sprites[0].mode).toBe('multicolor')
    expect(renderSprite(set, set.sprites[0])).toEqual(colours.images[0])
  })

  it('cuts a sheet into sprites, skipping empty cells', async () => {
    const { structure, sheet, set } = await importSprites({
      width: 48,
      height: 42,
      layers: [{ name: 'A' }, { name: 'B' }, { name: 'C' }],
      cels: [
        { frame: 0, layer: 0, pixels: art(fill(24, 21, '5')) },
        { frame: 0, layer: 1, x: 24, pixels: art(fill(24, 21, '7')) },
        { frame: 0, layer: 2, y: 21, pixels: art(fill(24, 20, 'a')) },
      ],
      tags: [{ name: 'idle', from: 0, to: 0 }],
    })
    expect(structure.grid).toMatchObject({ columns: 2, rows: 2 })
    expect(structure.warnings).toContain(
      "Tags only become animations when each frame is one sprite, so they're left out.",
    )
    // The bottom-right cell is empty.
    expect([sheet.images.length, sheet.empty]).toEqual([3, 1])
    expect(set.sprites.map((s) => [s.name, s.color])).toEqual([
      ['Sprite 0', 5],
      ['Sprite 1', 7],
      ['Sprite 2', 10],
    ])
    expect(set.animations).toEqual([])
  })

  it('reads an opaque background as transparent', async () => {
    const pixels = art(fill(24, 21, '6'))
    pixels[10] = art(['6'.repeat(10) + '1111' + '6'.repeat(10)])[0]
    const { transparent, set } = await importSprites({
      width: 24,
      height: 21,
      layers: [{ name: 'Layer 1' }],
      cels: [{ frame: 0, layer: 0, pixels }],
    })
    expect(transparent).toBe(6)
    expect(set.sprites[0]).toMatchObject({ mode: 'hires', color: 1 })
  })

  it('ignores empty cells when guessing the see-through colour', async () => {
    const { transparent, sheet } = await importSprites({
      width: 48,
      height: 21,
      layers: [{ name: 'Layer 1' }],
      cels: [{ frame: 0, layer: 0, pixels: art(fill(24, 21, '6')) }],
    })
    // The right-hand cell is empty; the left one is all blue: see-through.
    expect(transparent).toBe(6)
    expect([sheet.images.length, sheet.empty]).toEqual([0, 2])
  })

  it('flattens visible layers only, over each other', async () => {
    const { set } = await importSprites({
      width: 24,
      height: 21,
      layers: [
        { name: 'Body' },
        { name: 'Hidden', visible: false },
        { name: 'Group', group: true, visible: false },
        { name: 'In hidden group', childLevel: 1 },
        { name: 'Face' },
      ],
      cels: [
        // Row 0 stays transparent, so the body isn't read as background.
        { frame: 0, layer: 0, y: 1, pixels: art(fill(24, 20, '2')) },
        { frame: 0, layer: 1, pixels: art(fill(24, 21, '3')) },
        { frame: 0, layer: 3, pixels: art(fill(24, 21, '4')) },
        { frame: 0, layer: 4, x: 4, y: 4, pixels: art(fill(2, 2, '5')) },
      ],
    })
    const pixels = renderSprite(set, set.sprites[0])
    expect(new Set(pixels)).toEqual(new Set([-1, 2, 5]))
    expect(pixels[4 * 24 + 4]).toBe(5)
  })

  it('works out which layers are shown inside groups', async () => {
    const doc = await parseAseprite(
      writeAseprite({
        width: 24,
        height: 21,
        layers: [
          { name: 'Group', group: true, visible: false },
          { name: 'Child', childLevel: 1 },
          { name: 'Top' },
        ],
        cels: [],
      }),
    )
    expect([0, 1, 2].map((i) => layerShown(doc, i))).toEqual([
      false,
      false,
      true,
    ])
  })

  it('blocks a canvas that is not a grid of sprites', async () => {
    const doc = await parseAseprite(
      writeAseprite({
        width: 30,
        height: 21,
        layers: [{ name: 'Layer 1' }],
        cels: [{ frame: 0, layer: 0, pixels: art(fill(30, 21, '1')) }],
      }),
    )
    const structure = checkSpriteStructure(doc)
    expect(structure.ok).toBe(false)
    expect(structure.checks[1].text).toBe(
      'The canvas is 30×21 px; sprites need 24×21, or a grid of them (e.g. 96×42)',
    )
  })
})
