import { useState } from 'react'

/**
 * Char attributes drawn over chars (charset sheet, Screen worksheet): a
 * translucent tint per value with the value in hex in the corner. 0 (none)
 * draws nothing. The hues are fixed, not C64 colours, so they read as an
 * overlay; the golden-angle step keeps neighbouring values far apart.
 */
export function attributeTint(value: number): string {
  const hue = Math.round(((value - 1) * 137.5) % 360)
  return `hsl(${hue} 90% 50%)`
}

const TINT_ALPHA = 0.45
/** Below this cell size the number won't fit; only the tint is drawn. */
const MIN_LABEL_CELL = 12

/** Draw one char's attribute over a `size`-px cell at (x, y). */
export function drawAttribute(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  size: number,
  value: number,
) {
  if (value === 0) return
  ctx.save()
  ctx.globalAlpha = TINT_ALPHA
  ctx.fillStyle = attributeTint(value)
  ctx.fillRect(x, y, size, size)
  ctx.restore()
  if (size < MIN_LABEL_CELL) return
  const font = Math.min(14, Math.max(8, Math.floor(size * 0.55)))
  const w = Math.ceil(font * 0.7) + 2
  // White on black: readable on any char.
  ctx.fillStyle = 'rgb(0 0 0 / 0.75)'
  ctx.fillRect(x, y, w, font + 1)
  ctx.fillStyle = '#fff'
  ctx.font = `bold ${font}px ui-monospace, monospace`
  ctx.textBaseline = 'top'
  ctx.fillText(value.toString(16).toUpperCase(), x + 1, y + 1)
}

/**
 * Show / hide the attribute overlay; hidden by default and remembered per
 * device and per place (`'chars'`: the charset sheet, `'map'`: the Screen
 * worksheet). Storage failing just means hidden.
 */
export function useShowAttributes(
  where: 'chars' | 'map',
): [boolean, (show: boolean) => void] {
  const key = `c64pad:show-attributes:${where}`
  const [show, setShow] = useState(() => {
    try {
      return localStorage.getItem(key) === '1'
    } catch {
      return false
    }
  })
  return [
    show,
    (next: boolean) => {
      setShow(next)
      try {
        localStorage.setItem(key, next ? '1' : '0')
      } catch {
        // Remembered for this page only.
      }
    },
  ]
}
