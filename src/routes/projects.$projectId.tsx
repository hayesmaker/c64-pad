import { Link, Outlet, createFileRoute, notFound } from '@tanstack/react-router'
import { ProjectNotFoundError, openSession } from '@/storage/sessions'
import { WorksheetLayout } from '@/components/worksheet/worksheet-layout'
import { Breadcrumbs } from '@/components/worksheet/breadcrumbs'

export const Route = createFileRoute('/projects/$projectId')({
  loader: async ({ params }) => {
    try {
      // Opens (or reuses) the session; pages read it via useCurrentProject.
      await openSession(params.projectId)
    } catch (e) {
      if (e instanceof ProjectNotFoundError) throw notFound()
      throw e
    }
  },
  component: Outlet,
  notFoundComponent: ProjectMissing,
})

function ProjectMissing() {
  return (
    <WorksheetLayout
      title="Not found"
      breadcrumbs={
        <Breadcrumbs
          items={[{ label: 'My Projects', link: { to: '/projects' } }]}
        />
      }
      className="p-6"
    >
      <p>This project doesn’t exist on this device.</p>
      <Link to="/projects" className="mt-4 inline-block text-primary underline">
        Back to My Projects
      </Link>
    </WorksheetLayout>
  )
}
