import { useMemo } from 'react'
import { decodeEcm } from '@/c64/charmap'
import { charColor, charCount } from '@/c64/charset'
import { COLOR_NAMES } from '@/c64/palette'
import { renderCharmap } from '@/c64/render'
import { IndexedCanvas } from '@/components/c64/indexed-canvas'
import { usePalette } from '@/components/c64/palette-context'
import { cn } from '@/lib/utils'
import { CharsetSheet } from '../charset/charset-sheet'
import { ecmBackgroundColors } from '../charset/char-pens'
import { hex } from '../hex'
import type { Charmap, Region } from '@/c64/charmap'
import type { Charset } from '@/c64/charset'

/** The brush, ECM background (in ECM) and the charset to pick chars from. */
export function BrushPicker({
  map,
  charset,
  brush,
  ecmBg,
  onEcmBg,
  onPickChar,
  showAttributes = false,
}: {
  map: Charmap
  charset: Charset
  brush: Region
  ecmBg: number
  onEcmBg: (background: number) => void
  onPickChar: (char: number) => void
  /** Draw char attributes over the sheet. */
  showAttributes?: boolean
}) {
  const palette = usePalette()
  const ecm = charset.mode === 'ecm'
  const code = brush.cells[0]
  const sheetSelected =
    brush.width === 1 && brush.height === 1
      ? ecm
        ? decodeEcm(code).char
        : code
      : -1
  return (
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
                aria-label={`Paint on ECM background ${k}, ${COLOR_NAMES[c]}`}
                onClick={() => onEcmBg(k)}
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
                  style={{ background: palette.hex[c] }}
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
          magnify
          background={ecm ? ecmBg : 0}
          onPick={onPickChar}
          showAttributes={showAttributes}
        />
      </div>
    </>
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
              ? `${code} · ${char < charCount(charset.mode) ? COLOR_NAMES[charColor(charset, char)] : ''}`
              : 'From a selection · tiles as you drag'}
          </span>
        </div>
      </div>
    </div>
  )
}

/** A char drawn at icon size, for buttons. */
export function CharIcon({
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
          cellColors: null,
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
