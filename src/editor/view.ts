/** Zoom and pan of a grid inside its 1× frame. x/y = content offset in px (≤ 0). */
export interface GridView {
  zoom: number
  x: number
  y: number
}

export const MIN_ZOOM = 1
export const MAX_ZOOM = 8
export const DEFAULT_VIEW: GridView = { zoom: 1, x: 0, y: 0 }

/** Keep zoom in range and the content covering the frame (no empty margins). */
export function clampView(
  view: GridView,
  frameW: number,
  frameH: number,
): GridView {
  const zoom = Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, view.zoom))
  const minX = frameW - frameW * zoom
  const minY = frameH - frameH * zoom
  return {
    zoom,
    x: Math.min(0, Math.max(minX, view.x)),
    y: Math.min(0, Math.max(minY, view.y)),
  }
}

/** Zoom to `zoom`, keeping the content point under `at` (frame coords) fixed. */
export function zoomAround(
  view: GridView,
  zoom: number,
  at: { x: number; y: number },
  frameW: number,
  frameH: number,
): GridView {
  const z = Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, zoom))
  const contentX = (at.x - view.x) / view.zoom
  const contentY = (at.y - view.y) / view.zoom
  return clampView(
    { zoom: z, x: at.x - contentX * z, y: at.y - contentY * z },
    frameW,
    frameH,
  )
}
