import { useMemo, useState } from 'react'
import { Download } from 'lucide-react'
import { renderCharsetSheet } from '@/c64/render'
import {
  exportCharAttributes,
  exportCharColors,
  exportCharScreenColors,
  exportCharpadCtm,
  exportCharsetBin,
  exportKoala,
  exportCharsetKickAss,
  exportMapAttributes,
  exportMapBin,
  exportMapColors,
  exportMapKickAss,
  exportMapScreenRam,
  hasAttributes,
  renderMapImage,
} from '@/export/chars'
import { IndexedCanvas } from '@/components/c64/indexed-canvas'
import { Field } from '@/components/worksheet/field'
import { Button } from '@/components/ui/button'
import { DialogFooter } from '@/components/ui/dialog'
import { indexedImageToPng } from '@/platform/png'
import { usePalette } from '@/components/c64/palette-context'
import { safeFileName, saveFile } from '@/platform/save-file'
import { Segmented } from './segmented'
import type { IndexedImage } from '@/c64/render'
import type { Charmap } from '@/c64/charmap'
import type { Charset } from '@/c64/charset'
import type { Project } from '@/c64/project'

/** Largest PNG side we make: big maps are capped at a lower scale. */
const MAX_PNG_SIDE = 8192

interface Output {
  /** File name without the project / asset prefix. */
  extension: string
  data: () => Uint8Array | string | Promise<Uint8Array>
  mime?: string
  size: string
}

function SaveFooter({
  fileName,
  output,
  onClose,
}: {
  fileName: string
  output: Output | null
  onClose: () => void
}) {
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  return (
    <>
      {error && <p className="text-sm text-destructive">{error}</p>}
      <DialogFooter>
        <span className="mr-auto self-center font-mono text-xs text-muted-foreground">
          {output ? `${fileName}${output.extension} · ${output.size}` : ''}
        </span>
        <Button variant="outline" onClick={onClose}>
          Cancel
        </Button>
        <Button
          disabled={saving || !output}
          onClick={() => {
            if (!output) return
            setSaving(true)
            setError(null)
            void (async () => {
              try {
                const saved = await saveFile(
                  `${fileName}${output.extension}`,
                  await output.data(),
                  output.mime,
                )
                // Cancelled the Android picker: stay open to try again.
                if (saved) onClose()
              } catch (e) {
                setError((e as Error).message)
              } finally {
                setSaving(false)
              }
            })()
          }}
        >
          <Download aria-hidden="true" />
          {saving ? 'Saving…' : 'Save'}
        </Button>
      </DialogFooter>
    </>
  )
}

function PngOptions({
  image,
  scale,
  maxScale,
  onScale,
}: {
  image: IndexedImage
  scale: number
  maxScale: number
  onScale: (scale: number) => void
}) {
  return (
    <div className="flex gap-4">
      <Field label={`Scale: ${scale}×`}>
        <input
          type="range"
          min={1}
          max={maxScale}
          value={scale}
          onChange={(e) => onScale(Number(e.target.value))}
          className="h-8 w-40 accent-primary"
        />
      </Field>
      <div className="flex max-h-48 min-w-0 flex-1 items-start justify-center overflow-auto rounded-lg border border-rule-soft p-2">
        <IndexedCanvas
          image={image}
          label="PNG preview"
          style={{ width: Math.min(image.width * 2, 400), maxWidth: '100%' }}
        />
      </div>
    </div>
  )
}

const bytes = (n: number) => `${n} bytes`

