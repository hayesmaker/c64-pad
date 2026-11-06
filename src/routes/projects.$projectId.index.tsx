import { createFileRoute } from '@tanstack/react-router'
import { PlaceholderPage } from '@/components/layout/placeholder-page'

export const Route = createFileRoute('/projects/$projectId/')({
  component: Project,
})

function Project() {
  const { projectId } = Route.useParams()
  return (
    <PlaceholderPage
      title="Project"
      crumbs={[
        { label: 'My Projects', link: { to: '/projects' } },
        { label: projectId },
      ]}
    >
      Sprite sets, charsets and maps will be listed here.
    </PlaceholderPage>
  )
}
