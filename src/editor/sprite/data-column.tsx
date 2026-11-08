import { SPRITE_HEIGHT } from '@/c64/sprite'
import { cn } from '@/lib/utils'
import { BIT_HEADER_H } from '../grid-parts'
import { hex } from '../hex'
import type { Sprite } from '@/c64/sprite'

/**
 * The DATA bytes beside the grid, with their header. Tap anywhere on them to
 * switch decimal / hex.
 */
export function SpriteDataPanel({
  sprite,
  cell,
  asHex,
  onToggleHex,
}: {
  sprite: Sprite
  cell: number
  asHex: boolean
  onToggleHex: () => void
}) {
  return (
    <button
      type="button"
      onClick={onToggleHex}
      aria-label={`Sprite data bytes in ${asHex ? 'hex' : 'decimal'}; tap to show ${asHex ? 'decimal' : 'hex'}`}
      title="Tap to switch decimal / hex. 63 bytes + 1 pad = 64 per sprite; sprite pointer = address ÷ 64."
      className="flex w-[152px] shrink-0 cursor-pointer flex-col self-start rounded-md text-left"
    >
      <div
        className="flex w-full items-end gap-2 font-mono text-[9px] leading-[14px] text-muted-foreground"
        style={{ height: BIT_HEADER_H }}
      >
        {['byte 0', 'byte 1', 'byte 2'].map((b) => (
          <div key={b} className="flex-1 text-center">
            {b}
          </div>
        ))}
      </div>
      <DataColumn sprite={sprite} cell={cell} asHex={asHex} />
    </button>
  )
}

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
