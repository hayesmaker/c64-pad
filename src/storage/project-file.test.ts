import { describe, expect, it } from 'vitest'
import { createProject } from '@/c64/project'
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
