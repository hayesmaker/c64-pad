import { createFileRoute } from '@tanstack/react-router'
import { PlaceholderPage } from '@/components/layout/placeholder-page'

export const Route = createFileRoute(
  '/projects/$projectId/charsets/$charsetId',
)({ component: CharsetEditor })

function CharsetEditor() {
  const { charsetId } = Route.useParams()
  return (
    <PlaceholderPage title="Character Worksheet">
      Charset {charsetId}
    </PlaceholderPage>
  )
}
