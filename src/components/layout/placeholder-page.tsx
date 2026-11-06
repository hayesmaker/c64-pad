import type { ReactNode } from 'react'
import { WorksheetLayout } from '@/components/worksheet/worksheet-layout'
import { Breadcrumbs } from '@/components/worksheet/breadcrumbs'
import type { Crumb } from '@/components/worksheet/breadcrumbs'
import { EdgeTabs } from '@/components/worksheet/edge-tabs'
import type { EdgeTab } from '@/components/worksheet/edge-tabs'

/** Temporary page body for routes whose content isn't built yet. */
export function PlaceholderPage({
  title,
  crumbs = [],
  tabs,
  children,
}: {
  title: string
  crumbs?: Array<Crumb>
  tabs?: Array<EdgeTab>
  children?: ReactNode
}) {
  return (
    <WorksheetLayout
      title={title}
      breadcrumbs={<Breadcrumbs items={crumbs} />}
      tabs={tabs && <EdgeTabs tabs={tabs} />}
      className="p-6 text-muted-foreground"
    >
      {children}
    </WorksheetLayout>
  )
}
