import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { charCount, renderChar } from '@/c64/charset'
import { usePalette } from '@/components/c64/palette-context'
import { cssVar, useColorScheme } from '@/lib/theme'
import type { Charset } from '@/c64/charset'

const COLUMNS = 16
const LABEL_W = 24

const hexDigit = (n: number) => n.toString(16).toUpperCase()

/**
 * Every usable char of the set in a 16-wide grid with hex labels; tap one to
 * pick it. In ECM only the first 64 chars exist.
 */
export function CharsetSheet({
  charset,
  selected,
  swapping = false,
  onPick,
  pitch = 17,
  background,
  marked,
  magnify = false,
}: {
  charset: Charset
  selected: number
  /** Mark the sheet as waiting for a swap target. */
  swapping?: boolean
  onPick: (index: number) => void
  /** Px per char including a 1 px gap. */
  pitch?: number
  /** ECM background 0-3 to draw the chars on (default 0). */
  background?: number
  /** Chars outlined as chosen (multi-select), besides `selected`. */
  marked?: ReadonlySet<number>
  /**
   * Pen and touch: pressing shows a magnifier over the chars round the tip;
   * slide to the one you want and lift to pick it (lift off the grid to
   * cancel). The mouse picks on click as usual.
   */
  magnify?: boolean
}) {
  const palette = usePalette()
  const PITCH = pitch
  const SCALE = (pitch - 1) / 8
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const count = charCount(charset.mode)
  const scheme = useColorScheme()
  const rows = Math.ceil(count / COLUMNS)
  const width = COLUMNS * PITCH
  const height = rows * PITCH

  useEffect(() => {
    const canvas = canvasRef.current
    const ctx = canvas?.getContext('2d')
    if (!canvas || !ctx) return
    const dpr = window.devicePixelRatio || 1
    canvas.width = Math.round(width * dpr)
    canvas.height = Math.round(height * dpr)
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
    ctx.clearRect(0, 0, width, height)
    for (let i = 0; i < count; i++) {
      const ox = (i % COLUMNS) * PITCH + 1
      const oy = Math.floor(i / COLUMNS) * PITCH + 1
      const pixels = renderChar(charset, i, background)
      for (let y = 0; y < 8; y++) {
        for (let x = 0; x < 8; x++) {
          ctx.fillStyle = palette.hex[pixels[y * 8 + x]]
          ctx.fillRect(ox + x * SCALE, oy + y * SCALE, SCALE, SCALE)
        }
      }
    }
    const primary = cssVar('--primary') || '#2e2c9b'
    if (marked) {
      ctx.strokeStyle = primary
      ctx.lineWidth = 2
      for (const i of marked) {
        if (i >= count) continue
        ctx.strokeRect(
          (i % COLUMNS) * PITCH + 1,
          Math.floor(i / COLUMNS) * PITCH + 1,
          PITCH - 2,
          PITCH - 2,
        )
      }
    }
    if (selected < 0) return
    const sx = (selected % COLUMNS) * PITCH
    const sy = Math.floor(selected / COLUMNS) * PITCH
    ctx.strokeStyle = primary
    ctx.lineWidth = 2
    ctx.strokeRect(sx, sy, PITCH, PITCH)
  }, [
    charset,
    count,
    selected,
    width,
    height,
    PITCH,
    SCALE,
    background,
    scheme,
    palette,
    marked,
  ])

  const [loupe, setLoupe] = useState<Loupe | null>(null)

  /** The char under a pointer, or -1 off the grid. */
  const charAt = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const rect = e.currentTarget.getBoundingClientRect()
    const col = Math.floor((e.clientX - rect.left) / PITCH)
    const row = Math.floor((e.clientY - rect.top) / PITCH)
    const index = row * COLUMNS + col
    return col >= 0 && col < COLUMNS && row >= 0 && index < count ? index : -1
  }
  /**
   * Follow the tip. The highlighted char stays until the tip is STICKY px
   * into another, so wobble (and the skid as a stylus lifts) can't flip it
   * to a neighbour.
   */
  const track = (e: React.PointerEvent<HTMLCanvasElement>) => {
    let index = charAt(e)
    const held = loupe?.index ?? -1
    if (held >= 0 && index !== held) {
      const rect = e.currentTarget.getBoundingClientRect()
      const x = e.clientX - rect.left - (held % COLUMNS) * PITCH
      const y = e.clientY - rect.top - Math.floor(held / COLUMNS) * PITCH
      const near = (v: number) => v > -STICKY && v < PITCH + STICKY
      if (near(x) && near(y)) index = held
    }
    setLoupe({ index, x: e.clientX, y: e.clientY })
  }

  const onPointerDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!magnify || e.pointerType === 'mouse') {
      const index = charAt(e)
      if (index >= 0) onPick(index)
      return
    }
    try {
      // Keep getting moves when the tip slides off the grid.
      e.currentTarget.setPointerCapture(e.pointerId)
    } catch {
      // A pointer that can't be captured still works over the grid.
    }
    track(e)
  }

  return (
    <div className="flex flex-col">
      <div aria-hidden="true" className="flex" style={{ marginLeft: LABEL_W }}>
        {Array.from({ length: COLUMNS }, (_, c) => (
          <div
            key={c}
            className="text-center font-mono text-[9px] leading-[14px] text-muted-foreground"
            style={{ width: PITCH }}
          >
            {hexDigit(c)}
          </div>
        ))}
      </div>
      <div className="flex">
        <div
          aria-hidden="true"
          className="flex flex-col"
          style={{ width: LABEL_W }}
        >
          {Array.from({ length: rows }, (_, r) => (
            <div
              key={r}
              className="flex items-center font-mono text-[9px] text-muted-foreground"
              style={{ height: PITCH }}
            >
              ${hexDigit(r)}0
            </div>
          ))}
        </div>
        <canvas
          ref={canvasRef}
          role="img"
          aria-label={`Characters in ${charset.name}; character ${selected} selected`}
          onPointerDown={onPointerDown}
          onPointerMove={(e) => {
            if (loupe) track(e)
          }}
          onPointerUp={() => {
            if (!loupe) return
            // The char the magnifier shows, not where the lift skidded to.
            const { index } = loupe
            setLoupe(null)
            if (index >= 0) onPick(index)
          }}
          onPointerCancel={() => setLoupe(null)}
          tabIndex={0}
          onKeyDown={(e) => {
            const step = {
              ArrowLeft: -1,
              ArrowRight: 1,
              ArrowUp: -COLUMNS,
              ArrowDown: COLUMNS,
            }[e.key]
            if (step === undefined) return
            e.preventDefault()
            const next = selected + step
            if (next >= 0 && next < count) onPick(next)
          }}
          className="touch-surface block cursor-pointer rounded-[3px]"
          style={{
            width,
            height,
            outline: swapping ? '1px dashed var(--rule)' : undefined,
            outlineOffset: 2,
          }}
        />
      </div>
      {loupe &&
        createPortal(
          <Magnifier
            charset={charset}
            count={count}
            background={background}
            loupe={loupe}
          />,
          document.body,
        )}
    </div>
  )
}

