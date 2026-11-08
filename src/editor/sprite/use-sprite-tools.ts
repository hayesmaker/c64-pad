import { useCallback, useRef, useState } from 'react'
import { fillSprite, setSpriteColor, setSpritePixel } from '@/c64/sprite'
import { setMulticolors, updateSprite } from '@/c64/sprite-set'
import { spritePens } from './sprite-pens'
import type { PixelMode } from '@/c64/bitmap'
import type { C64Color } from '@/c64/palette'
import type { Sprite } from '@/c64/sprite'
import type { SpriteSet } from '@/c64/sprite-set'
import type { useAssetHistory } from '../asset-history'
import type { StrokeHandlers } from '../gestures'
import type { PixelTool } from '../pixel-tool-rail'

export type SpriteSetHistory = ReturnType<typeof useAssetHistory<'spriteSets'>>

/**
 * The Sprite Worksheet's drawing state for the selected sprite: tool, pen
 * (remembered per mode), recolouring the pen, and what a stroke on the grid
 * does. `sprite` is undefined only while a set has no sprites.
 */
export function useSpriteTools(
  set: SpriteSet,
  sprite: Sprite | undefined,
  history: SpriteSetHistory,
) {
  const [tool, setTool] = useState<PixelTool>('draw')
  const [penByMode, setPenByMode] = useState<Record<PixelMode, number>>({
    hires: 1,
    multicolor: 2,
  })
  const strokeId = useRef(0)
  /** The sprite before the last stroke, to tell whether a tap changed it. */
  const beforeStroke = useRef<Sprite | null>(null)

  /** Apply a change to the selected sprite. */
  const changeSprite = useCallback(
    (fn: (s: Sprite) => Sprite, group?: string) => {
      if (!sprite) return
      history.change((s) => updateSprite(s, sprite.id, fn), group)
    },
    [history, sprite],
  )

  const mode = sprite?.mode ?? 'hires'
  const pens = sprite ? spritePens(set, sprite) : []
  const pen = Math.min(penByMode[mode], pens.length - 1)
  const penDef = pens.at(pen)
  const value = tool === 'erase' ? 0 : pen

  const paint = (x: number, y: number, start: boolean) => {
    const group = `stroke-${strokeId.current}`
    if (tool === 'fill') {
      if (start) changeSprite((s) => fillSprite(s, x, y, value), group)
      return
    }
    changeSprite((s) => setSpritePixel(s, x, y, value), group)
  }

  /** Pointer handlers for the sprite grid. */
  const gridHandlers: StrokeHandlers = {
    onStrokeStart: (x, y) => {
      strokeId.current++
      beforeStroke.current = sprite ?? null
      paint(x, y, true)
    },
    onStrokeMove: (x, y) => paint(x, y, false),
    onStrokeEnd: history.endGroup,
    onStrokeCancel: history.cancelGroup,
    onDoubleTap: (x, y) => {
      if (tool !== 'draw') return
      // Clear the pixel, as one undo step with the first tap.
      if (beforeStroke.current !== sprite) history.undo()
      changeSprite((s) => setSpritePixel(s, x, y, 0))
    },
  }

  return {
    tool,
    setTool,
    pens,
    pen,
    penDef,
    /** Choose a pen (for this mode); Erase goes back to Draw. */
    choosePen: (v: number) => {
      setPenByMode((p) => ({ ...p, [mode]: v }))
      if (tool === 'erase') setTool('draw')
    },
    /** Recolour the selected pen: the sprite's colour or the set's MC1/MC2. */
    setPenColor: (color: C64Color) => {
      const slot = penDef?.slot
      if (!slot) return
      if (slot === 'color') changeSprite((s) => setSpriteColor(s, color))
      else history.change((s) => setMulticolors(s, { [slot]: color }))
    },
    changeSprite,
    gridHandlers,
  }
}
