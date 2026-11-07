import { MAX_MAP_SIZE, SCREEN_HEIGHT, SCREEN_WIDTH } from '@/c64/charmap'
import { cn } from '@/lib/utils'

/** "1 screen", "2 × 1 screens", "about 1.5 × 2 screens". */
export function describeScreens(width: number, height: number): string {
  const across = width / SCREEN_WIDTH
  const down = height / SCREEN_HEIGHT
  const fmt = (n: number) => (Number.isInteger(n) ? String(n) : n.toFixed(1))
  if (across === 1 && down === 1) return '1 screen'
  const exact = Number.isInteger(across) && Number.isInteger(down)
  return `${exact ? '' : 'about '}${fmt(across)} × ${fmt(down)} screens`
}

const PRESETS: ReadonlyArray<{ across: number; down: number }> = [
  { across: 1, down: 1 },
  { across: 2, down: 1 },
  { across: 1, down: 2 },
  { across: 2, down: 2 },
  { across: 4, down: 1 },
  { across: 3, down: 3 },
]

/**
 * Map sizes in whole screens (40 × 25 chars each), drawn as little screen
 * grids, so it's clear how to make a map bigger than one screen.
 */
export function ScreenPresets({
  width,
  height,
  onPick,
}: {
  width: number
  height: number
  onPick: (width: number, height: number) => void
}) {
  return (
    <div className="flex flex-col gap-1">
      <span className="text-xs text-muted-foreground">
        Screens (40×25 chars each) · across × down
      </span>
      <div className="grid grid-cols-6 gap-1.5">
        {PRESETS.filter(
          (p) =>
            p.across * SCREEN_WIDTH <= MAX_MAP_SIZE &&
            p.down * SCREEN_HEIGHT <= MAX_MAP_SIZE,
        ).map(({ across, down }) => {
          const w = across * SCREEN_WIDTH
          const h = down * SCREEN_HEIGHT
          const on = w === width && h === height
          return (
            <button
              key={`${across}x${down}`}
              type="button"
              aria-pressed={on}
              aria-label={`${across} across by ${down} down: ${w} × ${h} chars`}
              onClick={() => onPick(w, h)}
              className={cn(
                'flex h-16 flex-col items-center justify-center gap-1 rounded-lg border',
                on
                  ? 'border-primary bg-accent ring-1 ring-primary ring-inset'
                  : 'border-rule-soft hover:bg-muted',
              )}
            >
              <span
                aria-hidden="true"
                className="grid gap-px"
                style={{
                  gridTemplateColumns: `repeat(${across}, 12px)`,
                  gridAutoRows: '8px',
                }}
              >
                {Array.from({ length: across * down }, (_, i) => (
                  <span key={i} className="rounded-[1px] bg-c64-screen" />
                ))}
              </span>
              <span className="font-mono text-[11px]">
                {across}×{down}
              </span>
            </button>
          )
        })}
      </div>
    </div>
  )
}
