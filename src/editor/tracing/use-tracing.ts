import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { tracingStore } from '@/storage/tracings'
import { DEFAULT_TRACING, placeTracing } from './placement'
import type { GridTracing, TracingSettings } from './placement'

export interface LoadedTracing {
  name: string
  width: number
  height: number
  bitmap: ImageBitmap
  settings: TracingSettings
}

/**
 * The tracing paper of one sprite or map: loaded from this device's store,
 * changes saved back shortly after they stop.
 */
export function useTracing(assetId: string) {
  const [tracing, setTracing] = useState<LoadedTracing | null>(null)
  const [error, setError] = useState<string | null>(null)
  const saveTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)

  useEffect(() => {
    const run = { cancelled: false }
    const stopped = () => run.cancelled
    setTracing(null)
    setError(null)
    void (async () => {
      try {
        const stored = await tracingStore.get(assetId)
        if (!stored || stopped()) return
        const bitmap = await createImageBitmap(stored.image.blob)
        if (stopped()) return
        const { assetId: _id, ...settings } = stored.settings ?? {
          ...DEFAULT_TRACING,
          assetId,
        }
        setTracing({
          name: stored.image.name,
          width: stored.image.width,
          height: stored.image.height,
          bitmap,
          settings: { ...DEFAULT_TRACING, ...settings },
        })
      } catch (e) {
        if (!stopped()) setError((e as Error).message)
      }
    })()
    return () => {
      run.cancelled = true
    }
  }, [assetId])

  const update = useCallback(
    (fn: (s: TracingSettings) => TracingSettings) => {
      setTracing((t) => {
        if (!t) return t
        const settings = fn(t.settings)
        clearTimeout(saveTimer.current)
        saveTimer.current = setTimeout(
          () => void tracingStore.putSettings(assetId, settings),
          300,
        )
        return { ...t, settings }
      })
    },
    [assetId],
  )

  const load = useCallback(
    async (file: File) => {
      setError(null)
      try {
        const bitmap = await createImageBitmap(file)
        const image = {
          assetId,
          name: file.name,
          width: bitmap.width,
          height: bitmap.height,
          blob: file,
        }
        // A new image keeps the old settings, so replacing a reference
        // with the next section keeps its alignment.
        const settings = tracing?.settings ?? DEFAULT_TRACING
        await tracingStore.putImage(image)
        await tracingStore.putSettings(assetId, settings)
        setTracing({
          ...image,
          bitmap,
          settings: { ...settings, visible: true },
        })
      } catch {
        setError('That file couldn’t be read as an image.')
      }
    },
    [assetId, tracing],
  )

  const remove = useCallback(async () => {
    await tracingStore.remove(assetId)
    setTracing(null)
  }, [assetId])

  return { tracing, error, update, load, remove }
}

/** The tracing of an asset plus what its grid draws (null when hidden). */
export function useGridTracing(
  assetId: string,
  target: { width: number; height: number },
) {
  const hook = useTracing(assetId)
  const t = hook.tracing
  // By size, so a new target object each render doesn't re-place it.
  const { width, height } = target
  const grid = useMemo<GridTracing | null>(
    () =>
      t && t.settings.visible
        ? {
            image: t.bitmap,
            placement: placeTracing(t, { width, height }, t.settings),
            opacity: t.settings.opacity,
            layer: t.settings.layer,
          }
        : null,
    [t, width, height],
  )
  return { ...hook, grid }
}
