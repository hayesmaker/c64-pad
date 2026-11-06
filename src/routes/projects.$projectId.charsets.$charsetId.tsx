import { createFileRoute, notFound } from '@tanstack/react-router'
import { PlaceholderPage } from '@/components/layout/placeholder-page'
import { SaveStatus } from '@/components/save-status'
import { editorTabs } from '@/components/worksheet/editor-tabs'
import { findAsset } from '@/c64/project'
import { useCurrentProject } from '@/storage/use-current-project'

export const Route = createFileRoute(
  '/projects/$projectId/charsets/$charsetId',
)({
  component: CharsetEditor,
})

function CharsetEditor() {
  const { charsetId } = Route.useParams()
  const { project, status, error } = useCurrentProject()
  const asset = findAsset(project, 'charsets', charsetId)
  if (!asset) throw notFound()
  return (
    <PlaceholderPage
      title="Character Worksheet"
      crumbs={[
        { label: 'My Projects', link: { to: '/projects' } },
        {
          label: project.name,
          link: {
            to: '/projects/$projectId',
            params: { projectId: project.id },
          },
        },
        { label: asset.name },
      ]}
      actions={<SaveStatus status={status} error={error} />}
      tabs={editorTabs(project, 'charsets')}
    >
      Charset “{asset.name}”: the editor arrives in a later milestone.
    </PlaceholderPage>
  )
}
