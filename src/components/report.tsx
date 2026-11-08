import { Check, TriangleAlert, X } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { ReactNode } from 'react'

/** A titled part of a report dialog (import, merge). */
export function ReportSection({
  title,
  children,
}: {
  title: string
  children: ReactNode
}) {
  return (
    <section className="flex flex-col gap-2">
      <h3 className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
        {title}
      </h3>
      {children}
    </section>
  )
}

/** ✓ or ✗ and a line of text. */
export function CheckLine({
  ok,
  children,
}: {
  ok: boolean
  children: ReactNode
}) {
  const Icon = ok ? Check : X
  return (
    <span className="flex items-start gap-2">
      <Icon
        aria-label={ok ? 'OK' : 'Problem'}
        className={cn(
          'mt-0.5 size-4 shrink-0',
          ok ? 'text-ok-foreground' : 'text-destructive',
        )}
      />
      <span>{children}</span>
    </span>
  )
}

/** A warning that doesn't block anything. */
export function Note({ children }: { children: ReactNode }) {
  return (
    <span className="flex items-start gap-2 rounded-md bg-warn px-2.5 py-1.5 text-warn-foreground">
      <TriangleAlert aria-hidden="true" className="mt-0.5 size-4 shrink-0" />
      <span>{children}</span>
    </span>
  )
}
