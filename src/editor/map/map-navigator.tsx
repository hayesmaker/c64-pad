import { useEffect, useMemo, useRef, useState } from 'react'
import { MapIcon, Minus } from 'lucide-react'
import { usePalette } from '@/components/c64/palette-context'
import { drawTracing } from '../tracing/placement'
import { clampViewTo } from '../view'
import { charAtlas } from './map-canvas'
import type { GridTracing } from '../tracing/placement'
import type { GridView, ViewBounds } from '../view'
import type { Charmap } from '@/c64/charmap'
import type { Charset } from '@/c64/charset'

/** Below this many device px per char, chars are drawn as one average colour. */
const DETAIL_PX = 4

/**
 * Px per char for a navigator showing the whole map: at most 240 × 360 px,
 * a third of the frame's width and its height less room for the title, so a
 * tall or wide map gets a long strip rather than a sliver.
 */
export function navigatorScale(
  map: Pick<Charmap, 'width' | 'height'>,
  frame: { width: number; height: number },
) {
  const maxW = Math.max(48, Math.min(240, frame.width / 3))
  const maxH = Math.max(48, Math.min(360, frame.height - 56))
  return Math.min(maxW / map.width, maxH / map.height)
}

/** The part of the map the view shows, in chars, clipped to the map. */
export function visibleChars(
  map: Pick<Charmap, 'width' | 'height'>,
  view: GridView,
  bounds: ViewBounds,
) {
  const size = (bounds.contentW / map.width) * view.zoom
  const x = Math.max(0, -view.x / size)
  const y = Math.max(0, -view.y / size)
  return {
    x,
    y,
    width: Math.min(map.width - x, bounds.frameW / size),
    height: Math.min(map.height - y, bounds.frameH / size),
  }
}

/** The view with the map point (cx, cy), in chars, in the middle of the frame. */
export function centerViewOn(
  map: Pick<Charmap, 'width' | 'height'>,
  view: GridView,
  bounds: ViewBounds,
  cx: number,
  cy: number,
): GridView {
  const size = (bounds.contentW / map.width) * view.zoom
  return clampViewTo(
    {
      zoom: view.zoom,
      x: bounds.frameW / 2 - cx * size,
      y: bounds.frameH / 2 - cy * size,
    },
    bounds,
  )
}

/** The average colour of each screen code's 8 × 8 pixels, as RGB. */
function averageColors(atlas: HTMLCanvasElement): Uint8ClampedArray {
  const out = new Uint8ClampedArray(256 * 3)
  const data = atlas.getContext('2d')?.getImageData(0, 0, 256 * 8, 8).data
  if (!data) return out
  for (let code = 0; code < 256; code++) {
    let r = 0
    let g = 0
    let b = 0
    for (let y = 0; y < 8; y++) {
      for (let x = 0; x < 8; x++) {
        const o = (y * 256 * 8 + code * 8 + x) * 4
        r += data[o]
        g += data[o + 1]
        b += data[o + 2]
      }
    }
    out[code * 3] = r / 64
    out[code * 3 + 1] = g / 64
    out[code * 3 + 2] = b / 64
  }
  return out
}

/**
 * A thumbnail of the whole map in the corner of the map canvas, with the
 * visible part boxed. Tap or drag to move the view there. Shown only when the
 * map doesn't fit; it folds away to a button.
 */
