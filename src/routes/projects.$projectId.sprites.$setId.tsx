import { createFileRoute } from '@tanstack/react-router'
import { PlaceholderPage } from '@/components/layout/placeholder-page'
import { editorTabs } from '@/components/worksheet/editor-tabs'

export const Route = createFileRoute('/projects/$projectId/sprites/$setId')({
  component: SpriteDesigner,
})

function SpriteDesigner() {
  const { projectId, setId } = Route.useParams()
  return (
    <PlaceholderPage
      title="Sprite Worksheet"
      crumbs={[
        { label: 'My Projects', link: { to: '/projects' } },
        {
          label: projectId,
          link: { to: '/projects/$projectId', params: { projectId } },
        },
        { label: setId },
      ]}
      tabs={editorTabs(projectId, 'sprites')}
    >
      Sprite set {setId}
    </PlaceholderPage>
  )
}
