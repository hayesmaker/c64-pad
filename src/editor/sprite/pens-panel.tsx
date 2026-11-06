import { PALETTE } from '@/c64/palette'
import { cn } from '@/lib/utils'
import type { C64Color } from '@/c64/palette'
import type { Sprite } from '@/c64/sprite'
import type { SpriteSet } from '@/c64/sprite-set'

export interface PenDef {
  value: number
  code: string
  name: string
  sub: string
  color: C64Color | null
  /** Which register this pen's colour lives in (null = transparent). */
  slot: 'multicolor1' | 'color' | 'multicolor2' | null
}

export function spritePens(set: SpriteSet, sprite: Sprite): Array<PenDef> {
  const transparent: PenDef = {
    value: 0,
    code: sprite.mode === 'multicolor' ? '00' : '0',
    name: 'Transparent',
    sub: 'Shows screen background',
    color: null,
    slot: null,
  }
  const own: Omit<PenDef, 'value' | 'code'> = {
    name: `Sprite colour · ${PALETTE[sprite.color].name}`,
    sub: 'This sprite only',
    color: sprite.color,
    slot: 'color',
  }
  if (sprite.mode === 'hires')
    return [transparent, { value: 1, code: '1', ...own }]
  return [
    transparent,
    {
      value: 1,
      code: '01',
      name: `Multicolour 1 · ${PALETTE[set.multicolor1].name}`,
      sub: 'Shared by the set',
      color: set.multicolor1,
      slot: 'multicolor1',
    },
    { value: 2, code: '10', ...own },
    {
      value: 3,
      code: '11',
      name: `Multicolour 2 · ${PALETTE[set.multicolor2].name}`,
      sub: 'Shared by the set',
      color: set.multicolor2,
      slot: 'multicolor2',
    },
  ]
}

const TRANSPARENT_SWATCH =
  'repeating-conic-gradient(#d9d7cf 0% 25%, #fdfcf8 0% 50%) 0 0 / 8px 8px'

export function PensPanel({
  pens,
  pen,
  onPen,
}: {
  pens: Array<PenDef>
  pen: number
  onPen: (value: number) => void
}) {
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
            'flex h-8 items-center gap-2.5 rounded-lg border px-2.5 text-left',
            p.value === pen
              ? 'border-primary bg-accent ring-1 ring-primary'
              : 'border-rule-soft hover:bg-muted',
          )}
        >
          <span
            aria-hidden="true"
            className="size-5 shrink-0 rounded-[5px] border border-rule"
            style={{
              background:
                p.color === null ? TRANSPARENT_SWATCH : PALETTE[p.color].hex,
            }}
          />
          <span className="flex min-w-0 flex-1 flex-col leading-tight">
            <span className="truncate text-[13px] font-medium">{p.name}</span>
            <span className="text-[11px] text-muted-foreground">{p.sub}</span>
          </span>
          <span className="font-mono text-[13px] text-[#55534d]">{p.code}</span>
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
}: {
  selected: C64Color | null
  disabled: boolean
  penName: string
  onPick: (color: C64Color) => void
}) {
  return (
    <div className="flex flex-col gap-1">
      <div className="text-xs text-muted-foreground">
        {disabled ? 'Colour (pick a coloured pen)' : 'Colour for selected pen'}
      </div>
      <div className="grid grid-cols-8 gap-1">
        {PALETTE.map((entry) => (
          <button
            key={entry.index}
            type="button"
            disabled={disabled}
            aria-label={`Set ${penName} to ${entry.name}`}
            title={`${entry.name} (${entry.index})`}
            onClick={() => onPick(entry.index)}
            className={cn(
              'h-6 rounded-[5px] border border-rule disabled:opacity-45',
              selected === entry.index &&
                'ring-2 ring-primary ring-offset-2 ring-offset-paper',
            )}
            style={{ background: entry.hex }}
          />
        ))}
      </div>
    </div>
  )
}
