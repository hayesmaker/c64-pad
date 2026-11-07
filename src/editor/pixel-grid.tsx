import { useEffect, useRef } from 'react'
import { PALETTE } from '@/c64/palette'
import { useGridGestures } from './gestures'
import { clampView, zoomAround } from './view'
import type { GridView } from './view'
import type { StrokeHandlers } from './gestures'

export type { StrokeHandlers } from './gestures'

const MAJOR = '#8f8d86'
export interface GridLayer {
  /** C64 colour per hires pixel, row-major; -1 = transparent. */
  pixels: Int8Array
  /** 1 = solid; lower fades the layer (e.g. the layer not being edited). */
  alpha?: number
}

/**
 * An editable pixel grid drawn on a canvas, like the worksheets: minor lines
 * per pixel, heavy lines every `majorX` / `majorY` hires pixels.
 *
 * The canvas is the size of the grid at 1×; `view` zooms and pans inside it.
 * One pointer draws; two touch pointers pinch-zoom and pan; the wheel zooms.
 */
export function PixelGrid({
  width: columns,
  height: rows,
  step,
  majorX,
  majorY,
  layers,
  background,
  cell,
  view,
  onViewChange,
  label,
  ...handlers
}: {
  /** Size in hires pixels. */
  width: number
  height: number
  /** Hires pixels per editable pixel: 2 for multicolour. */
  step: 1 | 2
  majorX: number
  majorY: number
  layers: ReadonlyArray<GridLayer>
  /** CSS colour behind transparent pixels. */
  background: string
  cell: number
  view: GridView
  onViewChange: (view: GridView) => void
  label: string
} & StrokeHandlers) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const width = columns * cell
  const height = rows * cell

  useEffect(() => {
    const canvas = canvasRef.current
    const ctx = canvas?.getContext('2d')
    if (!canvas || !ctx) return
    const dpr = window.devicePixelRatio || 1
    canvas.width = Math.round(width * dpr)
    canvas.height = Math.round(height * dpr)
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
    draw(ctx, {
      columns,
      rows,
      step,
      majorX,
      majorY,
      layers,
      background,
      cell,
      view,
      width,
      height,
    })
  }, [
    columns,
    rows,
    step,
    majorX,
    majorY,
    layers,
    background,
    cell,
    view,
    width,
    height,
  ])

  useGridGestures(canvasRef, {
    handlers,
    view,
    onViewChange,
    toCell: (p) => {
      const size = cell * view.zoom
      const hx = Math.floor((p.x - view.x) / size)
      const y = Math.floor((p.y - view.y) / size)
      if (hx < 0 || y < 0 || hx >= columns || y >= rows) return null
      return [Math.floor(hx / step), y]
    },
    zoomAt: (v, zoom, at) => zoomAround(v, zoom, at, width, height),
    panBy: (v, dx, dy) =>
      clampView({ zoom: v.zoom, x: v.x + dx, y: v.y + dy }, width, height),
  })

  return (
    <canvas
      ref={canvasRef}
      role="img"
      aria-label={label}
      className="touch-surface block cursor-crosshair"
      style={{ width, height }}
    />
  )
}

/** Minor grid lines that stay visible on light and dark backgrounds. */
function minorLineColor(background: string) {
  const m = /^#([0-9a-f]{6})$/i.exec(background)
  if (!m) return 'rgba(143, 141, 134, 0.35)'
  const n = parseInt(m[1], 16)
  const luma =
    0.2126 * ((n >> 16) & 255) + 0.7152 * ((n >> 8) & 255) + 0.0722 * (n & 255)
  return luma < 90 ? 'rgba(255, 255, 255, 0.16)' : 'rgba(143, 141, 134, 0.35)'
}

function draw(
  ctx: CanvasRenderingContext2D,
  o: {
    columns: number
    rows: number
    step: number
    majorX: number
    majorY: number
    layers: ReadonlyArray<GridLayer>
    background: string
    cell: number
    view: GridView
    width: number
    height: number
  },
) {
  ctx.clearRect(0, 0, o.width, o.height)
  ctx.save()
  ctx.translate(o.view.x, o.view.y)
  const cell = o.cell * o.view.zoom
  const w = o.columns * cell
  const h = o.rows * cell
  ctx.fillStyle = o.background
  ctx.fillRect(0, 0, w, h)

  for (const layer of o.layers) {
    ctx.globalAlpha = layer.alpha ?? 1
    for (let y = 0; y < o.rows; y++) {
      for (let x = 0; x < o.columns; x++) {
        const index = layer.pixels[y * o.columns + x]
        if (index < 0) continue
        ctx.fillStyle = PALETTE[index].hex
        // Slight overlap avoids hairline seams at fractional zoom.
        ctx.fillRect(x * cell, y * cell, cell + 0.5, cell + 0.5)
      }
    }
  }
  ctx.globalAlpha = 1

  const minor = minorLineColor(o.background)
  const line = (
    x0: number,
    y0: number,
    x1: number,
    y1: number,
    color: string,
  ) => {
    ctx.strokeStyle = color
    ctx.lineWidth = color === MAJOR ? 1.5 : 1
    ctx.beginPath()
    ctx.moveTo(x0, y0)
    ctx.lineTo(x1, y1)
    ctx.stroke()
  }
  for (let x = o.step; x < o.columns; x += o.step) {
    if (x % o.majorX !== 0) line(x * cell + 0.5, 0, x * cell + 0.5, h, minor)
  }
  for (let y = 1; y < o.rows; y++) {
    if (y % o.majorY !== 0) line(0, y * cell + 0.5, w, y * cell + 0.5, minor)
  }
  for (let x = o.majorX; x < o.columns; x += o.majorX)
    line(x * cell, 0, x * cell, h, MAJOR)
  for (let y = o.majorY; y < o.rows; y += o.majorY)
    line(0, y * cell, w, y * cell, MAJOR)
  ctx.restore()
}
