import { useLayoutEffect, useMemo, useRef, useState } from 'react'
import {
  BoxSelect,
  Eraser,
  Expand,
  Grid3x3,
  Maximize2,
  PaintBucket,
  Pencil,
  Pipette,
  Plus,
  Redo2,
  Undo2,
} from 'lucide-react'
import {
  MAX_MAP_SIZE,
  copyRegion,
  decodeEcm,
  encodeEcm,
  fillRect,
  floodFillMap,
  pasteRegion,
  resizeCharmap,
  setCell,
  setMapBlank,
} from '@/c64/charmap'
import { charColor, charCount } from '@/c64/charset'
import { PALETTE } from '@/c64/palette'
import { renderCharmap } from '@/c64/render'
import { WorksheetLayout } from '@/components/worksheet/worksheet-layout'
import { Breadcrumbs } from '@/components/worksheet/breadcrumbs'
import { EdgeTabs } from '@/components/worksheet/edge-tabs'
import { editorTabs } from '@/components/worksheet/editor-tabs'
import { Field } from '@/components/worksheet/field'
import { SaveStatus } from '@/components/save-status'
import { IndexedCanvas } from '@/components/c64/indexed-canvas'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { cn } from '@/lib/utils'
import { ScreenPresets, describeScreens } from './map-size'
import { useAssetHistory } from '../asset-history'
import { ToolButton, useUndoShortcuts, zoomLabel } from '../grid-parts'
import { DEFAULT_VIEW, clampViewTo, zoomAroundIn } from '../view'
import { ZenMode } from '../zen-mode'
import { CharsetSheet } from '../charset/charset-sheet'
import { ecmBackgroundColors } from '../charset/char-pens'
import { MapCanvas, mapBounds } from './map-canvas'
import type { CellRect } from './map-canvas'
import type { GridView } from '../view'
import type { Charmap, Region } from '@/c64/charmap'
import type { Charset } from '@/c64/charset'
import type { Project } from '@/c64/project'
import type { ProjectSession, SaveStatus as Status } from '@/storage/session'

type Tool = 'paint' | 'erase' | 'fill' | 'pick' | 'select'

const COL_HEADER_H = 26
const ROW_LABELS_W = 24
const hex = (n: number, digits = 2) =>
  '$' + n.toString(16).toUpperCase().padStart(digits, '0')

/** Brush per map, kept while the app runs. */
const lastBrush = new Map<string, Region>()

const single = (code: number): Region => ({
  width: 1,
  height: 1,
  cells: Uint8Array.of(code),
})

