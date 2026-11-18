import type { Project } from '@/c64/project'
import type { ProjectSummary } from '@/storage/repository'

/** A project in the cloud, from its summary (no pixel data). */
export interface CloudSummary extends ProjectSummary {
  /** When it was uploaded. */
  savedAt: string
}

export class CloudError extends Error {
  constructor(
    message: string,
    readonly options: {
      notFound?: boolean
      /** Signing in again would fix it (an expired or revoked Google token). */
      needsSignIn?: boolean
    } = {},
  ) {
    super(message)
    this.name = 'CloudError'
  }
}

/** What every cloud provider does; sync, Keep both etc. sit on top. */
export interface CloudClient {
  list: () => Promise<Array<CloudSummary>>
  /** One project's summary, or null if it isn't in the cloud. */
  summary: (id: string) => Promise<CloudSummary | null>
  get: (id: string) => Promise<Project>
  put: (project: Project) => Promise<CloudSummary>
  remove: (id: string) => Promise<void>
}

/** A summary from untrusted stored data, or null if it isn't one. */
export function toSummary(v: unknown): CloudSummary | null {
  if (typeof v !== 'object' || v === null) return null
  const o = v as Partial<CloudSummary>
  if (typeof o.id !== 'string' || typeof o.updatedAt !== 'string') return null
  return {
    id: o.id,
    name: String(o.name ?? 'Untitled'),
    program: String(o.program ?? ''),
    updatedAt: o.updatedAt,
    savedAt: String(o.savedAt ?? o.updatedAt),
    counts: {
      spriteSets: Number(o.counts?.spriteSets ?? 0),
      sprites: Number(o.counts?.sprites ?? 0),
      charsets: Number(o.counts?.charsets ?? 0),
      maps: Number(o.counts?.maps ?? 0),
    },
  }
}
