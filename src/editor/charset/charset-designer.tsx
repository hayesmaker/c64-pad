import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  ArrowDown,
  ArrowLeft,
  ArrowLeftRight,
  ArrowRight,
  ArrowUp,
  ClipboardPaste,
  Contrast,
  Copy,
  Ellipsis,
  Eraser,
  FlipHorizontal2,
  FlipVertical2,
  Move,
  PaintBucket,
  Maximize2,
  Pencil,
  Redo2,
  RotateCw,
  Trash2,
  Undo2,
} from 'lucide-react'
import {
  CHARSET_BYTES,
  charCount,
  charPixelMode,
  clearChar,
  flipCharHorizontal,
  flipCharVertical,
  getCharBytes,
  getCharPixel,
  invertChar,
  isCharMulticolor,
  petsciiData,
  renderChar,
  rotateCharClockwise,
  setCharBytes,
  setCharMulticolor,
  setCharPixel,
  setCharsetMode,
  shiftChar,
  swapChars,
} from '@/c64/charset'
import { CHAR_SHAPE, floodFill } from '@/c64/bitmap'
import { PALETTE } from '@/c64/palette'
import { mapsUsingCharset, projectColors } from '@/c64/project'
import { WorksheetLayout } from '@/components/worksheet/worksheet-layout'
import { Breadcrumbs } from '@/components/worksheet/breadcrumbs'
import { EdgeTabs } from '@/components/worksheet/edge-tabs'
import { editorTabs } from '@/components/worksheet/editor-tabs'
import { Field } from '@/components/worksheet/field'
import { SaveStatus } from '@/components/save-status'
import { IndexedCanvas } from '@/components/c64/indexed-canvas'
import { ConfirmDialog } from '@/components/dialogs'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { cn } from '@/lib/utils'
import { useAssetHistory } from '../asset-history'
import { DEFAULT_VIEW, zoomAround } from '../view'
import {
  BIT_HEADER_H,
  BitHeader,
  ROW_NUMBERS_W,
  RowNumbers,
  ToolButton,
  useCellSize,
  useUndoShortcuts,
  zoomLabel,
} from '../grid-parts'
import { PixelGrid } from '../pixel-grid'
import { PaletteGrid, PensPanel } from '../pens-panel'
import { Segmented } from '../segmented'
import {
  charPens,
  ecmBackgroundColors,
  ecmSlot,
  setSlotColor,
  slotColor,
} from './char-pens'
import { CharsetSheet } from './charset-sheet'
import { ZenMode, ZenPens } from '../zen-mode'
import type { CharSlot } from './char-pens'
import type { GridView } from '../view'

import type { Charset, CharsetMode, PetsciiSet } from '@/c64/charset'
import type { PixelMode } from '@/c64/bitmap'
import type { IndexedImage } from '@/c64/render'
import type { Project } from '@/c64/project'
import type { ProjectSession, SaveStatus as Status } from '@/storage/session'

type Tool = 'draw' | 'erase' | 'fill'

/** Char copied with "Copy", kept for the app session (works across charsets). */
let clipboard: { bytes: Uint8Array; color: number } | null = null
/** Last selected char per charset. */
const lastSelected = new Map<string, number>()

