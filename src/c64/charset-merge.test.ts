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
import {
  createCharset,
  renderChar,
  setAttributeName,
  setCharAttribute,
  setCharBytes,
  setCharColor,
} from './charset'
import {
  addMergedCharset,
  isCharEmpty,
  mergedCharsetName,
  planCharMerge,
  usedChars,
} from './charset-merge'
import { addAsset, createProject } from './project'
import { renderCharmap } from './render'
import type { FixtureName } from '@/import/aseprite/test-fixtures'
import type { Charset } from './charset'
import type { Project } from './project'

const solid = (b: number) => new Uint8Array(8).fill(b)

/** A hires charset with the given chars set to solid bytes. */
function charsetWith(name: string, chars: Record<number, number>): Charset {
  let cs = createCharset({ name })
  for (const [i, b] of Object.entries(chars)) {
    cs = setCharBytes(cs, Number(i), solid(b))
  }
  return cs
}

/** A project holding `a` (with a map using chars 1 and 2) and `b`. */
function twoCharsets(a: Charset, b: Charset): Project {
  let p = createProject()
  p = addAsset(p, 'charsets', a)
  p = addAsset(p, 'charsets', b)
  return addAsset(
    p,
    'maps',
    createCharmap({
      name: 'A map',
      charsetId: a.id,
      width: 3,
      height: 1,
      cells: Uint8Array.of(1, 0, 2),
    }),
  )
}

describe('usedChars', () => {
  it('lists chars with pixels, skipping empty ones like $00', () => {
    const cs = charsetWith('A', { 1: 0xff, 7: 0x0f })
    expect(usedChars(cs)).toEqual([1, 7])
    expect(isCharEmpty(cs, 0)).toBe(true)
  })
})

describe('planCharMerge', () => {
  it('copies into the first free slots, keeping order', () => {
    const a = charsetWith('A', { 1: 0xff, 2: 0xf0 })
    const b = charsetWith('B', { 1: 0x81 })
    const p = twoCharsets(a, b)
    const plan = planCharMerge(p, a.id, b.id, usedChars(a))
    expect(plan.error).toBeNull()
    // B's $00 is empty and unused, $01 is taken: $00 and $02 are free.
    expect(plan.moves).toEqual([
      { from: 1, to: 0, reused: false },
      { from: 2, to: 2, reused: false },
    ])
  })

  it('never fills a slot a map of the target uses, even if empty', () => {
    const a = charsetWith('A', { 1: 0xff })
    const b = charsetWith('B', {})
    let p = twoCharsets(a, b)
    p = addAsset(p, 'maps', createCharmap({ name: 'B map', charsetId: b.id }))
    const plan = planCharMerge(p, a.id, b.id, [1])
    // B's map uses $00 (its blank), so $00 stays empty.
    expect(plan.moves).toEqual([{ from: 1, to: 1, reused: false }])
  })

  it('reuses a char the target already has', () => {
    const a = charsetWith('A', { 1: 0xff, 2: 0x3c })
    const b = charsetWith('B', { 9: 0x3c })
    const plan = planCharMerge(twoCharsets(a, b), a.id, b.id, [1, 2])
    expect(plan.moves[1]).toEqual({ from: 2, to: 9, reused: true })
  })

  it('refuses when the target is full', () => {
    let b = createCharset({ name: 'B' })
    for (let i = 0; i < 256; i++) {
      b = setCharBytes(b, i, Uint8Array.of(i, 0x55, 0, 0, 0, 0, 0, 0))
    }
    const a = charsetWith('A', { 1: 0xff })
    const plan = planCharMerge(twoCharsets(a, b), a.id, b.id, [1])
    expect(plan.error).toMatch(/Not enough room/)
  })

  it('explains chars that will look different in the target', () => {
    let a = charsetWith('A', { 1: 0xff })
    a = setCharColor(a, 1, 8) // orange: fine in hires, not in multicolour
    const b = createCharset({ name: 'B', mode: 'multicolor' })
    const plan = planCharMerge(twoCharsets(a, b), a.id, b.id, [1])
    expect(plan.problems).toEqual([
      { char: 1, problem: expect.stringMatching(/Orange/) },
    ])
  })
})

