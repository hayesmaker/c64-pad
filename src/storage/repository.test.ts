import 'fake-indexeddb/auto'
import { describe, expect, it } from 'vitest'
import { createProject } from '@/c64/project'
import { createIndexedDbRepository } from './repository'

let n = 0
const freshRepo = () => createIndexedDbRepository(`test-${n++}`)

describe('IndexedDB repository', () => {
  it('saves, loads, lists newest first and deletes', async () => {
    const repo = freshRepo()
    const a = createProject({ name: 'A' }, new Date('2026-01-01'))
    const b = createProject({ name: 'B' }, new Date('2026-02-01'))
    await repo.save(a)
    await repo.save(b)
    expect((await repo.list()).map((s) => s.name)).toEqual(['B', 'A'])
    const loaded = await repo.get(a.id)
    expect(loaded).toEqual(a)
    expect(loaded?.charsets[0].data).toBeInstanceOf(Uint8Array)
    await repo.delete(a.id)
    expect(await repo.get(a.id)).toBeUndefined()
    expect(await repo.list()).toHaveLength(1)
  })

  it('summarises asset counts', async () => {
    const repo = freshRepo()
    await repo.save(createProject())
    const [summary] = await repo.list()
    expect(summary.counts).toEqual({
      spriteSets: 1,
      sprites: 1,
      charsets: 1,
      maps: 1,
    })
  })
})
