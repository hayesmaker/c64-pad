import { useEffect, useState } from 'react'
import { Maximize2, MonitorPlay, Redo2, Undo2 } from 'lucide-react'
import { copyRegion, fillRect, resizeCharmap, setMapBlank } from '@/c64/charmap'
import { WorksheetLayout } from '@/components/worksheet/worksheet-layout'
import { Breadcrumbs } from '@/components/worksheet/breadcrumbs'
import { EdgeTabs } from '@/components/worksheet/edge-tabs'
import { editorTabs } from '@/components/worksheet/editor-tabs'
import { SaveStatus } from '@/components/save-status'
import { EmulatorOverlay } from '@/emulator/emulator-overlay'
import { mapViewerPrg } from '@/emulator/charmap-viewer'
import { safeFileName } from '@/platform/save-file'
import { useAssetHistory } from '../asset-history'
import { ToolButton, useUndoShortcuts } from '../grid-parts'
import { DEFAULT_VIEW, clampViewTo, zoomAroundIn } from '../view'
import { loadMapView, saveMapView } from './stored-view'
import { ZenMode } from '../zen-mode'
import { TracingPanel } from '../tracing/tracing-panel'
import { TracingButtons } from '../tracing/tracing-buttons'
import { useGridTracing } from '../tracing/use-tracing'
import { setSelectedChar } from '../charset/selected-char'
import {
  charOfCode,
  loadCharTracing,
  pinBrush,
  saveCharTracing,
} from '../tracing/char-tracing'
import { hex } from '../hex'
import { showToast } from '@/components/toast'
import { RunExportDialog } from '../run-export-dialog'
import { MapExportPanel } from '../chars-export'
import { useElementSize } from '../use-element-size'
import { MapCanvas, mapBounds } from './map-canvas'
import { MapNavigator } from './map-navigator'
import { useShowAttributes } from '../attribute-overlay'
import { BrushPicker } from './map-brush'
import { BlankCharDialog, ResizeDialog } from './map-dialogs'
import { Readout } from './map-readout'
import {
  COL_HEADER_H,
  ColumnHeader,
  ROW_LABELS_W,
  RowLabels,
} from './map-rulers'
import { MapSettings, SelectionActions } from './map-side-panel'
import { MapToolRail } from './map-tool-rail'
import { useMapStrokes } from './use-map-strokes'
import type { GridView } from '../view'
import type { Charmap } from '@/c64/charmap'
import type { Charset } from '@/c64/charset'
import type { Project } from '@/c64/project'
import type { ProjectSession, SaveStatus as Status } from '@/storage/session'

