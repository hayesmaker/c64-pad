import { createFileRoute } from '@tanstack/react-router'
import { PlaceholderPage } from '@/components/layout/placeholder-page'
import { editorTabs } from '@/components/worksheet/editor-tabs'

export const Route = createFileRoute(
  '/projects/$projectId/charsets/$charsetId',
)({
  component: CharsetEditor,
})

function CharsetEditor() {
  const { projectId, charsetId } = Route.useParams()
  return (
    <PlaceholderPage
      title="Character Worksheet"
      crumbs={[
        { label: 'My Projects', link: { to: '/projects' } },
        {
          label: projectId,
          link: { to: '/projects/$projectId', params: { projectId } },
        },
        { label: charsetId },
      ]}
      tabs={editorTabs(projectId, 'charsets')}
    >
      Charset {charsetId}
    </PlaceholderPage>
  )
}
