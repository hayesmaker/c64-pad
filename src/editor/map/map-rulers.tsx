import { cn } from '@/lib/utils'
import type { Charmap } from '@/c64/charmap'

export const COL_HEADER_H = 26
export const ROW_LABELS_W = 24

/** Column numbers (and screen RAM addresses on the first screen) every 5 columns. */
export function ColumnHeader({
  map,
  size,
  offset,
  width,
}: {
  map: Charmap
  size: number
  offset: number
  width: number
}) {
  const every = size >= 12 ? 5 : size >= 5 ? 10 : 20
  const cols: Array<number> = []
  for (let c = 0; c < map.width; c += every) cols.push(c)
  if (map.width <= 40 && cols.at(-1) !== map.width - 1) cols.push(map.width - 1)
  return (
    <div
      aria-hidden="true"
      className="relative shrink-0 overflow-hidden"
      // 16 px either side so the end labels aren't cut off.
      style={{
        height: COL_HEADER_H,
        marginLeft: ROW_LABELS_W + 2 - 16,
        width: width + 32,
      }}
    >
      {cols.map((c) => {
        const left = offset + c * size + size / 2 + 16
        if (left < 0 || left > width + 32) return null
        return (
          <div
            key={c}
            className="absolute bottom-0.5 w-10 -translate-x-1/2 text-center font-mono text-[9px] leading-[11px] text-muted-foreground"
            style={{ left }}
          >
            {c < 40 && (
              <>
                {1024 + c}
                <br />
              </>
            )}
            {c}
          </div>
        )
      })}
    </div>
  )
}

export function RowLabels({
  map,
  size,
  offset,
  height,
  active,
}: {
  map: Charmap
  size: number
  offset: number
  height: number
  active: number | null
}) {
  const every = size >= 12 ? 1 : size >= 6 ? 5 : 10
  const rows: Array<number> = []
  for (let r = 0; r < map.height; r += every) rows.push(r)
  return (
    <div
      aria-hidden="true"
      className="relative mt-[2px] mr-[2px] shrink-0 overflow-hidden"
      style={{ width: ROW_LABELS_W, height }}
    >
      {rows.map((r) => {
        const top = offset + r * size
        if (top < -size || top > height) return null
        return (
          <div
            key={r}
            className={cn(
              'absolute right-0 flex items-center font-mono text-[9px]',
              r === active
                ? 'font-semibold text-primary'
                : 'text-muted-foreground',
            )}
            style={{ top, height: Math.max(size, 11) }}
          >
            {r}
          </div>
        )
      })}
    </div>
  )
}
