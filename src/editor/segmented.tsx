import { cn } from '@/lib/utils'

/** Two-or-more option toggle in the worksheet style. */
export function Segmented<TValue extends string>({
  label,
  value,
  options,
  onChange,
  size = 'md',
  columns,
}: {
  label: string
  value: TValue
  options: ReadonlyArray<{ value: TValue; label: string }>
  onChange: (value: TValue) => void
  size?: 'sm' | 'md'
  /** Lay the options out in rows of this many (default: one row). */
  columns?: number
}) {
  return (
    <div
      role="group"
      aria-label={label}
      className={cn(
        'gap-[3px] rounded-[10px] border border-rule p-[3px]',
        columns ? 'grid' : 'flex',
      )}
      style={
        columns
          ? { gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))` }
          : undefined
      }
    >
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          aria-pressed={o.value === value}
          onClick={() => onChange(o.value)}
          className={cn(
            'flex-1 rounded-[7px] px-2.5',
            size === 'sm' ? 'h-8 text-xs' : 'h-9 text-sm',
            o.value === value
              ? 'bg-primary text-primary-foreground'
              : 'hover:bg-muted',
          )}
        >
          {o.label}
        </button>
      ))}
    </div>
  )
}
