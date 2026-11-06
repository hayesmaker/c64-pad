import { createFileRoute } from '@tanstack/react-router'
import { PlaceholderPage } from '@/components/layout/placeholder-page'
import { editorTabs } from '@/components/worksheet/editor-tabs'

export const Route = createFileRoute('/projects/$projectId/maps/$mapId')({
  component: MapEditor,
})

function MapEditor() {
  const { projectId, mapId } = Route.useParams()
  return (
    <PlaceholderPage
      title="Screen Worksheet"
      crumbs={[
        { label: 'My Projects', link: { to: '/projects' } },
        {
          label: projectId,
          link: { to: '/projects/$projectId', params: { projectId } },
        },
        { label: mapId },
      ]}
      tabs={editorTabs(projectId, 'maps')}
    >
      Map {mapId}
    </PlaceholderPage>
  )
}
