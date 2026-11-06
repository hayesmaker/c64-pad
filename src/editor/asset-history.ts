import { useCallback, useSyncExternalStore } from 'react'
import { findAsset, updateAsset } from '@/c64/project'
import {
  canRedo,
  canUndo,
  closeGroup,
  createHistory,
  record,
  redo,
  undo,
} from '@/c64/history'
import type { AssetKind, Project } from '@/c64/project'
import type { History } from '@/c64/history'
import type { ProjectSession } from '@/storage/session'

type AssetOf<TKind extends AssetKind> = Project[TKind][number]

/**
 * Undo history per asset, kept for the app session so leaving and returning to
 * an editor keeps its undo steps. If the asset was changed outside the editor
 * (e.g. renamed on the project page), the history restarts from that state.
 */
const histories = new Map<string, History<unknown>>()
const listeners = new Set<() => void>()
let version = 0
const notify = () => {
  version++
  listeners.forEach((l) => l())
}

export function useAssetHistory<TKind extends AssetKind>(
  session: ProjectSession,
  kind: TKind,
  id: string,
  current: AssetOf<TKind>,
) {
  useSyncExternalStore(
    (l) => {
      listeners.add(l)
      return () => listeners.delete(l)
    },
    () => version,
  )

  const get = useCallback((): History<AssetOf<TKind>> => {
    const live = findAsset(
      session.getSnapshot().project,
      kind,
      id,
    ) as AssetOf<TKind>
    const h = histories.get(id) as History<AssetOf<TKind>> | undefined
    if (!h || h.present !== live) {
      const fresh = createHistory(live)
      histories.set(id, fresh)
      return fresh
    }
    return h
  }, [session, kind, id])

  const apply = useCallback(
    (h: History<AssetOf<TKind>>) => {
      histories.set(id, h)
      session.update((p) => updateAsset(p, kind, id, () => h.present))
      notify()
    },
    [session, kind, id],
  )

  /** Change the asset; changes sharing an open `group` undo as one step. */
  const change = useCallback(
    (fn: (asset: AssetOf<TKind>) => AssetOf<TKind>, group?: string) => {
      const h = get()
      const next = fn(h.present)
      if (next === h.present) return
      apply(record(h, next, { group }))
    },
    [get, apply],
  )

  const endGroup = useCallback(() => {
    const h = histories.get(id)
    if (h) histories.set(id, closeGroup(h))
  }, [id])

  const h = histories.get(id) as History<AssetOf<TKind>> | undefined
  const inSync = h?.present === current
  return {
    change,
    endGroup,
    undo: useCallback(() => apply(undo(get())), [apply, get]),
    redo: useCallback(() => apply(redo(get())), [apply, get]),
    canUndo: inSync && canUndo(h),
    canRedo: inSync && canRedo(h),
  }
}
