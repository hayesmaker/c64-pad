import { useSyncExternalStore } from 'react'

/**
 * Where projects are kept in the cloud. Personal and per device: Space keys
 * are typed in on each device, Google Drive signs in on each device.
 */
export type CloudSettings = SpacesSettings | DriveSettings

/** A DigitalOcean Space: `<bucket>.<region>.digitaloceanspaces.com`. */
export interface SpacesSettings {
  provider: 'spaces'
  /** Spaces region, e.g. "lon1". */
  region: string
  bucket: string
  accessKey: string
  secretKey: string
  /** Folder in the bucket for this app's files. */
  folder: string
}

/** The signed-in Google account's Drive, in a "C64-Pad" folder. */
export interface DriveSettings {
  provider: 'gdrive'
  email: string
}

const KEY = 'c64-pad.cloud'
export const DEFAULT_FOLDER = 'c64-pad'

/**
 * Stored as `{ active, spaces?, gdrive? }`: each provider keeps its settings
 * while another is in use, so switching back needs nothing typed again.
 */
export interface StoredClouds {
  active: CloudSettings['provider'] | null
  spaces?: SpacesSettings
  gdrive?: DriveSettings
}

const listeners = new Set<() => void>()
let cached: StoredClouds | undefined

function stored(): StoredClouds {
  if (cached) return cached
  try {
    const raw = localStorage.getItem(KEY)
    cached = parseStored(raw ? JSON.parse(raw) : null)
  } catch {
    cached = { active: null }
  }
  return cached
}

function write(next: StoredClouds) {
  cached = next
  try {
    localStorage.setItem(KEY, JSON.stringify(next))
  } catch {
    // Storage unavailable: the settings last for this session only.
  }
  listeners.forEach((l) => l())
}

/** The cloud in use, or null. */
export function loadCloudSettings(): CloudSettings | null {
  const s = stored()
  return (s.active && s[s.active]) ?? null
}

/** A provider's saved settings, in use or not. */
export function savedCloudSettings<TProvider extends CloudSettings['provider']>(
  provider: TProvider,
): StoredClouds[TProvider] {
  return stored()[provider]
}

/** Save a provider's settings and use it. */
export function saveCloudSettings(settings: CloudSettings) {
  write({
    ...stored(),
    [settings.provider]: settings,
    active: settings.provider,
  })
}

/** Forget a provider's settings; the other one, if saved, is used instead. */
export function forgetCloudSettings(provider: CloudSettings['provider']) {
  const next: StoredClouds = { ...stored(), [provider]: undefined }
  if (next.active === provider) {
    const other = provider === 'gdrive' ? 'spaces' : 'gdrive'
    next.active = next[other] ? other : null
  }
  write(next)
}

export function parseStored(v: unknown): StoredClouds {
  if (typeof v !== 'object' || v === null) return { active: null }
  const o = v as Record<string, unknown>
  if (!('active' in o)) {
    // One provider's settings, from before they were kept side by side.
    const one = parseSettings(o)
    return one
      ? { active: one.provider, [one.provider]: one }
      : { active: null }
  }
  const spaces = parseSettings(o.spaces)
  const gdrive = parseSettings(o.gdrive)
  const result: StoredClouds = {
    active: null,
    ...(spaces?.provider === 'spaces' && { spaces }),
    ...(gdrive?.provider === 'gdrive' && { gdrive }),
  }
  if ((o.active === 'spaces' || o.active === 'gdrive') && result[o.active])
    result.active = o.active
  return result
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

export function parseSettings(v: unknown): CloudSettings | null {
  if (typeof v !== 'object' || v === null) return null
  const o = v as Record<string, unknown>
  const s = (k: string) => (typeof o[k] === 'string' ? o[k].trim() : '')
  if (o.provider === 'gdrive')
    return s('email') ? { provider: 'gdrive', email: s('email') } : null
  // Saved before there was a choice of provider: a Space.
  const settings: SpacesSettings = {
    provider: 'spaces',
    region: s('region'),
    bucket: s('bucket'),
    accessKey: s('accessKey'),
    secretKey: s('secretKey'),
    folder: s('folder') || DEFAULT_FOLDER,
  }
  return isComplete(settings) ? settings : null
}

export function isComplete(s: SpacesSettings) {
  return !!(s.region && s.bucket && s.accessKey && s.secretKey)
}

/** Which cloud store the settings point at; sync records are kept per store. */
export function cloudScope(s: CloudSettings) {
  return s.provider === 'gdrive'
    ? `gdrive:${s.email}`
    : `spaces:${s.region}/${s.bucket}/${s.folder}`
}

/** Where projects are, for people. */
export function cloudLabel(s: CloudSettings) {
  return s.provider === 'gdrive'
    ? `Google Drive (${s.email})`
    : `${s.bucket}/${s.folder}`
}

/**
 * The version of each project this device last pushed or pulled, per cloud
 * store: `{ scopes: { [scope]: { [projectId]: updatedAt } } }`.
 */
const BASES_KEY = 'c64-pad.cloud-synced'

type Bases = Partial<Record<string, Record<string, string>>>

/** Sync records from before providers: they belong to the Space. */
const LEGACY = 'legacy'

function readBases(): Bases {
  try {
    const raw = localStorage.getItem(BASES_KEY)
    const v: unknown = raw ? JSON.parse(raw) : {}
    if (typeof v !== 'object' || v === null) return {}
    const o = v as Record<string, unknown>
    if (typeof o.scopes === 'object' && o.scopes !== null) return o.scopes
    return Object.keys(o).length
      ? { [LEGACY]: o as Record<string, string> }
      : {}
  } catch {
    return {}
  }
}

function basesFor(all: Bases, scope: string) {
  return (
    all[scope] ?? (scope.startsWith('spaces:') ? all[LEGACY] : undefined) ?? {}
  )
}

export function loadSyncBases(scope: string): Record<string, string> {
  return basesFor(readBases(), scope)
}

export function setSyncBase(
  scope: string,
  id: string,
  updatedAt: string | null,
) {
  const all = readBases()
  const bases = { ...basesFor(all, scope) }
  if (updatedAt) bases[id] = updatedAt
  else delete bases[id]
  all[scope] = bases
  if (scope.startsWith('spaces:')) delete all[LEGACY]
  try {
    localStorage.setItem(BASES_KEY, JSON.stringify({ scopes: all }))
  } catch {
    // Without a base, status falls back to comparing dates.
  }
}
