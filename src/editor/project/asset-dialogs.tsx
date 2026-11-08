import { useState } from 'react'
import { MAX_MAP_SIZE } from '@/c64/charmap'
import { mapsUsingCharset } from '@/c64/project'
import { Field } from '@/components/worksheet/field'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { ScreenPresets } from '../map/map-size'
import { Segmented } from '../segmented'
import type { Charset, PetsciiSet } from '@/c64/charset'
import type { Project } from '@/c64/project'

/** `base N` with the first N not already used (counting from the list's size). */
export function nextName(
  base: string,
  existing: ReadonlyArray<{ name: string }>,
) {
  let n = existing.length + 1
  while (existing.some((a) => a.name === `${base} ${n}`)) n++
  return `${base} ${n}`
}

/** Deleting a charset that maps use: move those maps to another one first. */
export function DeleteCharsetDialog({
  project,
  charset,
  onOpenChange,
  onConfirm,
}: {
  project: Project
  charset: Charset
  onOpenChange: (open: boolean) => void
  onConfirm: (reassignTo: string) => void
}) {
  const others = project.charsets.filter((c) => c.id !== charset.id)
  const users = mapsUsingCharset(project, charset.id)
  const [target, setTarget] = useState(others.at(0)?.id ?? '')
  return (
    <Dialog open onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Delete “{charset.name}”?</DialogTitle>
          <DialogDescription>
            It’s used by {users.map((m) => m.name).join(', ')}.
            {others.length > 0
              ? ' Choose a charset for those maps to use instead: their chars are matched to the same-looking ones there.'
              : ' Create another charset first, so those maps have one to use.'}
          </DialogDescription>
        </DialogHeader>
        {others.length > 0 && (
          <Field label="Move maps to">
            <Select value={target} onValueChange={setTarget}>
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {others.map((c) => (
                  <SelectItem key={c.id} value={c.id}>
                    {c.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
        )}
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          {others.length > 0 && (
            <Button
              variant="destructive"
              onClick={() => {
                onConfirm(target)
                onOpenChange(false)
              }}
            >
              Move maps and delete
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

export function NewMapDialog({
  project,
  onOpenChange,
  onCreate,
}: {
  project: Project
  onOpenChange: (open: boolean) => void
  onCreate: (init: {
    name: string
    width: number
    height: number
    charsetId: string
  }) => void
}) {
  const [name, setName] = useState(nextName('Map', project.maps))
  const [width, setWidth] = useState('40')
  const [height, setHeight] = useState('25')
  const [charsetId, setCharsetId] = useState(project.charsets.at(0)?.id ?? '')
  const w = Number(width)
  const h = Number(height)
  const sizeOk = [w, h].every(
    (n) => Number.isInteger(n) && n >= 1 && n <= MAX_MAP_SIZE,
  )

  return (
    <Dialog open onOpenChange={onOpenChange}>
      <DialogContent>
        <form
          className="flex flex-col gap-4"
          onSubmit={(e) => {
            e.preventDefault()
            if (!sizeOk || !name.trim() || !charsetId) return
            onCreate({ name: name.trim(), width: w, height: h, charsetId })
            onOpenChange(false)
          }}
        >
          <DialogHeader>
            <DialogTitle>New screen map</DialogTitle>
            <DialogDescription>
              One C64 screen is 40×25. Larger maps scroll, up to {MAX_MAP_SIZE}×
              {MAX_MAP_SIZE}.
            </DialogDescription>
          </DialogHeader>
          <Field label="Name">
            <Input value={name} onChange={(e) => setName(e.target.value)} />
          </Field>
          <ScreenPresets
            width={Number(width)}
            height={Number(height)}
            onPick={(pw, ph) => {
              setWidth(String(pw))
              setHeight(String(ph))
            }}
          />
          <div className="flex gap-3">
            <Field label="Width (chars)" className="flex-1">
              <Input
                inputMode="numeric"
                value={width}
                onChange={(e) => setWidth(e.target.value)}
              />
            </Field>
            <Field label="Height (chars)" className="flex-1">
              <Input
                inputMode="numeric"
                value={height}
                onChange={(e) => setHeight(e.target.value)}
              />
            </Field>
          </div>
          <Field label="Charset">
            <Select value={charsetId} onValueChange={setCharsetId}>
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {project.charsets.map((c) => (
                  <SelectItem key={c.id} value={c.id}>
                    {c.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
          {!sizeOk && (
            <p className="text-sm text-destructive">
              Width and height must be 1–{MAX_MAP_SIZE}.
            </p>
          )}
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={!sizeOk || !name.trim()}>
              Create
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

export function NewCharsetDialog({
  project,
  onOpenChange,
  onCreate,
}: {
  project: Project
  onOpenChange: (open: boolean) => void
  onCreate: (init: { name: string; start: 'blank' | PetsciiSet }) => void
}) {
  const [name, setName] = useState(nextName('Charset', project.charsets))
  const [start, setStart] = useState<'blank' | PetsciiSet>('blank')
  return (
    <Dialog open onOpenChange={onOpenChange}>
      <DialogContent onOpenAutoFocus={(e) => e.preventDefault()}>
        <form
          className="flex flex-col gap-4"
          onSubmit={(e) => {
            e.preventDefault()
            if (!name.trim()) return
            onCreate({ name: name.trim(), start })
            onOpenChange(false)
          }}
        >
          <DialogHeader>
            <DialogTitle>New charset</DialogTitle>
            <DialogDescription>
              256 characters. Start blank, or from the C64’s built-in PETSCII
              set to edit.
            </DialogDescription>
          </DialogHeader>
          <Field label="Name">
            <Input value={name} onChange={(e) => setName(e.target.value)} />
          </Field>
          <div className="flex flex-col gap-[3px]">
            <span className="text-xs text-muted-foreground">Start from</span>
            <Segmented
              label="Start from"
              value={start}
              options={[
                { value: 'blank', label: 'Blank' },
                { value: 'upper', label: 'PETSCII upper' },
                { value: 'lower', label: 'PETSCII lower' },
              ]}
              onChange={setStart}
            />
          </div>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={!name.trim()}>
              Create
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
