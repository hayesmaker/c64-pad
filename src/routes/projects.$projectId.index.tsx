import { createFileRoute } from '@tanstack/react-router'
import { PlaceholderPage } from '@/components/layout/placeholder-page'

export const Route = createFileRoute('/projects/$projectId/')({
  component: Project,
})

function Project() {
  const { projectId } = Route.useParams()
  return (
    <PlaceholderPage title="Project">
      Project {projectId}: sprite sets, charsets and maps will be listed here.
    </PlaceholderPage>
  )
}
