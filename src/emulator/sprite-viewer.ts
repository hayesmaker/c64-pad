import { base64ToBytes } from '@/storage/bytes'
import { SPRITE_BYTES, SPRITE_HEIGHT, SPRITE_STRIDE } from '@/c64/sprite'
import { findSprite } from '@/c64/sprite-set'
import { spriteViewerPrg } from './stubs/sprite-viewer.gen'
import type { C64Color } from '@/c64/palette'
import type { Sprite } from '@/c64/sprite'
import type { SpriteSet } from '@/c64/sprite-set'

/** Memory layout shared with stubs/sprite-viewer.asm. */
export const VIEWER = {
  LOAD: 0x0801,
  CONFIG: 0x0c00,
  SPRITES: 0x2000,
  /** $2000-$3fff is visible to the VIC in bank 0: 128 sprites. */
  MAX_SPRITES: 128,
  MAX_FRAMES: 32,
  SLOTS: 8,
} as const

const OFFSET = {
  border: 0,
  background: 1,
  mc1: 2,
  mc2: 3,
  enable: 4,
  xlo: 5,
  xmsb: 13,
  y: 14,
  frameCount: 22,
  delay: 30,
  mode: 38,
  pointer: 0x40,
  color: 0x140,
  attributes: 0x240,
  caption: 0x340,
  captionColor: 0x368,
} as const

export interface ViewerFrame {
  /** Index into `sprites`. */
  sprite: number
  color: C64Color
  multicolor: boolean
  expandX: boolean
  expandY: boolean
}

export interface ViewerSlot {
  /** Hardware sprite coordinates (visible area x 24-343, y 50-249). */
  x: number
  y: number
  frames: Array<ViewerFrame>
  /** Display frames per animation step, 1-255. */
  delay: number
  pingpong: boolean
}

export interface ViewerConfig {
  border: C64Color
  background: C64Color
  multicolor1: C64Color
  multicolor2: C64Color
  caption: string
  captionColor: C64Color
  /** 63-byte sprite images; slots refer to them by index. */
  sprites: Array<Uint8Array>
  /** Up to 8; slot 0 has the highest priority (drawn on top). */
  slots: Array<ViewerSlot>
}

/** ASCII to C64 screen codes (upper case set); unknown characters become spaces. */
export function toScreenCodes(text: string, length = 40): Uint8Array {
  const out = new Uint8Array(length).fill(0x20)
  const upper = text.toUpperCase()
  for (let i = 0; i < Math.min(length, upper.length); i++) {
    const c = upper.charCodeAt(i)
    if (c === 0x40) out[i] = 0
    else if (c >= 0x41 && c <= 0x5a) out[i] = c - 0x40
    else if (c >= 0x20 && c <= 0x3f) out[i] = c
  }
  return out
}

/** Make a runnable PRG: the viewer stub with this configuration and sprite data. */
export function buildViewerPrg(config: ViewerConfig): Uint8Array {
  const { sprites, slots } = config
  if (sprites.length === 0 || sprites.length > VIEWER.MAX_SPRITES) {
    throw new RangeError(`The viewer shows 1-${VIEWER.MAX_SPRITES} sprites`)
  }
  if (slots.length > VIEWER.SLOTS)
    throw new RangeError('The C64 has 8 hardware sprites')

  const stub = base64ToBytes(spriteViewerPrg)
  const end = VIEWER.SPRITES + sprites.length * SPRITE_STRIDE
  const prg = new Uint8Array(2 + end - VIEWER.LOAD)
  prg.set(stub)
  const at = (address: number) => 2 + address - VIEWER.LOAD
  const cfg = (offset: number, value: number) => {
    prg[at(VIEWER.CONFIG + offset)] = value
  }

  cfg(OFFSET.border, config.border)
  cfg(OFFSET.background, config.background)
  cfg(OFFSET.mc1, config.multicolor1)
  cfg(OFFSET.mc2, config.multicolor2)
  prg.set(toScreenCodes(config.caption), at(VIEWER.CONFIG + OFFSET.caption))
  cfg(OFFSET.captionColor, config.captionColor)

  let enable = 0
  let xmsb = 0
  slots.forEach((slot, s) => {
    const frames = slot.frames.slice(0, VIEWER.MAX_FRAMES)
    if (frames.length === 0) return
    enable |= 1 << s
    if (slot.x >= 256) xmsb |= 1 << s
    cfg(OFFSET.xlo + s, slot.x & 0xff)
    cfg(OFFSET.y + s, slot.y & 0xff)
    cfg(OFFSET.frameCount + s, frames.length)
    cfg(OFFSET.delay + s, Math.min(255, Math.max(1, slot.delay)))
    cfg(OFFSET.mode + s, slot.pingpong ? 1 : 0)
    frames.forEach((f, i) => {
      if (f.sprite < 0 || f.sprite >= sprites.length)
        throw new RangeError(`No sprite ${f.sprite}`)
      const k = s * VIEWER.MAX_FRAMES + i
      cfg(OFFSET.pointer + k, VIEWER.SPRITES / 64 + f.sprite)
      cfg(OFFSET.color + k, f.color)
      cfg(
        OFFSET.attributes + k,
        (f.multicolor ? 1 : 0) | (f.expandX ? 2 : 0) | (f.expandY ? 4 : 0),
      )
    })
  })
  cfg(OFFSET.enable, enable)
  cfg(OFFSET.xmsb, xmsb)

  sprites.forEach((data, i) => {
    prg.set(
      data.subarray(0, SPRITE_BYTES),
      at(VIEWER.SPRITES + i * SPRITE_STRIDE),
    )
  })
  return prg
}

