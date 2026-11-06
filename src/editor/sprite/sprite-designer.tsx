import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from 'react'
import {
  ArrowDown,
  ArrowLeft,
  ArrowRight,
  ArrowUp,
  Contrast,
  Eraser,
  FlipHorizontal2,
  FlipVertical2,
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
  removeSprite,
  setMulticolors,
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
import { cn } from '@/lib/utils'
import { useAssetHistory } from '../asset-history'
import { SpriteGrid } from './sprite-grid'
import { DataColumn } from './data-column'
import { PaletteGrid, PensPanel, spritePens } from './pens-panel'
import { SpritePreview } from './sprite-preview'
import { SpriteStrip } from './sprite-strip'
import { Segmented } from './segmented'
import type { ReactNode } from 'react'
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

const RAIL_W = 40
const RAIL_GAP = 12
const BIT_HEADER_H = 16
const ROW_NUMBERS_W = 28
const MIN_CELL = 12
const MAX_CELL = 34

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
  const sprite =
    set.sprites.find((s) => s.id === selectedId) ?? set.sprites.at(0)
  const [tool, setTool] = useState<Tool>('draw')
  const [penByMode, setPenByMode] = useState<Record<PixelMode, number>>({
    hires: 1,
    multicolor: 2,
  })
  const [asHex, setAsHex] = useState(false)
  const [background, setBackground] = useStoredBackground()
  const cell = useCellSize()
  const strokeId = useRef(0)

  useEffect(() => {
    if (sprite) lastSelected.set(set.id, sprite.id)
  }, [set.id, sprite])

  const select = (id: string) => setSelectedId(id)

  /** Apply a change to the selected sprite. */
  const changeSprite = useCallback(
    (fn: (s: Sprite) => Sprite, group?: string) => {
      if (!sprite) return
      history.change((s) => updateSprite(s, sprite.id, fn), group)
    },
    [history, sprite],
  )

  // Desktop shortcuts.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (
        !(e.ctrlKey || e.metaKey) ||
        e.target instanceof HTMLInputElement ||
        e.target instanceof HTMLTextAreaElement
      )
        return
      const key = e.key.toLowerCase()
      if (key === 'z' && !e.shiftKey) history.undo()
      else if (key === 'y' || (key === 'z' && e.shiftKey)) history.redo()
      else return
      e.preventDefault()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [history])

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
      if (start) changeSprite((s) => fillSprite(s, x, y, value))
      return
    }
    changeSprite((s) => setSpritePixel(s, x, y, value), group)
  }

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
            { label: 'My Projects', link: { to: '/projects' } },
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
      className="flex gap-6 px-5 py-3"
    >
      {/* Left: sprite details, pens, palette, preview */}
      <div className="flex w-[264px] shrink-0 flex-col gap-2.5 overflow-y-auto">
        <div className="flex gap-2">
          <Field label="Sprite name" className="flex-1">
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
          sprite={sprite}
          background={background}
          onBackground={setBackground}
          onToggleExpand={(axis) =>
            changeSprite((s) => ({ ...s, [axis]: !s[axis] }))
          }
        />
        <Field label="Notes" className="min-h-[72px] flex-1">
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

      {/* Centre: tool rail, grid, sprites in set */}
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
            <div aria-hidden="true" className="mx-1.5 my-1 h-px bg-rule-soft" />
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
                  onSelect={() => changeSprite((s) => shiftSprite(s, 0, -1))}
                >
                  <ArrowUp aria-hidden="true" /> Shift up
                </DropdownMenuItem>
                <DropdownMenuItem
                  onSelect={() => changeSprite((s) => shiftSprite(s, 0, 1))}
                >
                  <ArrowDown aria-hidden="true" /> Shift down
                </DropdownMenuItem>
                <DropdownMenuItem
                  onSelect={() => changeSprite((s) => shiftSprite(s, -1, 0))}
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
          </div>

          <div className="flex min-h-0 flex-col">
            <BitHeader cell={cell.size} />
            <div ref={cell.slotRef} className="flex min-h-0 flex-1 gap-1">
              <RowNumbers cell={cell.size} />
              <div className="h-fit rounded-[2px] border-2 border-[#77756f]">
                <SpriteGrid
                  set={set}
                  sprite={sprite}
                  cell={cell.size}
                  background={background}
                  onStrokeStart={(x, y) => {
                    strokeId.current++
                    paint(x, y, true)
                  }}
                  onStrokeMove={(x, y) => paint(x, y, false)}
                  onStrokeEnd={history.endGroup}
                  onStrokeCancel={() => {
                    history.endGroup()
                    history.undo()
                  }}
                />
              </div>
            </div>
          </div>
        </div>

        <div className="mt-2 shrink-0">
          <SpriteStrip
            project={project}
            set={set}
            selectedId={sprite.id}
            actions={{
              select,
              add: () => {
                const created = createSprite({
                  name: `Sprite ${set.sprites.length}`,
                  mode: sprite.mode,
                })
                history.change((s) => addSprite(s, created))
                select(created.id)
              },
              duplicate: () => {
                history.change((s) => duplicateSprite(s, sprite.id))
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
                const from = set.sprites.indexOf(sprite)
                history.change((s) => moveSprite(s, from, from + delta))
              },
              remove:
                set.sprites.length > 1
                  ? () => {
                      const i = set.sprites.indexOf(sprite)
                      const next = set.sprites[i + 1] ?? set.sprites[i - 1]
                      history.change((s) => removeSprite(s, sprite.id))
                      select(next.id)
                    }
                  : null,
            }}
          />
        </div>
      </div>

      {/* Right: data bytes aligned to the grid rows */}
      <div className="flex w-[168px] shrink-0 flex-col">
        <div
          aria-hidden="true"
          className="flex items-end gap-2 font-mono text-[9px] leading-[14px] text-muted-foreground"
          style={{ height: BIT_HEADER_H }}
        >
          {['byte 0', 'byte 1', 'byte 2'].map((b) => (
            <div key={b} className="flex-1 text-center">
              {b}
            </div>
          ))}
        </div>
        <DataColumn sprite={sprite} cell={cell.size} asHex={asHex} />
        <div className="mt-2.5 flex items-center justify-between">
          <span className="text-xs text-muted-foreground">Data</span>
          <div className="w-[104px]">
            <Segmented
              label="Number format"
              size="sm"
              value={asHex ? 'hex' : 'dec'}
              options={[
                { value: 'dec', label: 'Dec' },
                { value: 'hex', label: 'Hex' },
              ]}
              onChange={(v) => setAsHex(v === 'hex')}
            />
          </div>
        </div>
        <p className="mt-2 text-[11px] leading-snug text-muted-foreground">
          63 bytes + 1 pad = 64 per sprite. Pointer = address ÷ 64.
        </p>
      </div>
    </WorksheetLayout>
  )
}

