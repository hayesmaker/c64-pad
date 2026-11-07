import { useEffect, useMemo, useRef } from 'react'
import { decodeEcm } from '@/c64/charmap'
import { renderChar } from '@/c64/charset'
import { PALETTE } from '@/c64/palette'
import { cn } from '@/lib/utils'
import { useGridGestures } from '../gestures'
import { clampViewTo, zoomAroundIn } from '../view'
import { drawTracing } from '../tracing/placement'
import type { GridTracing } from '../tracing/placement'
import type { StrokeHandlers } from '../gestures'
import type { GridView, ViewBounds } from '../view'
import type { Charmap } from '@/c64/charmap'
import type { Charset } from '@/c64/charset'

/** One C64 screen, for the heavy screen-boundary lines. */
const SCREEN_W = 40
const SCREEN_H = 25
const MAJOR_EVERY = 5

export interface CellRect {
  x: number
  y: number
  width: number
  height: number
}

/** Frame (canvas) size and zoom limits for a map shown at `cell` px per char. */
export function mapBounds(
  map: Pick<Charmap, 'width' | 'height'>,
  cell: number,
  frame: { width: number; height: number },
): ViewBounds {
  const contentW = map.width * cell
  const contentH = map.height * cell
  const frameW = Math.max(1, Math.min(frame.width, contentW))
  const frameH = Math.max(1, Math.min(frame.height, contentH))
  return {
    frameW,
    frameH,
    contentW,
    contentH,
    // Zoom out until the whole map fits; in to 8×.
    minZoom: Math.min(1, frameW / contentW, frameH / contentH),
    maxZoom: 8,
  }
}

/**
 * Every screen code drawn once into an 8 px tall strip (2048 × 8), so the map
 * is drawn with one drawImage per visible cell.
 */
export function charAtlas(charset: Charset): HTMLCanvasElement {
  const canvas = document.createElement('canvas')
  canvas.width = 256 * 8
  canvas.height = 8
  const ctx = canvas.getContext('2d')
  if (!ctx) return canvas
  const image = ctx.createImageData(256 * 8, 8)
  const rgb = PALETTE.map(({ hex }) => [
    parseInt(hex.slice(1, 3), 16),
    parseInt(hex.slice(3, 5), 16),
    parseInt(hex.slice(5, 7), 16),
  ])
  for (let code = 0; code < 256; code++) {
    const pixels =
      charset.mode === 'ecm'
        ? renderChar(charset, decodeEcm(code).char, decodeEcm(code).background)
        : renderChar(charset, code)
    for (let y = 0; y < 8; y++) {
      for (let x = 0; x < 8; x++) {
        const [r, g, b] = rgb[pixels[y * 8 + x]]
        const o = (y * 256 * 8 + code * 8 + x) * 4
        image.data[o] = r
        image.data[o + 1] = g
        image.data[o + 2] = b
        image.data[o + 3] = 255
      }
    }
  }
  ctx.putImageData(image, 0, 0)
  return canvas
}

/**
 * The map on a canvas, drawn with its charset. Only visible cells are drawn,
 * so large maps (up to 1024 × 1024) stay fast. One pointer uses the tool; two
 * fingers pinch-zoom and pan.
 */
