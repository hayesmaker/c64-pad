import { Link, Outlet, createFileRoute, notFound } from '@tanstack/react-router'
import { ProjectNotFoundError, openSession } from '@/storage/sessions'
import { WorksheetLayout } from '@/components/worksheet/worksheet-layout'
import { Breadcrumbs } from '@/components/worksheet/breadcrumbs'
import { PaletteProvider } from '@/components/c64/palette-context'
import { useCurrentProject } from '@/storage/use-current-project'

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
  component: ProjectShell,
  notFoundComponent: ProjectMissing,
})

/** Every page of an open project draws in the project's palette. */
function ProjectShell() {
  const { project } = useCurrentProject()
  return (
    <PaletteProvider id={project.palette}>
      <Outlet />
    </PaletteProvider>
  )
}

function ProjectMissing() {
  return (
    <WorksheetLayout
      title="Not found"
      breadcrumbs={<Breadcrumbs items={[]} />}
      className="p-6"
    >
      <p>This project doesn’t exist on this device.</p>
      <Link to="/" className="mt-4 inline-block text-primary underline">
        Back to My Projects
      </Link>
    </WorksheetLayout>
  )
}
