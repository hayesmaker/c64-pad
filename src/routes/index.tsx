import { createFileRoute } from '@tanstack/react-router'
import { Button } from '@/components/ui/button'

export const Route = createFileRoute('/')({ component: Home })

function Home() {
  return (
    <div className="p-8">
      <h1 className="text-4xl font-bold">C64-Pad</h1>
      <p className="mt-4 text-lg">
        Commodore 64 sprite, charset and map editor.
      </p>
      <Button className="mt-6">Start</Button>
    </div>
  )
}
