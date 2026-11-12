import { describe, expect, it } from 'vitest'
import { setAttributeName, setCharAttribute } from '@/c64/charset'
import { PROJECT_VERSION, createProject } from '@/c64/project'
import { setSpritePixel } from '@/c64/sprite'
import { updateSprite } from '@/c64/sprite-set'
import {
  ProjectFileError,
  exportProjectFile,
  importProjectFile,
} from './project-file'

function sampleProject() {
  const p = createProject({ name: 'Star Patrol', program: 'Game' })
  const set = p.spriteSets[0]
  const spriteId = set.sprites[0].id
  return {
    ...p,
    spriteSets: [
      updateSprite(set, spriteId, (s) => setSpritePixel(s, 3, 4, 2)),
    ],
  }
}

describe('.c64pad files', () => {
  it('round-trips a project including pixel bytes', () => {
    const p = sampleProject()
    const text = exportProjectFile(p)
    const back = importProjectFile(text)
    expect(back).toEqual(p)
    expect(back.spriteSets[0].sprites[0].data).toBeInstanceOf(Uint8Array)
  })

  it('keeps the palette, and gives v1 projects Colodore', () => {
    const p = { ...sampleProject(), palette: 'pepto' as const }
    expect(importProjectFile(exportProjectFile(p)).palette).toBe('pepto')
    const json = JSON.parse(exportProjectFile(p))
    json.version = 1
    json.project.version = 1
    delete json.project.palette
    const v1 = importProjectFile(JSON.stringify(json))
    expect(v1.version).toBe(PROJECT_VERSION)
    expect(v1.palette).toBe('colodore')
    json.project.palette = 'made-up'
    expect(importProjectFile(JSON.stringify(json)).palette).toBe('colodore')
  })

  it('keeps char attributes, and gives v2 charsets none', () => {
    const p = sampleProject()
    const cs = setAttributeName(
      setCharAttribute(p.charsets[0], 5, 3),
      3,
      'Ladder',
    )
    const withAttrs = { ...p, charsets: [cs] }
    const back = importProjectFile(exportProjectFile(withAttrs))
    expect(back.charsets[0].attributes[5]).toBe(3)
    expect(back.charsets[0].attributes).toBeInstanceOf(Uint8Array)
    expect(back.charsets[0].attributeNames[3]).toBe('Ladder')

    const json = JSON.parse(exportProjectFile(p))
    json.version = 2
    json.project.version = 2
    delete json.project.charsets[0].attributes
    delete json.project.charsets[0].attributeNames
    const v2 = importProjectFile(JSON.stringify(json))
    expect(v2.version).toBe(PROJECT_VERSION)
    expect([...v2.charsets[0].attributes].every((a) => a === 0)).toBe(true)
    expect(v2.charsets[0].attributeNames).toHaveLength(16)
    expect(v2.charsets[0].attributeNames.every((n) => n === '')).toBe(true)
  })

  it('stores bytes as base64, not number arrays', () => {
    const text = exportProjectFile(sampleProject())
    expect(text).toContain('"$bytes"')
    expect(JSON.parse(text).format).toBe('c64pad-project')
  })

  it('rejects other JSON, newer versions and damaged data', () => {
    expect(() => importProjectFile('not json')).toThrow(ProjectFileError)
    expect(() => importProjectFile('{"format":"other"}')).toThrow(
      ProjectFileError,
    )
    const json = JSON.parse(exportProjectFile(sampleProject()))
    json.project.version = 99
    expect(() => importProjectFile(JSON.stringify(json))).toThrow(
      /newer C64-Pad/,
    )
    json.project.version = 1
    json.project.maps[0].charsetId = 'missing'
    expect(() => importProjectFile(JSON.stringify(json))).toThrow(/damaged/)
  })
})
