import { useSyncExternalStore } from 'react'

/**
 * Where projects are kept in the cloud: a DigitalOcean Space (any S3 bucket
 * at `<bucket>.<region>.digitaloceanspaces.com`). Personal use: the keys are
 * typed in on each device and kept only in that device's storage.
 */
export interface CloudSettings {
  /** Spaces region, e.g. "lon1". */
  region: string
  bucket: string
  accessKey: string
  secretKey: string
  /** Folder in the bucket for this app's files. */
  folder: string
}

const KEY = 'c64-pad.cloud'
export const DEFAULT_FOLDER = 'c64-pad'

const listeners = new Set<() => void>()
let cached: CloudSettings | null | undefined

export function loadCloudSettings(): CloudSettings | null {
  if (cached !== undefined) return cached
  try {
    const raw = localStorage.getItem(KEY)
    cached = raw ? parseSettings(JSON.parse(raw)) : null
  } catch {
    cached = null
  }
  return cached
}

export function saveCloudSettings(settings: CloudSettings | null) {
  cached = settings
  try {
    if (settings) localStorage.setItem(KEY, JSON.stringify(settings))
    else localStorage.removeItem(KEY)
  } catch {
    // Storage unavailable: the settings last for this session only.
  }
  listeners.forEach((l) => l())
}

export function useCloudSettings(): CloudSettings | null {
  return useSyncExternalStore(
    (l) => {
      listeners.add(l)
      return () => listeners.delete(l)
    },
    loadCloudSettings,
    () => null,
  )
}

function parseSettings(v: unknown): CloudSettings | null {
  if (typeof v !== 'object' || v === null) return null
  const o = v as Record<string, unknown>
  const s = (k: string) => (typeof o[k] === 'string' ? o[k].trim() : '')
  const settings = {
    region: s('region'),
    bucket: s('bucket'),
    accessKey: s('accessKey'),
    secretKey: s('secretKey'),
    folder: s('folder') || DEFAULT_FOLDER,
  }
  return isComplete(settings) ? settings : null
}

export function isComplete(s: CloudSettings) {
  return !!(s.region && s.bucket && s.accessKey && s.secretKey)
}

/** The version of each project this device last pushed or pulled. */
const BASES_KEY = 'c64-pad.cloud-synced'

export function loadSyncBases(): Record<string, string> {
  try {
    const raw = localStorage.getItem(BASES_KEY)
    const v: unknown = raw ? JSON.parse(raw) : {}
    return typeof v === 'object' && v !== null
      ? (v as Record<string, string>)
      : {}
  } catch {
    return {}
  }
}

export function setSyncBase(id: string, updatedAt: string | null) {
  const bases = loadSyncBases()
  if (updatedAt) bases[id] = updatedAt
  else delete bases[id]
  try {
    localStorage.setItem(BASES_KEY, JSON.stringify(bases))
  } catch {
    // Without a base, status falls back to comparing dates.
  }
}
