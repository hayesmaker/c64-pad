import { useMemo, useState } from 'react'
import { Download } from 'lucide-react'
import { PALETTE } from '@/c64/palette'
import {
  exportSpritesBin,
  exportSpritesKickAss,
  exportSpritesSpd,
  renderSpriteSheet,
} from '@/export/sprites'
import { IndexedCanvas } from '@/components/c64/indexed-canvas'
import { Field } from '@/components/worksheet/field'
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
import { indexedImageToPng } from '@/platform/png'
import { safeFileName, saveFile } from '@/platform/save-file'
import { Segmented } from '../segmented'
import type { PadByte, SpriteRange } from '@/export/sprites'
import type { C64Color } from '@/c64/palette'
import type { Project } from '@/c64/project'
import type { SpriteSet } from '@/c64/sprite-set'

type Format = 'bin' | 'asm' | 'spd' | 'png'
type RangeChoice = 'all' | 'current' | 'custom'

const FORMATS: ReadonlyArray<{ value: Format; label: string; about: string }> =
  [
    {
      value: 'bin',
      label: '.bin',
      about:
        'Raw bytes, 64 per sprite, ready for KickAssembler’s .import binary.',
    },
    {
      value: 'asm',
      label: 'KickAss',
      about:
        'KickAssembler source: labelled .byte rows with a picture of each row.',
    },
    {
      value: 'spd',
      label: 'SpritePad',
      about:
        'SpritePad .spd (version 1, readable by every SpritePad). Whole set.',
    },
    {
      value: 'png',
      label: 'PNG',
      about: 'An image of the sprites for sharing.',
    },
  ]