/** Export tab of the Character Worksheet. */
export function CharsetExportPanel({
  project,
  charset,
  onClose,
}: {
  project: Project
  charset: Charset
  onClose: () => void
}) {
  type Format = 'chars' | 'colours' | 'screen' | 'attributes' | 'asm' | 'png'
  const [format, setFormat] = useState<Format>('chars')
  const bitmap = charset.mode === 'bitmap'
  const [scale, setScale] = useState(4)
  const palette = usePalette().id
  const sheet = useMemo(() => renderCharsetSheet(charset), [charset])
  const asm = useMemo(
    () =>
      format === 'asm'
        ? exportCharsetKickAss(charset, { projectName: project.name })
        : '',
    [format, charset, project.name],
  )
  const charsBin = exportCharsetBin(charset)
  const about: Record<Format, string> = {
    chars: `The charset as the VIC reads it, 8 bytes per char${charset.mode === 'ecm' ? ' (ECM: the 64 shapes)' : ''}. Load it on a $800 boundary.`,
    colours: bitmap
      ? 'Colour RAM value (the colour of 11) for each tile 0-255: a lookup table for filling $D800.'
      : 'Colour RAM value for each screen code 0-255 (multicolour chars have bit 3 set): a lookup table for filling $D800.',
    screen:
      'Screen RAM value for each tile 0-255: the colour of 01 in the high nibble, of 10 in the low one.',
    attributes:
      'Attribute (0-15, 0 = none) for each screen code 0-255: a lookup table for game code (solid, ladder, …).',
    asm: `KickAssembler source: register values, the charset and its colours${hasAttributes(charset) ? ', attributes and attribute names' : ''}.`,
    png: 'An image of the whole charset, 16 chars per row.',
  }
  const outputs: Record<Format, Output> = {
    chars: {
      extension: '-chars.bin',
      data: () => charsBin,
      size: bytes(charsBin.length),
    },
    colours: {
      extension: '-colours.bin',
      data: () => exportCharColors(charset),
      size: bytes(256),
    },
    screen: {
      extension: '-screen.bin',
      data: () => exportCharScreenColors(charset),
      size: bytes(256),
    },
    attributes: {
      extension: '-attributes.bin',
      data: () => exportCharAttributes(charset),
      size: bytes(256),
    },
    asm: {
      extension: '.asm',
      data: () => asm,
      mime: 'text/plain',
      size: `${asm.split('\n').length} lines`,
    },
    png: {
      extension: '.png',
      data: () => indexedImageToPng(sheet, { scale, palette }),
      mime: 'image/png',
      size: `${sheet.width * scale}×${sheet.height * scale} px`,
    },
  }
  return (
    <>
      <p className="text-sm text-muted-foreground">{about[format]}</p>
      <Segmented
        label="Format"
        value={format}
        options={[
          { value: 'chars', label: 'Chars .bin' },
          { value: 'colours', label: 'Colours' },
          ...(bitmap ? [{ value: 'screen' as const, label: 'Screen' }] : []),
          { value: 'attributes', label: 'Attributes' },
          { value: 'asm', label: 'KickAss' },
          { value: 'png', label: 'PNG' },
        ]}
        onChange={setFormat}
      />
      {format === 'asm' && <AsmPreview text={asm} />}
      {format === 'png' && (
        <PngOptions
          image={sheet}
          scale={scale}
          maxScale={8}
          onScale={setScale}
        />
      )}
      <SaveFooter
        fileName={`${safeFileName(project.name)}-${safeFileName(charset.name)}`}
        output={outputs[format]}
        onClose={onClose}
      />
    </>
  )
}

function AsmPreview({ text }: { text: string }) {
  const lines = text.split('\n')
  return (
    <pre className="max-h-48 overflow-auto rounded-lg border border-rule-soft bg-muted p-3 font-mono text-[11px] leading-snug">
      {lines.slice(0, 40).join('\n')}
      {lines.length > 40 ? '\n…' : ''}
    </pre>
  )
}

