import { exportProjectFile, importProjectFile } from '@/storage/project-file'
import { summarize } from '@/storage/repository'
import { dropboxToken } from './dropbox-auth'
import { CloudError, toSummary } from './types'
import type { DropboxSettings } from './settings'
import type { CloudClient, CloudSummary } from './types'

const API = 'https://api.dropboxapi.com/2'
const CONTENT = 'https://content.dropboxapi.com/2'

/**
 * Projects in the app's folder in the user's Dropbox (Apps/<app name>): each
 * is `<id>.c64pad` (the export format) plus `<id>.json`, a summary, as in a
 * Space.
 */
export function createDropboxClient(settings: DropboxSettings): CloudClient {
  const request = async (
    url: string,
    init: RequestInit & { headers?: Record<string, string> },
  ): Promise<Response> => {
    const send = async (renew: boolean) => {
      const token = await dropboxToken(settings, { renew })
      try {
        return await fetch(url, {
          method: 'POST',
          cache: 'no-store',
          ...init,
          headers: { ...init.headers, Authorization: `Bearer ${token}` },
        })
      } catch {
        throw new CloudError(
          "Couldn't reach Dropbox. Check that you're online.",
        )
      }
    }
    let res = await send(false)
    if (res.status === 401) res = await send(true)
    if (res.status === 401)
      throw new CloudError('Dropbox needs you to sign in again.', {
        needsSignIn: true,
      })
    if (!res.ok) throw await describeError(res)
    return res
  }

  const rpc = async (endpoint: string, args: unknown) =>
    (await (
      await request(`${API}/${endpoint}`, {
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(args),
      })
    ).json()) as unknown

  const download = async (path: string) =>
    (
      await request(`${CONTENT}/files/download`, {
        headers: { 'Dropbox-API-Arg': apiArg({ path }) },
      })
    ).text()

  const upload = (path: string, body: string) =>
    request(`${CONTENT}/files/upload`, {
      headers: {
        'Content-Type': 'application/octet-stream',
        'Dropbox-API-Arg': apiArg({ path, mode: 'overwrite', mute: true }),
      },
      body,
    })

  return {
    async list() {
      const names: Array<string> = []
      let page = (await rpc('files/list_folder', { path: '' })) as Listing
      names.push(...fileNames(page))
      while (page.has_more) {
        page = (await rpc('files/list_folder/continue', {
          cursor: page.cursor,
        })) as Listing
        names.push(...fileNames(page))
      }
      const summaries = await Promise.all(
        names
          .filter((n) => n.endsWith('.json'))
          .map(async (n) => toSummary(JSON.parse(await download(`/${n}`)))),
      )
      return summaries
        .filter((s): s is CloudSummary => s !== null)
        .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
    },

    async summary(id) {
      try {
        return toSummary(JSON.parse(await download(`/${id}.json`)))
      } catch (e) {
        if (e instanceof CloudError && e.options.notFound) return null
        throw e
      }
    },

    async get(id) {
      return importProjectFile(await download(`/${id}.c64pad`))
    },

    async put(project) {
      const summary: CloudSummary = {
        ...summarize(project),
        savedAt: new Date().toISOString(),
      }
      // The project first: a summary never points at a missing file.
      await upload(`/${project.id}.c64pad`, exportProjectFile(project))
      await upload(`/${project.id}.json`, JSON.stringify(summary))
      return summary
    },

    async remove(id) {
      // Dropbox keeps deleted files for a while, where they can be restored.
      await rpc('files/delete_v2', { path: `/${id}.json` })
      await rpc('files/delete_v2', { path: `/${id}.c64pad` })
    },
  }
}

interface Listing {
  entries: Array<{ '.tag': string; name: string }>
  cursor: string
  has_more: boolean
}

const fileNames = (page: Listing) =>
  page.entries.filter((e) => e['.tag'] === 'file').map((e) => e.name)

/** Dropbox-API-Arg must be ASCII: escape anything else as JSON does. */
export function apiArg(args: unknown) {
  return JSON.stringify(args).replace(
    /[\u007f-￿]/g,
    (c) => `\\u${c.charCodeAt(0).toString(16).padStart(4, '0')}`,
  )
}

async function describeError(res: Response) {
  const text = await res.text().catch(() => '')
  let summary = ''
  try {
    summary = String(
      (JSON.parse(text) as { error_summary?: string }).error_summary ?? '',
    )
  } catch {
    summary = text
  }
  if (/not_found/.test(summary))
    return new CloudError('That project is no longer in Dropbox.', {
      notFound: true,
    })
  if (/insufficient_space/.test(summary) || res.status === 507)
    return new CloudError('Your Dropbox is full.')
  if (res.status === 429)
    return new CloudError('Dropbox is busy. Try again in a minute.')
  if (/missing_scope/.test(summary))
    return new CloudError(
      "C64-Pad wasn't given access to its Dropbox folder. Sign in again.",
      { needsSignIn: true },
    )
  return new CloudError(
    `Dropbox answered ${res.status}${summary ? `: ${summary}` : '.'}`,
  )
}
