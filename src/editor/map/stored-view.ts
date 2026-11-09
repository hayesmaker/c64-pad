import { DEFAULT_VIEW } from '../view'
import type { GridView } from '../view'

/**
 * Each map's last zoom and scroll, so the Screen page reopens where you
 * left it: in memory, and in localStorage to survive a restart (a view is
 * only a convenience, so storage failing just means the default view).
 */
const views = new Map<string, GridView>()
const key = (mapId: string) => `c64pad:map-view:${mapId}`

function isView(v: unknown): v is GridView {
  if (typeof v !== 'object' || v === null) return false
  const { zoom, x, y } = v as Record<string, unknown>
  return [zoom, x, y].every((n) => typeof n === 'number' && Number.isFinite(n))
}

export function loadMapView(mapId: string): GridView {
  const known = views.get(mapId)
  if (known) return known
  try {
    const raw = localStorage.getItem(key(mapId))
    const v: unknown = raw ? JSON.parse(raw) : null
    if (isView(v)) return v
  } catch {
    // Unreadable storage: the default view.
  }
  return DEFAULT_VIEW
}

const pending = new Map<string, ReturnType<typeof setTimeout>>()

function write(mapId: string) {
  clearTimeout(pending.get(mapId))
  pending.delete(mapId)
  const view = views.get(mapId)
  if (!view) return
  try {
    localStorage.setItem(key(mapId), JSON.stringify(view))
  } catch {
    // Full or blocked storage: remembered for this session only.
  }
}

/** Remember at once; write to storage once panning settles. */
export function saveMapView(mapId: string, view: GridView) {
  views.set(mapId, view)
  clearTimeout(pending.get(mapId))
  pending.set(
    mapId,
    setTimeout(() => write(mapId), 300),
  )
}

// Don't lose the last pan when the app is closed or put in the background.
if (typeof window !== 'undefined') {
  const flush = () => {
    for (const mapId of [...pending.keys()]) write(mapId)
  }
  window.addEventListener('pagehide', flush)
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') flush()
  })
}
