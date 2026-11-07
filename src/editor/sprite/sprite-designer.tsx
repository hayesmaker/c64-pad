import { useCallback, useEffect, useRef, useState } from 'react'
import {
  ArrowDown,
  ArrowLeft,
  ArrowRight,
  ArrowUp,
  Contrast,
  Eraser,
  FlipHorizontal2,
  FlipVertical2,
  Maximize2,
  MonitorPlay,
  Move,
  PaintBucket,
  Pencil,
  Redo2,
  Trash2,
  Undo2,
} from 'lucide-react'
import {
  clearSprite,
  createSprite,
  fillSprite,
  flipSpriteHorizontal,
  flipSpriteVertical,
  invertSprite,
  setSpriteColor,
  setSpriteMode,
  setSpritePixel,
  shiftSprite,
} from '@/c64/sprite'
import {
  addSprite,
  duplicateSprite,
  moveSprite,
  findSprite,
  removeSprite,
  setMulticolors,
  addOverlaySprite,
  setOverlay,
  updateSprite,
} from '@/c64/sprite-set'
import { WorksheetLayout } from '@/components/worksheet/worksheet-layout'
import { Breadcrumbs } from '@/components/worksheet/breadcrumbs'
import { EdgeTabs } from '@/components/worksheet/edge-tabs'
import { editorTabs } from '@/components/worksheet/editor-tabs'
import { Field } from '@/components/worksheet/field'
import { SaveStatus } from '@/components/save-status'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { ModelError } from '@/c64/errors'
import { useAssetHistory } from '../asset-history'
import { AnimationControls, useAnimationFrame } from './animation'
import { RunExportSpritesDialog } from './export-dialog'
import { EmulatorOverlay } from '@/emulator/emulator-overlay'
import { buildViewerPrg, spriteSetShowcase } from '@/emulator/sprite-viewer'
import { safeFileName } from '@/platform/save-file'
import { DEFAULT_VIEW, zoomAround } from '../view'
import {
  BIT_HEADER_H,
  BitHeader,
  RowNumbers,
  ToolButton,
  useCellSize,
  useUndoShortcuts,
  zoomLabel,
} from '../grid-parts'
import type { GridView } from '../view'
import { SpriteGrid } from './sprite-grid'
import { ZenMode, ZenPens } from '../zen-mode'
import { projectColors } from '@/c64/project'
import { DataColumn } from './data-column'
import { PaletteGrid, PensPanel } from '../pens-panel'
import { spritePens } from './sprite-pens'
import { SpritePreview } from './sprite-preview'
import { SpriteStrip } from './sprite-strip'
import { Segmented } from '../segmented'
import type { PixelMode } from '@/c64/bitmap'
import type { C64Color } from '@/c64/palette'
import type { Project } from '@/c64/project'
import type { Sprite } from '@/c64/sprite'
import type { SpriteSet } from '@/c64/sprite-set'
import type { ProjectSession, SaveStatus as Status } from '@/storage/session'

type Tool = 'draw' | 'erase' | 'fill'