/** The Screen Worksheet: one map, drawn with its charset. */
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
  // Pin tool: the brush's chars trace from the tapped cells on the
  // Character Worksheet.
  const edit = useMapStrokes(map, ecm, history, (x, y, brush) => {
    const { prefs, pinned } = pinBrush(
      loadCharTracing(charset.id),
      map,
      brush,
      x,
      y,
      ecm,
    )
    saveCharTracing(charset.id, prefs)
    showToast(
      pinned.length === 0
        ? 'Nothing pinned: the brush is only the Blank Char'
        : `Pinned ${pinned.map((c) => hex(c)).join(', ')} at column ${x}, row ${y}`,
    )
  })
  // CHARS opens on the char being painted with (a single-char brush).
  const brushChar =
    edit.brush.width === 1 && edit.brush.height === 1
      ? charOfCode(edit.brush.cells[0], ecm)
      : null
  useEffect(() => {
    if (brushChar !== null) setSelectedChar(charset.id, brushChar)
  }, [charset.id, brushChar])
  const [showGrid, setShowGrid] = useState(true)
  const [showAttributes, setShowAttributes] = useShowAttributes('map')
  const [resizing, setResizing] = useState(false)
  const [zen, setZen] = useState(false)
  const [runExport, setRunExport] = useState(false)
  const [running, setRunning] = useState<{
    prg: Uint8Array
    title: string
    joystick: boolean
  } | null>(null)
  const [blankOpen, setBlankOpen] = useState(false)
  const [tracingOpen, setTracingOpen] = useState(false)
  const mapTarget = { width: map.width * 8, height: map.height * 8 }
  const trace = useGridTracing(map.id, mapTarget)

  // Space for the map canvas.
  const [areaRef, area] = useElementSize()
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
  // Reopens at the zoom and scroll it was left at.
  const [viewState, setView] = useState<GridView>(() => loadMapView(map.id))
  useEffect(() => saveMapView(map.id, viewState), [map.id, viewState])
  const bounds = mapBounds(map, cell, frame)
  const view = clampViewTo(viewState, bounds)
  const size = cell * view.zoom
  const { selection } = edit

  // The navigator fades while painting, so strokes show through it.
  const [painting, setPainting] = useState(false)
  const strokeHandlers = {
    ...edit.canvasHandlers,
    onStrokeStart: (x: number, y: number) => {
      setPainting(true)
      edit.canvasHandlers.onStrokeStart(x, y)
    },
    onStrokeEnd: () => {
      setPainting(false)
      edit.canvasHandlers.onStrokeEnd()
    },
    onStrokeCancel: () => {
      setPainting(false)
      edit.canvasHandlers.onStrokeCancel()
    },
  }

  const renderCanvas = (
    v: GridView,
    onV: (next: GridView) => void,
    canvasCell: number,
    canvasFrame: { width: number; height: number },
  ) => (
    <div className="relative">
      <MapCanvas
        map={map}
        charset={charset}
        cell={canvasCell}
        frame={canvasFrame}
        view={v}
        onViewChange={onV}
        showGrid={showGrid}
        showAttributes={showAttributes}
        hover={edit.footprint}
        selection={selection}
        tracing={trace.grid}
        pan={edit.tool === 'pan'}
        {...strokeHandlers}
      />
      <MapNavigator
        faded={painting}
        map={map}
        charset={charset}
        view={v}
        bounds={mapBounds(map, canvasCell, canvasFrame)}
        onViewChange={onV}
        tracing={trace.grid}
      />
    </div>
  )

  const brushPicker = (
    <BrushPicker
      map={map}
      charset={charset}
      brush={edit.brush}
      ecmBg={edit.ecmBg}
      onEcmBg={edit.chooseEcmBg}
      onPickChar={edit.pickChar}
      showAttributes={showAttributes}
    />
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
          <TracingButtons
            open={tracingOpen}
            onOpen={setTracingOpen}
            tracing={trace.tracing}
            onVisible={(visible) => trace.update((t) => ({ ...t, visible }))}
          />
          <ToolButton
            label="Zen mode: just the map"
            onClick={() => setZen(true)}
          >
            <Maximize2 />
          </ToolButton>
          <ToolButton label="Run & export" onClick={() => setRunExport(true)}>
            <MonitorPlay />
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
      tabs={<EdgeTabs tabs={editorTabs(project, 'maps', map.id)} />}
      className="flex gap-3 px-4 py-3"
    >
      {/* Left: map settings, brush, characters */}
      <div className="-mx-1 flex w-[240px] shrink-0 flex-col gap-2.5 overflow-y-auto px-1 py-0.5">
        {tracingOpen ? (
          <TracingPanel
            tracing={trace.tracing}
            error={trace.error}
            target={mapTarget}
            targetLabel={`map: ${mapTarget.width} × ${mapTarget.height} px (${map.width} × ${map.height} chars)`}
            onLoad={(file) => void trace.load(file)}
            onRemove={() => void trace.remove()}
            onChange={trace.update}
            onDone={() => setTracingOpen(false)}
          />
        ) : (
          <>
            <MapSettings
              project={project}
              map={map}
              onChange={history.change}
              onResize={() => setResizing(true)}
            />
            {brushPicker}
            {edit.tool === 'pin' && <PinNote traced={!!trace.tracing} />}
            {selection && !edit.stroking && edit.tool === 'select' && (
              <SelectionActions
                selection={selection}
                onUseAsBrush={() => {
                  edit.setBrush(
                    copyRegion(
                      map,
                      selection.x,
                      selection.y,
                      selection.width,
                      selection.height,
                    ),
                  )
                  edit.setSelection(null)
                  edit.setTool('paint')
                }}
                onClear={() => {
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
                  edit.setSelection(null)
                }}
              />
            )}
          </>
        )}
      </div>

      <MapToolRail
        tool={edit.tool}
        onTool={edit.chooseTool}
        map={map}
        charset={charset}
        onBlank={() => setBlankOpen(true)}
        showGrid={showGrid}
        onToggleGrid={() => setShowGrid((g) => !g)}
        showAttributes={showAttributes}
        onToggleAttributes={() => setShowAttributes(!showAttributes)}
        zoom={view.zoom}
        onZoom={() =>
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
      />

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
                  active={edit.cursor?.[1] ?? null}
                />
                <div className="h-fit rounded-[2px] border-2 border-grid-frame">
                  {renderCanvas(view, setView, cell, frame)}
                </div>
              </div>
            </>
          )}
        </div>
        <Readout map={map} charset={charset} cell={edit.cursor} />
      </div>

      {runExport && (
        <RunExportDialog
          title={map.name}
          runSummary={
            map.width <= 40 && map.height <= 25
              ? `Shows “${map.name}” on the C64 screen.`
              : `Shows the top-left screen of “${map.name}” (${map.width} × ${map.height}); scroll with the arrow keys or the on-screen arrows (joystick port 2).`
          }
          onRun={() => {
            const { prg, rows } = mapViewerPrg(map, charset)
            setRunning({
              prg,
              title:
                rows < map.height
                  ? `${map.name} · first ${rows} rows (C64 memory)`
                  : map.name,
              joystick: map.width > 40 || rows > 25,
            })
          }}
          exportPanel={
            <MapExportPanel
              project={project}
              map={map}
              charset={charset}
              onClose={() => setRunExport(false)}
            />
          }
          onClose={() => setRunExport(false)}
        />
      )}
      {running && (
        <EmulatorOverlay
          prg={running.prg}
          title={running.title}
          joystick={running.joystick}
          fileName={`${safeFileName(project.name)}-${safeFileName(map.name)}.prg`}
          onClose={() => setRunning(null)}
        />
      )}
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
          tool={
            edit.tool === 'erase' || edit.tool === 'fill' || edit.tool === 'pan'
              ? edit.tool
              : 'draw'
          }
          onTool={(t) => edit.setTool(t === 'draw' ? 'paint' : t)}
          canPan
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
          hint="Pinch to zoom · two fingers (or the Hand) to pan · double-tap to undo a stamp"
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
            edit.setSelection(null)
            setView(DEFAULT_VIEW)
          }}
        />
      )}
    </WorksheetLayout>
  )
}

/** What the Pin tool does (each pin is confirmed by a toast). */
function PinNote({ traced }: { traced: boolean }) {
  return (
    <p className="rounded-lg bg-muted px-2 py-1.5 text-[11px] leading-snug">
      {traced
        ? 'Tap a cell to pin the brush char there: the Character Worksheet then shows the tracing under that cell when you draw it. A block brush pins each of its chars.'
        : 'This screen has no tracing paper yet: load an image first, then pin chars to it.'}
    </p>
  )
}
