import { useEffect, useState } from 'react'
import { Maximize2, MonitorPlay, Redo2, Undo2 } from 'lucide-react'
import {
  clearSprite,
  flipSpriteHorizontal,
  flipSpriteVertical,
  invertSprite,
  setSpriteMode,
  shiftSprite,
} from '@/c64/sprite'
import { findSprite, updateSprite } from '@/c64/sprite-set'
import { projectColors } from '@/c64/project'
import { WorksheetLayout } from '@/components/worksheet/worksheet-layout'
import { Breadcrumbs } from '@/components/worksheet/breadcrumbs'
import { EdgeTabs } from '@/components/worksheet/edge-tabs'
import { editorTabs } from '@/components/worksheet/editor-tabs'
import { Field } from '@/components/worksheet/field'
import { SaveStatus } from '@/components/save-status'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { EmulatorOverlay } from '@/emulator/emulator-overlay'
import { buildViewerPrg, spriteSetShowcase } from '@/emulator/sprite-viewer'
import { safeFileName } from '@/platform/save-file'
import { useAssetHistory } from '../asset-history'
import { DEFAULT_VIEW, zoomAround } from '../view'
import {
  BitHeader,
  RowNumbers,
  ToolButton,
  useCellSize,
  useUndoShortcuts,
} from '../grid-parts'
import { PaletteGrid, PensPanel } from '../pens-panel'
import { PixelToolRail } from '../pixel-tool-rail'
import { Segmented } from '../segmented'
import { ZenMode, ZenPens } from '../zen-mode'
import { TracingPanel } from '../tracing/tracing-panel'
import { TracingButtons } from '../tracing/tracing-buttons'
import { useGridTracing } from '../tracing/use-tracing'
import { AnimationControls, useAnimationFrame } from './animation'
import { SpriteDataPanel } from './data-column'
import { RunExportSpritesDialog } from './export-dialog'
import { spriteStripActions } from './sprite-actions'
import { SpriteGrid } from './sprite-grid'
import { SpritePreview } from './sprite-preview'
import { SpriteStrip } from './sprite-strip'
import { useSpriteTools } from './use-sprite-tools'
import { useStoredBackground } from './use-stored-background'
import type { GridView } from '../view'
import type { Project } from '@/c64/project'
import type { SpriteSet } from '@/c64/sprite-set'
import type { ProjectSession, SaveStatus as Status } from '@/storage/session'

/** Tracing paper covers the sprite: 24 × 21 C64 pixels. */
const SPRITE_TARGET = { width: 24, height: 21 }

/** Last selected sprite per set, so returning to a set keeps your place. */
const lastSelected = new Map<string, string>()

