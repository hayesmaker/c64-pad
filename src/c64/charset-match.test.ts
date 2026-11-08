import { describe, expect, it } from 'vitest'
import { parseAseprite } from '@/import/aseprite/parse'
import {
  analyseColours,
  checkStructure,
  fitCharset,
} from '@/import/aseprite/validate'
import { buildCharset, buildMap } from '@/import/aseprite/convert'
import { fixture } from '@/import/aseprite/test-fixtures'
import { createCharmap } from './charmap'
import { createCharset, setCharBytes } from './charset'
import { planCharMerge, usedChars } from './charset-merge'
import { switchMapCharset } from './charset-match'
import { addAsset, createProject } from './project'
import { renderCharmap } from './render'
import type { FixtureName } from '@/import/aseprite/test-fixtures'

const solid = (b: number) => new Uint8Array(8).fill(b)

describe('switchMapCharset', () => {
  it('renumbers cells to matching chars and keeps codes that already match', () => {
    let a = createCharset({ name: 'A' })
    a = setCharBytes(a, 1, solid(0xff))
    a = setCharBytes(a, 2, solid(0x0f))
    let b = createCharset({ name: 'B', background: 0 }) // other background
    b = setCharBytes(b, 2, solid(0x0f)) // same code: kept
    b = setCharBytes(b, 9, solid(0xff)) // moved: $01 → $09
    const map = createCharmap({
      charsetId: a.id,
      width: 4,
      height: 1,
      cells: Uint8Array.of(1, 2, 0, 1),
    })
    const r = switchMapCharset(map, a, b)
    expect(r.map.charsetId).toBe(b.id)
    expect(Array.from(r.map.cells)).toEqual([9, 2, 0, 9])
    expect(r.renumbered).toEqual([{ from: 1, to: 9 }])
    expect(r.unmatched).toEqual([])
    // Empty chars match whatever the background colours.
    expect(r.map.blank).toBe(0)
  })

  it('keeps and lists codes with no match', () => {
    let a = createCharset({ name: 'A' })
    a = setCharBytes(a, 3, solid(0x81))
    let b = createCharset({ name: 'B' })
    b = setCharBytes(b, 3, solid(0x18)) // different char at the same code
    const map = createCharmap({
      charsetId: a.id,
      width: 1,
      height: 1,
      cells: Uint8Array.of(3),
    })
    const r = switchMapCharset(map, a, b)
    expect(r.unmatched).toEqual([3])
    expect(Array.from(r.map.cells)).toEqual([3])
  })

  it('moves both Rainbow Islands rounds onto their merged charset', async () => {
    async function imported(name: FixtureName) {
      const doc = await parseAseprite(fixture(name))
      const source = checkStructure(doc).source!
      const colours = analyseColours(doc, source.tileset, 'pepto')
      const cs = buildCharset(name, colours, fitCharset(colours))
      return { cs, map: buildMap(name, doc, source, cs.id) }
    }
    const one = await imported('island-8-1_test')
    const two = await imported('island-8-2_test')
    let p = createProject()
    p = addAsset(p, 'charsets', one.cs)
    p = addAsset(p, 'charsets', two.cs)
    p = addAsset(p, 'maps', one.map)
    p = addAsset(p, 'maps', two.map)
    const plan = planCharMerge(p, two.cs.id, one.cs.id, usedChars(two.cs))
    const merged = plan.merged

    // The base round's map: every code already matches.
    const r1 = switchMapCharset(one.map, one.cs, merged)
    expect(r1.renumbered).toEqual([])
    expect(r1.unmatched).toEqual([])
    expect(renderCharmap(r1.map, merged).pixels).toEqual(
      renderCharmap(one.map, one.cs).pixels,
    )

    // The merged-in round's map: renumbered to where its chars landed.
    const r2 = switchMapCharset(two.map, two.cs, merged)
    expect(r2.renumbered.length).toBeGreaterThan(0)
    // Only chars that couldn't be fitted into the merge go unmatched.
    const misfits = plan.problems.map((issue) => issue.char)
    expect(r2.unmatched.every((c) => misfits.includes(c))).toBe(true)
    // Every other cell draws exactly as before (unmatched ones blanked on
    // both sides; $00 is empty in both charsets).
    const unmatched = new Set(r2.unmatched)
    const blankOut = (cells: Uint8Array) =>
      cells.map((c) => (unmatched.has(c) ? 0 : c))
    expect(
      renderCharmap({ ...r2.map, cells: blankOut(r2.map.cells) }, merged)
        .pixels,
    ).toEqual(
      renderCharmap({ ...two.map, cells: blankOut(two.map.cells) }, two.cs)
        .pixels,
    )
  })
})
