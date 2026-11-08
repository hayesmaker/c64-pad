import { Link } from '@tanstack/react-router'
import { EllipsisVertical, Plus } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import type { ReactNode } from 'react'
import type { LinkProps } from '@tanstack/react-router'

/** One kind of asset on the Project Worksheet, with its "New…" button. */
export function AssetSection({
  title,
  addLabel,
  addDisabledReason,
  onAdd,
  children,
}: {
  title: string
  addLabel: string
  addDisabledReason?: string
  onAdd: () => void
  children: ReactNode
}) {
  return (
    <section className="flex flex-col gap-3">
      <div className="flex items-center gap-3 border-b border-rule-soft pb-2">
        <h2 className="text-lg font-medium">{title}</h2>
        <Button
          variant="outline"
          className="ml-auto"
          disabled={!!addDisabledReason}
          title={addDisabledReason}
          onClick={onAdd}
        >
          <Plus aria-hidden="true" />
          {addLabel}
        </Button>
      </div>
      <ul className="grid grid-cols-[repeat(auto-fill,minmax(230px,1fr))] gap-4">
        {children}
      </ul>
    </section>
  )
}

/** An asset's card: thumbnail and name (opening its editor), and its menu. */
export function AssetCard({
  name,
  meta,
  link,
  thumbnail,
  menu,
}: {
  name: string
  meta: string
  link: LinkProps
  thumbnail: ReactNode
  menu: ReactNode
}) {
  return (
    <li className="relative flex flex-col gap-2 rounded-lg border border-rule bg-paper p-2 hover:border-primary">
      {thumbnail}
      <div className="flex flex-col px-1 pb-1">
        <Link
          {...link}
          className="pr-10 font-medium after:absolute after:inset-0"
        >
          {name}
        </Link>
        <span className="text-xs text-muted-foreground">{meta}</span>
      </div>
      <div className="absolute right-1 bottom-1 z-10">{menu}</div>
    </li>
  )
}

/** Rename / Duplicate / Delete for one asset. */
export function AssetMenu({
  name,
  onRename,
  onDuplicate,
  onDelete,
}: {
  name: string
  onRename: () => void
  onDuplicate: () => void
  onDelete: () => void
}) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" aria-label={`Actions for ${name}`}>
          <EllipsisVertical aria-hidden="true" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem onSelect={onRename}>Rename</DropdownMenuItem>
        <DropdownMenuItem onSelect={onDuplicate}>Duplicate</DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem variant="destructive" onSelect={onDelete}>
          Delete
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
