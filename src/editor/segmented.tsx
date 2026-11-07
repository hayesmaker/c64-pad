import { cn } from '@/lib/utils'

/** Two-or-more option toggle in the worksheet style. */
export function Segmented<TValue extends string>({
  label,
  value,
  options,
  onChange,
  size = 'md',
}: {
  label: string
  value: TValue
  options: ReadonlyArray<{ value: TValue; label: string }>
  onChange: (value: TValue) => void
  size?: 'sm' | 'md'
}) {
  return (
    <div
      role="group"
      aria-label={label}
      className="flex gap-[3px] rounded-[10px] border border-rule p-[3px]"
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
