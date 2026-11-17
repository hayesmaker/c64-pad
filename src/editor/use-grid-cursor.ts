import { useRef, useState } from 'react'
import { PAD, useGamepad } from '@/lib/gamepad'
import { showToast } from '@/components/toast'
import type { StrokeHandlers } from './gestures'

/** What the face and shoulder buttons do, besides painting with A. */
export interface GridPadActions {
  /** B: Draw ↔ Erase. X: Draw ↔ Fill. */
  onToggleTool: (tool: 'erase' | 'fill') => void
  /** L1 / R1: previous / next pen. */
  onPen: (delta: -1 | 1) => void
  /** Y + L1 / R1: previous / next sprite or char. */
  onItem: (delta: -1 | 1) => void
  onUndo: () => void
  onRedo: () => void
  /** Select: Zen mode on / off. */
  onZen: () => void
}

/** Shown once per app session, on the first gamepad press. */
let announced = false

/**
 * A gamepad cursor over a pixel grid: the d-pad or left stick moves it, A
 * paints with the current tool (hold A and move to draw a line), and the
 * other buttons switch tools, pens and sprites/chars (see GamepadHelp).
 * Strokes go through the grid's StrokeHandlers, so they undo like touch.
 *
 * `columns` is in editable pixels (12 for a multicolour sprite).
 */
export function useGridCursor({
  columns,
  rows,
  handlers,
  actions,
  enabled = true,
}: {
  columns: number
  rows: number
  handlers: StrokeHandlers
  actions: GridPadActions
  enabled?: boolean
}) {
  const [cursor, setCursor] = useState<[number, number] | null>(null)
  const [help, setHelp] = useState(false)
  /** The cursor as of the latest event (several can land in one frame). */
  const pos = useRef<[number, number] | null>(null)
  const stroking = useRef(false)
  const clamp = ([x, y]: [number, number]): [number, number] => [
    Math.max(0, Math.min(columns - 1, x)),
    Math.max(0, Math.min(rows - 1, y)),
  ]
  const centre: [number, number] = [
    Math.floor(columns / 2),
    Math.floor(rows / 2),
  ]

  const endStroke = () => {
    if (!stroking.current) return
    stroking.current = false
    handlers.onStrokeEnd()
  }

  const move = (next: [number, number]) => {
    pos.current = next
    setCursor(next)
  }

  useGamepad((e, pad) => {
    const at = pos.current && clamp(pos.current)
    if (!announced) {
      announced = true
      showToast('Gamepad: press Start for the controls', 3500)
    }
    if (e.type === 'move') {
      const next = at ? clamp([at[0] + e.dx, at[1] + e.dy]) : centre
      move(next)
      if (stroking.current && at && (next[0] !== at[0] || next[1] !== at[1]))
        handlers.onStrokeMove(next[0], next[1])
      return
    }
    if (e.type === 'release') {
      if (e.button === PAD.A) endStroke()
      return
    }
    switch (e.button) {
      case PAD.A:
        if (!at) {
          move(centre)
          return
        }
        stroking.current = true
        handlers.onStrokeStart(at[0], at[1])
        return
      case PAD.B:
        return actions.onToggleTool('erase')
      case PAD.X:
        return actions.onToggleTool('fill')
      case PAD.L1:
      case PAD.R1: {
        const delta = e.button === PAD.L1 ? -1 : 1
        if (pad.isDown(PAD.Y)) {
          endStroke()
          actions.onItem(delta)
        } else actions.onPen(delta)
        return
      }
      case PAD.L2:
        endStroke()
        return actions.onUndo()
      case PAD.R2:
        endStroke()
        return actions.onRedo()
      case PAD.SELECT:
        endStroke()
        return actions.onZen()
      case PAD.START:
        return setHelp((h) => !h)
    }
  }, enabled)

  // The grid can narrow under the cursor (hires → multicolour).
  return {
    cursor: cursor && clamp(cursor),
    help,
    closeHelp: () => setHelp(false),
  }
}

/** Step through a list of pens by value, wrapping around. */
export function stepPen(
  pens: ReadonlyArray<{ value: number }>,
  pen: number,
  delta: -1 | 1,
) {
  const i = pens.findIndex((p) => p.value === pen)
  return pens[(i + delta + pens.length) % pens.length].value
}
