import { describe, expect, it } from 'vitest'
import { createProject, touchProject } from '@/c64/project'
import { sameProject } from './project-history'

describe('sameProject', () => {
  it('ignores the save stamp but not real changes', () => {
    const p = createProject({}, new Date('2026-11-08T10:00:00Z'))
    expect(sameProject(p, p)).toBe(true)
    // Autosave replaces the object with a newer updatedAt: same project.
    const saved = touchProject(p, new Date('2026-11-08T10:00:05Z'))
    expect(saved).not.toBe(p)
    expect(sameProject(p, saved)).toBe(true)
    expect(sameProject(p, { ...p, name: 'Renamed' })).toBe(false)
    expect(sameProject(p, { ...p, maps: [] })).toBe(false)
  })
})
