import { useEffect, useMemo, useState } from 'react'
import {
  Binary,
  Maximize2,
  MonitorPlay,
  PanelLeft,
  Redo2,
  Undo2,
} from 'lucide-react'
import {
  charCount,
  clearChar,
  flipCharHorizontal,
  flipCharVertical,
  getCharBytes,
  invertChar,
  isCharMulticolor,
  renderChar,
  rotateCharClockwise,
  setCharMulticolor,
  setCharsetMode,
  shiftChar,
  swapChars,
} from '@/c64/charset'
import { usePalette } from '@/components/c64/palette-context'
import { mapsUsingCharset, projectColors } from '@/c64/project'
import { WorksheetLayout } from '@/components/worksheet/worksheet-layout'
import { Breadcrumbs } from '@/components/worksheet/breadcrumbs'
import { EdgeTabs } from '@/components/worksheet/edge-tabs'
import { editorTabs } from '@/components/worksheet/editor-tabs'
import { Field } from '@/components/worksheet/field'
import { SaveStatus } from '@/components/save-status'
import { Input } from '@/components/ui/input'
import { EmulatorOverlay } from '@/emulator/emulator-overlay'
import { charsetViewerPrg } from '@/emulator/charmap-viewer'
import { safeFileName } from '@/platform/save-file'
import { useCompact } from '@/lib/compact'
import { cn } from '@/lib/utils'
import { useAssetHistory } from '../asset-history'
import { DEFAULT_VIEW, zoomAround } from '../view'
import {
  BIT_HEADER_H,
  BitHeader,
  RowNumbers,
  ToolButton,
  useCellSize,
  useUndoShortcuts,
} from '../grid-parts'
import { hex } from '../hex'
import { PixelGrid } from '../pixel-grid'
import { PixelToolRail } from '../pixel-tool-rail'
import { PaletteGrid, PensPanel } from '../pens-panel'
import { Segmented } from '../segmented'
import { ZenMode, ZenPens } from '../zen-mode'
import { GamepadHelp } from '../gamepad-help'
import { stepPen, useGridCursor } from '../use-grid-cursor'
import {
  ALL_COLORS,
  COMPACT_DRAWER,
  COMPACT_PENS_H,
  CompactDrawerBackdrop,
} from '../compact-panel'
import { RunExportDialog } from '../run-export-dialog'
import { CharsetExportPanel } from '../chars-export'
import { setSlotColor, slotColor } from './char-pens'
import { CharDataColumn, CharMemoryNote, DATA_W, MEM_H } from './char-data'
import { CharNumberField, CharPreview, EcmBackgrounds } from './char-panels'
import { CharsetPanel } from './charset-panel'
import { useCharTools } from './use-char-tools'
import { getSelectedChar, setSelectedChar } from './selected-char'
import { CharTracingPanel } from '../tracing/char-tracing-panel'
import { clearBackground } from '../tracing/char-tracing'
import { useCharTracing } from '../tracing/use-char-tracing'
import type { GridView } from '../view'
import type { Charset, CharsetMode } from '@/c64/charset'
import type { Project } from '@/c64/project'
import type { ProjectSession, SaveStatus as Status } from '@/storage/session'