/** The Sprite Worksheet: one sprite of a set at a time. */
export function SpriteDesigner({
  session,
  project,
  set,
  status,
  error,
}: {
  session: ProjectSession
  project: Project
  set: SpriteSet
  status: Status
  error: string | null
}) {
  const history = useAssetHistory(session, 'spriteSets', set.id, set)
  const [selectedId, setSelectedId] = useState(
    () => lastSelected.get(set.id) ?? set.sprites.at(0)?.id ?? '',
  )
  const selected =
    set.sprites.find((s) => s.id === selectedId) ?? set.sprites.at(0)
  /**
   * When the selected sprite is half of an overlay pair: the back sprite (the
   * base) and the front one (its overlay, drawn on top). The selected sprite
   * is always the one being edited; the other is shown faded.
   */
  const pairBase = selected
    ? selected.overlayId
      ? selected
      : (set.sprites.find((s) => s.overlayId === selected.id) ?? null)
    : null
  const pairOverlay = pairBase?.overlayId
    ? (findSprite(set, pairBase.overlayId) ?? null)
    : null
  const [animationId, setAnimationId] = useState<string | null>(null)
  const [playing, setPlaying] = useState(false)
  const [exporting, setExporting] = useState(false)
  const [zen, setZen] = useState(false)
  const [running, setRunning] = useState<{
    prg: Uint8Array
    title: string
  } | null>(null)
  const animation = set.animations.find((a) => a.id === animationId)
  const frameId = useAnimationFrame(animation, playing)
  const tools = useSpriteTools(set, selected, history)
  const { tool, pens, pen, changeSprite } = tools
  const [asHex, setAsHex] = useState(false)
  const [background, setBackground] = useStoredBackground()
  const cell = useCellSize({ columns: 24, rows: 21, min: 12, max: 34 })
  const [view, setView] = useState<GridView>(DEFAULT_VIEW)
  // A new cell size changes the frame; start again at 1×.
  useEffect(() => setView(DEFAULT_VIEW), [cell.size])
  const [tracingOpen, setTracingOpen] = useState(false)
  const trace = useGridTracing(selected?.id ?? '', SPRITE_TARGET)

  useEffect(() => {
    if (selected) lastSelected.set(set.id, selected.id)
  }, [set.id, selected])

  useUndoShortcuts(history)

  if (!selected || !tools.penDef) {
    return null // a set always has at least one sprite (removeSprite keeps one)
  }
  const sprite = selected
  const penDef = tools.penDef
  const select = (id: string) => setSelectedId(id)
  const indexOf = (id: string) => set.sprites.findIndex((s) => s.id === id)

  const renderGrid = (
    size: number,
    v: GridView,
    onV: (next: GridView) => void,
  ) => (
    <SpriteGrid
      set={set}
      sprite={sprite}
      layers={{ base: pairBase ?? sprite, overlay: pairOverlay }}
      cell={size}
      background={background}
      view={v}
      onViewChange={onV}
      tracing={trace.grid}
      {...tools.gridHandlers}
    />
  )

  return (
    <WorksheetLayout
      fitScreen
      title="Sprite Worksheet"
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
            { label: set.name },
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
            label="Zen mode: just the grid"
            onClick={() => setZen(true)}
          >
            <Maximize2 />
          </ToolButton>
          <ToolButton label="Run & export" onClick={() => setExporting(true)}>
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
      tabs={<EdgeTabs tabs={editorTabs(project, 'sprites', set.id)} />}
      className="flex gap-4 px-4 py-3"
    >
      {/* Left: sprite details, pens, palette, preview */}
      <div className="-mx-1 flex w-[248px] shrink-0 flex-col gap-2 overflow-y-auto px-1 py-0.5">
        {tracingOpen ? (
          <TracingPanel
            tracing={trace.tracing}
            error={trace.error}
            target={SPRITE_TARGET}
            targetLabel={'sprite: 24 × 21 px'}
            onLoad={(file) => void trace.load(file)}
            onRemove={() => void trace.remove()}
            onChange={trace.update}
            onDone={() => setTracingOpen(false)}
          />
        ) : (
          <>
            <div className="flex gap-2">
              <Field
                label={
                  pairOverlay
                    ? `Sprite name · ${sprite.id === pairOverlay.id ? 'front' : 'back'} layer`
                    : 'Sprite name'
                }
                className="flex-1"
              >
                <Input
                  value={sprite.name}
                  onChange={(e) =>
                    changeSprite(
                      (s) => ({ ...s, name: e.target.value }),
                      `name-${sprite.id}`,
                    )
                  }
                  onBlur={history.endGroup}
                />
              </Field>
              <Field label="Number" className="w-16">
                <Input
                  value={String(indexOf(sprite.id))}
                  readOnly
                  className="font-mono"
                />
              </Field>
            </div>
            <Segmented
              label="Sprite mode"
              value={sprite.mode}
              options={[
                { value: 'hires', label: 'Single colour' },
                { value: 'multicolor', label: 'Multi-colour' },
              ]}
              onChange={(mode) => changeSprite((s) => setSpriteMode(s, mode))}
            />
            <PensPanel pens={pens} pen={pen} onPen={tools.choosePen} />
            <PaletteGrid
              selected={penDef.color}
              disabled={!penDef.slot}
              penName={penDef.name.split(' · ')[0].toLowerCase()}
              onPick={tools.setPenColor}
            />
            <SpritePreview
              set={set}
              sprite={
                (frameId && findSprite(set, frameId)) || pairBase || sprite
              }
              background={background}
              onBackground={setBackground}
              onToggleExpand={(axis) =>
                history.change((s) =>
                  updateSprite(s, sprite.id, (x) => ({
                    ...x,
                    [axis]: !x[axis],
                  })),
                )
              }
            />
            <Field label="Notes" className="min-h-[56px] flex-1">
              <Textarea
                value={sprite.notes}
                onChange={(e) =>
                  changeSprite(
                    (s) => ({ ...s, notes: e.target.value }),
                    `notes-${sprite.id}`,
                  )
                }
                onBlur={history.endGroup}
                className="min-h-0 flex-1 resize-none bg-paper text-sm"
              />
            </Field>
          </>
        )}
      </div>

      {/* Main: tool rail + grid + data bytes, sprites strip below */}
      <div className="flex min-w-0 flex-1 flex-col">
        <div className="flex min-h-0 flex-1 gap-4">
          <div ref={cell.areaRef} className="flex min-w-0 flex-1 flex-col">
            <div className="flex min-h-0 flex-1 justify-center gap-3">
              <PixelToolRail
                tool={tool}
                onTool={tools.setTool}
                onFlipHorizontal={() => changeSprite(flipSpriteHorizontal)}
                onFlipVertical={() => changeSprite(flipSpriteVertical)}
                onShift={(dx, dy) =>
                  changeSprite((s) => shiftSprite(s, dx, dy))
                }
                onInvert={() => changeSprite(invertSprite)}
                clearLabel="Clear sprite"
                onClear={() => changeSprite(clearSprite)}
                zoom={view.zoom}
                onZoom={() =>
                  setView(
                    view.zoom > 1
                      ? DEFAULT_VIEW
                      : zoomAround(
                          DEFAULT_VIEW,
                          2,
                          {
                            x: (24 * cell.size) / 2,
                            y: (21 * cell.size) / 2,
                          },
                          24 * cell.size,
                          21 * cell.size,
                        ),
                  )
                }
              />

              <div className="flex min-h-0 flex-col">
                <BitHeader bytes={3} cell={cell.size} view={view} />
                <div ref={cell.slotRef} className="flex min-h-0 flex-1 gap-1">
                  <RowNumbers
                    rows={21}
                    first={1}
                    cell={cell.size}
                    view={view}
                  />
                  <div className="h-fit rounded-[2px] border-2 border-grid-frame">
                    {renderGrid(cell.size, view, setView)}
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Data bytes aligned to the grid rows */}
          <SpriteDataPanel
            sprite={sprite}
            cell={cell.size}
            asHex={asHex}
            onToggleHex={() => setAsHex((h) => !h)}
          />
        </div>

        <div className="mt-2 shrink-0">
          <SpriteStrip
            project={project}
            set={set}
            selectedId={sprite.id}
            actions={spriteStripActions({
              set,
              selected: sprite,
              pairBase,
              history,
              select,
              changeSprite,
            })}
          >
            <AnimationControls
              set={set}
              animationId={animation?.id ?? null}
              onAnimationId={setAnimationId}
              playing={playing && !!animation}
              onPlaying={setPlaying}
              onChange={history.change}
              background={background}
            />
          </SpriteStrip>
        </div>
      </div>
      {exporting && (
        <RunExportSpritesDialog
          project={project}
          set={set}
          currentIndex={indexOf(sprite.id)}
          background={background}
          runSummary={
            animation
              ? `Plays “${animation.name}” large in the middle, with the other sprites of ${set.name} along the bottom.`
              : `Shows sprite ${indexOf((pairBase ?? sprite).id)} large in the middle${pairOverlay ? ` with sprite ${indexOf(pairOverlay.id)} over it` : ''}, and the other sprites of ${set.name} along the bottom.`
          }
          onRun={() => {
            const prg = buildViewerPrg(
              spriteSetShowcase(set, {
                selectedId: (pairBase ?? sprite).id,
                animationId: animation?.id ?? null,
                background: background ?? 6,
              }),
            )
            setRunning({
              prg,
              title: `${set.name}${animation ? ` · ${animation.name}` : ` · sprite ${indexOf((pairBase ?? sprite).id)}`}`,
            })
          }}
          onClose={() => setExporting(false)}
        />
      )}
      {zen && (
        <ZenMode
          title={`Sprite ${indexOf(sprite.id)}`}
          columns={24}
          rows={21}
          renderGrid={renderGrid}
          tool={tool}
          // No Hand tool here (canPan is off).
          onTool={(t) => t !== 'pan' && tools.setTool(t)}
          side={
            <ZenPens
              pens={pens}
              pen={pen}
              onPen={tools.choosePen}
              colors={projectColors(project)}
              penColor={penDef.slot ? penDef.color : null}
              onRecolor={tools.setPenColor}
            />
          }
          onUndo={history.undo}
          onRedo={history.redo}
          canUndo={history.canUndo}
          canRedo={history.canRedo}
          onPrev={() => {
            const i = indexOf(sprite.id)
            select(
              set.sprites[(i + set.sprites.length - 1) % set.sprites.length].id,
            )
          }}
          onNext={() => {
            const i = indexOf(sprite.id)
            select(set.sprites[(i + 1) % set.sprites.length].id)
          }}
          onExit={() => setZen(false)}
        />
      )}
      {running && (
        <EmulatorOverlay
          prg={running.prg}
          title={running.title}
          fileName={`${safeFileName(project.name)}-${safeFileName(set.name)}.prg`}
          onClose={() => setRunning(null)}
        />
      )}
    </WorksheetLayout>
  )
}