export function ExportSpritesDialog({
  project,
  set,
  currentIndex,
  background,
  onClose,
}: {
  project: Project
  set: SpriteSet
  currentIndex: number
  /** Editor background: used for PNG/SPD background when not transparent. */
  background: C64Color | null
  onClose: () => void
}) {
  const last = set.sprites.length - 1
  const [format, setFormat] = useState<Format>('bin')
  const [rangeChoice, setRangeChoice] = useState<RangeChoice>('all')
  const [from, setFrom] = useState('0')
  const [to, setTo] = useState(String(last))
  const [pad, setPad] = useState<PadByte>('zero')
  const [scale, setScale] = useState(4)
  const [columns, setColumns] = useState(Math.min(8, set.sprites.length))
  const [pngBackground, setPngBackground] = useState<'transparent' | 'screen'>(
    'transparent',
  )
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  const range: SpriteRange | null = useMemo(() => {
    if (rangeChoice === 'all') return { from: 0, to: last }
    if (rangeChoice === 'current')
      return { from: currentIndex, to: currentIndex }
    const f = Number(from)
    const t = Number(to)
    return Number.isInteger(f) &&
      Number.isInteger(t) &&
      f >= 0 &&
      t >= f &&
      t <= last
      ? { from: f, to: t }
      : null
  }, [rangeChoice, from, to, last, currentIndex])

  const screenColor: C64Color = background ?? 6
  const spd = useMemo(
    () => (format === 'spd' ? exportSpritesSpd(set, screenColor) : null),
    [format, set, screenColor],
  )
  const asm = useMemo(
    () =>
      format === 'asm' && range
        ? exportSpritesKickAss(set, { range, pad, projectName: project.name })
        : null,
    [format, set, range, pad, project.name],
  )
  const sheet = useMemo(
    () =>
      format === 'png' && range
        ? renderSpriteSheet(set, { range, columns })
        : null,
    [format, set, range, columns],
  )

  const baseName = `${safeFileName(project.name)}-${safeFileName(set.name)}`
  const count = range ? range.to - range.from + 1 : 0

  const save = async () => {
    setError(null)
    setSaving(true)
    try {
      if (format === 'spd' && spd) {
        await saveFile(`${baseName}.spd`, spd.bytes)
      } else if (range) {
        if (format === 'bin')
          await saveFile(`${baseName}.bin`, exportSpritesBin(set, range, pad))
        if (format === 'asm' && asm)
          await saveFile(`${baseName}.asm`, asm, 'text/plain')
        if (format === 'png' && sheet) {
          const png = await indexedImageToPng(sheet, {
            scale,
            background: pngBackground === 'screen' ? screenColor : null,
          })
          await saveFile(`${baseName}.png`, png, 'image/png')
        }
      }
      onClose()
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setSaving(false)
    }
  }

  const about = FORMATS.find((f) => f.value === format)?.about

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent
        className="max-w-[640px] sm:max-w-[640px]"
        onOpenAutoFocus={(e) => e.preventDefault()}
      >
        <DialogHeader>
          <DialogTitle>Export sprites</DialogTitle>
          <DialogDescription>{about}</DialogDescription>
        </DialogHeader>

        <Segmented
          label="Format"
          value={format}
          options={FORMATS.map(({ value, label }) => ({ value, label }))}
          onChange={setFormat}
        />

        {format !== 'spd' && (
          <div className="flex flex-col gap-2">
            <span className="text-xs text-muted-foreground">Sprites</span>
            <div className="flex items-center gap-3">
              <div className="w-[300px]">
                <Segmented
                  label="Sprite range"
                  size="sm"
                  value={rangeChoice}
                  options={[
                    { value: 'all', label: `All (${set.sprites.length})` },
                    { value: 'current', label: `Current (#${currentIndex})` },
                    { value: 'custom', label: 'Range' },
                  ]}
                  onChange={setRangeChoice}
                />
              </div>
              {rangeChoice === 'custom' && (
                <div className="flex items-center gap-2 text-sm">
                  <Input
                    aria-label="First sprite"
                    inputMode="numeric"
                    className="w-16"
                    value={from}
                    onChange={(e) => setFrom(e.target.value)}
                  />
                  to
                  <Input
                    aria-label="Last sprite"
                    inputMode="numeric"
                    className="w-16"
                    value={to}
                    onChange={(e) => setTo(e.target.value)}
                  />
                </div>
              )}
            </div>
            {!range && (
              <p className="text-sm text-destructive">
                Choose sprites between 0 and {last}.
              </p>
            )}
          </div>
        )}

        {(format === 'bin' || format === 'asm') && (
          <div className="flex flex-col gap-2">
            <span className="text-xs text-muted-foreground">
              64th byte of each sprite
            </span>
            <div className="w-[300px]">
              <Segmented
                label="64th byte"
                size="sm"
                value={pad}
                options={[
                  { value: 'zero', label: 'Zero pad' },
                  { value: 'attributes', label: 'SpritePad attributes' },
                ]}
                onChange={setPad}
              />
            </div>
          </div>
        )}

        {format === 'asm' && asm && (
          <pre className="max-h-48 overflow-auto rounded-lg border border-rule-soft bg-muted p-3 font-mono text-[11px] leading-snug">
            {asm.split('\n').slice(0, 40).join('\n')}
            {asm.split('\n').length > 40 ? '\n…' : ''}
          </pre>
        )}

        {format === 'spd' && spd && (
          <div className="flex flex-col gap-1 text-sm">
            <p>
              {set.sprites.length} sprites, {set.animations.length}{' '}
              animation(s). Screen colour {PALETTE[screenColor].name} (the
              editor background).
            </p>
            {spd.warnings.map((w) => (
              <p key={w} className="text-destructive">
                {w}
              </p>
            ))}
          </div>
        )}

        {format === 'png' && sheet && (
          <div className="flex gap-4">
            <div className="flex flex-col gap-3">
              <Field label={`Scale: ${scale}×`}>
                <input
                  type="range"
                  min={1}
                  max={8}
                  value={scale}
                  onChange={(e) => setScale(Number(e.target.value))}
                  className="h-8 w-48 accent-primary"
                />
              </Field>
              <Field label={`Columns: ${columns}`}>
                <input
                  type="range"
                  min={1}
                  max={Math.max(1, count)}
                  value={columns}
                  onChange={(e) => setColumns(Number(e.target.value))}
                  className="h-8 w-48 accent-primary"
                />
              </Field>
              <div className="w-48">
                <Segmented
                  label="PNG background"
                  size="sm"
                  value={pngBackground}
                  options={[
                    { value: 'transparent', label: 'Transparent' },
                    { value: 'screen', label: PALETTE[screenColor].name },
                  ]}
                  onChange={setPngBackground}
                />
              </div>
            </div>
            <div
              className="flex max-h-48 min-w-0 flex-1 items-center justify-center overflow-auto rounded-lg border border-rule-soft p-2"
              style={{
                background:
                  pngBackground === 'screen'
                    ? PALETTE[screenColor].hex
                    : 'repeating-conic-gradient(#d9d7cf 0% 25%, #fdfcf8 0% 50%) 0 0 / 12px 12px',
              }}
            >
              <IndexedCanvas
                image={sheet}
                label="PNG preview"
                style={{
                  width: sheet.width * Math.min(scale, 4),
                  maxWidth: '100%',
                }}
              />
            </div>
          </div>
        )}

        {error && <p className="text-sm text-destructive">{error}</p>}

        <DialogFooter>
          <span className="mr-auto self-center font-mono text-xs text-muted-foreground">
            {format === 'spd'
              ? `${baseName}.spd · ${spd?.bytes.length ?? 0} bytes`
              : `${baseName}.${format} · ${count} sprite(s)${format === 'bin' ? ` · ${count * 64} bytes` : ''}`}
          </span>
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button
            disabled={saving || (format !== 'spd' && !range)}
            onClick={() => void save()}
          >
            <Download aria-hidden="true" />
            {saving ? 'Saving…' : 'Save'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
