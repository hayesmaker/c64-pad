import { createFileRoute } from '@tanstack/react-router'
import { PlaceholderPage } from '@/components/layout/placeholder-page'

export const Route = createFileRoute('/projects/$projectId/maps/$mapId')({
  component: MapEditor,
})

function MapEditor() {
  const { mapId } = Route.useParams()
  return <PlaceholderPage title="Screen Worksheet">Map {mapId}</PlaceholderPage>
}