export function MapNavigator({
  map,
  charset,
  view,
  bounds,
  onViewChange,
  tracing,
}: {
  map: Charmap
  charset: Charset
  view: GridView
  bounds: ViewBounds
  onViewChange: (view: GridView) => void
  tracing?: GridTracing | null
}) {
  const [open, setOpen] = useState(true)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const palette = usePalette()
  const atlas = useMemo(
    () => charAtlas(charset, palette.rgb),
    [charset, palette.rgb],
  )
  const averages = useMemo(() => averageColors(atlas), [atlas])
  const k = navigatorScale(map, {
    width: bounds.frameW,
    height: bounds.frameH,
  })
  const navW = Math.max(1, Math.round(map.width * k))
  const navH = Math.max(1, Math.round(map.height * k))
  const fits =
    bounds.contentW * view.zoom <= bounds.frameW + 0.5 &&
    bounds.contentH * view.zoom <= bounds.frameH + 0.5

  useEffect(() => {
    const canvas = canvasRef.current
    const ctx = canvas?.getContext('2d')
    if (!canvas || !ctx) return
    const dpr = window.devicePixelRatio || 1
    canvas.width = Math.round(navW * dpr)
    canvas.height = Math.round(navH * dpr)
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
    ctx.clearRect(0, 0, navW, navH)
    const sx = navW / map.width
    const sy = navH / map.height
    const under = tracing?.layer === 'under' ? tracing : null
    if (under) {
      ctx.fillStyle = palette.hex[charset.background]
      ctx.fillRect(0, 0, navW, navH)
      drawTracing(ctx, under, sx / 8, { width: navW, height: navH })
    }
    const skip = (code: number) => !!under && code === map.blank

    if (sx * dpr >= DETAIL_PX) {
      // Few enough cells to draw each char, smoothed down.
      ctx.imageSmoothingEnabled = true
      for (let y = 0; y < map.height; y++) {
        for (let x = 0; x < map.width; x++) {
          const code = map.cells[y * map.width + x]
          if (skip(code)) continue
          ctx.drawImage(atlas, code * 8, 0, 8, 8, x * sx, y * sy, sx, sy)
        }
      }
    } else {
      // One pixel per char in its average colour, scaled to fit.
      const small = document.createElement('canvas')
      small.width = map.width
      small.height = map.height
      const sctx = small.getContext('2d')
      if (!sctx) return
      const image = sctx.createImageData(map.width, map.height)
      for (let i = 0; i < map.cells.length; i++) {
        const code = map.cells[i]
        image.data[i * 4] = averages[code * 3]
        image.data[i * 4 + 1] = averages[code * 3 + 1]
        image.data[i * 4 + 2] = averages[code * 3 + 2]
        image.data[i * 4 + 3] = skip(code) ? 0 : 255
      }
      sctx.putImageData(image, 0, 0)
      ctx.imageSmoothingEnabled = true
      ctx.drawImage(small, 0, 0, navW, navH)
    }
    if (tracing?.layer === 'over')
      drawTracing(ctx, tracing, sx / 8, { width: navW, height: navH })
  }, [
    map,
    atlas,
    averages,
    navW,
    navH,
    tracing,
    charset.background,
    palette,
    open,
    fits,
  ])

  /** Where in the box the pointer grabbed it, in chars from its centre. */
  const grab = useRef<{ dx: number; dy: number } | null>(null)
  const box = visibleChars(map, view, bounds)

  if (fits) return null
  if (!open)
    return (
      <button
        type="button"
        aria-label="Show the map navigator"
        title="Navigator"
        onClick={() => setOpen(true)}
        className="absolute right-2 bottom-2 flex size-9 items-center justify-center rounded-lg border border-rule bg-paper/90 text-foreground shadow-[0_4px_16px_var(--shadow)] hover:bg-muted [&_svg]:size-4"
      >
        <MapIcon />
      </button>
    )

  const toChars = (e: React.PointerEvent) => {
    const rect = e.currentTarget.getBoundingClientRect()
    return {
      cx: ((e.clientX - rect.left) / rect.width) * map.width,
      cy: ((e.clientY - rect.top) / rect.height) * map.height,
    }
  }
  const moveTo = (e: React.PointerEvent) => {
    const g = grab.current
    if (!g) return
    const { cx, cy } = toChars(e)
    onViewChange(centerViewOn(map, view, bounds, cx - g.dx, cy - g.dy))
  }

  return (
    <div className="absolute right-2 bottom-2 flex flex-col gap-1 rounded-lg border border-rule bg-paper/90 p-1 shadow-[0_4px_16px_var(--shadow)]">
      <div className="flex items-center justify-between pl-1">
        <span className="text-[11px] text-muted-foreground">Navigator</span>
        <button
          type="button"
          aria-label="Hide the map navigator"
          title="Hide"
          onClick={() => setOpen(false)}
          className="flex size-6 items-center justify-center rounded-md text-muted-foreground hover:bg-muted [&_svg]:size-3.5"
        >
          <Minus />
        </button>
      </div>
      <div
        role="slider"
        aria-label="Map navigator: drag to move the view"
        aria-valuetext={`Showing x ${Math.round(box.x)}, y ${Math.round(box.y)}`}
        className="touch-surface relative cursor-pointer"
        style={{ width: navW, height: navH }}
        onPointerDown={(e) => {
          e.preventDefault()
          e.stopPropagation()
          e.currentTarget.setPointerCapture(e.pointerId)
          const { cx, cy } = toChars(e)
          const inside =
            cx >= box.x &&
            cx <= box.x + box.width &&
            cy >= box.y &&
            cy <= box.y + box.height
          // Dragging the box keeps hold where it was grabbed; elsewhere jumps.
          grab.current = inside
            ? {
                dx: cx - (box.x + box.width / 2),
                dy: cy - (box.y + box.height / 2),
              }
            : { dx: 0, dy: 0 }
          moveTo(e)
        }}
        onPointerMove={moveTo}
        onPointerUp={() => (grab.current = null)}
        onPointerCancel={() => (grab.current = null)}
      >
        <canvas
          ref={canvasRef}
          aria-hidden="true"
          className="block"
          style={{ width: navW, height: navH }}
        />
        <div
          aria-hidden="true"
          className="pointer-events-none absolute border-2 border-[#edf171] shadow-[0_0_0_1px_rgba(0,0,0,0.6)]"
          style={{
            left: (box.x / map.width) * navW,
            top: (box.y / map.height) * navH,
            width: (box.width / map.width) * navW,
            height: (box.height / map.height) * navH,
          }}
        />
      </div>
    </div>
  )
}
