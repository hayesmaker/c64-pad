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
      <Link
        to="/"
        className="shrink-0 font-semibold tracking-[-0.01em] whitespace-nowrap text-foreground"
      >
        C64-Pad
      </Link>
      {items.map((item) => (
        <Fragment key={item.label}>
          <span aria-hidden="true" className="shrink-0 text-rule">
            /
          </span>
          {item.link ? (
            <Link
              {...item.link}
              className="max-w-[160px] truncate text-ink-soft hover:text-foreground"
            >
              {item.label}
            </Link>
          ) : (
            <span aria-current="page" className="max-w-[200px] truncate">
              {item.label}
            </span>
          )}
        </Fragment>
      ))}
    </nav>
  )
}