interface Loupe {
  /** The char under the tip (-1: off the grid). */
  index: number
  x: number
  y: number
}

const STICKY = 3 // px a tip must go into a neighbour to move to it
const SPAN = 5 // chars across and down
const BIG = 40 // px per char
const GAP = 28 // px between the tip and the magnifier

/** The chars round the tip, big, floating above it (below near the top). */
function Magnifier({
  charset,
  count,
  background,
  loupe,
}: {
  charset: Charset
  count: number
  background?: number
  loupe: Loupe
}) {
  const palette = usePalette()
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const size = SPAN * BIG
  const centre = loupe.index

  useEffect(() => {
    const canvas = canvasRef.current
    const ctx = canvas?.getContext('2d')
    if (!canvas || !ctx) return
    const dpr = window.devicePixelRatio || 1
    canvas.width = Math.round(size * dpr)
    canvas.height = Math.round(size * dpr)
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
    ctx.fillStyle = cssVar('--muted') || '#ddd'
    ctx.fillRect(0, 0, size, size)
    if (centre < 0) return
    const half = Math.floor(SPAN / 2)
    const col0 = (centre % COLUMNS) - half
    const row0 = Math.floor(centre / COLUMNS) - half
    const px = (BIG - 2) / 8
    for (let r = 0; r < SPAN; r++) {
      for (let c = 0; c < SPAN; c++) {
        const col = col0 + c
        const i = (row0 + r) * COLUMNS + col
        if (col < 0 || col >= COLUMNS || row0 + r < 0 || i >= count) continue
        const pixels = renderChar(charset, i, background)
        for (let y = 0; y < 8; y++) {
          for (let x = 0; x < 8; x++) {
            ctx.fillStyle = palette.hex[pixels[y * 8 + x]]
            ctx.fillRect(c * BIG + 1 + x * px, r * BIG + 1 + y * px, px, px)
          }
        }
      }
    }
    // White inside black: visible on any C64 colour.
    const at = half * BIG
    ctx.lineWidth = 2
    ctx.strokeStyle = '#000'
    ctx.strokeRect(at + 1, at + 1, BIG - 2, BIG - 2)
    ctx.strokeStyle = '#fff'
    ctx.strokeRect(at + 3, at + 3, BIG - 6, BIG - 6)
  }, [charset, count, background, centre, palette, size])

  const boxH = size + 22
  const above = loupe.y - GAP - boxH
  const top = above >= 8 ? above : loupe.y + GAP
  const left = Math.min(
    Math.max(8, loupe.x - size / 2),
    window.innerWidth - size - 8,
  )
  return (
    <div
      role="status"
      aria-live="polite"
      className="pointer-events-none fixed z-50 flex flex-col overflow-hidden rounded-lg border border-rule bg-card shadow-lg"
      style={{ left, top }}
    >
      <canvas
        ref={canvasRef}
        aria-hidden="true"
        className="block"
        style={{ width: size, height: size }}
      />
      <span className="text-center font-mono text-xs leading-[22px]">
        {centre >= 0
          ? `$${centre.toString(16).toUpperCase().padStart(2, '0')} · ${centre}`
          : 'Lift here to cancel'}
      </span>
    </div>
  )
}
