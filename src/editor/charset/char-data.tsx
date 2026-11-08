import { cn } from '@/lib/utils'
import { BIT_HEADER_H, ROW_NUMBERS_W } from '../grid-parts'
import { hex } from '../hex'

export const DATA_W = 60
/** Room under the grid for the memory note and .byte line. */
export const MEM_H = 64

/**
 * DATA: one byte per grid row. Tap anywhere on the bytes to switch decimal /
 * hex (see docs/DESIGN.md: desktop may get a switch and typed edits).
 */
export function CharDataColumn({
  bytes,
  cell,
  asHex,
  onToggleHex,
}: {
  bytes: Uint8Array
  cell: number
  asHex: boolean
  onToggleHex: () => void
}) {
  return (
    <button
      type="button"
      onClick={onToggleHex}
      aria-label={`Character data bytes in ${asHex ? 'hex' : 'decimal'}; tap to show ${asHex ? 'decimal' : 'hex'}`}
      title="Tap to switch decimal / hex"
      className="flex shrink-0 cursor-pointer flex-col self-start rounded-md"
      style={{ width: DATA_W }}
    >
      <div
        className="flex w-full items-end justify-center text-[11px] leading-[14px] tracking-[0.08em] text-muted-foreground"
        style={{ height: BIT_HEADER_H }}
      >
        DATA
      </div>
      <div className="flex w-full flex-col pt-[2px]">
        {[...bytes].map((b, row) => (
          <div key={row} className="flex items-center" style={{ height: cell }}>
            <div
              className={cn(
                'flex w-full items-center justify-center rounded-md border border-data-box font-mono text-sm',
                b === 0 ? 'text-data-zero' : 'text-foreground',
              )}
              style={{ height: Math.min(cell - 8, 34) }}
            >
              {asHex ? hex(b) : b}
            </div>
          </div>
        ))}
      </div>
    </button>
  )
}

/** Where the char lives in memory, and its bytes as a .byte line. */
export function CharMemoryNote({
  index,
  bytes,
}: {
  index: number
  bytes: Uint8Array
}) {
  return (
    <div
      className="mt-2 flex flex-col gap-1"
      style={{ marginLeft: ROW_NUMBERS_W, height: MEM_H - 8 }}
    >
      <div className="flex items-center gap-2">
        <span className="min-w-0 flex-1 text-[11px] leading-tight text-muted-foreground">
          Offset +{index * 8} · {hex(0x2000 + index * 8, 4)} with the set at
          $2000
        </span>
      </div>
      <code className="font-mono text-xs whitespace-nowrap select-all">
        .byte {[...bytes].map((b) => hex(b)).join(',')}
      </code>
    </div>
  )
}
