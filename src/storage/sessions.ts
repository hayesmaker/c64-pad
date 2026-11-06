import { ProjectSession } from './session'
import { projectRepository } from './repository'
import type { ProjectRepository } from './repository'

/** Open sessions shared by every page of a project (project page, editors). */
const sessions = new Map<string, ProjectSession>()

export class ProjectNotFoundError extends Error {
  constructor(id: string) {
    super(`Project ${id} not found`)
    this.name = 'ProjectNotFoundError'
  }
}

export async function openSession(
  id: string,
  repo: ProjectRepository = projectRepository,
): Promise<ProjectSession> {
  const open = sessions.get(id)
  if (open) return open
  const project = await repo.get(id)
  if (!project) throw new ProjectNotFoundError(id)
  const session = sessions.get(id) ?? new ProjectSession(project, repo)
  sessions.set(id, session)
  return session
}

/** A session already opened by the project route's loader. */
export function getOpenSession(id: string): ProjectSession {
  const session = sessions.get(id)
  if (!session) throw new ProjectNotFoundError(id)
  return session
}

export async function closeSession(id: string): Promise<void> {
  const session = sessions.get(id)
  if (!session) return
  await session.flush()
  session.dispose()
  sessions.delete(id)
}

/** Save everything now, e.g. when the app goes to the background. */
export function flushAllSessions(): Promise<void> {
  return Promise.all([...sessions.values()].map((s) => s.flush())).then(
    () => undefined,
  )
}

let installed = false
/** Flush on hide/pagehide (Android backgrounding, tab close). Call once at startup. */
export function installFlushOnHide(): void {
  if (installed || typeof document === 'undefined') return
  installed = true
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') void flushAllSessions()
  })
  window.addEventListener('pagehide', () => void flushAllSessions())
}

/** Drop a session without saving (the project is being deleted). */
export function discardSession(id: string): void {
  sessions.get(id)?.dispose()
  sessions.delete(id)
}
