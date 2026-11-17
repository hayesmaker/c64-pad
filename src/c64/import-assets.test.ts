import { describe, expect, it } from 'vitest'
import { createCharmap } from './charmap'
import { createCharset } from './charset'
import { createProject, renameAsset } from './project'
import { createSpriteSet } from './sprite-set'
import { importAssets, importCandidates, requiredCharsets } from './import-assets'
import type { Project } from './project'

/** A copy of `base` (same asset ids) that gained a charset and a map. */
function fork(base: Project): Project {
  const charset = createCharset({ name: 'Level 2 chars' })
  const map = createCharmap({ name: 'Level 2', charsetId: charset.id })
  return {
    ...structuredClone(base),
    id: 'other',
    name: 'Tablet',
    charsets: [...base.charsets, charset],
    maps: [...base.maps, map],
  }
}

describe('importCandidates', () => {
  it('matches assets by id and compares their data', () => {
    const base = createProject({ name: 'Cloud' })
    const other = renameAsset(
      fork(base),
      'spriteSets',
      base.spriteSets[0].id,
      'Player',
    )
    const byName = Object.fromEntries(
      importCandidates(base, other).map((c) => [c.name, c.state]),
    )
    expect(byName).toEqual({
      Player: 'different',
      'Charset 1': 'same',
      'Level 2 chars': 'new',
      'Map 1': 'same',
      'Level 2': 'new',
    })
  })
})

describe('importAssets', () => {
  it('copies a changed map onto the copy of its changed charset', () => {
    const base = createProject({ name: 'Cloud' })
    const edited = renameAsset(
      renameAsset(structuredClone(base), 'charsets', base.charsets[0].id, 'C2'),
      'maps',
      base.maps[0].id,
      'M2',
    )
    const other = { ...edited, name: 'Tablet' }
    const merged = importAssets(base, other, [
      { kind: 'maps', id: base.maps[0].id },
    ])
    expect(merged.charsets.map((c) => c.name)).toEqual([
      'Charset 1',
      'C2 (Tablet)',
    ])
    expect(merged.maps[1].name).toBe('M2 (Tablet)')
    expect(merged.maps[1].charsetId).toBe(merged.charsets[1].id)
  })

  it('brings a map with the charset it needs, keeping ids', () => {
    const base = createProject({ name: 'Cloud' })
    const other = fork(base)
    const map = other.maps[1]
    const picks = [{ kind: 'maps' as const, id: map.id }]
    expect([...requiredCharsets(base, other, picks)]).toEqual([map.charsetId])

    const merged = importAssets(base, other, picks)
    expect(merged.maps.map((m) => m.name)).toEqual(['Map 1', 'Level 2'])
    expect(merged.charsets.map((c) => c.name)).toEqual([
      'Charset 1',
      'Level 2 chars',
    ])
    expect(merged.maps[1].id).toBe(map.id)
    expect(merged.maps[1].charsetId).toBe(map.charsetId)
    // A copy, not shared with the source.
    expect(merged.maps[1].cells).not.toBe(map.cells)
  })

  it("doesn't bring a charset this project already has unchanged", () => {
    const base = createProject({ name: 'Cloud' })
    const map = createCharmap({
      name: 'Bonus',
      charsetId: base.charsets[0].id,
    })
    const other = { ...structuredClone(base), maps: [...base.maps, map] }
    const picks = [{ kind: 'maps' as const, id: map.id }]
    expect(requiredCharsets(base, other, picks).size).toBe(0)
    const merged = importAssets(base, other, picks)
    expect(merged.charsets).toHaveLength(1)
    expect(merged.maps[1].charsetId).toBe(base.charsets[0].id)
  })

  it('imports changed assets as named copies, maps following', () => {
    const base = createProject({ name: 'Cloud' })
    const other = {
      ...renameAsset(
        structuredClone(base),
        'charsets',
        base.charsets[0].id,
        'Edited',
      ),
      name: 'Tablet',
      spriteSets: [createSpriteSet({ name: 'Enemies' })],
    }
    const merged = importAssets(base, other, [
      { kind: 'charsets', id: base.charsets[0].id },
      { kind: 'maps', id: base.maps[0].id },
      { kind: 'spriteSets', id: other.spriteSets[0].id },
    ])
    // The map is unchanged ("same"): nothing to bring.
    expect(merged.maps).toHaveLength(1)
    expect(merged.charsets.map((c) => c.name)).toEqual([
      'Charset 1',
      'Edited (Tablet)',
    ])
    expect(merged.charsets[1].id).not.toBe(base.charsets[0].id)
    expect(merged.spriteSets.map((s) => s.name)).toEqual([
      'Sprites 1',
      'Enemies',
    ])
  })
})
