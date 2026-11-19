import { useMemo, useState } from 'react'
import { Download } from 'lucide-react'
import { renderCharsetSheet } from '@/c64/render'
import {
  charsetBinsImport,
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
  mapBinsImport,
  renderMapImage,
} from '@/export/chars'
import { IndexedCanvas } from '@/components/c64/indexed-canvas'
import { Field } from '@/components/worksheet/field'
import { Button } from '@/components/ui/button'
import { DialogFooter } from '@/components/ui/dialog'
import { indexedImageToPng } from '@/platform/png'
import { usePalette } from '@/components/c64/palette-context'
import { safeFileName, saveFile } from '@/platform/save-file'
import { AsmCode } from './asm-code'
import { ImportCode } from './import-code'
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
  const [asmStyle, setAsmStyle] = useState<AsmStyle>('bytes')
  const bitmap = charset.mode === 'bitmap'
  const [scale, setScale] = useState(4)
  const palette = usePalette().id
  const sheet = useMemo(() => renderCharsetSheet(charset), [charset])
  const fileName = charsetFileName(project, charset)
  const asm = useMemo(() => {
    if (format !== 'asm') return ''
    if (asmStyle === 'bytes')
      return exportCharsetKickAss(charset, { projectName: project.name })
    const file = (ext: string) => `${fileName}${ext}`
    return withHeader(
      project,
      charsetBinsImport(charset, {
        chars: file(CHARS_EXTENSION),
        colours: file('-colours.bin'),
        screen: bitmap ? file('-screen.bin') : undefined,
        attributes: hasAttributes(charset)
          ? file('-attributes.bin')
          : undefined,
      }),
    )
  }, [format, asmStyle, charset, project, fileName, bitmap])
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
    asm:
      asmStyle === 'bytes'
        ? `KickAssembler source: register values, the charset and its colours${hasAttributes(charset) ? ', attributes and attribute names' : ''}.`
        : 'KickAssembler source that imports the .bin files (save each from its tab) with their labels and examples.',
    png: 'An image of the whole charset, 16 chars per row.',
  }
  const outputs: Record<Format, Output> = {
    chars: {
      extension: CHARS_EXTENSION,
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
      {format === 'asm' && (
        <>
          <AsmStyleToggle value={asmStyle} onChange={setAsmStyle} />
          <AsmPreview text={asm} />
        </>
      )}
      {(format === 'chars' ||
        format === 'colours' ||
        format === 'screen' ||
        format === 'attributes') && (
        // Imports this tab's .bin only; the KickAss tab imports them all.
        <ImportCode
          code={() =>
            charsetBinsImport(charset, {
              [format]: `${fileName}${outputs[format].extension}`,
            })
          }
        />
      )}
      {format === 'png' && (
        <PngOptions
          image={sheet}
          scale={scale}
          maxScale={8}
          onScale={setScale}
        />
      )}
      <SaveFooter
        fileName={fileName}
        output={outputs[format]}
        onClose={onClose}
      />
    </>
  )
}

type AsmStyle = 'bytes' | 'bins'

const CHARS_EXTENSION = '-chars.bin'

const charsetFileName = (project: Project, charset: Charset) =>
  `${safeFileName(project.name)}-${safeFileName(charset.name)}`

const withHeader = (project: Project, source: string) =>
  `// ${project.name} · made with C64-Pad\n${source}`

/** KickAss tab: the data as .byte rows, or .import binary of the .bins. */
function AsmStyleToggle({
  value,
  onChange,
}: {
  value: AsmStyle
  onChange: (style: AsmStyle) => void
}) {
  return (
    <div className="w-[260px]">
      <Segmented
        label="KickAss source"
        size="sm"
        value={value}
        options={[
          { value: 'bytes', label: 'Raw bytes' },
          { value: 'bins', label: '.bin imports' },
        ]}
        onChange={onChange}
      />
    </div>
  )
}

function AsmPreview({ text }: { text: string }) {
  return <AsmCode text={text} maxLines={40} />
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
  const [asmStyle, setAsmStyle] = useState<AsmStyle>('bytes')
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
  const fileName = `${safeFileName(project.name)}-${safeFileName(map.name)}`
  const asm = useMemo(() => {
    if (format !== 'asm') return ''
    if (asmStyle === 'bytes')
      return exportMapKickAss(map, charset, {
        projectName: project.name,
        colours: withColours,
        attributes: withAttributes,
        charset: withCharset,
      })
    const file = (ext: string) => `${fileName}${ext}`
    const source = mapBinsImport(map, charset, {
      map: file('-map.bin'),
      colours: withColours ? file('-colours.bin') : undefined,
      screen: withColours && bitmap ? file('-screen.bin') : undefined,
      attributes: withAttributes ? file('-attributes.bin') : undefined,
    })
    const chars = withCharset
      ? `\n${charsetBinsImport(charset, {
          chars: `${charsetFileName(project, charset)}${CHARS_EXTENSION}`,
        })}`
      : ''
    return withHeader(project, source + chars)
  }, [
    format,
    asmStyle,
    map,
    charset,
    project,
    fileName,
    bitmap,
    withColours,
    withAttributes,
    withCharset,
  ])
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
    asm:
      asmStyle === 'bytes'
        ? 'KickAssembler source: the map’s size and rows, with its colour RAM, attributes and charset if you like.'
        : 'KickAssembler source that imports the .bin files (save each from its tab, and the charset’s Chars .bin) with their labels and examples.',
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
          <AsmStyleToggle value={asmStyle} onChange={setAsmStyle} />
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
      {(format === 'map' ||
        format === 'colours' ||
        format === 'screen' ||
        format === 'attributes') && (
        // Imports this tab's .bin only; the KickAss tab imports them all.
        <ImportCode
          code={() =>
            mapBinsImport(map, charset, {
              [format]: `${fileName}${outputs[format]!.extension}`,
            })
          }
        />
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
        fileName={fileName}
        output={outputs[format]}
        onClose={onClose}
      />
    </>
  )
}
