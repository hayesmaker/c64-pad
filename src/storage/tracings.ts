import { openDB } from 'idb'
import type { DBSchema, IDBPDatabase } from 'idb'
import type { TracingSettings } from '@/editor/tracing/placement'

/**
 * Tracing paper images and settings, per sprite or map, on this device only:
 * kept out of projects and .c64pad files. Two stores, so nudging an image
 * rewrites only its small settings record.
 */
export interface TracingImage {
  assetId: string
  name: string
  width: number
  height: number
  blob: Blob
}

interface TracingDB extends DBSchema {
  images: { key: string; value: TracingImage }
  settings: { key: string; value: TracingSettings & { assetId: string } }
}

let db: Promise<IDBPDatabase<TracingDB>> | undefined
const open = () =>
  (db ??= openDB<TracingDB>('c64-pad-tracings', 1, {
    upgrade(database) {
      database.createObjectStore('images', { keyPath: 'assetId' })
      database.createObjectStore('settings', { keyPath: 'assetId' })
    },
  }))

export const tracingStore = {
  async get(assetId: string) {
    const d = await open()
    const [image, settings] = await Promise.all([
      d.get('images', assetId),
      d.get('settings', assetId),
    ])
    return image ? { image, settings } : undefined
  },
  async putImage(image: TracingImage) {
    await (await open()).put('images', image)
  },
  async putSettings(assetId: string, settings: TracingSettings) {
    await (await open()).put('settings', { ...settings, assetId })
  },
  async remove(assetId: string) {
    const d = await open()
    await Promise.all([
      d.delete('images', assetId),
      d.delete('settings', assetId),
    ])
  },
}
