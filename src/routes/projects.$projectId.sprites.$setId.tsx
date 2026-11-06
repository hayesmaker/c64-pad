import { createFileRoute } from '@tanstack/react-router'
import { PlaceholderPage } from '@/components/layout/placeholder-page'

export const Route = createFileRoute('/projects/$projectId/sprites/$setId')({
  component: SpriteDesigner,
})

function SpriteDesigner() {
  const { setId } = Route.useParams()
  return (
    <PlaceholderPage title="Sprite Worksheet">
      Sprite set {setId}
    </PlaceholderPage>
  )
}
