import { useCallback, useEffect, useMemo, useState } from 'react'
import { newId } from '@/c64/ids'
import { projectRepository } from '@/storage/repository'
import { discardSession, openSession } from '@/storage/sessions'
import { createCloudClient } from './spaces'
import { loadSyncBases, setSyncBase, useCloudSettings } from './settings'
import { pullNeedsConfirm, pushNeedsConfirm, syncStatus } from './sync'
import type { CloudSummary } from './spaces'
import type { SyncStatus } from './sync'
import type { Project } from '@/c64/project'

/** A save or open that would overwrite changes; the page asks first. */
export type CloudConflict =
  | { action: 'push'; id: string; name: string; status: SyncStatus }
  | { action: 'pull'; id: string; name: string; status: SyncStatus }

export type PullMode = 'replace' | 'copy'

/**
 * The cloud copies of projects, and moving projects to and from them. Nothing
 * that would lose changes happens without `force` / a pull mode: those calls
 * return a CloudConflict for the page to confirm.
 */
export function useCloud() {
  const settings = useCloudSettings()
  const client = useMemo(
    () => (settings ? createCloudClient(settings) : null),
    [settings],
  )
  const [summaries, setSummaries] = useState<Array<CloudSummary> | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [bases, setBases] = useState(loadSyncBases)

  const refresh = useCallback(async () => {
    if (!client) {
      setSummaries(null)
      return
    }
    setLoading(true)
    setError(null)
    try {
      setSummaries(await client.list())
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setLoading(false)
    }
  }, [client])

  useEffect(() => {
    void refresh()
  }, [refresh])

  const markSynced = (id: string, updatedAt: string | null) => {
    setSyncBase(id, updatedAt)
    setBases(loadSyncBases())
  }

  const require = () => {
    if (!client) throw new Error('Set up the cloud first.')
    return client
  }

  /** This device's current copy, with any unsaved edits flushed. */
  const localProject = async (id: string): Promise<Project | undefined> => {
    if (!(await projectRepository.get(id))) return undefined
    const session = await openSession(id)
    await session.flush()
    return session.getSnapshot().project
  }

  const push = async (
    id: string,
    { force = false } = {},
  ): Promise<CloudConflict | null> => {
    const c = require()
    const project = await localProject(id)
    if (!project) throw new Error('That project is no longer on this device.')
    const remote = await c.summary(id)
    const status = syncStatus(project.updatedAt, remote?.updatedAt, bases[id])
    if (!force && pushNeedsConfirm(status))
      return { action: 'push', id, name: project.name, status }
    const saved = await c.put(project)
    markSynced(id, project.updatedAt)
    setSummaries((list) => [
      saved,
      ...(list ?? []).filter((s) => s.id !== id),
    ])
    return null
  }

  /** Returns the id of the project opened on this device, or a conflict. */
  const pull = async (
    id: string,
    mode?: PullMode,
  ): Promise<CloudConflict | { id: string }> => {
    const c = require()
    const remote = await c.get(id)
    const local = await localProject(id)
    const status = syncStatus(local?.updatedAt, remote.updatedAt, bases[id])
    if (!mode && pullNeedsConfirm(status))
      return { action: 'pull', id, name: remote.name, status }
    if (local && mode === 'copy') {
      const copy = { ...remote, id: newId(), name: `${remote.name} (cloud)` }
      await projectRepository.save(copy)
      return { id: copy.id }
    }
    discardSession(id)
    await projectRepository.save(remote)
    markSynced(id, remote.updatedAt)
    return { id }
  }

  const remove = async (id: string) => {
    await require().remove(id)
    markSynced(id, null)
    setSummaries((list) => (list ?? []).filter((s) => s.id !== id))
  }

  const statusOf = (id: string, localUpdatedAt: string | undefined) => {
    if (!summaries) return null
    const remote = summaries.find((s) => s.id === id)
    return syncStatus(localUpdatedAt, remote?.updatedAt, bases[id])
  }

  return {
    settings,
    summaries,
    loading,
    error,
    refresh,
    push,
    pull,
    remove,
    statusOf,
  }
}

export type Cloud = ReturnType<typeof useCloud>
