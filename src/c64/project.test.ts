import { describe, expect, it } from 'vitest'
import { createCharmap } from './charmap'
import { createCharset } from './charset'
import { ModelError } from './errors'
import {
  addAsset,
  createProject,
  duplicateAsset,
  findAsset,
  mapsUsingCharset,
  removeCharset,
  removeMap,
  renameAsset,
  setMapCharset,
  touchProject,
  updateAsset,
} from './project'

const now = new Date('2026-11-06T12:00:00Z')

describe('project', () => {
  it('starts with a sprite set, a charset and a map using it', () => {
    const p = createProject({ name: 'Star Patrol' }, now)
    expect(p.version).toBe(1)
    expect(p.dateDesigned).toBe('2026-11-06')
    expect([p.spriteSets.length, p.charsets.length, p.maps.length]).toEqual([
      1, 1, 1,
    ])
    expect(p.maps[0].charsetId).toBe(p.charsets[0].id)
  })

  it('rejects maps pointing at missing charsets', () => {
    const p = createProject()
    expect(() =>
      addAsset(p, 'maps', createCharmap({ charsetId: 'missing' })),
    ).toThrow(ModelError)
    expect(() => setMapCharset(p, p.maps[0].id, 'missing')).toThrow(ModelError)
  })

  it('will not remove a charset in use unless maps are reassigned', () => {
    let p = createProject()
    const used = p.charsets[0].id
    expect(mapsUsingCharset(p, used)).toHaveLength(1)
    expect(() => removeCharset(p, used)).toThrow(ModelError)
    expect(() => removeCharset(p, used, { reassignTo: used })).toThrow(
      ModelError,
    )
    const other = createCharset({ name: 'Other' })
    p = addAsset(p, 'charsets', other)
    p = removeCharset(p, used, { reassignTo: other.id })
    expect(p.charsets.map((c) => c.id)).toEqual([other.id])
    expect(p.maps[0].charsetId).toBe(other.id)
  })

  it('removes an unused charset directly', () => {
    let p = addAsset(createProject(), 'charsets', createCharset())
    p = removeCharset(p, p.charsets[1].id)
    expect(p.charsets).toHaveLength(1)
  })

  it('updates, renames and duplicates assets', () => {
    let p = createProject()
    const setId = p.spriteSets[0].id
    p = renameAsset(p, 'spriteSets', setId, 'Ships')
    expect(findAsset(p, 'spriteSets', setId)?.name).toBe('Ships')
    expect(() =>
      updateAsset(p, 'maps', p.maps[0].id, (m) => ({ ...m, id: 'x' })),
    ).toThrow(ModelError)
    p = duplicateAsset(p, 'charsets', p.charsets[0].id)
    expect(p.charsets[1].name).toBe('Charset 1 copy')
    expect(p.charsets[1].id).not.toBe(p.charsets[0].id)
    expect(p.charsets[1].data).not.toBe(p.charsets[0].data)
    p = removeMap(p, p.maps[0].id)
    expect(p.maps).toHaveLength(0)
  })

  it('stamps updatedAt on touch', () => {
    const p = createProject({}, now)
    expect(touchProject(p, new Date('2026-12-01T00:00:00Z')).updatedAt).toBe(
      '2026-12-01T00:00:00.000Z',
    )
  })
})
