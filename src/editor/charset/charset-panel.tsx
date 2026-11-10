import { useState } from 'react'
import { ArrowLeftRight, ClipboardPaste, Copy, Ellipsis } from 'lucide-react'
import {
  CHARSET_BYTES,
  getCharBytes,
  petsciiData,
  setCharBytes,
} from '@/c64/charset'
import { ConfirmDialog } from '@/components/dialogs'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { cn } from '@/lib/utils'
import { hex } from '../hex'
import { useShowAttributes } from '../attribute-overlay'
import { CharAttributeControls } from './char-attributes'
import { CharsetSheet } from './charset-sheet'
import type { Charmap } from '@/c64/charmap'
import type { Charset, PetsciiSet } from '@/c64/charset'

/** Char copied with "Copy", kept for the app session (works across charsets). */
let clipboard: {
  bytes: Uint8Array
  color: number
  attribute: number
} | null = null

/**
 * The whole charset to pick from, with copy / paste / swap and the whole-set
 * actions (load PETSCII, clear all).
 */
export function CharsetPanel({
  charset,
  users,
  selected,
  swapping,
  onSwapping,
  onPick,
  onChange,
}: {
  charset: Charset
  /** Maps using this charset. */
  users: ReadonlyArray<Charmap>
  selected: number
  /** Swap mode: the next pick swaps with the selected char. */
  swapping: boolean
  onSwapping: (swapping: boolean) => void
  onPick: (index: number) => void
  /** Change the charset (an undoable step). */
  onChange: (fn: (cs: Charset) => Charset) => void
}) {
  const [, setClipboardVersion] = useState(0)
  const [showAttributes, setShowAttributes] = useShowAttributes('chars')
  const [confirm, setConfirm] = useState<
    { kind: 'petscii'; set: PetsciiSet } | { kind: 'clear' } | null
  >(null)

  return (
    <div className="flex w-[306px] shrink-0 flex-col gap-2 overflow-y-auto border-l border-rule-soft pl-3">
      <span className="text-xs text-muted-foreground">
        {users.length === 0
          ? 'Charset · not used by a map yet'
          : `Charset · used by ${users.map((m) => `“${m.name}”`).join(', ')}`}
      </span>
      <CharsetSheet
        charset={charset}
        selected={selected}
        swapping={swapping}
        onPick={onPick}
        showAttributes={showAttributes}
      />
      <div className="mt-1 grid grid-cols-2 gap-1.5">
        <Button
          variant="outline"
          onClick={() => {
            clipboard = {
              bytes: getCharBytes(charset, selected),
              color: charset.colors[selected],
              attribute: charset.attributes[selected],
            }
            setClipboardVersion((v) => v + 1)
          }}
        >
          <Copy aria-hidden="true" /> Copy
        </Button>
        <Button
          variant="outline"
          disabled={!clipboard}
          onClick={() => {
            const c = clipboard
            if (!c) return
            onChange((cs) => {
              const next = setCharBytes(cs, selected, c.bytes)
              const colors = next.colors.slice()
              colors[selected] = c.color
              const attributes = next.attributes.slice()
              attributes[selected] = c.attribute
              return { ...next, colors, attributes }
            })
          }}
        >
          <ClipboardPaste aria-hidden="true" /> Paste
        </Button>
        <Button
          variant="outline"
          aria-pressed={swapping}
          className={cn(
            swapping && 'border-primary bg-accent text-primary hover:bg-accent',
          )}
          onClick={() => onSwapping(!swapping)}
        >
          <ArrowLeftRight aria-hidden="true" />
          {swapping ? 'Pick target…' : 'Swap'}
        </Button>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline">
              <Ellipsis aria-hidden="true" /> More
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem
              onSelect={() => setConfirm({ kind: 'petscii', set: 'upper' })}
            >
              Load PETSCII: upper case + graphics
            </DropdownMenuItem>
            <DropdownMenuItem
              onSelect={() => setConfirm({ kind: 'petscii', set: 'lower' })}
            >
              Load PETSCII: lower + upper case
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              variant="destructive"
              onSelect={() => setConfirm({ kind: 'clear' })}
            >
              Clear all characters
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
      <CharAttributeControls
        charset={charset}
        selected={selected}
        show={showAttributes}
        onShow={setShowAttributes}
        onChange={onChange}
      />
      <p className="text-[11px] leading-snug text-muted-foreground">
        {swapping
          ? `Tap another character to swap it with ${hex(selected)}. Maps keep their codes.`
          : charset.mode === 'ecm'
            ? 'ECM uses chars $00–$3F; screen code bits 7–6 pick the background.'
            : 'Tap a character to edit it. Each char has its own colour.'}
      </p>
      <ConfirmDialog
        open={confirm !== null}
        onOpenChange={(open) => !open && setConfirm(null)}
        title={
          confirm?.kind === 'clear'
            ? 'Clear all characters?'
            : 'Load the PETSCII characters?'
        }
        description={
          confirm?.kind === 'clear'
            ? 'Every character’s pixels are cleared. Colours, attributes and maps are kept. You can undo this.'
            : 'Every character’s pixels are replaced with the C64’s built-in set. Colours, attributes and maps are kept. You can undo this.'
        }
        confirmLabel={confirm?.kind === 'clear' ? 'Clear all' : 'Load'}
        onConfirm={() => {
          const data =
            confirm?.kind === 'petscii'
              ? petsciiData(confirm.set)
              : new Uint8Array(CHARSET_BYTES)
          onChange((cs) => ({ ...cs, data }))
          setConfirm(null)
        }}
      />
    </div>
  )
}