/** Pixels copied with "Copy pixels", kept for the app session. */
let clipboard: Pick<Sprite, 'data' | 'mode'> | null = null
/** Last selected sprite per set, so returning to a set keeps your place. */
const lastSelected = new Map<string, string>()

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
  const sprite = selected
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
  const [tool, setTool] = useState<Tool>('draw')
  const [penByMode, setPenByMode] = useState<Record<PixelMode, number>>({
    hires: 1,
    multicolor: 2,
  })
  const [asHex, setAsHex] = useState(false)
  const [background, setBackground] = useStoredBackground()
  const cell = useCellSize({ columns: 24, rows: 21, min: 12, max: 34 })
  const [view, setView] = useState<GridView>(DEFAULT_VIEW)
  // A new cell size changes the frame; start again at 1×.
  useEffect(() => setView(DEFAULT_VIEW), [cell.size])
  const strokeId = useRef(0)
  /** The sprite before the last stroke, to tell whether a tap changed it. */
  const beforeStroke = useRef<Sprite | null>(null)

  useEffect(() => {
    if (selected) lastSelected.set(set.id, selected.id)
  }, [set.id, selected])

  const select = (id: string) => setSelectedId(id)

  /** Apply a change to the selected sprite. */
  const changeSprite = useCallback(
    (fn: (s: Sprite) => Sprite, group?: string) => {
      if (!sprite) return
      history.change((s) => updateSprite(s, sprite.id, fn), group)
    },
    [history, sprite],
  )

  useUndoShortcuts(history)

  if (!sprite) {
    return null // a set always has at least one sprite; see removeSprite guard below
  }

  const pens = spritePens(set, sprite)
  const pen = Math.min(penByMode[sprite.mode], pens.length - 1)
  const penDef = pens[pen]
  const value = tool === 'erase' ? 0 : pen

  const paint = (x: number, y: number, start: boolean) => {
    const group = `stroke-${strokeId.current}`
    if (tool === 'fill') {
      if (start) changeSprite((s) => fillSprite(s, x, y, value), group)
      return
    }
    changeSprite((s) => setSpritePixel(s, x, y, value), group)
  }

  const renderGrid = (
    size: number,
    v: GridView,
    onV: (next: GridView) => void,
  ) => (
    <SpriteGrid
      set={set}
      sprite={sprite}
      layers={{ base: pairBase ?? selected, overlay: pairOverlay }}
      cell={size}
      background={background}
      view={v}
      onViewChange={onV}
      onStrokeStart={(x, y) => {
        strokeId.current++
        beforeStroke.current = sprite
        paint(x, y, true)
      }}
      onDoubleTap={(x, y) => {
        if (tool !== 'draw') return
        // Clear the pixel, as one undo step with the first tap.
        if (beforeStroke.current !== sprite) history.undo()
        changeSprite((s) => setSpritePixel(s, x, y, 0))
      }}
      onStrokeMove={(x, y) => paint(x, y, false)}
      onStrokeEnd={history.endGroup}
      onStrokeCancel={history.cancelGroup}
    />
  )

  const setPenColor = (color: number) => {
    if (!penDef.slot) return
    if (penDef.slot === 'color') changeSprite((s) => setSpriteColor(s, color))
    else history.change((s) => setMulticolors(s, { [penDef.slot!]: color }))
  }

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
      tabs={<EdgeTabs tabs={editorTabs(project, 'sprites')} />}
      className="flex gap-4 px-4 py-3"
    >
      {/* Left: sprite details, pens, palette, preview */}
      <div className="-mx-1 flex w-[248px] shrink-0 flex-col gap-2 overflow-y-auto px-1 py-0.5">
        <div className="flex gap-2">
          <Field
            label={
              pairOverlay
                ? `Sprite name · ${selected.id === pairOverlay.id ? 'front' : 'back'} layer`
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
              value={String(set.sprites.indexOf(sprite))}
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
        <PensPanel
          pens={pens}
          pen={pen}
          onPen={(v) => {
            setPenByMode((p) => ({ ...p, [sprite.mode]: v }))
            if (tool === 'erase') setTool('draw')
          }}
        />
        <PaletteGrid
          selected={penDef.color}
          disabled={!penDef.slot}
          penName={penDef.name.split(' · ')[0].toLowerCase()}
          onPick={setPenColor}
        />
        <SpritePreview
          set={set}
          sprite={(frameId && findSprite(set, frameId)) || pairBase || selected}
          background={background}
          onBackground={setBackground}
          onToggleExpand={(axis) =>
            history.change((s) =>
              updateSprite(s, selected.id, (x) => ({ ...x, [axis]: !x[axis] })),
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
      </div>

      {/* Main: tool rail + grid + data bytes, sprites strip below */}
      <div className="flex min-w-0 flex-1 flex-col">
        <div className="flex min-h-0 flex-1 gap-4">
          <div ref={cell.areaRef} className="flex min-w-0 flex-1 flex-col">
            <div className="flex min-h-0 flex-1 justify-center gap-3">
              <div
                role="toolbar"
                aria-label="Drawing tools"
                aria-orientation="vertical"
                className="flex shrink-0 flex-col gap-1"
                style={{ paddingTop: BIT_HEADER_H + 2 }}
              >
                <ToolButton
                  label="Draw"
                  pressed={tool === 'draw'}
                  onClick={() => setTool('draw')}
                >
                  <Pencil />
                </ToolButton>
                <ToolButton
                  label="Erase"
                  pressed={tool === 'erase'}
                  onClick={() => setTool('erase')}
                >
                  <Eraser />
                </ToolButton>
                <ToolButton
                  label="Fill"
                  pressed={tool === 'fill'}
                  onClick={() => setTool('fill')}
                >
                  <PaintBucket />
                </ToolButton>
                <div
                  aria-hidden="true"
                  className="mx-1.5 my-1 h-px bg-rule-soft"
                />
                <ToolButton
                  label="Flip horizontally"
                  onClick={() => changeSprite(flipSpriteHorizontal)}
                >
                  <FlipHorizontal2 />
                </ToolButton>
                <ToolButton
                  label="Flip vertically"
                  onClick={() => changeSprite(flipSpriteVertical)}
                >
                  <FlipVertical2 />
                </ToolButton>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <ToolButton label="Shift (wraps around)">
                      <Move />
                    </ToolButton>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent side="right" align="start">
                    <DropdownMenuItem
                      onSelect={() =>
                        changeSprite((s) => shiftSprite(s, 0, -1))
                      }
                    >
                      <ArrowUp aria-hidden="true" /> Shift up
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      onSelect={() => changeSprite((s) => shiftSprite(s, 0, 1))}
                    >
                      <ArrowDown aria-hidden="true" /> Shift down
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      onSelect={() =>
                        changeSprite((s) => shiftSprite(s, -1, 0))
                      }
                    >
                      <ArrowLeft aria-hidden="true" /> Shift left
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      onSelect={() => changeSprite((s) => shiftSprite(s, 1, 0))}
                    >
                      <ArrowRight aria-hidden="true" /> Shift right
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
                <ToolButton
                  label="Invert"
                  onClick={() => changeSprite(invertSprite)}
                >
                  <Contrast />
                </ToolButton>
                <ToolButton
                  label="Clear sprite"
                  onClick={() => changeSprite(clearSprite)}
                >
                  <Trash2 />
                </ToolButton>
                <div
                  aria-hidden="true"
                  className="mx-1.5 my-1 h-px bg-rule-soft"
                />
                <ToolButton
                  label={
                    view.zoom > 1
                      ? 'Reset zoom (pinch to zoom)'
                      : 'Zoom in (or pinch)'
                  }
                  pressed={view.zoom > 1}
                  onClick={() =>
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
                >
                  <span className="font-mono text-[11px] font-medium">
                    {zoomLabel(view.zoom)}
                  </span>
                </ToolButton>
              </div>

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
          {/* Tap anywhere on the bytes to switch decimal / hex. */}
          <button
            type="button"
            onClick={() => setAsHex((h) => !h)}
            aria-label={`Sprite data bytes in ${asHex ? 'hex' : 'decimal'}; tap to show ${asHex ? 'decimal' : 'hex'}`}
            title="Tap to switch decimal / hex. 63 bytes + 1 pad = 64 per sprite; sprite pointer = address ÷ 64."
            className="flex w-[152px] shrink-0 cursor-pointer flex-col self-start rounded-md text-left"
          >
            <div
              className="flex w-full items-end gap-2 font-mono text-[9px] leading-[14px] text-muted-foreground"
              style={{ height: BIT_HEADER_H }}
            >
              {['byte 0', 'byte 1', 'byte 2'].map((b) => (
                <div key={b} className="flex-1 text-center">
                  {b}
                </div>
              ))}
            </div>
            <DataColumn sprite={sprite} cell={cell.size} asHex={asHex} />
          </button>
        </div>

        <div className="mt-2 shrink-0">
          <SpriteStrip
            project={project}
            set={set}
            selectedId={selected.id}
            actions={{
              select,
              add: () => {
                const created = createSprite({
                  name: `Sprite ${set.sprites.length}`,
                  mode: selected.mode,
                })
                history.change((s) => addSprite(s, created))
                select(created.id)
              },
              duplicate: () => {
                history.change((s) => duplicateSprite(s, selected.id))
              },
              copy: () => {
                clipboard = { data: sprite.data.slice(), mode: sprite.mode }
              },
              paste: clipboard
                ? () => {
                    const c = clipboard!
                    changeSprite((s) => ({
                      ...s,
                      data: c.data.slice(),
                      mode: c.mode,
                    }))
                  }
                : null,
              move: (delta) => {
                const from = set.sprites.indexOf(selected)
                history.change((s) => moveSprite(s, from, from + delta))
              },
              remove:
                set.sprites.length > 1
                  ? () => {
                      const i = set.sprites.indexOf(selected)
                      const next = set.sprites[i + 1] ?? set.sprites[i - 1]
                      history.change((s) => removeSprite(s, selected.id))
                      select(next.id)
                    }
                  : null,
              setOverlay: (overlayId) => {
                try {
                  history.change((s) => setOverlay(s, selected.id, overlayId))
                  if (overlayId) select(overlayId)
                } catch (e) {
                  if (!(e instanceof ModelError)) throw e
                }
              },
              addOverlay: () => {
                let created = ''
                history.change((s) => {
                  const r = addOverlaySprite(s, selected.id)
                  created = r.overlayId
                  return r.set
                })
                if (created) select(created)
              },
              unlinkOverlay: pairBase
                ? () => history.change((s) => setOverlay(s, pairBase.id, null))
                : null,
            }}
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
          currentIndex={set.sprites.indexOf(selected)}
          background={background}
          runSummary={
            animation
              ? `Plays “${animation.name}” large in the middle, with the other sprites of ${set.name} along the bottom.`
              : `Shows sprite ${set.sprites.indexOf(pairBase ?? selected)} large in the middle${pairOverlay ? ` with sprite ${set.sprites.indexOf(pairOverlay)} over it` : ''}, and the other sprites of ${set.name} along the bottom.`
          }
          onRun={() => {
            const prg = buildViewerPrg(
              spriteSetShowcase(set, {
                selectedId: (pairBase ?? selected).id,
                animationId: animation?.id ?? null,
                background: background ?? 6,
              }),
            )
            setRunning({
              prg,
              title: `${set.name}${animation ? ` · ${animation.name}` : ` · sprite ${set.sprites.indexOf(pairBase ?? selected)}`}`,
            })
          }}
          onClose={() => setExporting(false)}
        />
      )}
      {zen && (
        <ZenMode
          title={`Sprite ${set.sprites.indexOf(sprite)}`}
          columns={24}
          rows={21}
          renderGrid={renderGrid}
          tool={tool}
          onTool={setTool}
          side={
            <ZenPens
              pens={pens}
              pen={pen}
              onPen={(v) => {
                setPenByMode((p) => ({ ...p, [sprite.mode]: v }))
                if (tool === 'erase') setTool('draw')
              }}
              colors={projectColors(project)}
              penColor={penDef.slot ? penDef.color : null}
              onRecolor={setPenColor}
            />
          }
          onUndo={history.undo}
          onRedo={history.redo}
          canUndo={history.canUndo}
          canRedo={history.canRedo}
          onPrev={() => {
            const i = set.sprites.indexOf(selected)
            select(
              set.sprites[(i + set.sprites.length - 1) % set.sprites.length].id,
            )
          }}
          onNext={() => {
            const i = set.sprites.indexOf(selected)
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

const BG_KEY = 'c64pad:sprite-background'

/** Grid/preview background, remembered on this device. */
function useStoredBackground() {
  const [bg, setBg] = useState<C64Color | null>(() => {
    try {
      const v = localStorage.getItem(BG_KEY)
      return v === null || v === 'paper' ? null : Number(v)
    } catch {
      return null
    }
  })
  const set = (color: C64Color | null) => {
    setBg(color)
    try {
      localStorage.setItem(BG_KEY, color === null ? 'paper' : String(color))
    } catch {
      // storage unavailable: keep for this session only
    }
  }
  return [bg, set] as const
}
