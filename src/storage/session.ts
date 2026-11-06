import { touchProject } from '@/c64/project'
import type { Project } from '@/c64/project'
import type { ProjectRepository } from './repository'

export type SaveStatus = 'saved' | 'pending' | 'saving' | 'error'

export interface SessionState {
  project: Project
  status: SaveStatus
  error: string | null
}

/**
 * An open project: holds the current state, notifies subscribers and autosaves
 * a short while after each change (and immediately on `flush`).
 */
export class ProjectSession {
  private state: SessionState
  private listeners = new Set<() => void>()
  private timer: ReturnType<typeof setTimeout> | undefined
  private saving: Promise<void> = Promise.resolve()

  constructor(
    project: Project,
    private readonly repo: ProjectRepository,
    private readonly delayMs = 500,
  ) {
    this.state = { project, status: 'saved', error: null }
  }

  get id(): string {
    return this.state.project.id
  }

  getSnapshot = (): SessionState => this.state

  subscribe = (listener: () => void): (() => void) => {
    this.listeners.add(listener)
    return () => this.listeners.delete(listener)
  }

  private set(next: Partial<SessionState>) {
    this.state = { ...this.state, ...next }
    this.listeners.forEach((l) => l())
  }

  /** Apply a change; no-op changes (same object) don't trigger a save. */
  update(change: (project: Project) => Project): void {
    const next = change(this.state.project)
    if (next === this.state.project) return
    this.set({ project: next, status: 'pending' })
    clearTimeout(this.timer)
    this.timer = setTimeout(() => void this.flush(), this.delayMs)
  }

  /** Save now if there are unsaved changes. */
  flush(): Promise<void> {
    clearTimeout(this.timer)
    this.timer = undefined
    if (this.state.status !== 'pending' && this.state.status !== 'error') {
      return this.saving
    }
    const snapshot = this.state.project
    this.saving = this.saving.then(async () => {
      this.set({ status: 'saving' })
      try {
        const stamped = touchProject(snapshot)
        await this.repo.save(stamped)
        // Keep the stamp only if nothing changed while saving.
        if (this.state.project === snapshot) {
          this.set({ project: stamped, status: 'saved', error: null })
        } else {
          this.set({ status: 'pending' })
          this.timer = setTimeout(() => void this.flush(), this.delayMs)
        }
      } catch (e) {
        this.set({ status: 'error', error: (e as Error).message })
      }
    })
    return this.saving
  }

  dispose(): void {
    clearTimeout(this.timer)
    this.listeners.clear()
  }
}