/** Export tab of the Screen Worksheet. */
export function MapExportPanel({
  project,
  map,
  charset,
  start,
  onClose,
}: {
  project: Project
  map: Charmap
  charset: Charset
  /** Bitmap: the screen a Koala picture shows (its top-left cell). */
  start?: { x: number; y: number }
  onClose: () => void
}) {
  type Format =
    | 'map'
    | 'colours'
    | 'screen'
    | 'koala'
    | 'attributes'
    | 'asm'
    | 'ctm'
    | 'png'
  const [format, setFormat] = useState<Format>('map')
  const bitmap = charset.mode === 'bitmap'
  const big = map.width > 40 || map.height > 25
  const [withColours, setWithColours] = useState(true)
  const [withCharset, setWithCharset] = useState(true)
  const [withAttributes, setWithAttributes] = useState(() =>
    hasAttributes(charset),
  )
  const maxScale = Math.max(
    1,
    Math.min(
      4,
      Math.floor(MAX_PNG_SIDE / (8 * Math.max(map.width, map.height))),
    ),
  )
  const [scale, setScale] = useState(Math.min(2, maxScale))
  const palette = usePalette().id
  const image = useMemo(
    () => (format === 'png' ? renderMapImage(map, charset) : null),
    [format, map, charset],
  )
  const asm = useMemo(
    () =>
      format === 'asm'
        ? exportMapKickAss(map, charset, {
            projectName: project.name,
            colours: withColours,
            attributes: withAttributes,
            charset: withCharset,
          })
        : '',
    [
      format,
      map,
      charset,
      project.name,
      withColours,
      withAttributes,
      withCharset,
    ],
  )
  const ctm = useMemo(
    () => (format === 'ctm' ? exportCharpadCtm(map, charset) : null),
    [format, map, charset],
  )
  const cells = map.width * map.height
  const about: Record<Format, string> = {
    map: bitmap
      ? `Tile (char) numbers, one byte per cell, row by row (${map.width} per row).`
      : `Screen codes, one byte per cell, row by row (${map.width} per row).`,
    colours: bitmap
      ? 'Colour RAM (the colour of 11) for every cell, its own or its tile’s. Copy a screen’s worth to $D800.'
      : 'Colour RAM for every cell, from each char’s colour. Copy a screen’s worth to $D800.',
    screen:
      'Screen RAM for every cell, its own colours or its tile’s: 01 in the high nibble, 10 in the low one.',
    koala: `A Koala Painter picture (.kla, 10003 bytes): bitmap, screen and colour RAM${big ? ` of the screen in view (from column ${start?.x ?? 0}, row ${start?.y ?? 0})` : ''}.`,
    attributes:
      'Attribute (0-15, 0 = none) for every cell, from each char’s attribute, row by row like the map.',
    asm: 'KickAssembler source: the map’s size and rows, with its colour RAM, attributes and charset if you like.',
    ctm: 'A CharPad project (.ctm version 7) with the charset, a colour and material (attribute) per char and this map. Opens in CharPad 2.8 and later.',
    png: 'An image of the whole map.',
  }
  const outputs: Record<Format, Output | null> = {
    map: {
      extension: '-map.bin',
      data: () => exportMapBin(map),
      size: bytes(cells),
    },
    colours: {
      extension: '-colours.bin',
      data: () => exportMapColors(map, charset),
      size: bytes(cells),
    },
    screen: {
      extension: '-screen.bin',
      data: () => exportMapScreenRam(map, charset),
      size: bytes(cells),
    },
    koala: {
      extension: '.kla',
      data: () => exportKoala(map, charset, start),
      size: bytes(10003),
    },
    attributes: {
      extension: '-attributes.bin',
      data: () => exportMapAttributes(map, charset),
      size: bytes(cells),
    },
    asm: {
      extension: '.asm',
      data: () => asm,
      mime: 'text/plain',
      size: `${asm.split('\n').length} lines`,
    },
    ctm: ctm && {
      extension: '.ctm',
      data: () => ctm.bytes,
      size: bytes(ctm.bytes.length),
    },
    png: image && {
      extension: '.png',
      data: () => indexedImageToPng(image, { scale, palette }),
      mime: 'image/png',
      size: `${image.width * scale}×${image.height * scale} px`,
    },
  }
  return (
    <>
      <p className="text-sm text-muted-foreground">{about[format]}</p>
      <Segmented
        label="Format"
        value={format}
        options={[
          { value: 'map', label: bitmap ? 'Map' : 'Map .bin' },
          { value: 'colours', label: 'Colours' },
          ...(bitmap
            ? [
                { value: 'screen' as const, label: 'Screen' },
                { value: 'koala' as const, label: 'Koala' },
              ]
            : []),
          { value: 'attributes', label: 'Attributes' },
          { value: 'asm', label: 'KickAss' },
          { value: 'ctm', label: 'CharPad' },
          { value: 'png', label: 'PNG' },
        ]}
        onChange={setFormat}
      />
      {format === 'asm' && (
        <>
          <div className="flex gap-4 text-sm">
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                className="size-4 accent-primary"
                checked={withColours}
                onChange={(e) => setWithColours(e.target.checked)}
              />
              {bitmap ? 'Colour & screen RAM per cell' : 'Colour RAM per cell'}
            </label>
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                className="size-4 accent-primary"
                checked={withAttributes}
                onChange={(e) => setWithAttributes(e.target.checked)}
              />
              Attributes per cell
            </label>
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                className="size-4 accent-primary"
                checked={withCharset}
                onChange={(e) => setWithCharset(e.target.checked)}
              />
              Charset “{charset.name}”
            </label>
          </div>
          <AsmPreview text={asm} />
        </>
      )}
      {format === 'ctm' &&
        ctm?.warnings.map((w) => (
          <p key={w} className="text-sm text-destructive">
            {w}
          </p>
        ))}
      {format === 'png' && image && (
        <PngOptions
          image={image}
          scale={scale}
          maxScale={maxScale}
          onScale={setScale}
        />
      )}
      <SaveFooter
        fileName={`${safeFileName(project.name)}-${safeFileName(map.name)}`}
        output={outputs[format]}
        onClose={onClose}
      />
    </>
  )
}
