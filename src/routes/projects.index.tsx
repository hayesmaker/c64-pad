import { createFileRoute, redirect } from '@tanstack/react-router'

/** The projects list lives on the home page now; keep old links working. */
export const Route = createFileRoute('/projects/')({
  beforeLoad: () => {
    throw redirect({ to: '/', replace: true })
  },
})
