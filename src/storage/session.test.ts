import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createProject, renameProject } from '@/c64/project'
import { ProjectSession } from './session'
import type { Project } from '@/c64/project'
import type { ProjectRepository } from './repository'

function memoryRepo() {
  const saved: Array<Project> = []
  const repo: ProjectRepository = {
    list: () => Promise.resolve([]),
    get: () => Promise.resolve(undefined),
    save: (p) => {
      saved.push(p)
      return Promise.resolve()
    },
    delete: () => Promise.resolve(),
  }
  return { repo, saved }
}

describe('project session autosave', () => {
  beforeEach(() => vi.useFakeTimers())
  afterEach(() => vi.useRealTimers())

  it('debounces changes into one save and stamps updatedAt', async () => {
    const { repo, saved } = memoryRepo()
    const project = createProject({}, new Date('2026-01-01'))
    const s = new ProjectSession(project, repo, 500)
    s.update((p) => renameProject(p, 'One'))
    s.update((p) => renameProject(p, 'Two'))
    expect(s.getSnapshot().status).toBe('pending')
    await vi.advanceTimersByTimeAsync(499)
    expect(saved).toHaveLength(0)
    await vi.advanceTimersByTimeAsync(1)
    expect(saved.map((p) => p.name)).toEqual(['Two'])
    expect(s.getSnapshot().status).toBe('saved')
    expect(s.getSnapshot().project.updatedAt).not.toBe(project.updatedAt)
  })

  it('flush saves immediately; no-op updates do nothing', async () => {
    const { repo, saved } = memoryRepo()
    const s = new ProjectSession(createProject(), repo)
    s.update((p) => p)
    await s.flush()
    expect(saved).toHaveLength(0)
    s.update((p) => renameProject(p, 'Now'))
    await s.flush()
    expect(saved).toHaveLength(1)
  })

  it('notifies subscribers and reports save errors', async () => {
    const repo: ProjectRepository = {
      ...memoryRepo().repo,
      save: () => Promise.reject(new Error('disk full')),
    }
    const s = new ProjectSession(createProject(), repo)
    const listener = vi.fn()
    s.subscribe(listener)
    s.update((p) => renameProject(p, 'X'))
    await s.flush()
    expect(listener).toHaveBeenCalled()
    expect(s.getSnapshot()).toMatchObject({
      status: 'error',
      error: 'disk full',
    })
  })
})
