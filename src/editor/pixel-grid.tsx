import { useEffect, useRef } from 'react'
import { PALETTE } from '@/c64/palette'
import { lineCells } from './line'
import { clampView, zoomAround } from './view'
import type { GridView } from './view'

const MAJOR = '#8f8d86'
/** A second tap on the same cell within this time is a double-tap. */
const DOUBLE_TAP_MS = 350
/** A press longer than this is not a tap. */
const TAP_MS = 300

export interface StrokeHandlers {
  /** A stroke starts at mode-pixel (x, y). */
  onStrokeStart: (x: number, y: number) => void
  /** The stroke moved over (x, y); called for every cell, no gaps. */
  onStrokeMove: (x: number, y: number) => void
  onStrokeEnd: () => void
  /** A second finger landed: undo the stroke in progress. */
  onStrokeCancel: () => void
  /**
   * The same cell was tapped twice quickly. The first tap was a normal stroke;
   * the second starts no stroke.
   */
  onDoubleTap?: (x: number, y: number) => void
}

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

  // Latest values without re-binding listeners.
  const live = useRef({
    handlers,
    step,
    columns,
    rows,
    cell,
    view,
    onViewChange,
    width,
    height,
  })
  live.current = {
    handlers,
    step,
    columns,
    rows,
    cell,
    view,
    onViewChange,
    width,
    height,
  }

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const pointers = new Map<number, { x: number; y: number }>()
    let stroke: {
      id: number
      last: [number, number]
      start: [number, number]
      at: number
      moved: boolean
      /** The second tap of a double-tap: no stroke was started. */
      silent: boolean
    } | null = null
    let lastTap: { x: number; y: number; at: number } | null = null
    let gesture: {
      dist: number
      mid: { x: number; y: number }
      view: GridView
    } | null = null
    /** After a gesture, wait for every finger to lift before drawing again. */
    let gestureLock = false
    let penSeenAt = -Infinity

    const local = (e: { clientX: number; clientY: number }) => {
      const rect = canvas.getBoundingClientRect()
      return { x: e.clientX - rect.left, y: e.clientY - rect.top }
    }

    const toCell = (e: PointerEvent): [number, number] | null => {
      const {
        cell: c,
        step: s,
        columns: cols,
        rows: rs,
        view: v,
      } = live.current
      const p = local(e)
      const size = c * v.zoom
      const hx = Math.floor((p.x - v.x) / size)
      const y = Math.floor((p.y - v.y) / size)
      if (hx < 0 || y < 0 || hx >= cols || y >= rs) return null
      return [Math.floor(hx / s), y]
    }

    const pinchState = () => {
      const [a, b] = [...pointers.values()]
      return {
        dist: Math.hypot(a.x - b.x, a.y - b.y) || 1,
        mid: { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 },
      }
    }

    const down = (e: PointerEvent) => {
      if (e.pointerType === 'pen') penSeenAt = e.timeStamp
      // Palm rejection: ignore touches while (or shortly after) the stylus is in use.
      if (e.pointerType === 'touch' && e.timeStamp - penSeenAt < 1500) return
      if (e.button > 0) return
      pointers.set(e.pointerId, local(e))
      canvas.setPointerCapture(e.pointerId)
      e.preventDefault()

      if (pointers.size === 2 && e.pointerType === 'touch') {
        if (stroke && !stroke.silent) live.current.handlers.onStrokeCancel()
        stroke = null
        lastTap = null
        gesture = { ...pinchState(), view: live.current.view }
        gestureLock = true
        return
      }
      if (pointers.size > 1 || gestureLock) return
      const at = toCell(e)
      if (!at) return
      const { onDoubleTap } = live.current.handlers
      const isDouble =
        !!onDoubleTap &&
        !!lastTap &&
        lastTap.x === at[0] &&
        lastTap.y === at[1] &&
        e.timeStamp - lastTap.at < DOUBLE_TAP_MS
      lastTap = null
      stroke = {
        id: e.pointerId,
        last: at,
        start: at,
        at: e.timeStamp,
        moved: false,
        silent: isDouble,
      }
      if (isDouble) onDoubleTap(...at)
      else live.current.handlers.onStrokeStart(...at)
    }

    const move = (e: PointerEvent) => {
      if (e.pointerType === 'pen') penSeenAt = e.timeStamp
      if (!pointers.has(e.pointerId)) return
      pointers.set(e.pointerId, local(e))

      if (gesture && pointers.size === 2) {
        const now = pinchState()
        const { width: w, height: h, view: current } = live.current
        // Zoom around where the fingers started, then follow their midpoint.
        const zoomed = zoomAround(
          gesture.view,
          gesture.view.zoom * (now.dist / gesture.dist),
          gesture.mid,
          w,
          h,
        )
        const next = clampView(
          {
            zoom: zoomed.zoom,
            x: zoomed.x + now.mid.x - gesture.mid.x,
            y: zoomed.y + now.mid.y - gesture.mid.y,
          },
          w,
          h,
        )
        if (
          next.zoom !== current.zoom ||
          next.x !== current.x ||
          next.y !== current.y
        ) {
          live.current.onViewChange(next)
        }
        return
      }

      if (!stroke || e.pointerId !== stroke.id || stroke.silent) return
      const samples = e.getCoalescedEvents()
      for (const ev of samples.length ? samples : [e]) {
        const at = toCell(ev)
        if (!at || (at[0] === stroke.last[0] && at[1] === stroke.last[1]))
          continue
        stroke.moved = true
        for (const [x, y] of lineCells(...stroke.last, ...at).slice(1)) {
          live.current.handlers.onStrokeMove(x, y)
        }
        stroke.last = at
      }
    }

    const up = (e: PointerEvent) => {
      pointers.delete(e.pointerId)
      if (pointers.size < 2) gesture = null
      if (pointers.size === 0) gestureLock = false
      if (stroke && e.pointerId === stroke.id) {
        const s = stroke
        stroke = null
        if (s.silent) return
        live.current.handlers.onStrokeEnd()
        const tapped =
          e.type === 'pointerup' && !s.moved && e.timeStamp - s.at < TAP_MS
        lastTap = tapped ? { x: s.start[0], y: s.start[1], at: s.at } : null
      }
    }

    /** Desktop: the wheel zooms around the cursor. */
    const wheel = (e: WheelEvent) => {
      e.preventDefault()
      const { width: w, height: h, view: v } = live.current
      live.current.onViewChange(
        zoomAround(v, v.zoom * Math.exp(-e.deltaY * 0.0025), local(e), w, h),
      )
    }

    canvas.addEventListener('pointerdown', down)
    canvas.addEventListener('pointermove', move)
    canvas.addEventListener('pointerup', up)
    canvas.addEventListener('pointercancel', up)
    canvas.addEventListener('wheel', wheel, { passive: false })
    return () => {
      canvas.removeEventListener('pointerdown', down)
      canvas.removeEventListener('pointermove', move)
      canvas.removeEventListener('pointerup', up)
      canvas.removeEventListener('pointercancel', up)
      canvas.removeEventListener('wheel', wheel)
    }
  }, [])

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
