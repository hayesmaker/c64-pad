import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import {
  ChevronLeft,
  ChevronRight,
  Eraser,
  Hand,
  Minimize2,
  Minus,
  PaintBucket,
  Pencil,
  Plus,
  Redo2,
  Undo2,
} from 'lucide-react'
import { COLOR_NAMES } from '@/c64/palette'
import { usePalette } from '@/components/c64/palette-context'
import { cn } from '@/lib/utils'
import { DEFAULT_VIEW, MAX_ZOOM, zoomAround } from './view'
import { zoomLabel } from './grid-parts'
import type { ReactNode } from 'react'
import type { GridView } from './view'
import { penSwatch } from './pens-panel'
import type { PenDef } from './pens-panel'
import type { C64Color } from '@/c64/palette'

export type ZenTool = 'draw' | 'erase' | 'fill' | 'pan'

/** Room left for the floating panels around the grid. */
const TOP = 72
/** Room for the tools panel on the left. */
const LEFT = 96

/**
 * Zen mode: the grid alone, filling the screen, with pinch zoom and only the
 * essentials: draw / erase / fill, undo / redo, the pens and the project's
 * colours to recolour the chosen pen.
 */
export function ZenMode({
  title,
  columns,
  rows,
  renderGrid,
  tool,
  onTool,
  side,
  sideWidth = 168,
  zoom = (v, factor, at, frame) =>
    zoomAround(
      v,
      Math.min(MAX_ZOOM, v.zoom * factor),
      at,
      frame.width,
      frame.height,
    ),
  minZoom = 1,
  hint = 'Pinch to zoom · two fingers to pan · double-tap a pixel to clear it',
  toolLabels = {},
  canPan = false,
  onUndo,
  onRedo,
  canUndo,
  canRedo,
  onPrev,
  onNext,
  onExit,
}: {
  /** What is being edited, e.g. "Sprite 3" or "Char $41". */
  title: string
  /** Grid size in hires pixels. */
  columns: number
  rows: number
  renderGrid: (
    cell: number,
    view: GridView,
    onViewChange: (v: GridView) => void,
  ) => ReactNode
  tool: ZenTool
  onTool: (tool: ZenTool) => void
  /** The right-hand panel: pens (ZenPens) or a brush picker. */
  side: ReactNode
  /** Room kept on the right for the side panel, in px. */
  sideWidth?: number
  /** Zoom by `factor` around `at` (the +/- buttons). */
  zoom?: (
    view: GridView,
    factor: number,
    at: { x: number; y: number },
    frame: { width: number; height: number },
  ) => GridView
  minZoom?: number
  hint?: string
  toolLabels?: Partial<Record<ZenTool, string>>
  /** Offer the Hand tool (one finger drags the view). */
  canPan?: boolean
  onUndo: () => void
  onRedo: () => void
  canUndo: boolean
  canRedo: boolean
  /** Previous / next asset; the arrows are hidden without them. */
  onPrev?: () => void
  onNext?: () => void
  onExit: () => void
}) {
  const [box, setBox] = useState({ width: 0, height: 0 })
  const areaRef = useRef<HTMLDivElement>(null)
  useLayoutEffect(() => {
    const el = areaRef.current
    if (!el) return
    const measure = () =>
      setBox({ width: el.clientWidth, height: el.clientHeight })
    measure()
    const ro = new ResizeObserver(measure)
    ro.observe(el)
    return () => ro.disconnect()
  }, [])
  const cell = Math.max(
    4,
    Math.floor(
      Math.min(
        (box.width - LEFT - sideWidth) / columns,
        (box.height - 2 * TOP) / rows,
      ),
    ),
  )
  const [view, setView] = useState<GridView>(DEFAULT_VIEW)
  useEffect(() => setView(DEFAULT_VIEW), [cell])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onExit()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onExit])

  const w = columns * cell
  const h = rows * cell
  const zoomBy = (factor: number) =>
    setView((v) =>
      zoom(v, factor, { x: w / 2, y: h / 2 }, { width: w, height: h }),
    )

  return (
    <div
      ref={areaRef}
      role="dialog"
      aria-modal="true"
      aria-label={`Zen mode: ${title}`}
      className="fixed inset-0 z-40 overflow-hidden bg-desk"
    >
      <div
        className="absolute inset-y-0 flex items-center justify-center"
        style={{ left: LEFT, right: sideWidth }}
      >
        {box.width > 0 && (
          <div className="rounded-[2px] border-2 border-grid-frame shadow-[0_6px_24px_var(--shadow)]">
            {renderGrid(cell, view, setView)}
          </div>
        )}
      </div>

      {/* Top left: leave, and which asset */}
      <Panel className="top-[max(16px,env(safe-area-inset-top))] left-4 flex items-center gap-1 p-1">
        <IconButton label="Leave Zen mode (Esc)" onClick={onExit}>
          <Minimize2 />
        </IconButton>
        {onPrev && (
          <IconButton label="Previous" onClick={onPrev} className="w-9">
            <ChevronLeft />
          </IconButton>
        )}
        <span className="min-w-[96px] px-2 text-center font-mono text-sm">
          {title}
        </span>
        {onNext && (
          <IconButton label="Next" onClick={onNext} className="w-9">
            <ChevronRight />
          </IconButton>
        )}
      </Panel>

      {/* Top right: zoom */}
      <Panel className="top-[max(16px,env(safe-area-inset-top))] right-4 flex items-center gap-0.5 p-1">
        <IconButton
          label="Zoom out"
          onClick={() => zoomBy(1 / 1.5)}
          disabled={view.zoom <= minZoom + 1e-6}
        >
          <Minus />
        </IconButton>
        <button
          type="button"
          aria-label="Reset zoom"
          onClick={() => setView(DEFAULT_VIEW)}
          className="h-11 min-w-14 rounded-lg px-2 font-mono text-sm hover:bg-muted"
        >
          {zoomLabel(view.zoom)}
        </button>
        <IconButton
          label="Zoom in"
          onClick={() => zoomBy(1.5)}
          disabled={view.zoom >= MAX_ZOOM}
        >
          <Plus />
        </IconButton>
      </Panel>

      {/* Left: tools */}
      <Panel className="top-1/2 left-4 flex -translate-y-1/2 flex-col gap-1.5 p-1.5">
        <div role="toolbar" aria-label="Tools" aria-orientation="vertical">
          <div className="flex flex-col gap-1.5">
            {(
              [
                ['draw', 'Draw (double-tap a pixel to clear it)', Pencil],
                ['erase', 'Erase', Eraser],
                ['fill', 'Fill', PaintBucket],
                ...(canPan
                  ? ([['pan', 'Hand: drag to move around', Hand]] as const)
                  : []),
              ] as const
            ).map(([value, label, Icon]) => (
              <IconButton
                key={value}
                label={toolLabels[value] ?? label}
                pressed={tool === value}
                onClick={() => onTool(value)}
                size="lg"
              >
                <Icon />
              </IconButton>
            ))}
          </div>
        </div>
        <div aria-hidden="true" className="mx-1.5 h-px bg-rule-soft" />
        <IconButton label="Undo" onClick={onUndo} disabled={!canUndo} size="lg">
          <Undo2 />
        </IconButton>
        <IconButton label="Redo" onClick={onRedo} disabled={!canRedo} size="lg">
          <Redo2 />
        </IconButton>
      </Panel>

      {/* Right: pens or brushes */}
      <Panel className="top-1/2 right-4 flex max-h-[calc(100%-160px)] -translate-y-1/2 flex-col gap-2.5 overflow-y-auto p-2.5">
        {side}
      </Panel>

      <div className="pointer-events-none absolute bottom-[max(14px,env(safe-area-inset-bottom))] left-1/2 -translate-x-1/2 rounded-full bg-paper/90 px-3 py-1.5 text-xs whitespace-nowrap text-muted-foreground">
        {hint}
      </div>
    </div>
  )
}

