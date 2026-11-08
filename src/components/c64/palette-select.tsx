import { PALETTES, PALETTE_IDS, isPaletteId } from '@/c64/palette'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import type { PaletteId } from '@/c64/palette'

/** The 16 colours of a palette as a strip of small swatches. */
export function PaletteStrip({ id }: { id: PaletteId }) {
  return (
    <span
      aria-hidden="true"
      className="flex h-3.5 overflow-hidden rounded-[3px] border border-rule"
    >
      {PALETTES[id].hex.map((hex, i) => (
        <span key={i} className="w-2.5" style={{ background: hex }} />
      ))}
    </span>
  )
}

/** Pick one of the C64 emulator palettes; each option shows its colours. */
export function PaletteSelect({
  value,
  onChange,
  id,
}: {
  value: PaletteId
  onChange: (id: PaletteId) => void
  id?: string
}) {
  return (
    <Select value={value} onValueChange={(v) => isPaletteId(v) && onChange(v)}>
      {/* Name over a swatch strip: taller than the trigger's fixed 40 px, so
          let it grow, with even padding round the strip. */}
      <SelectTrigger
        id={id}
        className="w-full bg-paper py-2 data-[size=default]:h-auto"
      >
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {PALETTE_IDS.map((pid) => (
          <SelectItem
            key={pid}
            value={pid}
            title={PALETTES[pid].source}
            className="py-2"
          >
            <span className="flex flex-col items-start gap-1">
              <span className="text-[15px] text-foreground">
                {PALETTES[pid].name}
              </span>
              <PaletteStrip id={pid} />
            </span>
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  )
}