/** The Character Worksheet: one char of a charset at a time. */
export function CharsetDesigner({
  session,
  project,
  charset,
  status,
  error,
}: {
  session: ProjectSession
  project: Project
  charset: Charset
  status: Status
  error: string | null
}) {
  const palette = usePalette()
  const history = useAssetHistory(session, 'charsets', charset.id, charset)
  useUndoShortcuts(history)
  const { change } = history
  const count = charCount(charset.mode)
  const [selectedRaw, setSelected] = useState(
    () => getSelectedChar(charset.id) ?? 0,
  )
  const selected = Math.min(selectedRaw, count - 1)
  const tools = useCharTools(charset, selected, history)
  const { tool, pens, pen, penDef, target, targetName, limitColors } = tools
  const [asHex, setAsHex] = useState(true)
  const [swapping, setSwapping] = useState(false)
  const [zen, setZen] = useState(false)
  const [runExport, setRunExport] = useState(false)
  const [running, setRunning] = useState<{
    prg: Uint8Array
    title: string
    joystick: boolean
  } | null>(null)
  const compact = useCompact()
  /** Small screens: the left panel is a drawer, the byte column a toggle. */
  const [detailsOpen, setDetailsOpen] = useState(false)
  const [showBytes, setShowBytes] = useState(false)
  const cell = useCellSize({
    columns: 8,
    rows: 8,
    min: compact ? 16 : 24,
    max: 56,
    reserveWidth: !compact || showBytes ? DATA_W + 12 : 0,
    // Compact: the pens row sits under the grid instead of the memory note.
    reserveHeight: BIT_HEADER_H + 2 + (compact ? COMPACT_PENS_H : MEM_H),
  })
  const [view, setView] = useState<GridView>(DEFAULT_VIEW)
  useEffect(() => setView(DEFAULT_VIEW), [cell.size])

  useEffect(() => {
    setSelectedChar(charset.id, selected)
  }, [charset.id, selected])

  const mcChar = isCharMulticolor(charset, selected)
  const users = useMemo(
    () => mapsUsingCharset(project, charset.id),
    [project, charset.id],
  )
  const trace = useCharTracing(
    charset.id,
    users,
    selected,
    charset.mode === 'ecm',
  )
  const traceUnder = trace.grid?.layer === 'under'

  const pick = (index: number) => {
    if (swapping) {
      setSwapping(false)
      if (index !== selected) {
        change((cs) => swapChars(cs, selected, index))
      }
    }
    setSelected(index)
  }

  const pad = useGridCursor({
    columns: tools.pixelMode === 'multicolor' ? 4 : 8,
    rows: 8,
    handlers: tools.gridHandlers,
    actions: {
      onToggleTool: (t) => tools.setTool(tool === t ? 'draw' : t),
      onPen: (delta) => tools.choosePen(stepPen(pens, pen, delta)),
      onItem: (delta) => setSelected((selected + delta + count) % count),
      onUndo: history.undo,
      onRedo: history.redo,
      onZen: () => setZen((z) => !z),
    },
    enabled: !running && !runExport,
  })

  const bytes = getCharBytes(charset, selected)
  // Tracing under empty pixels shows through the background ones.
  const gridLayers = useMemo(() => {
    const pixels = renderChar(charset, selected)
    return [
      {
        pixels: traceUnder
          ? clearBackground(pixels, charset.background)
          : Int8Array.from(pixels),
      },
    ]
  }, [charset, selected, traceUnder])
  const renderGrid = (
    size: number,
    v: GridView,
    onV: (next: GridView) => void,
  ) => (
    <PixelGrid
      width={8}
      height={8}
      step={tools.pixelMode === 'multicolor' ? 2 : 1}
      majorX={4}
      majorY={4}
      layers={gridLayers}
      background={palette.hex[charset.background]}
      cell={size}
      view={v}
      onViewChange={onV}
      label={`Character ${selected} pixel grid, ${mcChar ? '4' : '8'} by 8`}
      tracing={trace.grid}
      cursor={pad.cursor}
      pan={tools.tool === 'pan'}
      {...tools.gridHandlers}
    />
  )

  const pensProps = {
    pens,
    pen,
    onPen: tools.choosePen,
    penColor: penDef.slot ? slotColor(charset, selected, penDef.slot) : null,
    isAllowed: (c: number) =>
      !(penDef.slot === 'char' && charset.mode === 'multicolor') || c < 8,
    onRecolor: (color: number) => {
      const slot = penDef.slot
      if (slot) change((cs) => setSlotColor(cs, selected, slot, color))
    },
  }
  const compactPens = (
    <ZenPens layout="row" colors={ALL_COLORS} {...pensProps} />
  )

  return (
    <WorksheetLayout
      fitScreen
      title="Character Worksheet"
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
            { label: charset.name },
          ]}
        />
      }
      actions={
        <>
          <SaveStatus status={status} error={error} />
          {compact && (
            <>
              <ToolButton
                label="Character details"
                pressed={detailsOpen}
                onClick={() => setDetailsOpen((o) => !o)}
              >
                <PanelLeft />
              </ToolButton>
              <ToolButton
                label="Show data bytes"
                pressed={showBytes}
                onClick={() => setShowBytes((b) => !b)}
              >
                <Binary />
              </ToolButton>
            </>
          )}
          <ToolButton
            label="Zen mode: just the grid"
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
      tabs={<EdgeTabs tabs={editorTabs(project, 'charsets', charset.id)} />}
      className="relative flex gap-4 px-4 py-3 compact:gap-2 compact:px-2 compact:py-2"
    >
      {compact && detailsOpen && (
        <CompactDrawerBackdrop onClose={() => setDetailsOpen(false)} />
      )}
      {/* Left: char details, mode, pens, palette, preview (a drawer when compact) */}
      <div
        className={cn(
          '-mx-1 flex w-[232px] shrink-0 flex-col gap-2.5 overflow-y-auto px-1 py-0.5',
          compact && COMPACT_DRAWER,
          compact && !detailsOpen && 'hidden',
        )}
      >
        <div className="flex gap-2">
          <CharNumberField count={count} value={selected} onChange={pick} />
          <Field label="Hex" className="w-20">
            <Input value={hex(selected)} readOnly className="font-mono" />
          </Field>
        </div>
        <div className="flex flex-col gap-[3px]">
          <span className="text-xs text-muted-foreground">
            Charset mode · all {count === 64 ? '64' : '256'} chars
          </span>
          <Segmented<CharsetMode>
            label="Charset mode"
            columns={2}
            size="sm"
            value={charset.mode}
            options={[
              { value: 'hires', label: 'Hires' },
              { value: 'multicolor', label: 'Multicolour' },
              { value: 'ecm', label: 'ECM' },
              { value: 'bitmap', label: 'Bitmap' },
            ]}
            onChange={(mode) => {
              tools.clearEcmTarget()
              change((cs) => setCharsetMode(cs, mode))
            }}
          />
        </div>
        {charset.mode === 'multicolor' && (
          <div className="flex flex-col gap-[3px]">
            <span className="text-xs text-muted-foreground">
              This character · colour bit 3
            </span>
            <Segmented
              label="This character's mode"
              size="sm"
              value={mcChar ? 'mc' : 'hires'}
              options={[
                { value: 'hires', label: 'Hires' },
                { value: 'mc', label: 'Multicolour' },
              ]}
              onChange={(v) =>
                change((cs) => setCharMulticolor(cs, selected, v === 'mc'))
              }
            />
          </div>
        )}
        {/* Compact: the pens sit under the grid instead. */}
        {!compact && (
          <PensPanel pens={pens} pen={pen} onPen={tools.choosePen} />
        )}
        {charset.mode === 'bitmap' && (
          <p className="text-[11px] leading-snug text-muted-foreground">
            Multicolour bitmap: each char is a tile with its own three colours.
            Screens can change them cell by cell.
          </p>
        )}
        {charset.mode === 'ecm' && (
          <EcmBackgrounds
            charset={charset}
            target={tools.ecmTarget}
            onTarget={tools.chooseEcmTarget}
          />
        )}
        {!compact && (
          <PaletteGrid
            selected={target ? slotColor(charset, selected, target) : null}
            disabled={!target}
            penName={targetName}
            label={
              !target
                ? 'Colour (pick a pen or background)'
                : limitColors
                  ? 'Char colour · 0–7 in a multicolour set'
                  : `Colour for ${targetName}`
            }
            isAllowed={(c) => !limitColors || c < 8}
            onPick={(color) => {
              if (target)
                change((cs) => setSlotColor(cs, selected, target, color))
            }}
          />
        )}
        <CharPreview charset={charset} index={selected} />
        <CharTracingPanel trace={trace} />
      </div>

      {/* Middle: tool rail, grid, data bytes */}
      <div ref={cell.areaRef} className="flex min-w-0 flex-1 flex-col">
        <div className="flex min-h-0 flex-1 justify-center gap-3">
          <PixelToolRail
            tool={tool}
            onTool={tools.setTool}
            drawLabel="Draw (double-tap a pixel to clear it)"
            onFlipHorizontal={() =>
              change((cs) => flipCharHorizontal(cs, selected))
            }
            onFlipVertical={() =>
              change((cs) => flipCharVertical(cs, selected))
            }
            rotate={{
              label: mcChar ? 'Rotate (hires chars only)' : 'Rotate clockwise',
              disabled: mcChar,
              onRotate: () => change((cs) => rotateCharClockwise(cs, selected)),
            }}
            onShift={(dx, dy) =>
              change((cs) => shiftChar(cs, selected, dx, dy))
            }
            onInvert={() => change((cs) => invertChar(cs, selected))}
            clearLabel="Clear character"
            onClear={() => change((cs) => clearChar(cs, selected))}
            zoom={view.zoom}
            onZoom={() =>
              setView(
                view.zoom > 1
                  ? DEFAULT_VIEW
                  : zoomAround(
                      DEFAULT_VIEW,
                      2,
                      { x: 4 * cell.size, y: 4 * cell.size },
                      8 * cell.size,
                      8 * cell.size,
                    ),
              )
            }
          />

          <div ref={cell.slotRef} className="flex min-h-0 flex-col">
            <div className="flex gap-3">
              <div className="flex flex-col">
                <BitHeader bytes={1} cell={cell.size} view={view} />
                <div className="flex gap-1">
                  <RowNumbers rows={8} first={0} cell={cell.size} view={view} />
                  <div className="h-fit rounded-[2px] border-2 border-grid-frame">
                    {renderGrid(cell.size, view, setView)}
                  </div>
                </div>
              </div>
              {(!compact || showBytes) && (
                <CharDataColumn
                  bytes={bytes}
                  cell={cell.size}
                  asHex={asHex}
                  onToggleHex={() => setAsHex((h) => !h)}
                />
              )}
            </div>
            {compact ? (
              <div className="mt-2">{compactPens}</div>
            ) : (
              <CharMemoryNote index={selected} bytes={bytes} />
            )}
          </div>
        </div>
      </div>

      {/* Right: the whole charset */}
      <CharsetPanel
        charset={charset}
        users={users}
        selected={selected}
        swapping={swapping}
        onSwapping={setSwapping}
        onPick={pick}
        onChange={change}
      />

      {runExport && (
        <RunExportDialog
          title={charset.name}
          runSummary={`Shows all ${charset.mode === 'ecm' ? '256 screen codes (64 shapes on the 4 backgrounds)' : charset.mode === 'bitmap' ? '256 tiles' : '256 characters'} of “${charset.name}” as a 16 × 16 grid, in ${{ ecm: 'ECM', multicolor: 'multicolour', hires: 'hires', bitmap: 'multicolour bitmap' }[charset.mode]} mode with their own colours.`}
          onRun={() =>
            setRunning({
              prg: charsetViewerPrg(charset).prg,
              title: charset.name,
              joystick: false,
            })
          }
          exportPanel={
            <CharsetExportPanel
              project={project}
              charset={charset}
              onClose={() => setRunExport(false)}
            />
          }
          onClose={() => setRunExport(false)}
        />
      )}
      {pad.help && <GamepadHelp onClose={pad.closeHelp} />}
      {running && (
        <EmulatorOverlay
          prg={running.prg}
          title={running.title}
          joystick={running.joystick}
          fileName={`${safeFileName(project.name)}-${safeFileName(charset.name)}.prg`}
          onClose={() => setRunning(null)}
        />
      )}
      {zen && (
        <ZenMode
          title={`Char ${hex(selected)}`}
          columns={8}
          rows={8}
          renderGrid={renderGrid}
          tool={tool}
          onTool={tools.setTool}
          canPan
          side={<ZenPens colors={projectColors(project)} {...pensProps} />}
          onUndo={history.undo}
          onRedo={history.redo}
          canUndo={history.canUndo}
          canRedo={history.canRedo}
          onPrev={() => setSelected((selected + count - 1) % count)}
          onNext={() => setSelected((selected + 1) % count)}
          onExit={() => setZen(false)}
        />
      )}
    </WorksheetLayout>
  )
}
