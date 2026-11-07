import { createFileRoute, notFound } from '@tanstack/react-router'
import { findAsset } from '@/c64/project'
import { useCurrentProject } from '@/storage/use-current-project'
import { CharsetDesigner } from '@/editor/charset/charset-designer'

export const Route = createFileRoute(
  '/projects/$projectId/charsets/$charsetId',
)({
  component: CharsetDesignerPage,
})

function CharsetDesignerPage() {
  const { charsetId } = Route.useParams()
  const { session, project, status, error } = useCurrentProject()
  const charset = findAsset(project, 'charsets', charsetId)
  if (!charset) throw notFound()
  return (
    <CharsetDesigner
      key={charset.id}
      session={session}
      project={project}
      charset={charset}
      status={status}
      error={error}
    />
  )
}
