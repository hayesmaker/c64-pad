import { useCallback, useSyncExternalStore } from 'react'
import {
  canRedo,
  canUndo,
  closeGroup,
  createHistory,
  record,
  redo,
  undo,
} from '@/c64/history'
import type { History } from '@/c64/history'
import type { Project } from '@/c64/project'
import type { ProjectSession } from '@/storage/session'

/**
 * Undo history for the Project Worksheet (names, palette, adding, duplicating
 * and deleting assets, imports), one per project, kept for the app session.
 * If the project is changed in an editor meanwhile, it restarts from there.
 */
const histories = new Map<string, History<Project>>()
const listeners = new Set<() => void>()
let version = 0
const notify = () => {
  version++
  listeners.forEach((l) => l())
}

/**
 * The same project apart from its save stamp: saving replaces the object
 * with one carrying a new `updatedAt`, which isn't a change to undo.
 */
export function sameProject(a: Project, b: Project): boolean {
  return (
    a === b ||
    (Object.keys(a) as Array<keyof Project>).every(
      (k) => k === 'updatedAt' || a[k] === b[k],
    )
  )
}

export function useProjectHistory(session: ProjectSession, current: Project) {
  useSyncExternalStore(
    (l) => {
      listeners.add(l)
      return () => listeners.delete(l)
    },
    () => version,
  )
  const id = current.id

  const get = useCallback((): History<Project> => {
    const live = session.getSnapshot().project
    const h = histories.get(id)
    if (!h || !sameProject(h.present, live)) {
      const fresh = createHistory(live)
      histories.set(id, fresh)
      return fresh
    }
    return h
  }, [session, id])

  const apply = useCallback(
    (h: History<Project>) => {
      histories.set(id, h)
      session.update(() => h.present)
      notify()
    },
    [session, id],
  )

  /** Change the project; changes sharing an open `group` undo as one step. */
  const change = useCallback(
    (fn: (project: Project) => Project, group?: string) => {
      const h = get()
      const next = fn(session.getSnapshot().project)
      if (sameProject(next, h.present)) return
      apply(record(h, next, { group }))
    },
    [get, apply, session],
  )

  /** End typing into a field, so the next edit is a new undo step. */
  const endGroup = useCallback(() => {
    const h = histories.get(id)
    if (h) histories.set(id, closeGroup(h))
  }, [id])

  const h = histories.get(id)
  const inSync = h !== undefined && sameProject(h.present, current)
  return {
    change,
    endGroup,
    undo: useCallback(() => apply(undo(get())), [apply, get]),
    redo: useCallback(() => apply(redo(get())), [apply, get]),
    canUndo: inSync && canUndo(h),
    canRedo: inSync && canRedo(h),
  }
}
