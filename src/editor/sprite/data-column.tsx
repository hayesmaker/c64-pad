import { SPRITE_HEIGHT } from '@/c64/sprite'
import { cn } from '@/lib/utils'
import type { Sprite } from '@/c64/sprite'

const hex = (n: number) => '$' + n.toString(16).toUpperCase().padStart(2, '0')

/** The sprite's bytes, three per row, aligned with the grid rows (row height = cell). */
export function DataColumn({
  sprite,
  cell,
  asHex,
}: {
  sprite: Sprite
  cell: number
  asHex: boolean
}) {
  return (
    <div className="flex w-full flex-col pt-[2px]">
      {Array.from({ length: SPRITE_HEIGHT }, (_, row) => (
        <div
          key={row}
          className={cn(
            'flex items-center gap-2 border-b',
            row === 6 || row === 13
              ? 'border-grid-major'
              : 'border-transparent',
          )}
          style={{ height: cell }}
        >
          {[0, 1, 2].map((i) => {
            const value = sprite.data[row * 3 + i]
            return (
              <div
                key={i}
                className={cn(
                  'flex flex-1 items-center justify-center rounded-[5px] border border-data-box font-mono text-xs',
                  value === 0 ? 'text-data-zero' : 'text-foreground',
                )}
                style={{ height: Math.max(cell - 5, 12) }}
              >
                {asHex ? hex(value) : value}
              </div>
            )
          })}
        </div>
      ))}
    </div>
  )
}