export function MapDesigner({
  session,
  project,
  map,
  charset,
  status,
  error,
}: {
  session: ProjectSession
  project: Project
  map: Charmap
  charset: Charset
  status: Status
  error: string | null
}) {
  const history = useAssetHistory(session, 'maps', map.id, map)
  useUndoShortcuts(history)
  const ecm = charset.mode === 'ecm'
  const [tool, setTool] = useState<Tool>('paint')
  const [brush, setBrushState] = useState<Region>(
    () => lastBrush.get(map.id) ?? single(1),
  )
  const setBrush = (b: Region) => {
    lastBrush.set(map.id, b)
    setBrushState(b)
  }
  const [ecmBg, setEcmBg] = useState(0)
  const [showGrid, setShowGrid] = useState(true)
  const [cursorState, setCursor] = useState<[number, number] | null>(null)
  const [hovering, setHovering] = useState(false)
  const [selectionState, setSelection] = useState<CellRect | null>(null)
  const [resizing, setResizing] = useState(false)
  const [zen, setZen] = useState(false)
  const [blankOpen, setBlankOpen] = useState(false)
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

  // Space for the map canvas.
  const areaRef = useRef<HTMLDivElement>(null)
  const [area, setArea] = useState({ width: 0, height: 0 })
  useLayoutEffect(() => {
    const el = areaRef.current
    if (!el) return
    const measure = () =>
      setArea({ width: el.clientWidth, height: el.clientHeight })
    measure()
    const ro = new ResizeObserver(measure)
    ro.observe(el)
    return () => ro.disconnect()
  }, [])
  const frame = {
    width: Math.max(0, area.width - ROW_LABELS_W - 4),
    height: Math.max(0, area.height - COL_HEADER_H - 4),
  }
  // Fit one screen (or the whole map, if smaller) at zoom 1.
  const cell = Math.max(
    4,
    Math.min(
      40,
      Math.floor(
        Math.min(
          frame.width / Math.min(40, map.width),
          frame.height / Math.min(25, map.height),
        ),
      ),
    ),
  )
  const [viewState, setView] = useState<GridView>(DEFAULT_VIEW)
  const bounds = mapBounds(map, cell, frame)
  const view = clampViewTo(viewState, bounds)
  const size = cell * view.zoom

  const brushIsSingle = brush.width === 1 && brush.height === 1
  const brushCode = brush.cells[0]
  const sheetSelected = brushIsSingle
    ? ecm
      ? decodeEcm(brushCode).char
      : brushCode
    : -1

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
      case 'pick': {
        const code = map.cells[y * map.width + x]
        if (ecm) setEcmBg(decodeEcm(code).background)
        setBrush(single(code))
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
    cursor && (hovering || stroke.current) && tool !== 'select'
      ? {
          x: cursor[0],
          y: cursor[1],
          width: tool === 'paint' ? brush.width : 1,
          height: tool === 'paint' ? brush.height : 1,
        }
      : null

  const renderCanvas = (
    v: GridView,
    onV: (next: GridView) => void,
    canvasCell: number,
    canvasFrame: { width: number; height: number },
  ) => (
    <MapCanvas
      map={map}
      charset={charset}
      cell={canvasCell}
      frame={canvasFrame}
      view={v}
      onViewChange={onV}
      showGrid={showGrid}
      hover={footprint}
      selection={selection}
      onStrokeStart={startStroke}
      onStrokeMove={moveStroke}
      onStrokeEnd={() => {
        stroke.current = null
        history.endGroup()
      }}
      onStrokeCancel={() => {
        stroke.current = null
        history.cancelGroup()
      }}
      onDoubleTap={(x, y) => {
        if (tool !== 'paint') return
        // Undo what the first tap added; a single char clears to blank.
        if (beforeStroke.current !== map) history.undo()
        if (brushIsSingle) history.change((m) => setCell(m, x, y, m.blank))
      }}
      onHover={(at, pointerType) => {
        // A finger has no hover: show the brush outline only for mouse / stylus.
        setHovering(!!at && pointerType !== 'touch')
        if (at) setCursor(at)
      }}
    />
  )

  const brushPicker = (
    <>
      <BrushBox map={map} charset={charset} brush={brush} />

      {ecm && (
        <div className="flex flex-col gap-1">
          <span className="text-xs text-muted-foreground">
            ECM background · screen code bits 7–6
          </span>
          <div className="grid grid-cols-4 gap-1">
            {ecmBackgroundColors(charset).map((c, k) => (
              <button
                key={k}
                type="button"
                aria-pressed={ecmBg === k}
                aria-label={`Paint on ECM background ${k}, ${PALETTE[c].name}`}
                onClick={() => {
                  setEcmBg(k)
                  if (brushIsSingle)
                    setBrush(single(encodeEcm(decodeEcm(brushCode).char, k)))
                }}
                className={cn(
                  'flex h-9 items-center gap-1.5 rounded-lg border px-1.5 font-mono text-[11px]',
                  ecmBg === k
                    ? 'border-primary bg-accent ring-1 ring-primary ring-inset'
                    : 'border-rule-soft hover:bg-muted',
                )}
              >
                <span
                  aria-hidden="true"
                  className="size-4 shrink-0 rounded-[4px] border border-rule"
                  style={{ background: PALETTE[c].hex }}
                />
                B{k}
              </button>
            ))}
          </div>
        </div>
      )}

      <div className="flex flex-col gap-1">
        <span className="text-xs text-muted-foreground">
          Characters · tap to paint
        </span>
        <CharsetSheet
          charset={charset}
          selected={sheetSelected}
          pitch={13}
          background={ecm ? ecmBg : 0}
          onPick={(i) => {
            setBrush(single(ecm ? encodeEcm(i, ecmBg) : i))
            if (tool !== 'paint' && tool !== 'fill') setTool('paint')
          }}
        />
      </div>
    </>
  )

  const zenCols = Math.min(40, map.width)
  const zenRows = Math.min(25, map.height)

  return (
    <WorksheetLayout
      fitScreen
      title="Screen Worksheet"
      breadcrumbs={
        <Breadcrumbs
          items={[
            {
              label: project.name,
              link: {
                to: '/projects/$projectId',
                params: { projectId: project.id },
              },
            },
            { label: map.name },
          ]}
        />
      }
      actions={
        <>
          <SaveStatus status={status} error={error} />
          <ToolButton
            label="Zen mode: just the map"
            onClick={() => setZen(true)}
          >
            <Maximize2 />
          </ToolButton>
          <ToolButton
            label="Undo"
            disabled={!history.canUndo}
            onClick={history.undo}
          >
            <Undo2 />
          </ToolButton>
          <ToolButton
            label="Redo"
            disabled={!history.canRedo}
            onClick={history.redo}
          >
            <Redo2 />
          </ToolButton>
        </>
      }
      tabs={<EdgeTabs tabs={editorTabs(project, 'maps')} />}
      className="flex gap-3 px-4 py-3"
    >
      {/* Left: map settings, brush, characters */}
      <div className="-mx-1 flex w-[240px] shrink-0 flex-col gap-2.5 overflow-y-auto px-1 py-0.5">
        <div className="flex gap-2">
          <Field label="Map size" className="w-[104px]">
            <Button
              variant="outline"
              className="justify-between px-2.5 font-mono"
              onClick={() => setResizing(true)}
              aria-label={`Resize map, now ${map.width} by ${map.height} chars`}
            >
              {map.width}×{map.height}
              <Expand aria-hidden="true" className="text-muted-foreground" />
            </Button>
          </Field>
          <Field label="Charset" className="min-w-0 flex-1">
            <Select
              value={map.charsetId}
              onValueChange={(id) =>
                history.change((m) => ({ ...m, charsetId: id }))
              }
            >
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {project.charsets.map((c) => (
                  <SelectItem key={c.id} value={c.id}>
                    {c.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
        </div>
        <div className="flex flex-col gap-1">
          <span className="text-xs text-muted-foreground">
            {describeScreens(map.width, map.height)} · add a screen
          </span>
          <div className="grid grid-cols-2 gap-1.5">
            <Button
              variant="outline"
              disabled={map.width + 40 > MAX_MAP_SIZE}
              onClick={() =>
                history.change((m) => resizeCharmap(m, m.width + 40, m.height))
              }
              title="Add a screen to the right (+40 columns)"
            >
              <Plus aria-hidden="true" /> Right →
            </Button>
            <Button
              variant="outline"
              disabled={map.height + 25 > MAX_MAP_SIZE}
              onClick={() =>
                history.change((m) => resizeCharmap(m, m.width, m.height + 25))
              }
              title="Add a screen below (+25 rows)"
            >
              <Plus aria-hidden="true" /> Below ↓
            </Button>
          </div>
        </div>

        {brushPicker}
        {selection && !stroke.current && tool === 'select' && (
          <div className="flex flex-col gap-1">
            <span className="text-xs text-muted-foreground">
              Selection · {selection.width}×{selection.height} at x{' '}
              {selection.x}, y {selection.y}
            </span>
            <div className="grid grid-cols-2 gap-1.5">
              <Button
                variant="outline"
                className="border-primary bg-accent text-primary hover:bg-accent"
                onClick={() => {
                  setBrush(
                    copyRegion(
                      map,
                      selection.x,
                      selection.y,
                      selection.width,
                      selection.height,
                    ),
                  )
                  setSelection(null)
                  setTool('paint')
                }}
              >
                Use as brush
              </Button>
              <Button
                variant="outline"
                onClick={() => {
                  history.change((m) =>
                    fillRect(
                      m,
                      selection.x,
                      selection.y,
                      selection.width,
                      selection.height,
                      m.blank,
                    ),
                  )
                  setSelection(null)
                }}
              >
                Clear area
              </Button>
            </div>
          </div>
        )}
      </div>

      {/* Tool rail */}
      <div
        role="toolbar"
        aria-label="Map tools"
        aria-orientation="vertical"
        className="flex shrink-0 flex-col gap-1"
        style={{ paddingTop: COL_HEADER_H + 2 }}
      >
        {(
          [
            [
              'paint',
              'Paint with the brush (double-tap to undo a stamp)',
              Pencil,
            ],
            ['erase', 'Erase (writes the Blank Char)', Eraser],
            ['fill', 'Fill with the brush char', PaintBucket],
            ['pick', 'Pick a char from the map', Pipette],
            ['select', 'Select an area', BoxSelect],
          ] as const
        ).map(([value, label, Icon]) => (
          <ToolButton
            key={value}
            label={label}
            pressed={tool === value}
            onClick={() => {
              setTool(value)
              if (value !== 'select') setSelection(null)
            }}
          >
            <Icon />
          </ToolButton>
        ))}
        <ToolButton
          label={`Blank char: ${hex(map.blank)} (fills new cells; Erase writes it)`}
          onClick={() => setBlankOpen(true)}
        >
          <CharIcon charset={charset} code={map.blank} />
        </ToolButton>
        <div aria-hidden="true" className="mx-1.5 my-1 h-px bg-rule-soft" />
        <ToolButton
          label="Grid lines"
          pressed={showGrid}
          onClick={() => setShowGrid((g) => !g)}
        >
          <Grid3x3 />
        </ToolButton>
        <ToolButton
          label={
            view.zoom !== 1
              ? 'Reset zoom (pinch to zoom)'
              : 'Zoom in (or pinch)'
          }
          pressed={view.zoom !== 1}
          onClick={() =>
            setView(
              view.zoom !== 1
                ? DEFAULT_VIEW
                : zoomAroundIn(
                    view,
                    2,
                    { x: bounds.frameW / 2, y: bounds.frameH / 2 },
                    bounds,
                  ),
            )
          }
        >
          <span className="font-mono text-[11px] font-medium">
            {zoomLabel(view.zoom)}
          </span>
        </ToolButton>
      </div>

      {/* The map, with screen addresses along the top like the paper sheet */}
      <div className="flex min-w-0 flex-1 flex-col">
        <div ref={areaRef} className="flex min-h-0 flex-1 flex-col">
          {area.width > 0 && (
            <>
              <ColumnHeader
                map={map}
                size={size}
                offset={view.x}
                width={bounds.frameW}
              />
              <div className="flex">
                <RowLabels
                  map={map}
                  size={size}
                  offset={view.y}
                  height={bounds.frameH}
                  active={cursor?.[1] ?? null}
                />
                <div className="h-fit rounded-[2px] border-2 border-grid-frame">
                  {renderCanvas(view, setView, cell, frame)}
                </div>
              </div>
            </>
          )}
        </div>
        <Readout map={map} charset={charset} cell={cursor} />
      </div>

      {zen && (
        <ZenMode
          title={map.name}
          columns={zenCols}
          rows={zenRows}
          renderGrid={(c, v, onV) =>
            renderCanvas(
              clampViewTo(
                v,
                mapBounds(map, c, { width: zenCols * c, height: zenRows * c }),
              ),
              onV,
              c,
              {
                width: zenCols * c,
                height: zenRows * c,
              },
            )
          }
          tool={tool === 'erase' || tool === 'fill' ? tool : 'draw'}
          onTool={(t) => setTool(t === 'draw' ? 'paint' : t)}
          toolLabels={{ draw: 'Paint with the brush' }}
          side={
            <div className="flex w-[240px] flex-col gap-2.5">{brushPicker}</div>
          }
          sideWidth={292}
          zoom={(v, factor, at, f) =>
            zoomAroundIn(
              v,
              v.zoom * factor,
              at,
              mapBounds(map, f.width / zenCols, f),
            )
          }
          minZoom={Math.min(1, zenCols / map.width, zenRows / map.height)}
          hint="Pinch to zoom · two fingers to pan · double-tap to undo a stamp"
          onUndo={history.undo}
          onRedo={history.redo}
          canUndo={history.canUndo}
          canRedo={history.canRedo}
          onExit={() => setZen(false)}
        />
      )}
      {blankOpen && (
        <BlankCharDialog
          charset={charset}
          blank={map.blank}
          onClose={() => setBlankOpen(false)}
          onSave={(code) => history.change((m) => setMapBlank(m, code))}
        />
      )}
      {resizing && (
        <ResizeDialog
          map={map}
          onClose={() => setResizing(false)}
          onResize={(w, h) => {
            history.change((m) => resizeCharmap(m, w, h))
            setSelection(null)
            setView(DEFAULT_VIEW)
          }}
        />
      )}
    </WorksheetLayout>
  )
}

/** Column numbers (and screen RAM addresses on the first screen) every 5 columns. */
function ColumnHeader({
  map,
  size,
  offset,
  width,
}: {
  map: Charmap
  size: number
  offset: number
  width: number
}) {
  const every = size >= 12 ? 5 : size >= 5 ? 10 : 20
  const cols: Array<number> = []
  for (let c = 0; c < map.width; c += every) cols.push(c)
  if (map.width <= 40 && cols.at(-1) !== map.width - 1) cols.push(map.width - 1)
  return (
    <div
      aria-hidden="true"
      className="relative shrink-0 overflow-hidden"
      // 16 px either side so the end labels aren't cut off.
      style={{
        height: COL_HEADER_H,
        marginLeft: ROW_LABELS_W + 2 - 16,
        width: width + 32,
      }}
    >
      {cols.map((c) => {
        const left = offset + c * size + size / 2 + 16
        if (left < 0 || left > width + 32) return null
        return (
          <div
            key={c}
            className="absolute bottom-0.5 w-10 -translate-x-1/2 text-center font-mono text-[9px] leading-[11px] text-muted-foreground"
            style={{ left }}
          >
            {c < 40 && (
              <>
                {1024 + c}
                <br />
              </>
            )}
            {c}
          </div>
        )
      })}
    </div>
  )
}

function RowLabels({
  map,
  size,
  offset,
  height,
  active,
}: {
  map: Charmap
  size: number
  offset: number
  height: number
  active: number | null
}) {
  const every = size >= 12 ? 1 : size >= 6 ? 5 : 10
  const rows: Array<number> = []
  for (let r = 0; r < map.height; r += every) rows.push(r)
  return (
    <div
      aria-hidden="true"
      className="relative mt-[2px] mr-[2px] shrink-0 overflow-hidden"
      style={{ width: ROW_LABELS_W, height }}
    >
      {rows.map((r) => {
        const top = offset + r * size
        if (top < -size || top > height) return null
        return (
          <div
            key={r}
            className={cn(
              'absolute right-0 flex items-center font-mono text-[9px]',
              r === active
                ? 'font-semibold text-primary'
                : 'text-muted-foreground',
            )}
            style={{ top, height: Math.max(size, 11) }}
          >
            {r}
          </div>
        )
      })}
    </div>
  )
}

/** Where the cell lives in memory, as on the paper worksheet. */
function Readout({
  map,
  charset,
  cell,
}: {
  map: Charmap
  charset: Charset
  cell: [number, number] | null
}) {
  const items: Array<[string, string]> = [
    ['Cell', '—'],
    ['Map byte · x + W·y', ''],
    ['Screen RAM · 1024 + x + 40·y', ''],
    ['Colour RAM · 55296 + x + 40·y', ''],
    ['Char · colour', ''],
  ]
  if (cell) {
    const [x, y] = cell
    const code = map.cells[y * map.width + x]
    const onScreen = x < 40 && y < 25
    const off = x + 40 * y
    const char = charset.mode === 'ecm' ? decodeEcm(code).char : code
    const color =
      char < charCount(charset.mode)
        ? PALETTE[charColor(charset, char)].name
        : '—'
    items[0][1] = `x ${x}, y ${y}`
    items[1][1] = String(x + map.width * y)
    items[2][1] = onScreen
      ? `${1024 + off} (${hex(1024 + off, 4)})`
      : 'not on screen 0'
    items[3][1] = onScreen
      ? `${55296 + off} (${hex(55296 + off, 4)})`
      : 'not on screen 0'
    items[4][1] = `${hex(code)} · ${color}`
  }
  return (
    <dl className="mt-2 ml-[26px] grid shrink-0 grid-flow-col grid-rows-2 gap-x-4 gap-y-0.5 text-xs">
      {items.map(([label, value]) => (
        <div key={label} className="contents">
          <dt className="text-muted-foreground">{label}</dt>
          <dd className="font-mono">{value}</dd>
        </div>
      ))}
    </dl>
  )
}

function BrushBox({
  map,
  charset,
  brush,
}: {
  map: Charmap
  charset: Charset
  brush: Region
}) {
  const image = useMemo(
    () =>
      renderCharmap(
        {
          ...map,
          width: brush.width,
          height: brush.height,
          cells: brush.cells,
        },
        charset,
        { x: 0, y: 0, width: brush.width, height: brush.height },
      ),
    [map, charset, brush],
  )
  const isSingle = brush.width === 1 && brush.height === 1
  const code = brush.cells[0]
  const char = charset.mode === 'ecm' ? decodeEcm(code).char : code
  const scale = Math.max(
    1,
    Math.min(6, Math.floor(56 / (8 * Math.max(brush.width, brush.height)))),
  )
  return (
    <div className="flex flex-col gap-1">
      <span className="text-xs text-muted-foreground">Brush</span>
      <div className="flex items-center gap-2.5 rounded-lg border border-rule-soft p-1.5">
        <IndexedCanvas
          image={image}
          label={
            isSingle
              ? `Brush: char ${hex(code)}`
              : `Brush: ${brush.width}×${brush.height} block`
          }
          className="shrink-0 rounded-[3px]"
          style={{ width: image.width * scale, height: image.height * scale }}
        />
        <div className="flex min-w-0 flex-col">
          <span className="font-mono text-sm">
            {isSingle
              ? `Char ${hex(code)}`
              : `Block ${brush.width}×${brush.height}`}
          </span>
          <span className="text-[11px] text-muted-foreground">
            {isSingle
              ? `${code} · ${char < charCount(charset.mode) ? PALETTE[charColor(charset, char)].name : ''}`
              : 'From a selection · tiles as you drag'}
          </span>
        </div>
      </div>
    </div>
  )
}

function ResizeDialog({
  map,
  onClose,
  onResize,
}: {
  map: Charmap
  onClose: () => void
  onResize: (width: number, height: number) => void
}) {
  const [width, setWidth] = useState(String(map.width))
  const [height, setHeight] = useState(String(map.height))
  const w = Number(width)
  const h = Number(height)
  const ok = [w, h].every(
    (n) => Number.isInteger(n) && n >= 1 && n <= MAX_MAP_SIZE,
  )
  const shrinks = ok && (w < map.width || h < map.height)
  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent onOpenAutoFocus={(e) => e.preventDefault()}>
        <form
          className="flex flex-col gap-4"
          onSubmit={(e) => {
            e.preventDefault()
            if (!ok) return
            onResize(w, h)
            onClose()
          }}
        >
          <DialogHeader>
            <DialogTitle>Resize map</DialogTitle>
            <DialogDescription>
              Make the map bigger than one screen to draw scrolling levels.
              Content stays at the top left; new cells get the Blank Char (
              {hex(map.blank)}). Up to {MAX_MAP_SIZE}×{MAX_MAP_SIZE} chars.
            </DialogDescription>
          </DialogHeader>
          <ScreenPresets
            width={Number(width)}
            height={Number(height)}
            onPick={(pw, ph) => {
              setWidth(String(pw))
              setHeight(String(ph))
            }}
          />
          <div className="flex gap-3">
            <Field label="Width (chars)" className="flex-1">
              <Input
                inputMode="numeric"
                value={width}
                onChange={(e) => setWidth(e.target.value)}
              />
            </Field>
            <Field label="Height (chars)" className="flex-1">
              <Input
                inputMode="numeric"
                value={height}
                onChange={(e) => setHeight(e.target.value)}
              />
            </Field>
          </div>
          {!ok && (
            <p className="text-sm text-destructive">
              Width and height must be 1–{MAX_MAP_SIZE}.
            </p>
          )}
          {shrinks && (
            <p className="text-sm text-muted-foreground">
              Cells outside the new size are cut off (you can undo this).
            </p>
          )}
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit" disabled={!ok}>
              Resize
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

/** A char drawn at icon size, for buttons. */
function CharIcon({
  charset,
  code,
  className = 'size-5',
}: {
  charset: Charset
  code: number
  className?: string
}) {
  const image = useMemo(
    () =>
      renderCharmap(
        {
          id: '',
          name: '',
          notes: '',
          charsetId: charset.id,
          width: 1,
          height: 1,
          cells: Uint8Array.of(code),
          blank: code,
        },
        charset,
        { x: 0, y: 0, width: 1, height: 1 },
      ),
    [charset, code],
  )
  return (
    <IndexedCanvas
      image={image}
      label=""
      className={cn(
        'rounded-[3px] outline-1 outline-offset-1 outline-rule outline-dashed',
        className,
      )}
    />
  )
}

/** Choose the map's Blank Char: what new cells get and what Erase writes. */
function BlankCharDialog({
  charset,
  blank,
  onClose,
  onSave,
}: {
  charset: Charset
  blank: number
  onClose: () => void
  onSave: (code: number) => void
}) {
  const ecm = charset.mode === 'ecm'
  const [code, setCode] = useState(blank)
  const char = ecm ? decodeEcm(code).char : code
  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent
        className="max-w-[440px] sm:max-w-[440px]"
        onOpenAutoFocus={(e) => e.preventDefault()}
      >
        <DialogHeader>
          <DialogTitle>Blank Char</DialogTitle>
          <DialogDescription>
            The character that means “empty” on this map: Erase writes it, and
            new cells get it when the map grows. Usually $00 for custom maps, or
            $20 in PETSCII.
          </DialogDescription>
        </DialogHeader>
        <div className="flex items-start gap-4">
          <CharsetSheet
            charset={charset}
            selected={char}
            pitch={15}
            onPick={(i) =>
              setCode(ecm ? encodeEcm(i, decodeEcm(code).background) : i)
            }
          />
          <div className="flex flex-col items-center gap-1.5">
            <span className="text-xs text-muted-foreground">Blank Char</span>
            <CharIcon charset={charset} code={code} className="size-16" />
            <span className="font-mono text-sm">{hex(code)}</span>
            <span className="font-mono text-xs text-muted-foreground">
              {code}
            </span>
          </div>
        </div>
        <DialogFooter>
          <Button
            variant="ghost"
            className="mr-auto"
            disabled={code === 0}
            onClick={() => setCode(0)}
          >
            Reset to $00
          </Button>
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button
            onClick={() => {
              onSave(code)
              onClose()
            }}
          >
            Save
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
