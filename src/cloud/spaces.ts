import { AwsClient } from 'aws4fetch'
import { exportProjectFile, importProjectFile } from '@/storage/project-file'
import { summarize } from '@/storage/repository'
import type { CloudSettings } from './settings'
import type { Project } from '@/c64/project'
import type { ProjectSummary } from '@/storage/repository'

/** A project in the cloud, from its small summary file. */
export interface CloudSummary extends ProjectSummary {
  /** When it was uploaded. */
  savedAt: string
}

export class CloudError extends Error {
  constructor(
    message: string,
    readonly notFound = false,
  ) {
    super(message)
    this.name = 'CloudError'
  }
}

export interface CloudClient {
  list: () => Promise<Array<CloudSummary>>
  /** One project's summary, or null if it isn't in the cloud. */
  summary: (id: string) => Promise<CloudSummary | null>
  get: (id: string) => Promise<Project>
  put: (project: Project) => Promise<CloudSummary>
  remove: (id: string) => Promise<void>
}

/**
 * Projects in a DigitalOcean Space (S3 API), signed on the device. Each
 * project is `<folder>/<id>.c64pad` (the export format) plus `<id>.json`, a
 * summary so the list doesn't download every project.
 */
export function createCloudClient(settings: CloudSettings): CloudClient {
  const aws = new AwsClient({
    accessKeyId: settings.accessKey,
    secretAccessKey: settings.secretKey,
    service: 's3',
    // Spaces accepts the S3 default region in signatures.
    region: 'us-east-1',
  })
  const base = `https://${settings.bucket}.${settings.region}.digitaloceanspaces.com`
  const folder = settings.folder.replace(/^\/+|\/+$/g, '')
  const key = (name: string) => `${folder}/${name}`
  const url = (k: string) =>
    `${base}/${k.split('/').map(encodeURIComponent).join('/')}`

  const request = async (input: string, init: RequestInit = {}) => {
    let res: Response
    try {
      res = await aws.fetch(input, { cache: 'no-store', ...init })
    } catch {
      throw new CloudError(
        `Couldn't reach the Space “${settings.bucket}” in ${settings.region}. Check the region, the bucket name and the Space's CORS settings, and that you're online.`,
      )
    }
    if (!res.ok)
      throw new CloudError(await describeError(res), res.status === 404)
    return res
  }

  const getJson = async (k: string) =>
    (await (await request(url(k))).json()) as unknown

  return {
    async list() {
      const keys: Array<string> = []
      let token: string | null = null
      do {
        const params = new URLSearchParams({
          'list-type': '2',
          prefix: `${folder}/`,
        })
        if (token) params.set('continuation-token', token)
        const xml = await (await request(`${base}/?${params}`)).text()
        const page = parseListing(xml)
        keys.push(...page.keys)
        token = page.next
      } while (token)
      const summaries = await Promise.all(
        keys
          .filter((k) => k.endsWith('.json'))
          .map(async (k) => toSummary(await getJson(k))),
      )
      return summaries
        .filter((s): s is CloudSummary => s !== null)
        .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
    },

    async summary(id) {
      try {
        return toSummary(await getJson(key(`${id}.json`)))
      } catch (e) {
        if (e instanceof CloudError && e.notFound) return null
        throw e
      }
    },

    async get(id) {
      const res = await request(url(key(`${id}.c64pad`)))
      return importProjectFile(await res.text())
    },

    async put(project) {
      const summary: CloudSummary = {
        ...summarize(project),
        savedAt: new Date().toISOString(),
      }
      // The project first: a summary never points at a missing file.
      await request(url(key(`${project.id}.c64pad`)), {
        method: 'PUT',
        body: exportProjectFile(project),
        headers: { 'Content-Type': 'application/json', 'x-amz-acl': 'private' },
      })
      await request(url(key(`${project.id}.json`)), {
        method: 'PUT',
        body: JSON.stringify(summary),
        headers: { 'Content-Type': 'application/json', 'x-amz-acl': 'private' },
      })
      return summary
    },

    async remove(id) {
      await request(url(key(`${id}.json`)), { method: 'DELETE' })
      await request(url(key(`${id}.c64pad`)), { method: 'DELETE' })
    },
  }
}

/** Keys and continuation token from a ListObjectsV2 response. */
export function parseListing(xml: string): {
  keys: Array<string>
  next: string | null
} {
  const keys = [...xml.matchAll(/<Key>([^<]*)<\/Key>/g)].map((m) =>
    decodeXml(m[1]),
  )
  const truncated = /<IsTruncated>true<\/IsTruncated>/.test(xml)
  const next = /<NextContinuationToken>([^<]*)<\/NextContinuationToken>/.exec(
    xml,
  )
  return { keys, next: truncated && next ? decodeXml(next[1]) : null }
}

function decodeXml(s: string) {
  return s
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&amp;/g, '&')
}

async function describeError(res: Response) {
  const text = await res.text().catch(() => '')
  const code = /<Code>([^<]*)<\/Code>/.exec(text)?.[1]
  switch (code) {
    case 'InvalidAccessKeyId':
    case 'SignatureDoesNotMatch':
      return 'The Space rejected the access key or secret. Check them in Cloud settings.'
    case 'AccessDenied':
      return "This access key isn't allowed to use that Space."
    case 'NoSuchBucket':
      return 'There is no Space with that name in that region.'
    case 'NoSuchKey':
      return 'That project is no longer in the cloud.'
  }
  return `The Space answered ${res.status}${code ? ` (${code})` : ''}.`
}

function toSummary(v: unknown): CloudSummary | null {
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
