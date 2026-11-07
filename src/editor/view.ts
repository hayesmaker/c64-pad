/** Zoom and pan of content inside a frame. x/y = content offset in px. */
export interface GridView {
  zoom: number
  x: number
  y: number
}

export const MIN_ZOOM = 1
export const MAX_ZOOM = 8
export const DEFAULT_VIEW: GridView = { zoom: 1, x: 0, y: 0 }

/** A frame showing content that is `contentW` × `contentH` px at zoom 1. */
export interface ViewBounds {
  frameW: number
  frameH: number
  contentW: number
  contentH: number
  minZoom: number
  maxZoom: number
}

function clampAxis(offset: number, frame: number, content: number) {
  // Larger content may not leave a gap at either edge; smaller content sits
  // at the start, under the column and row labels.
  return content >= frame ? Math.min(0, Math.max(frame - content, offset)) : 0
}

/** Keep zoom in range and the content in the frame. */
export function clampViewTo(view: GridView, b: ViewBounds): GridView {
  const zoom = Math.min(b.maxZoom, Math.max(b.minZoom, view.zoom))
  return {
    zoom,
    x: clampAxis(view.x, b.frameW, b.contentW * zoom),
    y: clampAxis(view.y, b.frameH, b.contentH * zoom),
  }
}

/** Zoom to `zoom`, keeping the content point under `at` (frame coords) fixed. */
export function zoomAroundIn(
  view: GridView,
  zoom: number,
  at: { x: number; y: number },
  b: ViewBounds,
): GridView {
  const z = Math.min(b.maxZoom, Math.max(b.minZoom, zoom))
  const contentX = (at.x - view.x) / view.zoom
  const contentY = (at.y - view.y) / view.zoom
  return clampViewTo(
    { zoom: z, x: at.x - contentX * z, y: at.y - contentY * z },
    b,
  )
}

/** Bounds of a grid whose frame is the content at 1× (zoom 1-8). */
function gridBounds(frameW: number, frameH: number): ViewBounds {
  return {
    frameW,
    frameH,
    contentW: frameW,
    contentH: frameH,
    minZoom: MIN_ZOOM,
    maxZoom: MAX_ZOOM,
  }
}

/** Keep zoom in range and the content covering the frame (no empty margins). */
export function clampView(
  view: GridView,
  frameW: number,
  frameH: number,
): GridView {
  return clampViewTo(view, gridBounds(frameW, frameH))
}

export function zoomAround(
  view: GridView,
  zoom: number,
  at: { x: number; y: number },
  frameW: number,
  frameH: number,
): GridView {
  return zoomAroundIn(view, zoom, at, gridBounds(frameW, frameH))
}
