import { useState } from 'react'
import { renderChar } from '@/c64/charset'
import { COLOR_NAMES } from '@/c64/palette'
import { IndexedCanvas } from '@/components/c64/indexed-canvas'
import { usePalette } from '@/components/c64/palette-context'
import { Field } from '@/components/worksheet/field'
import { Input } from '@/components/ui/input'
import { cn } from '@/lib/utils'
import { hex } from '../hex'
import { ecmBackgroundColors } from './char-pens'
import type { Charset } from '@/c64/charset'
import type { IndexedImage } from '@/c64/render'

/** Character number: type decimal or $hex to jump. */
export function CharNumberField({
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
export function EcmBackgrounds({
  charset,
  target,
  onTarget,
}: {
  charset: Charset
  target: number | null
  onTarget: (k: number) => void
}) {
  const palette = usePalette()
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
            aria-label={`ECM background ${k}, ${COLOR_NAMES[c]} ($D02${k + 1})`}
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
              style={{ background: palette.hex[c] }}
            />
            B{k}
          </button>
        ))}
      </div>
    </div>
  )
}

/** The char tiled on the screen, or in ECM on each of the four backgrounds. */
export function CharPreview({
  charset,
  index,
}: {
  charset: Charset
  index: number
}) {
  const palette = usePalette()
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
                  label={`Screen code ${hex(code)}`}
                  className="w-full rounded-[3px]"
                />
                <span className="font-mono text-[10px] text-muted-foreground">
                  {hex(code)}
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
        style={{ borderColor: palette.hex[14] }}
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