function Panel({
  className,
  children,
}: {
  className?: string
  children: ReactNode
}) {
  return (
    <div
      className={cn(
        'absolute rounded-[14px] border border-rule-soft bg-paper/95',
        className,
      )}
    >
      {children}
    </div>
  )
}

function IconButton({
  label,
  pressed,
  disabled,
  onClick,
  size = 'md',
  className,
  children,
}: {
  label: string
  pressed?: boolean
  disabled?: boolean
  onClick: () => void
  size?: 'md' | 'lg'
  className?: string
  children: ReactNode
}) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      aria-pressed={pressed}
      disabled={disabled}
      onClick={onClick}
      className={cn(
        'flex shrink-0 items-center justify-center rounded-[10px] disabled:opacity-35 [&_svg]:size-[22px] [&_svg]:stroke-[1.7]',
        size === 'lg' ? 'size-12' : 'size-11',
        pressed ? 'bg-primary text-primary-foreground' : 'hover:bg-muted',
        className,
      )}
    >
      {children}
    </button>
  )
}

/** Zen mode's pens, then the project's colours to recolour the chosen pen. */
export function ZenPens({
  pens,
  pen,
  onPen,
  colors,
  penColor,
  isAllowed = () => true,
  onRecolor,
}: {
  pens: ReadonlyArray<PenDef>
  pen: number
  onPen: (value: number) => void
  /** The project's colours. */
  colors: ReadonlyArray<C64Color>
  /** The chosen pen's colour; null when it can't be recoloured. */
  penColor: C64Color | null
  isAllowed?: (color: C64Color) => boolean
  onRecolor: (color: C64Color) => void
}) {
  const palette = usePalette()
  const chosen = pens.find((p) => p.value === pen)
  return (
    <div className="flex w-[108px] flex-col gap-2.5">
      <div className="text-[11px] text-muted-foreground">Pens</div>
      <div className="grid grid-cols-2 gap-2">
        {pens.map((p) => (
          <button
            key={p.value}
            type="button"
            aria-pressed={p.value === pen}
            aria-label={`Pen ${p.code}: ${p.name}`}
            title={p.name}
            onClick={() => onPen(p.value)}
            className={cn(
              'flex h-16 flex-col items-center justify-center gap-1 rounded-[10px]',
              p.value === pen
                ? 'bg-accent ring-2 ring-primary ring-inset'
                : 'hover:bg-muted',
            )}
          >
            <span
              aria-hidden="true"
              className="size-8 rounded-full border border-rule"
              style={{ background: penSwatch(p, palette.hex) }}
            />
            <span className="font-mono text-[11px] text-ink-soft">
              {p.code}
            </span>
          </button>
        ))}
      </div>
      <div aria-hidden="true" className="h-px bg-rule-soft" />
      <div className="text-[11px] leading-tight text-muted-foreground">
        {penColor === null
          ? 'Project colours · pick a coloured pen'
          : `Project colours · recolour ${chosen?.name.split(' · ')[0].toLowerCase() ?? 'pen'}`}
      </div>
      <div className="grid grid-cols-3 gap-1.5">
        {colors.map((c) => (
          <button
            key={c}
            type="button"
            aria-label={`Set pen colour to ${COLOR_NAMES[c]}`}
            title={`${COLOR_NAMES[c]} (${c})`}
            disabled={penColor === null || !isAllowed(c)}
            onClick={() => onRecolor(c)}
            className={cn(
              'h-7 rounded-md border border-rule disabled:opacity-30',
              penColor === c &&
                'ring-2 ring-primary ring-offset-2 ring-offset-paper',
            )}
            style={{ background: palette.hex[c] }}
          />
        ))}
      </div>
    </div>
  )
}
