import { Link } from '@tanstack/react-router'

const navLinkClass =
  'rounded-md px-3 py-2 text-sm font-medium text-muted-foreground hover:text-foreground data-[status=active]:text-foreground'

export function AppHeader() {
  return (
    <header className="flex items-center gap-2 border-b px-4 pt-[env(safe-area-inset-top)]">
      <Link to="/" className="mr-4 py-3 text-lg font-bold tracking-tight">
        C64-Pad
      </Link>
      <nav className="flex gap-1">
        <Link
          to="/projects"
          className={navLinkClass}
          activeOptions={{ includeSearch: false }}
        >
          My Projects
        </Link>
      </nav>
    </header>
  )
}
