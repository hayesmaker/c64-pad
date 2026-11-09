import { useEffect, useRef, useState } from 'react'
import { CHAR_SHAPE, floodFill } from '@/c64/bitmap'
import {
  charPixelMode,
  getCharBytes,
  getCharPixel,
  setCharBytes,
  setCharPixel,
} from '@/c64/charset'
import { charPens, ecmSlot } from './char-pens'
import type { PixelMode } from '@/c64/bitmap'
import type { Charset } from '@/c64/charset'
import type { useAssetHistory } from '../asset-history'
import type { StrokeHandlers } from '../gestures'
import type { CharSlot } from './char-pens'
import type { PixelTool } from '../pixel-tool-rail'

export type CharsetHistory = ReturnType<typeof useAssetHistory<'charsets'>>

/** Each charset's last pens, so leaving and coming back keeps them. */
const lastPens = new Map<
  string,
  { penByMode: Record<PixelMode, number>; ecmTarget: number | null }
>()

/**
 * The Character Worksheet's drawing state for the selected char: tool, pen
 * (remembered per pixel mode), the colour slot the palette edits, and what a
 * stroke on the grid does.
 */
export function useCharTools(
  charset: Charset,
  selected: number,
  history: CharsetHistory,
) {
  const [tool, setTool] = useState<PixelTool>('draw')
  const [penByMode, setPenByMode] = useState<Record<PixelMode, number>>(
    () => lastPens.get(charset.id)?.penByMode ?? { hires: 1, multicolor: 3 },
  )
  /** An ECM background chosen for recolouring (pen 0 covers all four). */
  const [ecmTarget, setEcmTarget] = useState<number | null>(
    () => lastPens.get(charset.id)?.ecmTarget ?? null,
  )
  useEffect(() => {
    lastPens.set(charset.id, { penByMode, ecmTarget })
  }, [charset.id, penByMode, ecmTarget])
  const strokeId = useRef(0)
  const beforeStroke = useRef<Charset | null>(null)

  const pixelMode = charPixelMode(charset, selected)
  const pens = charPens(charset, selected)
  const pen = Math.min(penByMode[pixelMode], pens.length - 1)
  const penDef = pens[pen]
  const value = tool === 'erase' ? 0 : pen
  const target: CharSlot | null =
    charset.mode === 'ecm' && ecmTarget !== null
      ? ecmSlot(ecmTarget)
      : penDef.slot
  const targetName =
    target === null
      ? ''
      : target === 'char'
        ? 'char colour'
        : target === 'background'
          ? 'background'
          : target.startsWith('ecm')
            ? `ECM background ${target.slice(3)}`
            : `multicolour ${target.slice(-1)}`

  const paint = (x: number, y: number, start: boolean) => {
    const group = `stroke-${strokeId.current}`
    if (tool === 'fill') {
      if (!start) return
      history.change(
        (cs) =>
          setCharBytes(
            cs,
            selected,
            floodFill(
              getCharBytes(cs, selected),
              CHAR_SHAPE,
              charPixelMode(cs, selected),
              x,
              y,
              value,
            ),
          ),
        group,
      )
      return
    }
    history.change((cs) => setCharPixel(cs, selected, x, y, value), group)
  }

  /** Pointer handlers for the pixel grid. */
  const gridHandlers: StrokeHandlers = {
    onStrokeStart: (x, y) => {
      strokeId.current++
      beforeStroke.current = charset
      paint(x, y, true)
    },
    onStrokeMove: (x, y) => paint(x, y, false),
    onStrokeEnd: history.endGroup,
    onStrokeCancel: history.cancelGroup,
    onDoubleTap: (x, y) => {
      if (tool !== 'draw') return
      // Clear the pixel, as one undo step with the first tap.
      if (beforeStroke.current !== charset) history.undo()
      history.change((cs) =>
        getCharPixel(cs, selected, x, y) === 0
          ? cs
          : setCharPixel(cs, selected, x, y, 0),
      )
    },
  }

  return {
    tool,
    setTool,
    pixelMode,
    pens,
    pen,
    penDef,
    /** Choose a pen (for this pixel mode); Erase goes back to Draw. */
    choosePen: (v: number) => {
      setPenByMode((p) => ({ ...p, [pixelMode]: v }))
      setEcmTarget(null)
      if (tool === 'erase') setTool('draw')
    },
    ecmTarget,
    /** Recolour an ECM background (pen 0 draws on it). */
    chooseEcmTarget: (k: number) => {
      setEcmTarget(k)
      setPenByMode((p) => ({ ...p, hires: 0 }))
    },
    clearEcmTarget: () => setEcmTarget(null),
    /** The colour slot the palette edits, and its name. */
    target,
    targetName,
    /** Char colours are 0-7 in a multicolour set. */
    limitColors: target === 'char' && charset.mode === 'multicolor',
    gridHandlers,
  }
}
