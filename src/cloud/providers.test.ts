import { beforeEach, describe, expect, it } from 'vitest'
import { driveProperties, driveSummary } from './drive'
import { apiArg } from './dropbox'
import {
  cloudScope,
  forgetCloudSettings,
  loadCloudSettings,
  loadSyncBases,
  parseSettings,
  saveCloudSettings,
  savedCloudSettings,
  setSyncBase,
} from './settings'
import type { DropboxSettings, SpacesSettings } from './settings'
import type { CloudSummary } from './types'

const summary: CloudSummary = {
  id: 'p1',
  name: 'Rainbow Islands CE',
  program: 'Rainbow Islands',
  updatedAt: '2026-11-18T10:00:00.000Z',
  savedAt: '2026-11-18T10:05:00.000Z',
  counts: { spriteSets: 2, sprites: 40, charsets: 3, maps: 5 },
}

describe('Drive summaries', () => {
  it('round-trip through appProperties and the file name', () => {
    const file = {
      id: 'f1',
      name: 'Rainbow Islands CE.c64pad',
      appProperties: driveProperties(summary),
    }
    expect(driveSummary(file)).toEqual(summary)
  })

  it('fit each property in 124 bytes', () => {
    const props = driveProperties({ ...summary, name: 'é'.repeat(200) })
    for (const [k, v] of Object.entries(props))
      expect(new TextEncoder().encode(k + v).length).toBeLessThanOrEqual(124)
  })

  it('skip files that are not projects', () => {
    expect(driveSummary({ id: 'x', name: 'notes.txt' })).toBeNull()
  })
})

describe('cloud settings', () => {
  beforeEach(() => {
    const store = new Map<string, string>()
    globalThis.localStorage = {
      getItem: (k: string) => store.get(k) ?? null,
      setItem: (k: string, v: string) => void store.set(k, v),
      removeItem: (k: string) => void store.delete(k),
    } as Storage
  })

  it('reads settings saved before providers as a Space', () => {
    expect(
      parseSettings({
        region: 'fra1',
        bucket: 'hay64',
        accessKey: 'K',
        secretKey: 'S',
        folder: 'c64-pad',
      }),
    ).toMatchObject({ provider: 'spaces', bucket: 'hay64' })
    expect(parseSettings({ provider: 'gdrive', email: 'a@b.c' })).toEqual({
      provider: 'gdrive',
      email: 'a@b.c',
    })
  })

  it('keeps sync records per store, moving old ones to the Space', () => {
    localStorage.setItem('c64-pad.cloud-synced', JSON.stringify({ p1: 'T1' }))
    const space = cloudScope({
      provider: 'spaces',
      region: 'fra1',
      bucket: 'hay64',
      accessKey: 'K',
      secretKey: 'S',
      folder: 'c64-pad',
    })
    const drive = cloudScope({ provider: 'gdrive', email: 'a@b.c' })
    expect(loadSyncBases(drive)).toEqual({})
    expect(loadSyncBases(space)).toEqual({ p1: 'T1' })
    setSyncBase(drive, 'p1', 'T2')
    expect(loadSyncBases(space)).toEqual({ p1: 'T1' })
    expect(loadSyncBases(drive)).toEqual({ p1: 'T2' })
  })

  it('keeps each provider when switching, and the old format loads', () => {
    const space: SpacesSettings = {
      provider: 'spaces',
      region: 'fra1',
      bucket: 'hay64',
      accessKey: 'K',
      secretKey: 'S',
      folder: 'c64-pad',
    }
    // As saved before providers were kept side by side.
    const { provider: _, ...flat } = space
    localStorage.setItem('c64-pad.cloud', JSON.stringify(flat))
    expect(loadCloudSettings()).toEqual(space)

    saveCloudSettings({ provider: 'gdrive', email: 'a@b.c' })
    expect(loadCloudSettings()).toEqual({ provider: 'gdrive', email: 'a@b.c' })
    expect(savedCloudSettings('spaces')).toEqual(space)

    forgetCloudSettings('gdrive')
    expect(loadCloudSettings()).toEqual(space)
    forgetCloudSettings('spaces')
    expect(loadCloudSettings()).toBeNull()
  })

  it('keeps Dropbox beside the others, and its sign-in survives a reload', () => {
    const dropbox: DropboxSettings = {
      provider: 'dropbox',
      email: 'a@b.c',
      accountId: 'dbid:1',
      refreshToken: 'R',
    }
    saveCloudSettings({ provider: 'gdrive', email: 'a@b.c' })
    saveCloudSettings(dropbox)
    expect(loadCloudSettings()).toEqual(dropbox)
    expect(cloudScope(dropbox)).toBe('dropbox:dbid:1')
    expect(parseSettings({ ...dropbox, refreshToken: '' })).toBeNull()

    forgetCloudSettings('dropbox')
    expect(loadCloudSettings()).toEqual({ provider: 'gdrive', email: 'a@b.c' })
    expect(savedCloudSettings('dropbox')).toBeUndefined()
  })

  it('writes Dropbox-API-Arg as ASCII', () => {
    const arg = apiArg({ path: '/Größe ✨.json' })
    expect(arg).toMatch(/^[\x20-\x7e]*$/)
    expect(JSON.parse(arg)).toEqual({ path: '/Größe ✨.json' })
  })
})