export function MapCanvas({
  map,
  charset,
  cell,
  frame,
  view,
  onViewChange,
  showGrid,
  hover,
  selection,
  tracing,
  pan = false,
  ...handlers
}: {
  map: Charmap
  charset: Charset
  /** Px per char at zoom 1. */
  cell: number
  /** Space available for the canvas. */
  frame: { width: number; height: number }
  view: GridView
  onViewChange: (view: GridView) => void
  showGrid: boolean
  /** Highlighted cells under the pointer (the brush footprint). */
  hover: CellRect | null
  selection: CellRect | null
  /** Reference image over the map, or under its blank cells. */
  tracing?: GridTracing | null
  /** Hand tool: one finger or the mouse drags the map. */
  pan?: boolean
} & StrokeHandlers) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const bounds = mapBounds(map, cell, frame)
  const { frameW, frameH } = bounds
  const atlas = useMemo(() => charAtlas(charset), [charset])

  useEffect(() => {
    const canvas = canvasRef.current
    const ctx = canvas?.getContext('2d')
    if (!canvas || !ctx) return
    const dpr = window.devicePixelRatio || 1
    canvas.width = Math.round(frameW * dpr)
    canvas.height = Math.round(frameH * dpr)
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
    ctx.imageSmoothingEnabled = false
    ctx.clearRect(0, 0, frameW, frameH)

    const size = cell * view.zoom
    const px = (i: number, offset: number) => Math.round(offset + i * size)
    const x0 = Math.max(0, Math.floor(-view.x / size))
    const y0 = Math.max(0, Math.floor(-view.y / size))
    const x1 = Math.min(map.width, Math.ceil((frameW - view.x) / size))
    const y1 = Math.min(map.height, Math.ceil((frameH - view.y) / size))
    const traceAt = (t: GridTracing) => {
      ctx.save()
      ctx.translate(view.x, view.y)
      drawTracing(ctx, t, size / 8, {
        width: map.width * size,
        height: map.height * size,
      })
      ctx.restore()
    }
    const under = tracing?.layer === 'under' ? tracing : null
    if (under) {
      // Background, the image, then every cell that isn't blank on top.
      ctx.fillStyle = PALETTE[charset.background].hex
      ctx.fillRect(
        px(x0, view.x),
        px(y0, view.y),
        px(x1, view.x) - px(x0, view.x),
        px(y1, view.y) - px(y0, view.y),
      )
      traceAt(under)
    }
    for (let y = y0; y < y1; y++) {
      const top = px(y, view.y)
      const h = px(y + 1, view.y) - top
      for (let x = x0; x < x1; x++) {
        const left = px(x, view.x)
        const code = map.cells[y * map.width + x]
        if (under && code === map.blank) continue
        ctx.drawImage(
          atlas,
          code * 8,
          0,
          8,
          8,
          left,
          top,
          px(x + 1, view.x) - left,
          h,
        )
      }
    }

    if (tracing?.layer === 'over') traceAt(tracing)

    const right = px(x1, view.x)
    const bottom = px(y1, view.y)
    const vline = (x: number, color: string, w: number) => {
      ctx.strokeStyle = color
      ctx.lineWidth = w
      ctx.beginPath()
      ctx.moveTo(px(x, view.x) + 0.5, px(y0, view.y))
      ctx.lineTo(px(x, view.x) + 0.5, bottom)
      ctx.stroke()
    }
    const hline = (y: number, color: string, w: number) => {
      ctx.strokeStyle = color
      ctx.lineWidth = w
      ctx.beginPath()
      ctx.moveTo(px(x0, view.x), px(y, view.y) + 0.5)
      ctx.lineTo(right, px(y, view.y) + 0.5)
      ctx.stroke()
    }
    if (showGrid && size >= 6) {
      for (let x = x0 + 1; x < x1; x++)
        if (x % MAJOR_EVERY) vline(x, 'rgba(255,255,255,0.13)', 1)
      for (let y = y0 + 1; y < y1; y++)
        if (y % MAJOR_EVERY) hline(y, 'rgba(255,255,255,0.13)', 1)
    }
    if (showGrid) {
      for (let x = x0 + 1; x < x1; x++)
        if (x % MAJOR_EVERY === 0 && x % SCREEN_W)
          vline(x, 'rgba(255,255,255,0.35)', 1)
      for (let y = y0 + 1; y < y1; y++)
        if (y % MAJOR_EVERY === 0 && y % SCREEN_H)
          hline(y, 'rgba(255,255,255,0.35)', 1)
    }
    // Screen boundaries: where one 40 × 25 screen ends and the next begins.
    for (let x = Math.max(SCREEN_W, x0); x < x1; x++)
      if (x % SCREEN_W === 0) vline(x, '#706deb', 2)
    for (let y = Math.max(SCREEN_H, y0); y < y1; y++)
      if (y % SCREEN_H === 0) hline(y, '#706deb', 2)

    const rect = (r: CellRect) =>
      [
        px(r.x, view.x),
        px(r.y, view.y),
        px(r.x + r.width, view.x) - px(r.x, view.x),
        px(r.y + r.height, view.y) - px(r.y, view.y),
      ] as const
    if (hover) {
      const [x, y, w, h] = rect(hover)
      ctx.fillStyle = 'rgba(255,255,255,0.14)'
      ctx.fillRect(x, y, w, h)
      ctx.strokeStyle = '#ffffff'
      ctx.lineWidth = 1.5
      ctx.strokeRect(x + 0.75, y + 0.75, w - 1.5, h - 1.5)
    }
    if (selection) {
      const [x, y, w, h] = rect(selection)
      ctx.fillStyle = 'rgba(112,109,235,0.25)'
      ctx.fillRect(x, y, w, h)
      ctx.strokeStyle = '#edf171'
      ctx.lineWidth = 2
      ctx.setLineDash([6, 4])
      ctx.strokeRect(x + 1, y + 1, w - 2, h - 2)
      ctx.setLineDash([])
    }
  }, [
    map,
    atlas,
    cell,
    view,
    frameW,
    frameH,
    showGrid,
    hover,
    selection,
    tracing,
    charset.background,
  ])

  useGridGestures(canvasRef, {
    handlers,
    view,
    onViewChange,
    pan,
    toCell: (p) => {
      const size = cell * view.zoom
      const x = Math.floor((p.x - view.x) / size)
      const y = Math.floor((p.y - view.y) / size)
      if (x < 0 || y < 0 || x >= map.width || y >= map.height) return null
      return [x, y]
    },
    zoomAt: (v, zoom, at) => zoomAroundIn(v, zoom, at, bounds),
    panBy: (v, dx, dy) =>
      clampViewTo({ zoom: v.zoom, x: v.x + dx, y: v.y + dy }, bounds),
  })

  return (
    <canvas
      ref={canvasRef}
      role="img"
      aria-label={`Map ${map.name}, ${map.width} by ${map.height} characters`}
      className={cn(
        'touch-surface block',
        pan ? 'cursor-grab active:cursor-grabbing' : 'cursor-crosshair',
      )}
      style={{ width: frameW, height: frameH }}
    />
  )
}
