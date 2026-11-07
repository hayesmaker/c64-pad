import { useEffect, useRef } from 'react'
import { lineCells } from './line'
import type { RefObject } from 'react'
import type { GridView } from './view'

/** A second tap on the same cell within this time is a double-tap. */
const DOUBLE_TAP_MS = 350
/** A press longer than this is not a tap. */
const TAP_MS = 300

export interface StrokeHandlers {
  /** A stroke starts at cell (x, y). */
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
  /**
   * The cell under the pointer changed (null = left the grid): a hovering
   * mouse or stylus, or a touch while drawing.
   */
  onHover?: (cell: [number, number] | null, pointerType: string) => void
}

export interface GestureConfig {
  handlers: StrokeHandlers
  /** The cell under a point in element coordinates, or null outside. */
  toCell: (p: { x: number; y: number }) => [number, number] | null
  view: GridView
  onViewChange: (view: GridView) => void
  /** Zoom to `zoom` around `at`, clamped. */
  zoomAt: (
    view: GridView,
    zoom: number,
    at: { x: number; y: number },
  ) => GridView
  /** The view moved by (dx, dy), clamped. */
  panBy: (view: GridView, dx: number, dy: number) => GridView
}

/**
 * Pointer input for an editable grid element. One pointer draws strokes; two
 * touch pointers pinch-zoom and pan; the wheel zooms. Touches are ignored
 * while a stylus is in use (palm rejection).
 */
export function useGridGestures(
  ref: RefObject<HTMLElement | null>,
  config: GestureConfig,
) {
  // Latest values without re-binding listeners.
  const live = useRef(config)
  live.current = config

  useEffect(() => {
    const canvas = ref.current
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
    let hovered: string | null = null

    const local = (e: { clientX: number; clientY: number }) => {
      const rect = canvas.getBoundingClientRect()
      return { x: e.clientX - rect.left, y: e.clientY - rect.top }
    }
    const toCell = (e: PointerEvent) => live.current.toCell(local(e))

    const hover = (at: [number, number] | null, pointerType: string) => {
      const key = at ? at.join() : null
      if (key === hovered) return
      hovered = key
      live.current.handlers.onHover?.(at, pointerType)
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
      hover(at, e.pointerType)
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
      if (!pointers.has(e.pointerId)) {
        // Hovering mouse or stylus.
        if (e.pointerType !== 'touch') hover(toCell(e), e.pointerType)
        return
      }
      pointers.set(e.pointerId, local(e))

      if (gesture && pointers.size === 2) {
        const now = pinchState()
        const { view: current, zoomAt, panBy } = live.current
        // Zoom around where the fingers started, then follow their midpoint.
        const zoomed = zoomAt(
          gesture.view,
          gesture.view.zoom * (now.dist / gesture.dist),
          gesture.mid,
        )
        const next = panBy(
          zoomed,
          now.mid.x - gesture.mid.x,
          now.mid.y - gesture.mid.y,
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
        hover(at, e.pointerType)
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

    const leave = (e: PointerEvent) => {
      if (e.pointerType !== 'touch' && !pointers.has(e.pointerId))
        hover(null, e.pointerType)
    }

    /** Desktop: the wheel zooms around the cursor. */
    const wheel = (e: WheelEvent) => {
      e.preventDefault()
      const { view: v, zoomAt } = live.current
      live.current.onViewChange(
        zoomAt(v, v.zoom * Math.exp(-e.deltaY * 0.0025), local(e)),
      )
    }

    canvas.addEventListener('pointerdown', down)
    canvas.addEventListener('pointermove', move)
    canvas.addEventListener('pointerup', up)
    canvas.addEventListener('pointercancel', up)
    canvas.addEventListener('pointerleave', leave)
    canvas.addEventListener('wheel', wheel, { passive: false })
    return () => {
      canvas.removeEventListener('pointerdown', down)
      canvas.removeEventListener('pointermove', move)
      canvas.removeEventListener('pointerup', up)
      canvas.removeEventListener('pointercancel', up)
      canvas.removeEventListener('pointerleave', leave)
      canvas.removeEventListener('wheel', wheel)
    }
  }, [ref])
}
