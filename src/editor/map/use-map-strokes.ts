import { useRef, useState } from 'react'
import {
  decodeEcm,
  encodeEcm,
  floodFillMap,
  pasteRegion,
  setCell,
  setCellColor,
} from '@/c64/charmap'
import type { CellColorSlot, Charmap, Region } from '@/c64/charmap'
import type { C64Color } from '@/c64/palette'
import type { useAssetHistory } from '../asset-history'
import type { StrokeHandlers } from '../gestures'
import type { CellRect } from './map-canvas'

export type MapTool =
  'paint' | 'erase' | 'fill' | 'pick' | 'select' | 'pan' | 'pin' | 'colour'

export type MapHistory = ReturnType<typeof useAssetHistory<'maps'>>

/** A 1×1 brush of one screen code. */
export const singleBrush = (code: number): Region => ({
  width: 1,
  height: 1,
  cells: Uint8Array.of(code),
})

/** Brush per map, kept while the app runs. */
const lastBrush = new Map<string, Region>()

/** The Colour tool's slot and colour (null: the char's own), app-wide. */
let lastCellColour: { slot: CellColorSlot; colour: C64Color | null } = {
  slot: 3,
  colour: 1,
}

/**
 * The Screen Worksheet's editing state: tool, brush, ECM background, cursor
 * and selection, and what a stroke on the map does with them.
 */
