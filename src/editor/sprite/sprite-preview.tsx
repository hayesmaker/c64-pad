import { useMemo } from 'react'
import { SPRITE_HEIGHT } from '@/c64/sprite'
import { SPRITE_RENDER_WIDTH, renderSprite } from '@/c64/sprite-set'
import { IndexedCanvas } from '@/components/c64/indexed-canvas'
import { cn } from '@/lib/utils'
import { PALETTE } from '@/c64/palette'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import type { C64Color } from '@/c64/palette'
import type { Sprite } from '@/c64/sprite'
import type { SpriteSet } from '@/c64/sprite-set'

/** Sprite on a C64 screen at 3× with the hardware expand flags. */
export function SpritePreview({
  set,
  sprite,
  background,
  onBackground,
  onToggleExpand,
}: {
  set: SpriteSet
  sprite: Sprite
  background: C64Color | null
  onBackground: (color: C64Color | null) => void
  onToggleExpand: (axis: 'expandX' | 'expandY') => void
}) {
  const image = useMemo(
    () => ({
      width: SPRITE_RENDER_WIDTH,
      height: SPRITE_HEIGHT,
      pixels: renderSprite(set, sprite),
    }),
    [set, sprite],
  )
  const scale = 2.5
  const chip = (axis: 'expandX' | 'expandY', label: string, title: string) => (
    <button
      type="button"
      aria-pressed={sprite[axis]}
      aria-label={title}
      title={title}
      onClick={() => onToggleExpand(axis)}
      className={cn(
        'h-8 rounded-full border px-2.5 font-mono text-xs whitespace-nowrap',
        sprite[axis]
          ? 'border-primary bg-accent text-primary'
          : 'border-rule-soft',
      )}
    >
      {label}
    </button>
  )
  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex items-center justify-between">
        <span className="text-xs text-muted-foreground">Preview</span>
        <div className="flex gap-1">
          <BackgroundPicker value={background} onChange={onBackground} />
          {chip('expandX', 'X×2', 'Expand X (double width)')}
          {chip('expandY', 'Y×2', 'Expand Y (double height)')}
        </div>
      </div>
      <div
        className="flex h-[118px] items-center justify-center rounded-lg border-[5px] border-c64-border"
        style={{ background: PALETTE[background ?? 6].hex }}
      >
        <IndexedCanvas
          image={image}
          label={`${sprite.name} preview`}
          className="shrink-0"
          style={{
            width: SPRITE_RENDER_WIDTH * scale * (sprite.expandX ? 2 : 1),
            height: SPRITE_HEIGHT * scale * (sprite.expandY ? 2 : 1),
          }}
        />
      </div>
    </div>
  )
}

/** Background behind transparent pixels in the grid and preview. */
function BackgroundPicker({
  value,
  onChange,
}: {
  value: C64Color | null
  onChange: (color: C64Color | null) => void
}) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          aria-label="Background colour"
          title="Background colour"
          className="flex h-8 items-center gap-1.5 rounded-full border border-rule-soft px-2.5 text-xs"
        >
          <span
            aria-hidden="true"
            className="size-3.5 rounded-sm border border-rule"
            style={{
              background: value === null ? 'var(--paper)' : PALETTE[value].hex,
            }}
          />
          Bg
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent className="w-56">
        <DropdownMenuItem onSelect={() => onChange(null)}>
          <span
            aria-hidden="true"
            className="size-4 rounded-sm border border-rule bg-paper"
          />
          Paper (preview on blue)
        </DropdownMenuItem>
        <div className="grid grid-cols-4 gap-1 p-1">
          {PALETTE.map((p) => (
            <DropdownMenuItem
              key={p.index}
              aria-label={p.name}
              title={p.name}
              onSelect={() => onChange(p.index)}
              className={cn(
                'h-9 min-h-0 justify-center border border-rule p-0',
                value === p.index && 'ring-2 ring-primary',
              )}
              style={{ background: p.hex }}
            />
          ))}
        </div>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
