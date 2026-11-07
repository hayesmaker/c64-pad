import { useRef, useState } from 'react'
import { ImagePlus, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { Segmented } from '../segmented'
import { placeTracing, sizeCheck } from './placement'
import type { ReactNode } from 'react'
import type { TracingSettings, TracingSize } from './placement'
import type { LoadedTracing } from './use-tracing'

const SIZES: ReadonlyArray<{ value: TracingSize; label: string }> = [
  { value: 'one', label: '1:1' },
  { value: 'width', label: 'Fit width' },
  { value: 'height', label: 'Fit height' },
  { value: 'fit', label: 'Fit all' },
  { value: 'stretch', label: 'Stretch' },
  { value: 'custom', label: 'Custom' },
]

const ANCHORS = [
  'top left',
  'top',
  'top right',
  'left',
  'centre',
  'right',
  'bottom left',
  'bottom',
  'bottom right',
]

const fmt = (n: number) => String(Math.round(n * 10) / 10)

/** − [value] + : a whole number, typed or stepped. */
function Stepper({
  label,
  value,
  onChange,
  step = 1,
}: {
  label: string
  value: number
  onChange: (n: number) => void
  step?: number
}) {
  const [draft, setDraft] = useState<string | null>(null)
  return (
    <div className="flex items-center rounded-md border border-rule-soft">
      <button
        type="button"
        aria-label={`${label} minus ${step}`}
        onClick={() => {
          setDraft(null)
          onChange(value - step)
        }}
        className="h-8 w-6 shrink-0 text-muted-foreground hover:text-foreground"
      >
        −
      </button>
      <input
        aria-label={label}
        inputMode="text"
        value={draft ?? String(value)}
        onFocus={(e) => e.target.select()}
        onChange={(e) => {
          // Keep what's typed ("-" on its way to "-16"); apply whole numbers.
          const text = e.target.value.replace(/[^\d-]/g, '')
          setDraft(text)
          if (/^-?\d+$/.test(text)) onChange(Number(text))
        }}
        onBlur={() => setDraft(null)}
        className="h-8 w-full min-w-0 bg-transparent text-center font-mono text-xs outline-none"
      />
      <button
        type="button"
        aria-label={`${label} plus ${step}`}
        onClick={() => {
          setDraft(null)
          onChange(value + step)
        }}
        className="h-8 w-6 shrink-0 text-muted-foreground hover:text-foreground"
      >
        +
      </button>
    </div>
  )
}

function Section({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex flex-col gap-1">
      <span className="text-xs text-muted-foreground">{label}</span>
      {children}
    </div>
  )
}

/**
 * Tracing paper settings, shown in place of a worksheet's left panel: load a
 * reference image, then crop, size, anchor and nudge it onto the grid.
 */
export function TracingPanel({
  tracing,
  error,
  target,
  targetLabel,
  onLoad,
  onRemove,
  onChange,
  onDone,
}: {
  tracing: LoadedTracing | null
  error: string | null
  /** The grid in C64 pixels. */
  target: { width: number; height: number }
  /** e.g. "map 320 × 2048 px (40 × 256 chars)". */
  targetLabel: string
  onLoad: (file: File) => void
  onRemove: () => void
  onChange: (fn: (s: TracingSettings) => TracingSettings) => void
  onDone: () => void
}) {
  const fileInput = useRef<HTMLInputElement>(null)
  const pick = () => fileInput.current?.click()
  const set = (patch: Partial<TracingSettings>) =>
    onChange((s) => ({ ...s, ...patch }))

  return (
    <div className="flex flex-col gap-2.5">
      <div className="flex items-center justify-between">
        <span className="text-[15px] font-semibold">Tracing paper</span>
        <Button size="sm" onClick={onDone}>
          Done
        </Button>
      </div>
      <input
        ref={fileInput}
        type="file"
        accept="image/png,image/jpeg,image/gif,image/webp"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0]
          if (file) onLoad(file)
          e.target.value = ''
        }}
      />
      {error && <p className="text-sm text-destructive">{error}</p>}

      {!tracing ? (
        <>
          <button
            type="button"
            onClick={pick}
            className="flex h-24 flex-col items-center justify-center gap-1.5 rounded-lg border border-dashed border-rule text-sm hover:bg-muted"
          >
            <ImagePlus aria-hidden="true" className="size-6" />
            Choose a reference image
          </button>
          <p className="text-xs leading-relaxed text-muted-foreground">
            A PNG to draw over: it sits on the grid at the size and place you
            choose, and stays on this device (it isn’t saved in project files or
            exported).
          </p>
        </>
      ) : (
        <TracingSettingsView
          tracing={tracing}
          target={target}
          targetLabel={targetLabel}
          onReplace={pick}
          onRemove={onRemove}
          set={set}
        />
      )}
    </div>
  )
}

