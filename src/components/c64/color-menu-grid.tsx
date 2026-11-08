import { COLOR_NAMES } from '@/c64/palette'
import { DropdownMenuItem } from '@/components/ui/dropdown-menu'
import { cn } from '@/lib/utils'
import { usePalette } from './palette-context'
import type { C64Color } from '@/c64/palette'

/**
 * The 16 C64 colours as swatches inside a dropdown menu, drawn in the
 * project's palette; the current one is ringed.
 */
export function ColorMenuGrid({
  value,
  onPick,
}: {
  value: C64Color | null
  onPick: (color: C64Color) => void
}) {
  const palette = usePalette()
  return (
    <div className="grid grid-cols-4 gap-1 p-1">
      {palette.hex.map((hex, index) => (
        <DropdownMenuItem
          key={index}
          aria-label={COLOR_NAMES[index]}
          title={`${COLOR_NAMES[index]} (${index})`}
          onSelect={() => onPick(index)}
          className={cn(
            'h-9 min-h-0 justify-center border border-rule p-0',
            value === index && 'ring-2 ring-primary',
          )}
          style={{ background: hex }}
        />
      ))}
    </div>
  )
}
