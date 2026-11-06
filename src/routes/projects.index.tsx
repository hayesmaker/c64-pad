import { createFileRoute } from '@tanstack/react-router'
import { PlaceholderPage } from '@/components/layout/placeholder-page'

export const Route = createFileRoute('/projects/')({ component: Projects })

function Projects() {
  return (
    <PlaceholderPage title="My Projects" crumbs={[{ label: 'My Projects' }]}>
      No projects yet.
    </PlaceholderPage>
  )
}
