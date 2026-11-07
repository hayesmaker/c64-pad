import { useEffect, useLayoutEffect, useState } from 'react'
import { cn } from '@/lib/utils'
import type { ReactNode } from 'react'
import type { GridView } from './view'

/** Shared pieces around an editor's pixel grid. */

export const RAIL_W = 40
export const RAIL_GAP = 12
export const BIT_HEADER_H = 16
export const ROW_NUMBERS_W = 28

export function ToolButton({
  label,
  pressed,
  disabled,
  onClick,
  children,
  ...rest
}: {
  label: string
  pressed?: boolean
  disabled?: boolean
  onClick?: () => void
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
        'flex size-10 shrink-0 items-center justify-center rounded-lg border disabled:opacity-40 [&_svg]:size-[21px] [&_svg]:stroke-[1.7]',
        pressed
          ? 'border-primary bg-primary text-primary-foreground'
          : 'border-rule-soft bg-paper hover:bg-muted',
      )}
      {...rest}
    >
      {children}
    </button>
  )
}

/** Bit weights over each byte of the grid, following the view. */
export function BitHeader({
  bytes,
  cell,
  view,
}: {
  bytes: number
  cell: number
  view: GridView
}) {
  const weights = [128, 64, 32, 16, 8, 4, 2, 1]
  const size = cell * view.zoom
  return (
    <div
      aria-hidden="true"
      className="flex shrink-0 items-end"
      style={{ height: BIT_HEADER_H, paddingLeft: ROW_NUMBERS_W + 2 }}
    >
      <div className="overflow-hidden" style={{ width: bytes * 8 * cell }}>
        <div
          className="flex font-mono leading-[14px] text-muted-foreground"
          style={{
            transform: `translateX(${view.x}px)`,
            fontSize: size < 22 ? 8 : size < 40 ? 9 : 11,
          }}
        >
          {Array.from({ length: bytes }, (_, b) =>
            weights.map((w) => (
              <div
                key={`${b}-${w}`}
                className="shrink-0 text-center"
                style={{ width: size }}
              >
                {w}
              </div>
            )),
          )}
        </div>
      </div>
    </div>
  )
}

/** Row numbers beside the grid, following the view. */
export function RowNumbers({
  rows,
  first,
  cell,
  view,
}: {
  rows: number
  /** Number of the top row: 1 on the Sprite Worksheet, 0 on the Character one. */
  first: number
  cell: number
  view: GridView
}) {
  const size = cell * view.zoom
  return (
    <div
      aria-hidden="true"
      className="mt-[2px] shrink-0 overflow-hidden"
      style={{ width: ROW_NUMBERS_W - 4, height: rows * cell }}
    >
      <div style={{ transform: `translateY(${view.y}px)` }}>
        {Array.from({ length: rows }, (_, i) => (
          <div
            key={i}
            className={cn(
              'flex items-center justify-end font-mono text-muted-foreground',
              size < 40 ? 'text-[10px]' : 'text-[11px]',
            )}
            style={{ height: size }}
          >
            {i + first}
          </div>
        ))}
      </div>
    </div>
  )
}

export function zoomLabel(zoom: number) {
  return zoom < 1.05 ? '1×' : `${zoom.toFixed(1)}×`
}

/**
 * Cell size that fits a `columns` × `rows` grid into the space left for it:
 * the slot's height and the area's width (less the tool rail and row numbers).
 */
export function useCellSize({
  columns,
  rows,
  min,
  max,
  reserveWidth = 0,
  reserveHeight = 0,
}: {
  columns: number
  rows: number
  min: number
  max: number
  /** Other fixed-width things sharing the area. */
  reserveWidth?: number
  /** Fixed-height things under the grid inside the slot. */
  reserveHeight?: number
}) {
  const [size, setSize] = useState(Math.round((min + max) / 2))
  const [slot, setSlot] = useState<HTMLDivElement | null>(null)
  const [area, setArea] = useState<HTMLDivElement | null>(null)
  useLayoutEffect(() => {
    if (!slot || !area) return
    const measure = () => {
      const h = slot.clientHeight - 4 - reserveHeight
      const w =
        area.clientWidth - RAIL_W - RAIL_GAP - ROW_NUMBERS_W - 8 - reserveWidth
      setSize(
        Math.max(
          min,
          Math.min(max, Math.floor(Math.min(h / rows, w / columns))),
        ),
      )
    }
    measure()
    const ro = new ResizeObserver(measure)
    ro.observe(slot)
    ro.observe(area)
    return () => ro.disconnect()
  }, [slot, area, columns, rows, min, max, reserveWidth, reserveHeight])
  return { size, slotRef: setSlot, areaRef: setArea }
}

/** Ctrl/Cmd+Z undoes, Ctrl+Y or Ctrl+Shift+Z redoes (not while typing). */
export function useUndoShortcuts(history: {
  undo: () => void
  redo: () => void
}) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (
        !(e.ctrlKey || e.metaKey) ||
        e.target instanceof HTMLInputElement ||
        e.target instanceof HTMLTextAreaElement
      )
        return
      const key = e.key.toLowerCase()
      if (key === 'z' && !e.shiftKey) history.undo()
      else if (key === 'y' || (key === 'z' && e.shiftKey)) history.redo()
      else return
      e.preventDefault()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [history])
}