function ToolButton({
  label,
  pressed,
  disabled,
  onClick,
  children,
  ...rest
}: {
  label: string
  pressed?: boolean
  disabled?: boolean
  onClick?: () => void
  children: ReactNode
}) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      aria-pressed={pressed}
      disabled={disabled}
      onClick={onClick}
      className={cn(
        'flex size-10 shrink-0 items-center justify-center rounded-lg border disabled:opacity-40 [&_svg]:size-[21px] [&_svg]:stroke-[1.7]',
        pressed
          ? 'border-primary bg-primary text-primary-foreground'
          : 'border-rule-soft bg-paper hover:bg-muted',
      )}
      {...rest}
    >
      {children}
    </button>
  )
}

function BitHeader({ cell }: { cell: number }) {
  const weights = [128, 64, 32, 16, 8, 4, 2, 1]
  return (
    <div
      aria-hidden="true"
      className="flex shrink-0 items-end font-mono leading-[14px] text-muted-foreground"
      style={{
        height: BIT_HEADER_H,
        paddingLeft: ROW_NUMBERS_W + 2,
        fontSize: cell < 22 ? 8 : 9,
      }}
    >
      {[0, 1, 2].flatMap((b) =>
        weights.map((w) => (
          <div
            key={`${b}-${w}`}
            className="text-center"
            style={{ width: cell }}
          >
            {w}
          </div>
        )),
      )}
    </div>
  )
}

function RowNumbers({ cell }: { cell: number }) {
  return (
    <div
      aria-hidden="true"
      className="flex shrink-0 flex-col pt-[2px]"
      style={{ width: ROW_NUMBERS_W - 4 }}
    >
      {Array.from({ length: 21 }, (_, i) => (
        <div
          key={i}
          className="flex items-center justify-end font-mono text-[10px] text-muted-foreground"
          style={{ height: cell }}
        >
          {i + 1}
        </div>
      ))}
    </div>
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

/** Cell size that fits the grid into the space left for it (measured). */
function useCellSize() {
  const [size, setSize] = useState(22)
  const [slot, setSlot] = useState<HTMLDivElement | null>(null)
  const [area, setArea] = useState<HTMLDivElement | null>(null)
  useLayoutEffect(() => {
    if (!slot || !area) return
    const measure = () => {
      const h = slot.clientHeight - 4
      const w = area.clientWidth - RAIL_W - RAIL_GAP - ROW_NUMBERS_W - 8
      setSize(
        Math.max(
          MIN_CELL,
          Math.min(MAX_CELL, Math.floor(Math.min(h / 21, w / 24))),
        ),
      )
    }
    measure()
    const ro = new ResizeObserver(measure)
    ro.observe(slot)
    ro.observe(area)
    return () => ro.disconnect()
  }, [slot, area])
  return { size, slotRef: setSlot, areaRef: setArea }
}
