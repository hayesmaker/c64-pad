import { createFileRoute, notFound } from '@tanstack/react-router'
import { findAsset } from '@/c64/project'
import { useCurrentProject } from '@/storage/use-current-project'
import { SpriteDesigner } from '@/editor/sprite/sprite-designer'

export const Route = createFileRoute('/projects/$projectId/sprites/$setId')({
  component: SpriteDesignerPage,
})

function SpriteDesignerPage() {
  const { setId } = Route.useParams()
  const { session, project, status, error } = useCurrentProject()
  const set = findAsset(project, 'spriteSets', setId)
  if (!set) throw notFound()
  return (
    <SpriteDesigner
      key={set.id}
      session={session}
      project={project}
      set={set}
      status={status}
      error={error}
    />
  )
}