function TracingSettingsView({
  tracing,
  target,
  targetLabel,
  onReplace,
  onRemove,
  set,
}: {
  tracing: LoadedTracing
  target: { width: number; height: number }
  targetLabel: string
  onReplace: () => void
  onRemove: () => void
  set: (patch: Partial<TracingSettings>) => void
}) {
  const s = tracing.settings
  const check = sizeCheck(tracing, target, s.crop)
  const place = placeTracing(tracing, target, s)
  const cropped =
    s.crop.top || s.crop.bottom || s.crop.left || s.crop.right
      ? `Cropped to ${check.width} × ${check.height} px. `
      : ''
  const diffs = [
    check.wider &&
      `${Math.abs(check.wider)} px ${check.wider > 0 ? 'wider' : 'narrower'}`,
    check.taller &&
      `${Math.abs(check.taller)} px ${check.taller > 0 ? 'taller' : 'shorter'}`,
  ].filter(Boolean)
  const fits = diffs.length === 0

  return (
    <>
      <div className="flex items-center gap-2 rounded-lg border border-rule-soft p-1.5">
        <div className="flex min-w-0 flex-1 flex-col">
          <span className="truncate text-xs">{tracing.name}</span>
          <span className="font-mono text-[11px] text-muted-foreground">
            {tracing.width} × {tracing.height} px
          </span>
        </div>
        <Button size="sm" variant="outline" onClick={onReplace}>
          Replace
        </Button>
        <Button
          size="icon"
          variant="ghost"
          aria-label="Remove tracing paper"
          onClick={onRemove}
        >
          <Trash2 aria-hidden="true" />
        </Button>
      </div>

      <p
        className={cn(
          'rounded-lg px-2 py-1.5 text-[11px] leading-snug',
          fits ? 'bg-ok text-ok-foreground' : 'bg-warn text-warn-foreground',
        )}
      >
        {cropped}
        {fits
          ? `Same size as the ${targetLabel}.`
          : `The ${targetLabel}; the image is ${diffs.join(' and ')}. Crop, size or anchor it to line up.`}
      </p>

      <Section label="Crop the image (px)">
        <div className="grid grid-cols-2 gap-1">
          {(['top', 'bottom', 'left', 'right'] as const).map((edge) => (
            <div key={edge} className="flex items-center gap-1.5">
              <span className="w-11 text-[11px] text-muted-foreground capitalize">
                {edge}
              </span>
              <Stepper
                label={`Crop ${edge}`}
                value={s.crop[edge]}
                onChange={(n) =>
                  set({ crop: { ...s.crop, [edge]: Math.max(0, n) } })
                }
              />
            </div>
          ))}
        </div>
      </Section>

      <Section label="Size">
        <div
          role="group"
          aria-label="Size"
          className="grid grid-cols-3 gap-[3px] rounded-[10px] border border-rule p-[3px]"
        >
          {SIZES.map((o) => (
            <button
              key={o.value}
              type="button"
              aria-pressed={s.size === o.value}
              onClick={() => set({ size: o.value })}
              className={cn(
                'h-8 rounded-[7px] text-xs',
                s.size === o.value
                  ? 'bg-primary text-primary-foreground'
                  : 'hover:bg-muted',
              )}
            >
              {o.label}
            </button>
          ))}
        </div>
        {s.size === 'custom' && (
          <div className="flex items-center gap-2 text-xs">
            <input
              type="range"
              min={10}
              max={400}
              value={s.customPercent}
              aria-label="Custom size, percent"
              onChange={(e) => set({ customPercent: Number(e.target.value) })}
              className="h-8 flex-1 accent-primary"
            />
            <span className="w-10 text-right font-mono">
              {s.customPercent}%
            </span>
          </div>
        )}
      </Section>

      <div className="flex gap-3">
        <Section label="Anchor">
          <div
            role="group"
            aria-label="Anchor"
            className="grid grid-cols-3 gap-[3px]"
          >
            {ANCHORS.map((name, i) => (
              <button
                key={name}
                type="button"
                aria-pressed={s.anchor === i}
                aria-label={`Anchor ${name}`}
                title={`Anchor ${name}`}
                onClick={() => set({ anchor: i, nudge: { x: 0, y: 0 } })}
                className={cn(
                  'size-6 rounded-[5px] border',
                  s.anchor === i
                    ? 'border-primary bg-primary'
                    : 'border-rule-soft bg-muted hover:bg-accent',
                )}
              />
            ))}
          </div>
        </Section>
        <Section label="Nudge (px · 8 = a char)">
          <div className="grid grid-cols-[auto_1fr] items-center gap-1">
            <span className="text-[11px] text-muted-foreground">x</span>
            <Stepper
              label="Nudge x"
              value={s.nudge.x}
              onChange={(x) => set({ nudge: { ...s.nudge, x } })}
            />
            <span className="text-[11px] text-muted-foreground">y</span>
            <Stepper
              label="Nudge y"
              value={s.nudge.y}
              onChange={(y) => set({ nudge: { ...s.nudge, y } })}
            />
          </div>
        </Section>
      </div>

      <Section label={`Opacity · ${Math.round(s.opacity * 100)}%`}>
        <input
          type="range"
          min={10}
          max={100}
          value={Math.round(s.opacity * 100)}
          aria-label="Opacity"
          onChange={(e) => set({ opacity: Number(e.target.value) / 100 })}
          className="h-7 accent-primary"
        />
      </Section>

      <Segmented
        label="Layer"
        size="sm"
        value={s.layer}
        options={[
          { value: 'over', label: 'Over all' },
          { value: 'under', label: 'Under empty' },
        ]}
        onChange={(layer) => set({ layer })}
      />

      <p className="font-mono text-[10.5px] leading-snug text-muted-foreground">
        At x {fmt(place.target.x)}, y {fmt(place.target.y)} ·{' '}
        {fmt(place.target.width)} × {fmt(place.target.height)} px ·{' '}
        {fmt(place.scaleX * 100)}%
        {place.scaleX !== place.scaleY ? ` × ${fmt(place.scaleY * 100)}%` : ''}
      </p>
    </>
  )
}