const frameOf = (index: number, s: Sprite): ViewerFrame => ({
  sprite: index,
  color: s.color,
  multicolor: s.mode === 'multicolor',
  expandX: s.expandX,
  expandY: s.expandY,
})

/**
 * What to show for a sprite set: the selected sprite (or a playing animation)
 * large in the middle with its overlay on top, and other sprites of the set
 * along the bottom.
 */
export function spriteSetShowcase(
  set: SpriteSet,
  {
    selectedId,
    animationId = null,
    background = 6,
    border = 14,
  }: {
    selectedId: string
    animationId?: string | null
    background?: C64Color
    border?: C64Color
  },
): ViewerConfig {
  const shown = set.sprites.slice(0, VIEWER.MAX_SPRITES - 1)
  const index = (id: string) => shown.findIndex((s) => s.id === id)
  const blank = shown.length // an empty sprite, for frames without an overlay
  const sprites = [...shown.map((s) => s.data), new Uint8Array(SPRITE_BYTES)]

  const animation = set.animations.find((a) => a.id === animationId)
  const mainIds =
    animation && animation.frames.length > 0
      ? animation.frames.filter((id) => index(id) >= 0)
      : [selectedId]
  const mainSprites = mainIds
    .map((id) => findSprite(set, id))
    .filter((s): s is Sprite => !!s && index(s.id) >= 0)
  if (mainSprites.length === 0) throw new RangeError('Nothing to show')

  const first = mainSprites[0]
  const width = 24 * (first.expandX ? 2 : 1)
  const height = SPRITE_HEIGHT * (first.expandY ? 2 : 1)
  const x = 184 - width / 2
  const y = 128 - height / 2
  const delay = animation?.speed ?? 1
  const pingpong = animation?.mode === 'pingpong'

  const main: ViewerSlot = {
    x,
    y,
    delay,
    pingpong,
    frames: mainSprites.map((s) => frameOf(index(s.id), s)),
  }
  const overlays = mainSprites.map((s) =>
    s.overlayId ? findSprite(set, s.overlayId) : undefined,
  )
  const slots: Array<ViewerSlot> = []
  if (overlays.some((o) => o && index(o.id) >= 0)) {
    // Lower slot numbers are drawn on top, so the overlay goes first.
    slots.push({
      x,
      y,
      delay,
      pingpong,
      frames: overlays.map((o) =>
        o && index(o.id) >= 0
          ? frameOf(index(o.id), o)
          : {
              sprite: blank,
              color: 0,
              multicolor: false,
              expandX: false,
              expandY: false,
            },
      ),
    })
  }
  slots.push(main)

  // The rest of the set along the bottom (no expand, so they fit).
  const used = new Set([
    ...mainSprites.map((s) => s.id),
    ...overlays.map((o) => o?.id),
  ])
  const others = shown
    .filter((s) => !used.has(s.id))
    .slice(0, VIEWER.SLOTS - slots.length)
  const spacing = Math.min(44, Math.floor(300 / Math.max(1, others.length)))
  const rowX = 184 - ((others.length - 1) * spacing + 24) / 2
  others.forEach((s, i) => {
    slots.push({
      x: Math.round(rowX + i * spacing),
      y: 208,
      delay: 1,
      pingpong: false,
      frames: [{ ...frameOf(index(s.id), s), expandX: false, expandY: false }],
    })
  })

  return {
    border,
    background,
    multicolor1: set.multicolor1,
    multicolor2: set.multicolor2,
    caption: ` ${set.name}${animation ? ` - ${animation.name}` : ''}`,
    captionColor: background === 1 ? 0 : 1,
    sprites,
    slots,
  }
}
