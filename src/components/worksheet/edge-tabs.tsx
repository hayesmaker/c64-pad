import { Link } from '@tanstack/react-router'
import type { LinkProps } from '@tanstack/react-router'
import { cn } from '@/lib/utils'

export interface EdgeTab {
  label: string
  link: LinkProps
  current?: boolean
}

/** Vertical section tabs on the sheet's right edge, like a workbook's page tabs. */
export function EdgeTabs({ tabs }: { tabs: Array<EdgeTab> }) {
  return (
    <nav
      aria-label="Editors"
      className="flex w-11 shrink-0 flex-col gap-1.5 pt-[84px]"
    >
      {tabs.map((tab) => (
        <Link
          key={tab.label}
          {...tab.link}
          aria-current={tab.current ? 'page' : undefined}
          className={cn(
            'flex h-[120px] rotate-180 items-center justify-center rounded-l-lg text-[13px] font-semibold tracking-[0.14em] [writing-mode:vertical-rl]',
            tab.current
              ? 'bg-tab text-tab-foreground'
              : 'bg-tab-inactive text-tab-inactive-foreground hover:bg-[#c6c4bb]',
          )}
        >
          {tab.label}
        </Link>
      ))}
    </nav>
  )
}
