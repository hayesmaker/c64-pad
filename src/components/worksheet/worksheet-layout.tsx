import type { ReactNode } from 'react'
import { cn } from '@/lib/utils'

interface WorksheetLayoutProps {
  /** Centred sheet title, e.g. "Sprite Worksheet". */
  title: string
  /** Left of the header: usually a Breadcrumbs element. */
  breadcrumbs?: ReactNode
  /** Right of the header: page actions (Export, Run…). */
  actions?: ReactNode
  /** Edge tabs shown down the right side of the sheet. */
  tabs?: ReactNode
  className?: string
  children: ReactNode
}

/**
 * A page drawn as a paper worksheet on a desk: bordered sheet, header with the
 * title between double rules, optional edge tabs on the right.
 */
export function WorksheetLayout({
  title,
  breadcrumbs,
  actions,
  tabs,
  className,
  children,
}: WorksheetLayoutProps) {
  return (
    <div className="flex min-h-dvh bg-desk pt-[env(safe-area-inset-top)] pb-[env(safe-area-inset-bottom)]">
      <div
        className={cn(
          'my-3 ml-3 flex min-w-0 flex-1 flex-col overflow-hidden rounded-[10px] border border-rule bg-paper',
          !tabs && 'mr-3',
        )}
      >
        <header className="grid h-14 shrink-0 grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-center gap-4 border-b border-rule-soft px-5">
          <div className="flex min-w-0 items-center gap-4">
            <div className="min-w-0 shrink">{breadcrumbs}</div>
            <DoubleRule />
          </div>
          <h1 className="text-2xl font-light tracking-[0.01em] whitespace-nowrap">
            {title}
          </h1>
          <div className="flex min-w-0 items-center gap-4">
            <DoubleRule />
            <div className="flex shrink-0 items-center gap-2">{actions}</div>
          </div>
        </header>
        <div className={cn('min-h-0 flex-1', className)}>{children}</div>
      </div>
      {tabs}
    </div>
  )
}

function DoubleRule() {
  return (
    <div
      aria-hidden="true"
      className="h-[3px] min-w-6 flex-1 border-y border-rule"
    />
  )
}
