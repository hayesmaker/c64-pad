import { PALETTE } from '@/c64/palette'
import type { PenDef } from '../pens-panel'
import type { Sprite } from '@/c64/sprite'
import type { SpriteSet } from '@/c64/sprite-set'

export type SpriteSlot = 'multicolor1' | 'color' | 'multicolor2'

export function spritePens(
  set: SpriteSet,
  sprite: Sprite,
): Array<PenDef<SpriteSlot>> {
  const transparent: PenDef<SpriteSlot> = {
    value: 0,
    code: sprite.mode === 'multicolor' ? '00' : '0',
    name: 'Transparent',
    sub: 'Shows screen background',
    color: null,
    slot: null,
  }
  const own: Omit<PenDef<SpriteSlot>, 'value' | 'code'> = {
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
