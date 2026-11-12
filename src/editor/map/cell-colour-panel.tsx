import { Button } from '@/components/ui/button'
import { PaletteGrid } from '../pens-panel'
import { Segmented } from '../segmented'
import type { CellColorSlot } from '@/c64/charmap'
import type { C64Color } from '@/c64/palette'

export const SLOT_NAMES: Record<CellColorSlot, string> = {
  1: 'screen colour 1',
  2: 'screen colour 2',
  3: 'colour RAM',
}

/**
 * The Colour tool's settings (bitmap screens): which of a cell's three
 * colours to set, and to what; "Char's own" takes the cell's back to its
 * tile's.
 */
export function CellColourPanel({
  slot,
  onSlot,
  colour,
  onColour,
}: {
  slot: CellColorSlot
  onSlot: (slot: CellColorSlot) => void
  /** Null: the char's own. */
  colour: C64Color | null
  onColour: (colour: C64Color | null) => void
}) {
  return (
    <section aria-label="Cell colours" className="flex flex-col gap-2">
      <div className="flex flex-col gap-[3px]">
        <span className="text-xs text-muted-foreground">
          Cell colour to set
        </span>
        <Segmented<`${CellColorSlot}`>
          label="Cell colour to set"
          size="sm"
          value={`${slot}`}
          options={[
            { value: '1', label: '01 Scr 1' },
            { value: '2', label: '10 Scr 2' },
            { value: '3', label: '11 RAM' },
          ]}
          onChange={(v) => onSlot(Number(v) as CellColorSlot)}
        />
      </div>
      <PaletteGrid
        selected={colour}
        disabled={false}
        penName={SLOT_NAMES[slot]}
        label={`Colour for ${SLOT_NAMES[slot]}`}
        onPick={onColour}
      />
      <Button
        variant="outline"
        size="sm"
        aria-pressed={colour === null}
        className={colour === null ? 'border-primary' : undefined}
        onClick={() => onColour(null)}
      >
        Char’s own colour
      </Button>
      <p className="text-[11px] leading-snug text-muted-foreground">
        Tap or drag over cells to give them this {SLOT_NAMES[slot]}.
        {colour === null
          ? ' Char’s own takes them back to their tile’s colour.'
          : ''}
      </p>
    </section>
  )
}
