import { useEffect, useRef } from 'react'
import { PALETTE } from '@/c64/palette'
import { SPRITE_HEIGHT } from '@/c64/sprite'
import { SPRITE_RENDER_WIDTH, renderSprite } from '@/c64/sprite-set'
import { lineCells } from '../line'
import type { PixelMode } from '@/c64/bitmap'
import type { C64Color } from '@/c64/palette'
import type { Sprite } from '@/c64/sprite'
import type { SpriteSet } from '@/c64/sprite-set'

const PAPER = '#fdfcf8'
const MINOR = 'rgba(143, 141, 134, 0.35)'
const MAJOR = '#8f8d86'

export interface StrokeHandlers {
  /** A stroke starts at mode-pixel (x, y). */
  onStrokeStart: (x: number, y: number) => void
  /** The stroke moved over (x, y); called for every cell, no gaps. */
  onStrokeMove: (x: number, y: number) => void
  onStrokeEnd: () => void
  /** A second finger landed: undo the stroke in progress. */
  onStrokeCancel: () => void
}

/**
 * The sprite's pixel grid as a canvas, drawn like the worksheet: minor lines
 * per pixel, heavy lines every byte (8 hires pixels) and every 7 rows.
 */
export function SpriteGrid({
  set,
  sprite,
  cell,
  background,
  ...handlers
}: {
  set: SpriteSet
  sprite: Sprite
  cell: number
  /** Colour shown for transparent pixels; null = worksheet paper. */
  background: C64Color | null
} & StrokeHandlers) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const width = SPRITE_RENDER_WIDTH * cell
  const height = SPRITE_HEIGHT * cell

  useEffect(() => {
    const canvas = canvasRef.current
    const ctx = canvas?.getContext('2d')
    if (!canvas || !ctx) return
    const dpr = window.devicePixelRatio || 1
    canvas.width = Math.round(width * dpr)
    canvas.height = Math.round(height * dpr)
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
    draw(ctx, set, sprite, cell, background)
  }, [set, sprite, cell, width, height, background])

  // Latest handlers/mode without re-binding listeners.
  const live = useRef({ handlers, mode: sprite.mode, cell })
  live.current = { handlers, mode: sprite.mode, cell }

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const pointers = new Map<number, PointerEvent>()
    let stroke: { id: number; last: [number, number] } | null = null
    let penSeenAt = 0

    const toCell = (e: PointerEvent): [number, number] | null => {
      const rect = canvas.getBoundingClientRect()
      const { cell: c, mode } = live.current
      const hx = Math.floor((e.clientX - rect.left) / c)
      const y = Math.floor((e.clientY - rect.top) / c)
      if (hx < 0 || y < 0 || hx >= SPRITE_RENDER_WIDTH || y >= SPRITE_HEIGHT)
        return null
      return [modeX(mode, hx), y]
    }

    const down = (e: PointerEvent) => {
      if (e.pointerType === 'pen') penSeenAt = e.timeStamp
      // Palm rejection: ignore touches while (or shortly after) the stylus is in use.
      if (e.pointerType === 'touch' && e.timeStamp - penSeenAt < 1500) return
      if (e.button > 0) return
      pointers.set(e.pointerId, e)
      if (pointers.size > 1) {
        // Multi-touch is a gesture, not drawing.
        if (stroke) {
          live.current.handlers.onStrokeCancel()
          stroke = null
        }
        return
      }
      const at = toCell(e)
      if (!at) return
      canvas.setPointerCapture(e.pointerId)
      stroke = { id: e.pointerId, last: at }
      live.current.handlers.onStrokeStart(...at)
      e.preventDefault()
    }

    const move = (e: PointerEvent) => {
      if (e.pointerType === 'pen') penSeenAt = e.timeStamp
      if (!stroke || e.pointerId !== stroke.id) return
      const events = e.getCoalescedEvents()
      for (const ev of events.length ? events : [e]) {
        const at = toCell(ev)
        if (!at || (at[0] === stroke.last[0] && at[1] === stroke.last[1]))
          continue
        for (const [x, y] of lineCells(...stroke.last, ...at).slice(1)) {
          live.current.handlers.onStrokeMove(x, y)
        }
        stroke.last = at
      }
    }

    const up = (e: PointerEvent) => {
      pointers.delete(e.pointerId)
      if (stroke && e.pointerId === stroke.id) {
        stroke = null
        live.current.handlers.onStrokeEnd()
      }
    }

    canvas.addEventListener('pointerdown', down)
    canvas.addEventListener('pointermove', move)
    canvas.addEventListener('pointerup', up)
    canvas.addEventListener('pointercancel', up)
    return () => {
      canvas.removeEventListener('pointerdown', down)
      canvas.removeEventListener('pointermove', move)
      canvas.removeEventListener('pointerup', up)
      canvas.removeEventListener('pointercancel', up)
    }
  }, [])

  return (
    <canvas
      ref={canvasRef}
      role="img"
      aria-label={`${sprite.name} pixel grid, ${sprite.mode === 'multicolor' ? '12' : '24'} by 21`}
      className="touch-surface block cursor-crosshair"
      style={{ width, height }}
    />
  )
}

function modeX(mode: PixelMode, hiresX: number) {
  return mode === 'multicolor' ? hiresX >> 1 : hiresX
}

function draw(
  ctx: CanvasRenderingContext2D,
  set: SpriteSet,
  sprite: Sprite,
  cell: number,
  background: C64Color | null,
) {
  const w = SPRITE_RENDER_WIDTH * cell
  const h = SPRITE_HEIGHT * cell
  ctx.fillStyle = background === null ? PAPER : PALETTE[background].hex
  ctx.fillRect(0, 0, w, h)

  const pixels = renderSprite(set, sprite)
  for (let y = 0; y < SPRITE_HEIGHT; y++) {
    for (let x = 0; x < SPRITE_RENDER_WIDTH; x++) {
      const index = pixels[y * SPRITE_RENDER_WIDTH + x]
      if (index < 0) continue
      ctx.fillStyle = PALETTE[index].hex
      ctx.fillRect(x * cell, y * cell, cell, cell)
    }
  }

  const step = sprite.mode === 'multicolor' ? 2 : 1
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
  for (let x = step; x < SPRITE_RENDER_WIDTH; x += step) {
    if (x % 8 !== 0) line(x * cell + 0.5, 0, x * cell + 0.5, h, MINOR)
  }
  for (let y = 1; y < SPRITE_HEIGHT; y++) {
    if (y % 7 !== 0) line(0, y * cell + 0.5, w, y * cell + 0.5, MINOR)
  }
  for (let x = 8; x < SPRITE_RENDER_WIDTH; x += 8)
    line(x * cell, 0, x * cell, h, MAJOR)
  for (let y = 7; y < SPRITE_HEIGHT; y += 7)
    line(0, y * cell, w, y * cell, MAJOR)
}
