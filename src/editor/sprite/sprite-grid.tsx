import { useMemo } from 'react'
import { PALETTE } from '@/c64/palette'
import { SPRITE_HEIGHT } from '@/c64/sprite'
import { SPRITE_RENDER_WIDTH, renderSprite } from '@/c64/sprite-set'
import { PixelGrid } from '../pixel-grid'
import type { GridLayer, StrokeHandlers } from '../pixel-grid'
import type { GridView } from '../view'
import type { C64Color } from '@/c64/palette'
import type { Sprite } from '@/c64/sprite'
import type { SpriteSet } from '@/c64/sprite-set'

export type { StrokeHandlers } from '../pixel-grid'

const PAPER = '#fdfcf8'

/**
 * The sprite's pixel grid: heavy lines every byte (8 hires pixels) and every
 * 7 rows, like the Sprite Worksheet. The layer not being edited is faded.
 */
export function SpriteGrid({
  set,
  sprite,
  layers,
  background,
  ...rest
}: {
  set: SpriteSet
  /** The sprite being edited (its mode decides pixel width). */
  sprite: Sprite
  /** Base + optional overlay; the layer not being edited is drawn faded. */
  layers: { base: Sprite; overlay: Sprite | null }
  cell: number
  /** Colour shown for transparent pixels; null = worksheet paper. */
  background: C64Color | null
  view: GridView
  onViewChange: (view: GridView) => void
} & StrokeHandlers) {
  const { base, overlay } = layers
  const gridLayers = useMemo<Array<GridLayer>>(
    () =>
      [base, overlay]
        .filter((l): l is Sprite => !!l)
        .map((l) => ({
          pixels: renderSprite(set, l, { withOverlay: false }),
          alpha: overlay && l.id !== sprite.id ? 0.35 : 1,
        })),
    [set, base, overlay, sprite.id],
  )
  return (
    <PixelGrid
      {...rest}
      width={SPRITE_RENDER_WIDTH}
      height={SPRITE_HEIGHT}
      step={sprite.mode === 'multicolor' ? 2 : 1}
      majorX={8}
      majorY={7}
      layers={gridLayers}
      background={background === null ? PAPER : PALETTE[background].hex}
      label={`${sprite.name} pixel grid, ${sprite.mode === 'multicolor' ? '12' : '24'} by 21`}
    />
  )
}
