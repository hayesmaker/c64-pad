import { COLOR_NAMES } from '@/c64/palette'
import { usePalette } from '@/components/c64/palette-context'
import { cn } from '@/lib/utils'
import type { C64Color } from '@/c64/palette'

export interface PenDef<TSlot extends string = string> {
  /** Pixel value the pen draws. */
  value: number
  /** Bit pattern shown beside the pen ("01"). */
  code: string
  name: string
  sub: string
  /** null = transparent. */
  color: C64Color | null
  /** Which register this pen's colour lives in (null = not editable). */
  slot: TSlot | null
  /** Colours shown as equal stripes in the swatch, instead of `color`. */
  swatch?: ReadonlyArray<C64Color>
}

const TRANSPARENT_SWATCH =
  'repeating-conic-gradient(var(--checker-a) 0% 25%, var(--checker-b) 0% 50%) 0 0 / 8px 8px'

/** CSS background for a pen's swatch in the given palette. */
export function penSwatch(p: PenDef, hex: ReadonlyArray<string>): string {
  if (p.swatch) {
    const step = 100 / p.swatch.length
    const stops = p.swatch.map(
      (c, i) => `${hex[c]} ${i * step}% ${(i + 1) * step}%`,
    )
    return `linear-gradient(90deg, ${stops.join(', ')})`
  }
  return p.color === null ? TRANSPARENT_SWATCH : hex[p.color]
}

export function PensPanel({
  pens,
  pen,
  onPen,
}: {
  pens: ReadonlyArray<PenDef>
  pen: number
  onPen: (value: number) => void
}) {
  const palette = usePalette()
  return (
    <div className="flex flex-col gap-1">
      <div className="text-xs text-muted-foreground">Pens</div>
      {pens.map((p) => (
        <button
          key={p.value}
          type="button"
          aria-pressed={p.value === pen}
          onClick={() => onPen(p.value)}
          className={cn(
            'flex h-[30px] items-center gap-2.5 rounded-lg border px-2.5 text-left',
            p.value === pen
              ? 'border-primary bg-accent ring-1 ring-inset ring-primary'
              : 'border-rule-soft hover:bg-muted',
          )}
        >
          <span
            aria-hidden="true"
            className="size-5 shrink-0 rounded-[5px] border border-rule"
            style={{ background: penSwatch(p, palette.hex) }}
          />
          <span className="flex min-w-0 flex-1 flex-col leading-tight">
            <span className="truncate text-[13px] font-medium">{p.name}</span>
            <span className="text-[11px] text-muted-foreground">{p.sub}</span>
          </span>
          <span className="font-mono text-[13px] text-ink-soft">{p.code}</span>
        </button>
      ))}
    </div>
  )
}

export function PaletteGrid({
  selected,
  disabled,
  penName,
  onPick,
  isAllowed = () => true,
  label,
}: {
  selected: C64Color | null
  disabled: boolean
  penName: string
  onPick: (color: C64Color) => void
  /** Colours the hardware can't use for this pen are shown disabled. */
  isAllowed?: (color: C64Color) => boolean
  label?: string
}) {
  const palette = usePalette()
  return (
    <div className="flex flex-col gap-1">
      <div className="text-xs text-muted-foreground">
        {label ??
          (disabled
            ? 'Colour (pick a coloured pen)'
            : 'Colour for selected pen')}
      </div>
      <div className="grid grid-cols-8 gap-1">
        {palette.hex.map((hex, index) => (
          <button
            key={index}
            type="button"
            disabled={disabled || !isAllowed(index)}
            aria-label={`Set ${penName} to ${COLOR_NAMES[index]}`}
            title={`${COLOR_NAMES[index]} (${index})`}
            onClick={() => onPick(index)}
            className={cn(
              'h-6 rounded-[5px] border border-rule disabled:opacity-30',
              selected === index &&
                'ring-2 ring-primary ring-offset-2 ring-offset-paper',
            )}
            style={{ background: hex }}
          />
        ))}
      </div>
    </div>
  )
}
