import { exportProjectFile, importProjectFile } from '@/storage/project-file'
import { summarize } from '@/storage/repository'
import { googleToken } from './google'
import { CloudError } from './types'
import type { CloudClient, CloudSummary } from './types'

const API = 'https://www.googleapis.com/drive/v3'
const UPLOAD = 'https://www.googleapis.com/upload/drive/v3'
export const DRIVE_FOLDER = 'C64-Pad'
const FOLDER_TYPE = 'application/vnd.google-apps.folder'
const FILE_FIELDS = 'id,name,appProperties'

/** The bits of a Drive file the client reads. */
export interface DriveFile {
  id: string
  name: string
  appProperties?: Record<string, string>
}

/**
 * Projects in the user's Google Drive, in a visible "C64-Pad" folder: each is
 * "<name>.c64pad" (the export format), its summary kept in the file's
 * appProperties so one listing gives the whole cloud list.
 */
export function createDriveClient(): CloudClient {
  const request = async (
    url: string,
    init: RequestInit = {},
  ): Promise<Response> => {
    const send = async (renew: boolean) => {
      const headers = new Headers(init.headers)
      headers.set('Authorization', `Bearer ${await googleToken({ renew })}`)
      try {
        return await fetch(url, { cache: 'no-store', ...init, headers })
      } catch {
        throw new CloudError(
          "Couldn't reach Google Drive. Check that you're online.",
        )
      }
    }
    let res = await send(false)
    if (res.status === 401) res = await send(true)
    if (res.status === 401)
      throw new CloudError('Google Drive needs you to sign in again.', {
        needsSignIn: true,
      })
    if (!res.ok) throw new CloudError(await describeError(res))
    return res
  }

  const query = async (q: string): Promise<Array<DriveFile>> => {
    const files: Array<DriveFile> = []
    let pageToken: string | undefined
    do {
      const params = new URLSearchParams({
        q,
        fields: `nextPageToken,files(${FILE_FIELDS})`,
        pageSize: '1000',
        spaces: 'drive',
      })
      if (pageToken) params.set('pageToken', pageToken)
      const page = (await (await request(`${API}/files?${params}`)).json()) as {
        files?: Array<DriveFile>
        nextPageToken?: string
      }
      files.push(...(page.files ?? []))
      pageToken = page.nextPageToken
    } while (pageToken)
    return files
  }

  /** The app's folder, made the first time. */
  let folder: Promise<string> | null = null
  const folderId = () =>
    (folder ??= (async () => {
      const found = await query(
        `name='${DRIVE_FOLDER}' and mimeType='${FOLDER_TYPE}' and 'root' in parents and trashed=false`,
      )
      const existing = found.at(0)
      if (existing) return existing.id
      const res = await request(`${API}/files?fields=id`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: DRIVE_FOLDER, mimeType: FOLDER_TYPE }),
      })
      return ((await res.json()) as { id: string }).id
    })().catch((e: unknown) => {
      folder = null
      throw e
    }))

  const projectFiles = async (id?: string) =>
    query(
      `'${await folderId()}' in parents and trashed=false and ` +
        (id
          ? `appProperties has { key='c64padId' and value='${quote(id)}' }`
          : `mimeType!='${FOLDER_TYPE}'`),
    )

  const find = async (id: string) => {
    const file = (await projectFiles(id)).at(0)
    if (!file)
      throw new CloudError('That project is no longer in Google Drive.', {
        notFound: true,
      })
    return file
  }

  return {
    async list() {
      return (await projectFiles())
        .map(driveSummary)
        .filter((s): s is CloudSummary => s !== null)
        .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
    },

    async summary(id) {
      const file = (await projectFiles(id)).at(0)
      return file ? driveSummary(file) : null
    },

    async get(id) {
      const file = await find(id)
      const res = await request(`${API}/files/${file.id}?alt=media`)
      return importProjectFile(await res.text())
    },

    async put(project) {
      const summary: CloudSummary = {
        ...summarize(project),
        savedAt: new Date().toISOString(),
      }
      const existing = (await projectFiles(project.id)).at(0)
      const metadata = {
        name: `${project.name}.c64pad`,
        appProperties: driveProperties(summary),
        ...(existing ? {} : { parents: [await folderId()] }),
      }
      const boundary = `c64pad-${crypto.randomUUID()}`
      const body = [
        `--${boundary}`,
        'Content-Type: application/json; charset=UTF-8',
        '',
        JSON.stringify(metadata),
        `--${boundary}`,
        'Content-Type: application/octet-stream',
        '',
        exportProjectFile(project),
        `--${boundary}--`,
        '',
      ].join('\r\n')
      await request(
        existing
          ? `${UPLOAD}/files/${existing.id}?uploadType=multipart&fields=id`
          : `${UPLOAD}/files?uploadType=multipart&fields=id`,
        {
          method: existing ? 'PATCH' : 'POST',
          headers: {
            'Content-Type': `multipart/related; boundary=${boundary}`,
          },
          body,
        },
      )
      return summary
    },

    async remove(id) {
      // To Drive's bin, where it can still be restored.
      const file = await find(id)
      await request(`${API}/files/${file.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ trashed: true }),
      })
    },
  }
}

/** Drive limits each property's key + value to 124 bytes of UTF-8. */
function fit(key: string, value: string) {
  const bytes = new TextEncoder()
  let v = value
  while (bytes.encode(key + v).length > 124) v = v.slice(0, -1)
  return v
}

export function driveProperties(s: CloudSummary): Record<string, string> {
  const c = s.counts
  const props: Record<string, string> = {
    c64padId: s.id,
    updatedAt: s.updatedAt,
    savedAt: s.savedAt,
    counts: [c.spriteSets, c.sprites, c.charsets, c.maps].join(','),
    name: s.name,
    program: s.program,
  }
  return Object.fromEntries(
    Object.entries(props).map(([k, v]) => [k, fit(k, v)]),
  )
}

export function driveSummary(file: DriveFile): CloudSummary | null {
  const p: Partial<Record<string, string>> = file.appProperties ?? {}
  if (!p.c64padId || !p.updatedAt) return null
  const n = (p.counts ?? '').split(',').map((v) => Number(v) || 0)
  return {
    id: p.c64padId,
    // The name property is cut to fit; the file name usually isn't.
    name: file.name.replace(/\.c64pad$/i, '') || p.name || 'Untitled',
    program: p.program ?? '',
    updatedAt: p.updatedAt,
    savedAt: p.savedAt ?? p.updatedAt,
    counts: {
      spriteSets: n.at(0) ?? 0,
      sprites: n.at(1) ?? 0,
      charsets: n.at(2) ?? 0,
      maps: n.at(3) ?? 0,
    },
  }
}

/** Escape a value for a Drive query string. */
function quote(s: string) {
  return s.replace(/\\/g, '\\\\').replace(/'/g, "\\'")
}

async function describeError(res: Response) {
  const body = (await res.json().catch(() => null)) as {
    error?: { message?: string; errors?: Array<{ reason?: string }> }
  } | null
  const reason = body?.error?.errors?.[0]?.reason
  if (reason === 'storageQuotaExceeded') return 'Your Google Drive is full.'
  if (res.status === 403 && reason === 'insufficientPermissions')
    return "C64-Pad wasn't given access to Drive. Sign in again and allow it."
  return `Google Drive answered ${res.status}${body?.error?.message ? `: ${body.error.message}` : '.'}`
}
