import { Fragment } from 'react'
import { Link } from '@tanstack/react-router'
import type { LinkProps } from '@tanstack/react-router'

export interface Crumb {
  label: string
  /** Omit for the current page. */
  link?: LinkProps
}

export function Breadcrumbs({ items }: { items: Array<Crumb> }) {
  return (
    <nav
      aria-label="Breadcrumb"
      className="flex min-w-0 items-center gap-2 text-sm"
    >
      <Link to="/" className="font-semibold tracking-[-0.01em] text-foreground">
        C64-Pad
      </Link>
      {items.map((item) => (
        <Fragment key={item.label}>
          <span aria-hidden="true" className="text-rule">
            /
          </span>
          {item.link ? (
            <Link
              {...item.link}
              className="truncate text-[#55534d] hover:text-foreground"
            >
              {item.label}
            </Link>
          ) : (
            <span aria-current="page" className="truncate">
              {item.label}
            </span>
          )}
        </Fragment>
      ))}
    </nav>
  )
}
