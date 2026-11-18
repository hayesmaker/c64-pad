import { useSyncExternalStore } from 'react'

/**
 * Where projects are kept in the cloud. Personal and per device: Space keys
 * are typed in on each device, Google Drive signs in on each device.
 */
export type CloudSettings = SpacesSettings | DriveSettings | DropboxSettings
export type CloudProvider = CloudSettings['provider']

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

/** The signed-in account's Dropbox, in the app's folder (Apps/…). */
export interface DropboxSettings {
  provider: 'dropbox'
  email: string
  accountId: string
  /** Kept on this device only; signing out revokes it. */
  refreshToken: string
}

/** In the order the settings offer them. */
export const PROVIDERS: ReadonlyArray<CloudProvider> = [
  'gdrive',
  'dropbox',
  'spaces',
]

const KEY = 'c64-pad.cloud'
export const DEFAULT_FOLDER = 'c64-pad'

/**
 * Stored as `{ active, spaces?, gdrive? }`: each provider keeps its settings
 * while another is in use, so switching back needs nothing typed again.
 */
export interface StoredClouds {
  active: CloudProvider | null
  spaces?: SpacesSettings
  gdrive?: DriveSettings
  dropbox?: DropboxSettings
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
export function savedCloudSettings<TProvider extends CloudProvider>(
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

/** Forget a provider's settings; another saved one is used instead. */
export function forgetCloudSettings(provider: CloudProvider) {
  const next: StoredClouds = { ...stored(), [provider]: undefined }
  if (next.active === provider)
    next.active = PROVIDERS.find((p) => next[p]) ?? null
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
  const dropbox = parseSettings(o.dropbox)
  const result: StoredClouds = {
    active: null,
    ...(spaces?.provider === 'spaces' && { spaces }),
    ...(gdrive?.provider === 'gdrive' && { gdrive }),
    ...(dropbox?.provider === 'dropbox' && { dropbox }),
  }
  const active = PROVIDERS.find((p) => p === o.active)
  if (active && result[active]) result.active = active
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
  if (o.provider === 'dropbox')
    return s('accountId') && s('refreshToken')
      ? {
          provider: 'dropbox',
          email: s('email'),
          accountId: s('accountId'),
          refreshToken: s('refreshToken'),
        }
      : null
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
  switch (s.provider) {
    case 'gdrive':
      return `gdrive:${s.email}`
    case 'dropbox':
      return `dropbox:${s.accountId}`
    case 'spaces':
      return `spaces:${s.region}/${s.bucket}/${s.folder}`
  }
}

/** Where projects are, for people. */
export function cloudLabel(s: CloudSettings) {
  switch (s.provider) {
    case 'gdrive':
      return `Google Drive (${s.email})`
    case 'dropbox':
      return `Dropbox (${s.email})`
    case 'spaces':
      return `${s.bucket}/${s.folder}`
  }
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
