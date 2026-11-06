import { useMemo } from 'react'
import { useNavigate } from '@tanstack/react-router'
import {
  ChevronLeft,
  ChevronRight,
  ClipboardPaste,
  Copy,
  CopyPlus,
  EllipsisVertical,
  Plus,
  Trash2,
} from 'lucide-react'
import { SPRITE_HEIGHT } from '@/c64/sprite'
import { SPRITE_RENDER_WIDTH, renderSprite } from '@/c64/sprite-set'
import { IndexedCanvas } from '@/components/c64/indexed-canvas'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { cn } from '@/lib/utils'
import type { Project } from '@/c64/project'
import type { Sprite } from '@/c64/sprite'
import type { SpriteSet } from '@/c64/sprite-set'

export interface StripActions {
  select: (id: string) => void
  add: () => void
  duplicate: () => void
  copy: () => void
  paste: (() => void) | null
  move: (delta: -1 | 1) => void
  remove: (() => void) | null
}

function Thumb({ set, sprite }: { set: SpriteSet; sprite: Sprite }) {
  const image = useMemo(
    () => ({
      width: SPRITE_RENDER_WIDTH,
      height: SPRITE_HEIGHT,
      pixels: renderSprite(set, sprite),
    }),
    [set, sprite],
  )
  return <IndexedCanvas image={image} label="" className="w-10" />
}

/** Sprites in the set, the set switcher and per-sprite actions. */
export function SpriteStrip({
  project,
  set,
  selectedId,
  actions,
}: {
  project: Project
  set: SpriteSet
  selectedId: string
  actions: StripActions
}) {
  const navigate = useNavigate()
  const index = set.sprites.findIndex((s) => s.id === selectedId)

  return (
    <div className="flex items-center gap-2">
      <div className="flex shrink-0 flex-col gap-0.5">
        <span className="text-[11px] text-muted-foreground">
          Sprites in set
        </span>
        <Select
          value={set.id}
          onValueChange={(setId) =>
            void navigate({
              to: '/projects/$projectId/sprites/$setId',
              params: { projectId: project.id, setId },
            })
          }
        >
          <SelectTrigger
            size="sm"
            className="h-8 max-w-[150px] text-xs"
            aria-label="Sprite set"
          >
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {project.spriteSets.map((s) => (
              <SelectItem key={s.id} value={s.id}>
                {s.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <ul className="flex min-w-0 gap-1.5 overflow-x-auto py-0.5">
        {set.sprites.map((sprite, i) => (
          <li key={sprite.id} className="shrink-0">
            <button
              type="button"
              aria-label={`Sprite ${i}, ${sprite.name}`}
              aria-current={sprite.id === selectedId}
              onClick={() => actions.select(sprite.id)}
              className={cn(
                'relative flex h-12 w-16 items-center justify-center rounded-lg border bg-c64-screen',
                sprite.id === selectedId
                  ? 'border-primary ring-2 ring-primary'
                  : 'border-rule',
              )}
            >
              <Thumb set={set} sprite={sprite} />
              <span className="absolute bottom-0 left-1 font-mono text-[10px] text-white">
                {i}
              </span>
            </button>
          </li>
        ))}
      </ul>
      <Button
        variant="outline"
        className="h-12 w-14 shrink-0 flex-col gap-0 border-dashed text-[11px]"
        onClick={actions.add}
      >
        <Plus aria-hidden="true" />
        Add
      </Button>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            variant="ghost"
            size="icon"
            aria-label="Sprite actions"
            className="shrink-0"
          >
            <EllipsisVertical aria-hidden="true" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" side="top">
          <DropdownMenuItem onSelect={actions.duplicate}>
            <CopyPlus aria-hidden="true" /> Duplicate sprite
          </DropdownMenuItem>
          <DropdownMenuItem onSelect={actions.copy}>
            <Copy aria-hidden="true" /> Copy pixels
          </DropdownMenuItem>
          <DropdownMenuItem
            disabled={!actions.paste}
            onSelect={() => actions.paste?.()}
          >
            <ClipboardPaste aria-hidden="true" /> Paste pixels
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem
            disabled={index <= 0}
            onSelect={() => actions.move(-1)}
          >
            <ChevronLeft aria-hidden="true" /> Move left
          </DropdownMenuItem>
          <DropdownMenuItem
            disabled={index >= set.sprites.length - 1}
            onSelect={() => actions.move(1)}
          >
            <ChevronRight aria-hidden="true" /> Move right
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem
            variant="destructive"
            disabled={!actions.remove}
            onSelect={() => actions.remove?.()}
          >
            <Trash2 aria-hidden="true" /> Delete sprite
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  )
}
