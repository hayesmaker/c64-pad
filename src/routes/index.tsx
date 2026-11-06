import { Link, createFileRoute } from '@tanstack/react-router'
import { WorksheetLayout } from '@/components/worksheet/worksheet-layout'
import { Breadcrumbs } from '@/components/worksheet/breadcrumbs'
import { Button } from '@/components/ui/button'

export const Route = createFileRoute('/')({ component: Home })

function Home() {
  return (
    <WorksheetLayout
      title="C64-Pad"
      breadcrumbs={<Breadcrumbs items={[]} />}
      className="p-6"
    >
      <p className="text-lg">
        Design Commodore 64 sprites, character sets and screens.
      </p>
      <Button asChild size="lg" className="mt-6">
        <Link to="/projects">My Projects</Link>
      </Button>
    </WorksheetLayout>
  )
}
