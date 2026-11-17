import { describe, expect, it } from 'vitest'
import { parseListing } from './spaces'
import { pullNeedsConfirm, pushNeedsConfirm, syncStatus } from './sync'

const T1 = '2026-11-01T10:00:00.000Z'
const T2 = '2026-11-02T10:00:00.000Z'
const T3 = '2026-11-03T10:00:00.000Z'

describe('syncStatus', () => {
  it('knows which side has the project', () => {
    expect(syncStatus(T1, undefined, undefined).kind).toBe('device-only')
    expect(syncStatus(undefined, T1, undefined).kind).toBe('cloud-only')
    expect(syncStatus(T1, T1, undefined).kind).toBe('synced')
  })

  it('uses the last sync to tell which side changed', () => {
    expect(syncStatus(T2, T1, T1)).toEqual({ kind: 'device-newer', sure: true })
    expect(syncStatus(T1, T2, T1)).toEqual({ kind: 'cloud-newer', sure: true })
    expect(syncStatus(T2, T3, T1)).toEqual({ kind: 'conflict' })
  })

  it('falls back to dates, unsure, without a last sync', () => {
    expect(syncStatus(T2, T1, undefined)).toEqual({
      kind: 'device-newer',
      sure: false,
    })
    expect(syncStatus(T1, T2, undefined)).toEqual({
      kind: 'cloud-newer',
      sure: false,
    })
  })

  it('asks before overwriting anything it is not sure about', () => {
    expect(pushNeedsConfirm(syncStatus(T2, T1, T1))).toBe(false)
    expect(pushNeedsConfirm(syncStatus(T1, T2, T1))).toBe(true)
    expect(pushNeedsConfirm(syncStatus(T2, T3, T1))).toBe(true)
    expect(pushNeedsConfirm(syncStatus(T2, T1, undefined))).toBe(true)
    expect(pullNeedsConfirm(syncStatus(T1, T2, T1))).toBe(false)
    expect(pullNeedsConfirm(syncStatus(T2, T1, T1))).toBe(true)
    expect(pullNeedsConfirm(syncStatus(T2, T3, T1))).toBe(true)
    expect(pullNeedsConfirm(syncStatus(T1, T2, undefined))).toBe(true)
    expect(pullNeedsConfirm(syncStatus(undefined, T2, undefined))).toBe(false)
  })
})

describe('parseListing', () => {
  it('reads keys and the continuation token', () => {
    const xml = `<?xml version="1.0"?><ListBucketResult>
      <IsTruncated>true</IsTruncated>
      <Contents><Key>c64-pad/a.json</Key></Contents>
      <Contents><Key>c64-pad/a&amp;b.c64pad</Key></Contents>
      <NextContinuationToken>tok/1=</NextContinuationToken>
    </ListBucketResult>`
    expect(parseListing(xml)).toEqual({
      keys: ['c64-pad/a.json', 'c64-pad/a&b.c64pad'],
      next: 'tok/1=',
    })
  })

  it('stops when the listing is complete', () => {
    const xml =
      '<ListBucketResult><IsTruncated>false</IsTruncated></ListBucketResult>'
    expect(parseListing(xml)).toEqual({ keys: [], next: null })
  })
})