const DATA_W = 60
/** Room under the grid for the memory note and .byte line. */
const MEM_H = 64
const hex2 = (n: number) => '$' + n.toString(16).toUpperCase().padStart(2, '0')
const hex4 = (n: number) => '$' + n.toString(16).toUpperCase().padStart(4, '0')

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
  const history = useAssetHistory(session, 'charsets', charset.id, charset)
  useUndoShortcuts(history)
  const count = charCount(charset.mode)
  const [selectedRaw, setSelected] = useState(
    () => lastSelected.get(charset.id) ?? 0,
  )
  const selected = Math.min(selectedRaw, count - 1)
  const [tool, setTool] = useState<Tool>('draw')
  const [penByMode, setPenByMode] = useState<Record<PixelMode, number>>({
    hires: 1,
    multicolor: 3,
  })
  /** An ECM background chosen for recolouring (pens 0 covers all four). */
  const [ecmTarget, setEcmTarget] = useState<number | null>(null)
  const [asHex, setAsHex] = useState(true)
  const [swapping, setSwapping] = useState(false)
  const [zen, setZen] = useState(false)
  const [, setClipboardVersion] = useState(0)
  const [confirm, setConfirm] = useState<
    { kind: 'petscii'; set: PetsciiSet } | { kind: 'clear' } | null
  >(null)
  const cell = useCellSize({
    columns: 8,
    rows: 8,
    min: 24,
    max: 56,
    reserveWidth: DATA_W + 12,
    reserveHeight: BIT_HEADER_H + 2 + MEM_H,
  })
  const [view, setView] = useState<GridView>(DEFAULT_VIEW)
  useEffect(() => setView(DEFAULT_VIEW), [cell.size])
  const strokeId = useRef(0)
  const beforeStroke = useRef<Charset | null>(null)

  useEffect(() => {
    lastSelected.set(charset.id, selected)
  }, [charset.id, selected])

  const change = useCallback(
    (fn: (cs: Charset) => Charset, group?: string) => history.change(fn, group),
    [history],
  )

  const pixelMode = charPixelMode(charset, selected)
  const mcChar = isCharMulticolor(charset, selected)
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
  const limitColors = target === 'char' && charset.mode === 'multicolor'

  const paint = (x: number, y: number, start: boolean) => {
    const group = `stroke-${strokeId.current}`
    if (tool === 'fill') {
      if (!start) return
      change((cs) =>
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
      )
      return
    }
    change((cs) => setCharPixel(cs, selected, x, y, value), group)
  }

  const pick = (index: number) => {
    if (swapping) {
      setSwapping(false)
      if (index !== selected) {
        change((cs) => swapChars(cs, selected, index))
      }
    }
    setSelected(index)
  }

  const bytes = getCharBytes(charset, selected)
  const gridLayers = useMemo(
    () => [{ pixels: Int8Array.from(renderChar(charset, selected)) }],
    [charset, selected],
  )
  const bgHex = PALETTE[charset.background].hex
  const renderGrid = (
    size: number,
    v: GridView,
    onV: (next: GridView) => void,
  ) => (
    <PixelGrid
      width={8}
      height={8}
      step={pixelMode === 'multicolor' ? 2 : 1}
      majorX={4}
      majorY={4}
      layers={gridLayers}
      background={bgHex}
      cell={size}
      view={v}
      onViewChange={onV}
      label={`Character ${selected} pixel grid, ${mcChar ? '4' : '8'} by 8`}
      onStrokeStart={(x, y) => {
        strokeId.current++
        beforeStroke.current = charset
        paint(x, y, true)
      }}
      onStrokeMove={(x, y) => paint(x, y, false)}
      onStrokeEnd={history.endGroup}
      onStrokeCancel={() => {
        history.endGroup()
        history.undo()
      }}
      onDoubleTap={(x, y) => {
        if (tool !== 'draw') return
        // Clear the pixel, as one undo step with the first tap.
        if (beforeStroke.current !== charset) history.undo()
        change((cs) =>
          getCharPixel(cs, selected, x, y) === 0
            ? cs
            : setCharPixel(cs, selected, x, y, 0),
        )
      }}
    />
  )
  const users = mapsUsingCharset(project, charset.id)

  return (
    <WorksheetLayout
      fitScreen
      title="Character Worksheet"
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
            { label: charset.name },
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
      tabs={<EdgeTabs tabs={editorTabs(project, 'charsets')} />}
      className="flex gap-4 px-4 py-3"
    >
      {/* Left: char details, mode, pens, palette, preview */}
      <div className="-mx-1 flex w-[232px] shrink-0 flex-col gap-2.5 overflow-y-auto px-1 py-0.5">
        <div className="flex gap-2">
          <CharNumberField count={count} value={selected} onChange={pick} />
          <Field label="Hex" className="w-20">
            <Input value={hex2(selected)} readOnly className="font-mono" />
          </Field>
        </div>
        <div className="flex flex-col gap-[3px]">
          <span className="text-xs text-muted-foreground">
            Charset mode · all {count === 64 ? '64' : '256'} chars
          </span>
          <Segmented<CharsetMode>
            label="Charset mode"
            value={charset.mode}
            options={[
              { value: 'hires', label: 'Hires' },
              { value: 'multicolor', label: 'Multicolour' },
              { value: 'ecm', label: 'ECM' },
            ]}
            onChange={(mode) => {
              setEcmTarget(null)
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
        <PensPanel
          pens={pens}
          pen={pen}
          onPen={(v) => {
            setPenByMode((p) => ({ ...p, [pixelMode]: v }))
            setEcmTarget(null)
            if (tool === 'erase') setTool('draw')
          }}
        />
        {charset.mode === 'ecm' && (
          <EcmBackgrounds
            charset={charset}
            target={ecmTarget}
            onTarget={(k) => {
              setEcmTarget(k)
              setPenByMode((p) => ({ ...p, hires: 0 }))
            }}
          />
        )}
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
        <CharPreview charset={charset} index={selected} />
      </div>

      {/* Middle: tool rail, grid, data bytes */}
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
              label="Draw (double-tap a pixel to clear it)"
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
              onClick={() => change((cs) => flipCharHorizontal(cs, selected))}
            >
              <FlipHorizontal2 />
            </ToolButton>
            <ToolButton
              label="Flip vertically"
              onClick={() => change((cs) => flipCharVertical(cs, selected))}
            >
              <FlipVertical2 />
            </ToolButton>
            <ToolButton
              label={mcChar ? 'Rotate (hires chars only)' : 'Rotate clockwise'}
              disabled={mcChar}
              onClick={() => change((cs) => rotateCharClockwise(cs, selected))}
            >
              <RotateCw />
            </ToolButton>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <ToolButton label="Shift (wraps around)">
                  <Move />
                </ToolButton>
              </DropdownMenuTrigger>
              <DropdownMenuContent side="right" align="start">
                {(
                  [
                    ['Shift up', 0, -1, ArrowUp],
                    ['Shift down', 0, 1, ArrowDown],
                    ['Shift left', -1, 0, ArrowLeft],
                    ['Shift right', 1, 0, ArrowRight],
                  ] as const
                ).map(([label, dx, dy, Icon]) => (
                  <DropdownMenuItem
                    key={label}
                    onSelect={() =>
                      change((cs) => shiftChar(cs, selected, dx, dy))
                    }
                  >
                    <Icon aria-hidden="true" /> {label}
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
            <ToolButton
              label="Invert"
              onClick={() => change((cs) => invertChar(cs, selected))}
            >
              <Contrast />
            </ToolButton>
            <ToolButton
              label="Clear character"
              onClick={() => change((cs) => clearChar(cs, selected))}
            >
              <Trash2 />
            </ToolButton>
            <div aria-hidden="true" className="mx-1.5 my-1 h-px bg-rule-soft" />
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
                        { x: 4 * cell.size, y: 4 * cell.size },
                        8 * cell.size,
                        8 * cell.size,
                      ),
                )
              }
            >
              <span className="font-mono text-[11px] font-medium">
                {zoomLabel(view.zoom)}
              </span>
            </ToolButton>
          </div>

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

              {/* DATA: one byte per row */}
              <div className="flex shrink-0 flex-col" style={{ width: DATA_W }}>
                <div
                  className="flex items-end justify-center text-[11px] leading-[14px] tracking-[0.08em] text-muted-foreground"
                  style={{ height: BIT_HEADER_H }}
                >
                  DATA
                </div>
                <div
                  className="flex flex-col pt-[2px]"
                  aria-label="Character data bytes"
                >
                  {[...bytes].map((b, row) => (
                    <div
                      key={row}
                      className="flex items-center"
                      style={{ height: cell.size }}
                    >
                      <div
                        className={cn(
                          'flex w-full items-center justify-center rounded-md border border-data-box font-mono text-sm',
                          b === 0 ? 'text-data-zero' : 'text-foreground',
                        )}
                        style={{ height: Math.min(cell.size - 8, 34) }}
                      >
                        {asHex ? hex2(b) : b}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
            <div
              className="mt-2 flex flex-col gap-1"
              style={{ marginLeft: ROW_NUMBERS_W, height: MEM_H - 8 }}
            >
              <div className="flex items-center gap-2">
                <span className="min-w-0 flex-1 text-[11px] leading-tight text-muted-foreground">
                  Offset +{selected * 8} · {hex4(0x2000 + selected * 8)} with
                  the set at $2000
                </span>
                <div className="w-24 shrink-0">
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
              <code className="font-mono text-xs whitespace-nowrap select-all">
                .byte {[...bytes].map(hex2).join(',')}
              </code>
            </div>
          </div>
        </div>
      </div>

      {/* Right: the whole charset */}
      <div className="flex w-[306px] shrink-0 flex-col gap-2 overflow-y-auto border-l border-rule-soft pl-3">
        <span className="text-xs text-muted-foreground">
          {users.length === 0
            ? 'Charset · not used by a map yet'
            : `Charset · used by ${users.map((m) => `“${m.name}”`).join(', ')}`}
        </span>
        <CharsetSheet
          charset={charset}
          selected={selected}
          swapping={swapping}
          onPick={pick}
        />
        <div className="mt-1 grid grid-cols-2 gap-1.5">
          <Button
            variant="outline"
            onClick={() => {
              clipboard = {
                bytes: getCharBytes(charset, selected),
                color: charset.colors[selected],
              }
              setClipboardVersion((v) => v + 1)
            }}
          >
            <Copy aria-hidden="true" /> Copy
          </Button>
          <Button
            variant="outline"
            disabled={!clipboard}
            onClick={() => {
              const c = clipboard
              if (!c) return
              change((cs) => {
                const next = setCharBytes(cs, selected, c.bytes)
                const colors = next.colors.slice()
                colors[selected] = c.color
                return { ...next, colors }
              })
            }}
          >
            <ClipboardPaste aria-hidden="true" /> Paste
          </Button>
          <Button
            variant="outline"
            aria-pressed={swapping}
            className={cn(
              swapping &&
                'border-primary bg-accent text-primary hover:bg-accent',
            )}
            onClick={() => setSwapping((s) => !s)}
          >
            <ArrowLeftRight aria-hidden="true" />
            {swapping ? 'Pick target…' : 'Swap'}
          </Button>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline">
                <Ellipsis aria-hidden="true" /> More
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem
                onSelect={() => setConfirm({ kind: 'petscii', set: 'upper' })}
              >
                Load PETSCII: upper case + graphics
              </DropdownMenuItem>
              <DropdownMenuItem
                onSelect={() => setConfirm({ kind: 'petscii', set: 'lower' })}
              >
                Load PETSCII: lower + upper case
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                variant="destructive"
                onSelect={() => setConfirm({ kind: 'clear' })}
              >
                Clear all characters
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
        <p className="text-[11px] leading-snug text-muted-foreground">
          {swapping
            ? `Tap another character to swap it with ${hex2(selected)}. Maps keep their codes.`
            : charset.mode === 'ecm'
              ? 'ECM uses chars $00–$3F; screen code bits 7–6 pick the background.'
              : 'Tap a character to edit it. Each char has its own colour.'}
        </p>
      </div>

      {zen && (
        <ZenMode
          title={`Char ${hex2(selected)}`}
          columns={8}
          rows={8}
          renderGrid={renderGrid}
          tool={tool}
          onTool={setTool}
          side={
            <ZenPens
              pens={pens}
              pen={pen}
              onPen={(v) => {
                setPenByMode((p) => ({ ...p, [pixelMode]: v }))
                setEcmTarget(null)
                if (tool === 'erase') setTool('draw')
              }}
              colors={projectColors(project)}
              penColor={
                penDef.slot ? slotColor(charset, selected, penDef.slot) : null
              }
              isAllowed={(c) =>
                !(penDef.slot === 'char' && charset.mode === 'multicolor') ||
                c < 8
              }
              onRecolor={(color) => {
                const slot = penDef.slot
                if (slot)
                  change((cs) => setSlotColor(cs, selected, slot, color))
              }}
            />
          }
          onUndo={history.undo}
          onRedo={history.redo}
          canUndo={history.canUndo}
          canRedo={history.canRedo}
          onPrev={() => setSelected((selected + count - 1) % count)}
          onNext={() => setSelected((selected + 1) % count)}
          onExit={() => setZen(false)}
        />
      )}
      <ConfirmDialog
        open={confirm !== null}
        onOpenChange={(open) => !open && setConfirm(null)}
        title={
          confirm?.kind === 'clear'
            ? 'Clear all characters?'
            : 'Load the PETSCII characters?'
        }
        description={
          confirm?.kind === 'clear'
            ? 'Every character’s pixels are cleared. Colours and maps are kept. You can undo this.'
            : 'Every character’s pixels are replaced with the C64’s built-in set. Colours and maps are kept. You can undo this.'
        }
        confirmLabel={confirm?.kind === 'clear' ? 'Clear all' : 'Load'}
        onConfirm={() => {
          const data =
            confirm?.kind === 'petscii'
              ? petsciiData(confirm.set)
              : new Uint8Array(CHARSET_BYTES)
          change((cs) => ({ ...cs, data }))
          setConfirm(null)
        }}
      />
    </WorksheetLayout>
  )
}

/** Character number: type decimal or $hex to jump. */
function CharNumberField({
  count,
  value,
  onChange,
}: {
  count: number
  value: number
  onChange: (index: number) => void
}) {
  const [draft, setDraft] = useState<string | null>(null)
  return (
    <Field label="Character number" className="flex-1">
      <Input
        inputMode="numeric"
        className="font-mono"
        value={draft ?? String(value)}
        onFocus={(e) => e.target.select()}
        onChange={(e) => {
          setDraft(e.target.value)
          const text = e.target.value.trim()
          const n = text.startsWith('$')
            ? parseInt(text.slice(1), 16)
            : Number(text)
          if (text !== '' && Number.isInteger(n) && n >= 0 && n < count)
            onChange(n)
        }}
        onBlur={() => setDraft(null)}
      />
    </Field>
  )
}

/** ECM: the four backgrounds, each recolourable. */
function EcmBackgrounds({
  charset,
  target,
  onTarget,
}: {
  charset: Charset
  target: number | null
  onTarget: (k: number) => void
}) {
  return (
    <div className="flex flex-col gap-1">
      <div className="text-xs text-muted-foreground">
        ECM backgrounds · screen code bits 7–6
      </div>
      <div className="grid grid-cols-4 gap-1">
        {ecmBackgroundColors(charset).map((c, k) => (
          <button
            key={k}
            type="button"
            aria-pressed={target === k}
            aria-label={`ECM background ${k}, ${PALETTE[c].name} ($D02${k + 1})`}
            title={`$D02${k + 1}`}
            onClick={() => onTarget(k)}
            className={cn(
              'flex h-9 items-center gap-1.5 rounded-lg border px-1.5 font-mono text-[11px]',
              target === k
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
  )
}

/** The char tiled on the screen, or in ECM on each of the four backgrounds. */
function CharPreview({ charset, index }: { charset: Charset; index: number }) {
  if (charset.mode === 'ecm') {
    return (
      <div className="flex flex-col gap-1">
        <div className="text-xs text-muted-foreground">
          Screen codes using this char
        </div>
        <div className="grid grid-cols-4 gap-1.5">
          {[0, 1, 2, 3].map((k) => {
            const code = (k << 6) | index
            return (
              <div key={k} className="flex flex-col items-center gap-0.5">
                <IndexedCanvas
                  image={{
                    width: 8,
                    height: 8,
                    pixels: Int8Array.from(renderChar(charset, index, k)),
                  }}
                  label={`Screen code ${hex2(code)}`}
                  className="w-full rounded-[3px]"
                />
                <span className="font-mono text-[10px] text-muted-foreground">
                  {hex2(code)}
                </span>
              </div>
            )
          })}
        </div>
      </div>
    )
  }
  const char = renderChar(charset, index)
  const image: IndexedImage = {
    width: 48,
    height: 16,
    pixels: new Int8Array(48 * 16),
  }
  for (let y = 0; y < 16; y++) {
    for (let x = 0; x < 48; x++) {
      image.pixels[y * 48 + x] = char[(y % 8) * 8 + (x % 8)]
    }
  }
  return (
    <div className="flex flex-col gap-1">
      <div className="text-xs text-muted-foreground">Preview · tiled</div>
      <div
        className="rounded-lg border-[5px]"
        style={{ borderColor: PALETTE[14].hex }}
      >
        <IndexedCanvas
          image={image}
          label="Character tiled"
          className="w-full"
        />
      </div>
    </div>
  )
}
