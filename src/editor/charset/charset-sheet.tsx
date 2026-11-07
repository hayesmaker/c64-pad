import { useEffect, useRef } from 'react'
import { charCount, renderChar } from '@/c64/charset'
import { PALETTE } from '@/c64/palette'
import type { Charset } from '@/c64/charset'

const COLUMNS = 16
const SCALE = 2
const PITCH = 8 * SCALE + 2
const ACCENT = '#2e2c9b'

const hexDigit = (n: number) => n.toString(16).toUpperCase()

/**
 * Every usable char of the set in a 16-wide grid with hex labels; tap one to
 * pick it. In ECM only the first 64 chars exist.
 */
export function CharsetSheet({
  charset,
  selected,
  swapping,
  onPick,
}: {
  charset: Charset
  selected: number
  /** Mark the sheet as waiting for a swap target. */
  swapping: boolean
  onPick: (index: number) => void
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const count = charCount(charset.mode)
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
      const pixels = renderChar(charset, i)
      for (let y = 0; y < 8; y++) {
        for (let x = 0; x < 8; x++) {
          ctx.fillStyle = PALETTE[pixels[y * 8 + x]].hex
          ctx.fillRect(ox + x * SCALE, oy + y * SCALE, SCALE, SCALE)
        }
      }
    }
    const sx = (selected % COLUMNS) * PITCH
    const sy = Math.floor(selected / COLUMNS) * PITCH
    ctx.strokeStyle = ACCENT
    ctx.lineWidth = 2
    ctx.strokeRect(sx, sy, PITCH, PITCH)
  }, [charset, count, selected, width, height])

  const pick = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const rect = e.currentTarget.getBoundingClientRect()
    const col = Math.floor((e.clientX - rect.left) / PITCH)
    const row = Math.floor((e.clientY - rect.top) / PITCH)
    const index = row * COLUMNS + col
    if (col >= 0 && col < COLUMNS && row >= 0 && index < count) onPick(index)
  }

  return (
    <div className="flex flex-col">
      <div aria-hidden="true" className="flex" style={{ marginLeft: 26 }}>
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
        <div aria-hidden="true" className="flex w-[26px] flex-col">
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
          onPointerDown={pick}
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
            outline: swapping ? '1px dashed #8f8d86' : undefined,
            outlineOffset: 2,
          }}
        />
      </div>
    </div>
  )
}
