import { createFileRoute, notFound } from '@tanstack/react-router'
import { findAsset } from '@/c64/project'
import { useCurrentProject } from '@/storage/use-current-project'
import { MapDesigner } from '@/editor/map/map-designer'

export const Route = createFileRoute('/projects/$projectId/maps/$mapId')({
  component: MapDesignerPage,
})

function MapDesignerPage() {
  const { mapId } = Route.useParams()
  const { session, project, status, error } = useCurrentProject()
  const map = findAsset(project, 'maps', mapId)
  if (!map) throw notFound()
  const charset = findAsset(project, 'charsets', map.charsetId)
  if (!charset) throw notFound()
  return (
    <MapDesigner
      key={map.id}
      session={session}
      project={project}
      map={map}
      charset={charset}
      status={status}
      error={error}
    />
  )
}
