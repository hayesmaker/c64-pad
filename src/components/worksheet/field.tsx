import type { ReactNode } from 'react'
import { cn } from '@/lib/utils'

/** Worksheet-style labelled field: small grey label above the control. */
export function Field({
  label,
  className,
  children,
}: {
  label: string
  className?: string
  children: ReactNode
}) {
  return (
    <label
      className={cn(
        'flex flex-col gap-[3px] text-xs text-muted-foreground',
        className,
      )}
    >
      {label}
      {children}
    </label>
  )
}

export const worksheetInputClass =
  'h-[38px] rounded-lg border border-input bg-paper px-2.5 text-[15px] text-foreground'
