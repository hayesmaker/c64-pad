import type { ReactNode } from 'react'

/** Temporary page body for routes whose editors aren't built yet. */
export function PlaceholderPage({
  title,
  children,
}: {
  title: string
  children?: ReactNode
}) {
  return (
    <div className="p-6">
      <h1 className="text-2xl font-semibold">{title}</h1>
      <div className="mt-2 text-muted-foreground">{children}</div>
    </div>
  )
}