describe('attributes', () => {
  it('copied chars keep their attribute; names fill gaps or warn', () => {
    let a = charsetWith('A', { 1: 0xff, 2: 0xf0 })
    a = setCharAttribute(setCharAttribute(a, 1, 3), 2, 4)
    a = setAttributeName(setAttributeName(a, 3, 'Ladder'), 4, 'Spikes')
    const b = setAttributeName(charsetWith('B', { 1: 0x81 }), 4, 'Lava')
    const plan = planCharMerge(twoCharsets(a, b), a.id, b.id, [1, 2])
    const [m1, m2] = plan.moves
    expect(plan.merged.attributes[m1.to]).toBe(3)
    expect(plan.merged.attributes[m2.to]).toBe(4)
    expect(plan.merged.attributeNames[3]).toBe('Ladder')
    expect(plan.merged.attributeNames[4]).toBe('Lava')
    expect(plan.warnings.some((w) => w.includes('Spikes'))).toBe(true)
  })

  it('only reuses a matching char with the same attribute', () => {
    const a = setCharAttribute(charsetWith('A', { 1: 0x3c }), 1, 2)
    const b = charsetWith('B', { 9: 0x3c })
    const plan = planCharMerge(twoCharsets(a, b), a.id, b.id, [1])
    expect(plan.moves[0].reused).toBe(false)
    const same = setCharAttribute(b, 9, 2)
    const plan2 = planCharMerge(twoCharsets(a, same), a.id, same.id, [1])
    expect(plan2.moves[0]).toEqual({ from: 1, to: 9, reused: true })
  })
})

describe('colour fitting', () => {
  it('keeps colours when the target has them in other registers', () => {
    // Source: MC1 white, MC2 yellow. Target: MC1 yellow, MC2 orange.
    let a = createCharset({
      name: 'A',
      mode: 'multicolor',
      multicolor1: 1,
      multicolor2: 7,
    })
    // Bit pairs 01 (white) and 10 (yellow), as a multicolour char in red.
    a = setCharBytes(a, 1, solid(0b01100110))
    a = setCharColor(a, 1, 2)
    const b = createCharset({
      name: 'B',
      mode: 'multicolor',
      multicolor1: 7,
      multicolor2: 8,
    })
    const p = twoCharsets(a, b)
    const plan = planCharMerge(p, a.id, b.id, [1])
    expect(plan.problems).toEqual([])
    const to = plan.moves[0].to
    // White becomes the char's own colour; yellow moves to B's MC1.
    expect(Array.from(renderChar(plan.merged, to))).toEqual(
      Array.from(renderChar(a, 1)),
    )
  })
})

describe('addMergedCharset', () => {
  it('adds a new charset and changes nothing else', () => {
    const a = charsetWith('A', { 1: 0xff, 2: 0xf0 })
    const b = charsetWith('B', { 0: 0x18, 1: 0x81 })
    let p = twoCharsets(a, b)
    p = addAsset(
      p,
      'maps',
      createCharmap({
        name: 'B map',
        charsetId: b.id,
        width: 2,
        height: 1,
        cells: Uint8Array.of(0, 1),
      }),
    )
    const plan = planCharMerge(p, a.id, b.id, usedChars(a))
    expect(mergedCharsetName(p, plan)).toBe('B + A')
    const next = addMergedCharset(p, plan, 'B + A')

    expect(next.charsets.map((c) => c.name)).toEqual([
      ...p.charsets.map((c) => c.name),
      'B + A',
    ])
    // The originals and every map are untouched.
    p.charsets.forEach((c, i) => expect(next.charsets[i]).toBe(c))
    expect(next.maps).toBe(p.maps)

    // B's chars kept their slots, so B's map looks the same on the new set.
    const merged = next.charsets.at(-1)!
    expect(merged.id).not.toBe(b.id)
    const bMap = p.maps.at(-1)!
    expect(
      renderCharmap({ ...bMap, charsetId: merged.id }, merged).pixels,
    ).toEqual(renderCharmap(bMap, b).pixels)
    expect(mergedCharsetName(next, plan)).toBe('B + A 2')
  })

  it('merges two Rainbow Islands imports, sharing their common tiles', async () => {
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
    expect(plan.error).toBeNull()
    expect(plan.moves.some((m) => m.reused)).toBe(true)
    // The base round's map draws exactly as imported on the merged set.
    expect(renderCharmap(one.map, plan.merged).pixels).toEqual(
      renderCharmap(one.map, one.cs).pixels,
    )
    // Each added char draws as it did in its own charset, apart from the
    // ones listed as not fitting one's registers.
    const misfits = new Set(plan.problems.map((issue) => issue.char))
    expect(misfits.size).toBeLessThan(plan.moves.length / 4)
    for (const m of plan.moves.filter((move) => !misfits.has(move.from))) {
      expect(Array.from(renderChar(plan.merged, m.to))).toEqual(
        Array.from(renderChar(two.cs, m.from)),
      )
    }
  })
})
