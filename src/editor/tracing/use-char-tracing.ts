import { useCallback, useEffect, useMemo, useState } from 'react'
import { tracingStore } from '@/storage/tracings'
import {
  loadCharTracing,
  saveCharTracing,
  shiftToCell,
  traceSources,
} from './char-tracing'
import { DEFAULT_TRACING, placeTracing } from './placement'
import type { Charmap } from '@/c64/charmap'
import type {
  CharTraceSource,
  CharTraceSpot,
  CharTracingPrefs,
} from './char-tracing'
import type { GridTracing, TracingSettings } from './placement'

interface MapImage {
  bitmap: ImageBitmap
  width: number
  height: number
  settings: TracingSettings
}

/**
 * The Character Worksheet's tracing: the tracing paper of the screens drawn
 * with this charset, shown 8 × 8 under the selected char. `maps` are the
 * maps using the charset.
 */
export function useCharTracing(
  charsetId: string,
  maps: ReadonlyArray<Charmap>,
  char: number,
  ecm: boolean,
) {
  const [prefs, setPrefsState] = useState<CharTracingPrefs>(() =>
    loadCharTracing(charsetId),
  )
  useEffect(() => setPrefsState(loadCharTracing(charsetId)), [charsetId])
  const setPrefs = useCallback(
    (fn: (p: CharTracingPrefs) => CharTracingPrefs) =>
      setPrefsState((p) => {
        const next = fn(p)
        saveCharTracing(charsetId, next)
        return next
      }),
    [charsetId],
  )

  // Each map's tracing image (maps without one are left out).
  const [images, setImages] = useState<ReadonlyMap<string, MapImage>>(
    () => new Map(),
  )
  const mapIds = maps.map((m) => m.id).join(',')
  useEffect(() => {
    const run = { cancelled: false }
    void (async () => {
      const found = new Map<string, MapImage>()
      for (const id of mapIds ? mapIds.split(',') : []) {
        try {
          const stored = await tracingStore.get(id)
          if (!stored) continue
          const bitmap = await createImageBitmap(stored.image.blob)
          const { assetId: _id, ...settings } = stored.settings ?? {
            ...DEFAULT_TRACING,
            assetId: id,
          }
          found.set(id, {
            bitmap,
            width: stored.image.width,
            height: stored.image.height,
            settings: { ...DEFAULT_TRACING, ...settings },
          })
        } catch {
          // An unreadable image: that map just isn't traced from.
        }
        if (run.cancelled) return
      }
      if (!run.cancelled) setImages(found)
    })()
    return () => {
      run.cancelled = true
    }
  }, [mapIds])

  const traced = useMemo(
    () => maps.filter((m) => images.has(m.id)),
    [maps, images],
  )
  const pin = prefs.pins[char] as CharTraceSpot | undefined
  const sources = useMemo<Array<CharTraceSource>>(
    () => traceSources(traced, char, ecm, pin),
    [traced, char, ecm, pin],
  )

  // Which source is shown; back to the first (the pin) for another char.
  const [indexRaw, setIndex] = useState(0)
  useEffect(() => setIndex(0), [char, charsetId])
  const index = sources.length ? Math.min(indexRaw, sources.length - 1) : 0
  const source = sources.length ? sources[index] : null
  const sourceMap = source
    ? (traced.find((m) => m.id === source.mapId) ?? null)
    : null

  const grid = useMemo<GridTracing | null>(() => {
    if (!source || !sourceMap || !prefs.visible) return null
    const image = images.get(source.mapId)
    if (!image) return null
    const placement = placeTracing(
      image,
      { width: sourceMap.width * 8, height: sourceMap.height * 8 },
      image.settings,
    )
    return {
      image: image.bitmap,
      placement: shiftToCell(placement, source.x, source.y),
      opacity: prefs.opacity,
      layer: prefs.layer,
    }
  }, [source, sourceMap, images, prefs.visible, prefs.opacity, prefs.layer])

  return {
    prefs,
    setPrefs,
    /** Screens using this charset that have tracing paper. */
    tracedMaps: traced,
    sources,
    index,
    source,
    sourceMap,
    /** Step through the sources, wrapping round. */
    step: (by: number) =>
      setIndex(
        sources.length ? (index + by + sources.length) % sources.length : 0,
      ),
    /** The char's pin (even if its screen has no tracing now). */
    pin: pin ?? null,
    pinMap: pin ? (maps.find((m) => m.id === pin.mapId) ?? null) : null,
    /** Pin the char to the source shown now, or unpin it. */
    setPinned: (on: boolean) => {
      // A new pin is listed first: stay on it.
      if (on) setIndex(0)
      setPrefs((p) => {
        const pins = { ...p.pins }
        if (on && source)
          pins[char] = { mapId: source.mapId, x: source.x, y: source.y }
        else delete pins[char]
        return { ...p, pins }
      })
    },
    grid,
  }
}
