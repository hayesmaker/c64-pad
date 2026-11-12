import { ChevronLeft, ChevronRight, Eye, EyeOff, Pin, X } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Segmented } from '../segmented'
import type { useCharTracing } from './use-char-tracing'

const iconButton =
  'flex size-8 shrink-0 items-center justify-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground disabled:opacity-40 disabled:hover:bg-transparent [&_svg]:size-4'

/**
 * Character Worksheet: the screen tracing under the selected char, where
 * it's taken from, and how it's shown.
 */
export function CharTracingPanel({
  trace,
}: {
  trace: ReturnType<typeof useCharTracing>
}) {
  const { prefs, setPrefs, sources, index, source, sourceMap, tracedMaps } =
    trace
  const { pin, pinMap } = trace

  return (
    <section
      aria-label="Tracing from screens"
      className="flex flex-col gap-1.5 rounded-lg border border-rule-soft p-2"
    >
      <div className="flex items-center gap-1">
        <span className="flex-1 text-xs text-muted-foreground">
          Tracing from screens
        </span>
        {source && (
          <button
            type="button"
            className={iconButton}
            aria-label={
              prefs.visible ? 'Hide char tracing' : 'Show char tracing'
            }
            onClick={() => setPrefs((p) => ({ ...p, visible: !p.visible }))}
          >
            {prefs.visible ? <Eye /> : <EyeOff />}
          </button>
        )}
      </div>

      {pin && (
        <div className="flex flex-col gap-1 rounded-md bg-muted p-1 text-[11px] leading-tight">
          <div className="flex items-center gap-1.5 px-1 pt-0.5">
            <Pin aria-hidden="true" className="size-3.5 shrink-0" />
            <span className="min-w-0 truncate">
              Pinned to {pinMap?.name ?? 'a removed screen'} ·{' '}
              <span className="font-mono">
                {pin.x},{pin.y}
              </span>
            </span>
          </div>
          <button
            type="button"
            className="flex h-8 items-center justify-center gap-1 rounded-md border border-rule-soft bg-background px-2 text-xs hover:bg-accent [&_svg]:size-3.5"
            onClick={() => trace.setPinned(false)}
          >
            <X aria-hidden="true" />
            Remove pin
          </button>
        </div>
      )}

      {!source ? (
        <p className="text-[11px] leading-snug text-muted-foreground">
          {tracedMaps.length === 0
            ? 'None of the screens using this charset has tracing paper yet.'
            : 'This char isn’t on a traced screen yet. Paint it where it belongs, or use the Pin tool on the Screen Worksheet.'}
        </p>
      ) : (
        <>
          <div className="flex items-center gap-1">
            <button
              type="button"
              className={iconButton}
              aria-label="Previous place"
              disabled={sources.length < 2}
              onClick={() => trace.step(-1)}
            >
              <ChevronLeft />
            </button>
            <div className="flex min-w-0 flex-1 flex-col items-center leading-tight">
              <span className="max-w-full truncate text-xs">
                {sourceMap?.name}
              </span>
              <span
                className="font-mono text-[11px] text-muted-foreground"
                aria-label={`Column ${source.x}, row ${source.y}, ${index + 1} of ${sources.length}`}
              >
                {source.x},{source.y} · {index + 1}/{sources.length}
              </span>
            </div>
            <button
              type="button"
              className={iconButton}
              aria-label="Next place"
              disabled={sources.length < 2}
              onClick={() => trace.step(1)}
            >
              <ChevronRight />
            </button>
            <button
              type="button"
              aria-pressed={source.pinned}
              aria-label={
                source.pinned
                  ? 'Pinned to this place'
                  : 'Pin the char to this place'
              }
              title={source.pinned ? 'Pinned here' : 'Pin here'}
              disabled={source.pinned}
              className={cn(
                iconButton,
                source.pinned &&
                  'bg-primary text-primary-foreground disabled:opacity-100 disabled:hover:bg-primary',
              )}
              onClick={() => trace.setPinned(true)}
            >
              <Pin />
            </button>
          </div>

          <div className="flex items-center gap-2 text-[11px] text-muted-foreground">
            <input
              type="range"
              min={10}
              max={100}
              value={Math.round(prefs.opacity * 100)}
              aria-label="Char tracing opacity"
              onChange={(e) =>
                setPrefs((p) => ({
                  ...p,
                  opacity: Number(e.target.value) / 100,
                }))
              }
              className="h-7 min-w-0 flex-1 accent-primary"
            />
            <span className="w-8 text-right font-mono">
              {Math.round(prefs.opacity * 100)}%
            </span>
          </div>
          <Segmented
            label="Char tracing layer"
            size="sm"
            value={prefs.layer}
            options={[
              { value: 'over', label: 'Over all' },
              { value: 'under', label: 'Under empty' },
            ]}
            onChange={(layer) => setPrefs((p) => ({ ...p, layer }))}
          />
        </>
      )}
    </section>
  )
}