export function useMapStrokes(
  map: Charmap,
  ecm: boolean,
  history: MapHistory,
  /** The Pin tool tapped cell (x, y) with this brush. */
  onPin?: (x: number, y: number, brush: Region) => void,
) {
  const [tool, setTool] = useState<MapTool>('paint')
  const [brush, setBrushState] = useState<Region>(
    () => lastBrush.get(map.id) ?? singleBrush(1),
  )
  const setBrush = (b: Region) => {
    lastBrush.set(map.id, b)
    setBrushState(b)
  }
  const [cellColour, setCellColourState] = useState(lastCellColour)
  const setCellColour = (c: typeof lastCellColour) => {
    lastCellColour = c
    setCellColourState(c)
  }
  const recolour = (m: Charmap, x: number, y: number) =>
    setCellColor(m, x, y, cellColour.slot, cellColour.colour)
  const [ecmBg, setEcmBgState] = useState(0)
  const [cursorState, setCursor] = useState<[number, number] | null>(null)
  const [hovering, setHovering] = useState(false)
  const [selectionState, setSelection] = useState<CellRect | null>(null)
  // Undo, redo or a resize can shrink the map under the cursor or selection.
  const cursor =
    cursorState && cursorState[0] < map.width && cursorState[1] < map.height
      ? cursorState
      : null
  const selection =
    selectionState &&
    selectionState.x + selectionState.width <= map.width &&
    selectionState.y + selectionState.height <= map.height
      ? selectionState
      : null
  const stroke = useRef<{
    anchor: [number, number]
    last: string
    selectFrom: [number, number] | null
    group: string
  } | null>(null)
  const strokeId = useRef(0)
  /** The map before the last stroke, to tell whether a tap changed it. */
  const beforeStroke = useRef<Charmap | null>(null)

  const brushIsSingle = brush.width === 1 && brush.height === 1
  const brushCode = brush.cells[0]

  const stampAt = (m: Charmap, x: number, y: number) =>
    brushIsSingle ? setCell(m, x, y, brushCode) : pasteRegion(m, brush, x, y)

  const startStroke = (x: number, y: number) => {
    strokeId.current++
    const group = `stroke-${strokeId.current}`
    setCursor([x, y])
    stroke.current = {
      anchor: [x, y],
      last: `${x},${y}`,
      selectFrom: null,
      group,
    }
    beforeStroke.current = map
    switch (tool) {
      case 'pin':
        onPin?.(x, y, brush)
        stroke.current = null
        return
      case 'pick': {
        const code = map.cells[y * map.width + x]
        if (ecm) setEcmBgState(decodeEcm(code).background)
        setBrush(singleBrush(code))
        setTool('paint')
        stroke.current = null
        return
      }
      case 'select':
        stroke.current.selectFrom = [x, y]
        setSelection({ x, y, width: 1, height: 1 })
        return
      case 'fill':
        history.change((m) => floodFillMap(m, x, y, brushCode), group)
        return
      case 'erase':
        history.change((m) => setCell(m, x, y, m.blank), group)
        return
      case 'colour':
        history.change((m) => recolour(m, x, y), group)
        return
      case 'paint':
        history.change((m) => stampAt(m, x, y), group)
    }
  }

  const moveStroke = (x: number, y: number) => {
    const s = stroke.current
    if (!s) return
    setCursor([x, y])
    if (tool === 'select' && s.selectFrom) {
      const [fx, fy] = s.selectFrom
      setSelection({
        x: Math.min(fx, x),
        y: Math.min(fy, y),
        width: Math.abs(fx - x) + 1,
        height: Math.abs(fy - y) + 1,
      })
    } else if (tool === 'erase') {
      history.change((m) => setCell(m, x, y, m.blank), s.group)
    } else if (tool === 'colour') {
      history.change((m) => recolour(m, x, y), s.group)
    } else if (tool === 'paint') {
      // Blocks tile on a grid from where the stroke started.
      const [ax, ay] = s.anchor
      const sx = ax + Math.floor((x - ax) / brush.width) * brush.width
      const sy = ay + Math.floor((y - ay) / brush.height) * brush.height
      const key = `${sx},${sy}`
      if (key === s.last) return
      s.last = key
      history.change((m) => stampAt(m, sx, sy), s.group)
    }
  }

  const footprint: CellRect | null =
    cursor &&
    (hovering || stroke.current) &&
    tool !== 'select' &&
    tool !== 'pan'
      ? {
          x: cursor[0],
          y: cursor[1],
          width: tool === 'paint' || tool === 'pin' ? brush.width : 1,
          height: tool === 'paint' || tool === 'pin' ? brush.height : 1,
        }
      : null

  /** Pointer handlers for MapCanvas. */
  const canvasHandlers: StrokeHandlers = {
    onStrokeStart: startStroke,
    onStrokeMove: moveStroke,
    onStrokeEnd: () => {
      stroke.current = null
      history.endGroup()
    },
    onStrokeCancel: () => {
      stroke.current = null
      history.cancelGroup()
    },
    // Only painting has a double-tap; other tools take both taps.
    onDoubleTap:
      tool !== 'paint'
        ? undefined
        : (x, y) => {
            // Undo what the first tap added; a single char clears to blank.
            if (beforeStroke.current !== map) history.undo()
            if (brushIsSingle) history.change((m) => setCell(m, x, y, m.blank))
          },
    onHover: (at, pointerType) => {
      // A finger has no hover: show the brush outline only for mouse / stylus.
      setHovering(!!at && pointerType !== 'touch')
      if (at) setCursor(at)
    },
  }

  return {
    tool,
    /** Choose a tool; leaving Select drops the selection. */
    chooseTool: (t: MapTool) => {
      setTool(t)
      if (t !== 'select') setSelection(null)
    },
    setTool,
    brush,
    setBrush,
    /** The Colour tool's slot and colour. */
    cellColour,
    setCellColour,
    ecmBg,
    /** Paint on another ECM background; a single-char brush follows it. */
    chooseEcmBg: (k: number) => {
      setEcmBgState(k)
      if (brushIsSingle)
        setBrush(singleBrush(encodeEcm(decodeEcm(brushCode).char, k)))
    },
    /** A char tapped in the sheet becomes the brush. */
    pickChar: (char: number) => {
      setBrush(singleBrush(ecm ? encodeEcm(char, ecmBg) : char))
      if (tool !== 'paint' && tool !== 'fill' && tool !== 'pin')
        setTool('paint')
    },
    cursor,
    selection,
    setSelection,
    /** A stroke is under way (the selection is still being dragged). */
    stroking: stroke.current !== null,
    footprint,
    canvasHandlers,
  }
}
