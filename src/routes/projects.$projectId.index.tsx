import { useState } from 'react'
import { Link, createFileRoute } from '@tanstack/react-router'
import { Download, EllipsisVertical, Plus } from 'lucide-react'
import {
  addAsset,
  duplicateAsset,
  mapsUsingCharset,
  removeCharset,
  removeMap,
  removeSpriteSet,
  renameAsset,
} from '@/c64/project'
import { createSpriteSet } from '@/c64/sprite-set'
import { createCharset, petsciiData } from '@/c64/charset'
import { MAX_MAP_SIZE, createCharmap } from '@/c64/charmap'
import { PALETTE } from '@/c64/palette'
import { WorksheetLayout } from '@/components/worksheet/worksheet-layout'
import { Breadcrumbs } from '@/components/worksheet/breadcrumbs'
import { Field, worksheetInputClass } from '@/components/worksheet/field'
import { ConfirmDialog, PromptDialog } from '@/components/dialogs'
import { SaveStatus } from '@/components/save-status'
import {
  CharsetThumbnail,
  MapThumbnail,
  SpriteSetThumbnail,
} from '@/components/c64/thumbnails'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
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
import { Segmented } from '@/editor/segmented'
import { useCurrentProject } from '@/storage/use-current-project'
import { ScreenPresets } from '@/editor/map/map-size'
import {
  PROJECT_FILE_EXTENSION,
  exportProjectFile,
} from '@/storage/project-file'
import { safeFileName, saveTextFile } from '@/platform/save-file'
import type { ReactNode } from 'react'
import type { LinkProps } from '@tanstack/react-router'
import type { AssetKind, Project } from '@/c64/project'
import type { Charset, CharsetMode, PetsciiSet } from '@/c64/charset'

export const Route = createFileRoute('/projects/$projectId/')({
  component: ProjectPage,
})

const MODE_LABEL: Record<CharsetMode, string> = {
  hires: 'Hires',
  multicolor: 'Multicolour',
  ecm: 'ECM',
}

type AssetRef = { kind: AssetKind; id: string; name: string }
type DialogState =
  | { kind: 'rename'; asset: AssetRef }
  | { kind: 'delete'; asset: AssetRef }
  | { kind: 'deleteCharset'; charset: Charset }
  | { kind: 'newMap' }
  | { kind: 'newCharset' }
  | null

function nextName(base: string, existing: ReadonlyArray<{ name: string }>) {
  let n = existing.length + 1
  while (existing.some((a) => a.name === `${base} ${n}`)) n++
  return `${base} ${n}`
}

function ProjectPage() {
  const { session, project, status, error } = useCurrentProject()
  const [dialog, setDialog] = useState<DialogState>(null)
  const update = (fn: (p: Project) => Project) => session.update(fn)
  const projectId = project.id
  const close = (open: boolean) => !open && setDialog(null)

  const exportFile = async () => {
    await session.flush()
    await saveTextFile(
      safeFileName(project.name) + PROJECT_FILE_EXTENSION,
      exportProjectFile(session.getSnapshot().project),
    )
  }

  const assetMenu = (asset: AssetRef, onDelete: () => void) => (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          aria-label={`Actions for ${asset.name}`}
        >
          <EllipsisVertical aria-hidden="true" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem onSelect={() => setDialog({ kind: 'rename', asset })}>
          Rename
        </DropdownMenuItem>
        <DropdownMenuItem
          onSelect={() =>
            update((p) => duplicateAsset(p, asset.kind, asset.id))
          }
        >
          Duplicate
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem variant="destructive" onSelect={onDelete}>
          Delete
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )

  return (
    <WorksheetLayout
      title="Project Worksheet"
      breadcrumbs={
        <Breadcrumbs
          items={[
            { label: 'My Projects', link: { to: '/projects' } },
            { label: project.name },
          ]}
        />
      }
      actions={
        <div className="flex items-center gap-3">
          <SaveStatus status={status} error={error} />
          <Button variant="outline" onClick={() => void exportFile()}>
            <Download aria-hidden="true" />
            Export
          </Button>
        </div>
      }
      className="flex gap-7 overflow-auto px-6 py-5"
    >
      {/* Worksheet fields */}
      <div className="flex w-[260px] shrink-0 flex-col gap-3">
        <Field label="Project name">
          <Input
            value={project.name}
            onChange={(e) => update((p) => ({ ...p, name: e.target.value }))}
          />
        </Field>
        <Field label="Program">
          <Input
            value={project.program}
            placeholder="e.g. the game these graphics are for"
            onChange={(e) => update((p) => ({ ...p, program: e.target.value }))}
          />
        </Field>
        <Field label="Date designed">
          <input
            type="date"
            className={worksheetInputClass}
            value={project.dateDesigned}
            onChange={(e) =>
              update((p) => ({ ...p, dateDesigned: e.target.value }))
            }
          />
        </Field>
        <Field label="Notes">
          <Textarea
            rows={6}
            className="resize-none bg-paper text-base"
            value={project.notes}
            onChange={(e) => update((p) => ({ ...p, notes: e.target.value }))}
          />
        </Field>
      </div>

      {/* Assets */}
      <div className="flex min-w-0 flex-1 flex-col gap-6">
        <AssetSection
          title="Sprite sets"
          addLabel="New sprite set"
          onAdd={() =>
            update((p) =>
              addAsset(
                p,
                'spriteSets',
                createSpriteSet({ name: nextName('Sprites', p.spriteSets) }),
              ),
            )
          }
        >
          {project.spriteSets.map((set) => (
            <AssetCard
              key={set.id}
              name={set.name}
              meta={`${set.sprites.length} sprite${set.sprites.length === 1 ? '' : 's'} · MC ${PALETTE[set.multicolor1].name} / ${PALETTE[set.multicolor2].name}`}
              link={{
                to: '/projects/$projectId/sprites/$setId',
                params: { projectId, setId: set.id },
              }}
              thumbnail={<SpriteSetThumbnail set={set} />}
              menu={assetMenu(
                { kind: 'spriteSets', id: set.id, name: set.name },
                () =>
                  setDialog({
                    kind: 'delete',
                    asset: { kind: 'spriteSets', id: set.id, name: set.name },
                  }),
              )}
            />
          ))}
        </AssetSection>

        <AssetSection
          title="Character sets"
          addLabel="New charset"
          onAdd={() => setDialog({ kind: 'newCharset' })}
        >
          {project.charsets.map((cs) => (
            <AssetCard
              key={cs.id}
              name={cs.name}
              meta={`${MODE_LABEL[cs.mode]} · used by ${mapsUsingCharset(project, cs.id).length} map(s)`}
              link={{
                to: '/projects/$projectId/charsets/$charsetId',
                params: { projectId, charsetId: cs.id },
              }}
              thumbnail={<CharsetThumbnail charset={cs} />}
              menu={assetMenu(
                { kind: 'charsets', id: cs.id, name: cs.name },
                () =>
                  mapsUsingCharset(project, cs.id).length > 0
                    ? setDialog({ kind: 'deleteCharset', charset: cs })
                    : setDialog({
                        kind: 'delete',
                        asset: { kind: 'charsets', id: cs.id, name: cs.name },
                      }),
              )}
            />
          ))}
        </AssetSection>

        <AssetSection
          title="Screen maps"
          addLabel="New map"
          addDisabledReason={
            project.charsets.length === 0 ? 'Create a charset first' : undefined
          }
          onAdd={() => setDialog({ kind: 'newMap' })}
        >
          {project.maps.map((map) => {
            const charset = project.charsets.find((c) => c.id === map.charsetId)
            return (
              <AssetCard
                key={map.id}
                name={map.name}
                meta={`${map.width}×${map.height} · ${charset?.name ?? 'missing charset'}`}
                link={{
                  to: '/projects/$projectId/maps/$mapId',
                  params: { projectId, mapId: map.id },
                }}
                thumbnail={<MapThumbnail map={map} charset={charset} />}
                menu={assetMenu(
                  { kind: 'maps', id: map.id, name: map.name },
                  () =>
                    setDialog({
                      kind: 'delete',
                      asset: { kind: 'maps', id: map.id, name: map.name },
                    }),
                )}
              />
            )
          })}
        </AssetSection>
      </div>

      <PromptDialog
        open={dialog?.kind === 'rename'}
        onOpenChange={close}
        title="Rename"
        label="Name"
        initialValue={dialog?.kind === 'rename' ? dialog.asset.name : ''}
        onSubmit={(name) =>
          dialog?.kind === 'rename' &&
          update((p) =>
            renameAsset(p, dialog.asset.kind, dialog.asset.id, name),
          )
        }
      />
      <ConfirmDialog
        open={dialog?.kind === 'delete'}
        onOpenChange={close}
        title={`Delete “${dialog?.kind === 'delete' ? dialog.asset.name : ''}”?`}
        description="This can’t be undone."
        onConfirm={() => {
          if (dialog?.kind !== 'delete') return
          const { kind, id } = dialog.asset
          update((p) =>
            kind === 'spriteSets'
              ? removeSpriteSet(p, id)
              : kind === 'maps'
                ? removeMap(p, id)
                : removeCharset(p, id),
          )
        }}
      />
      {dialog?.kind === 'deleteCharset' && (
        <DeleteCharsetDialog
          project={project}
          charset={dialog.charset}
          onOpenChange={close}
          onConfirm={(reassignTo) =>
            update((p) => removeCharset(p, dialog.charset.id, { reassignTo }))
          }
        />
      )}
      {dialog?.kind === 'newCharset' && (
        <NewCharsetDialog
          project={project}
          onOpenChange={close}
          onCreate={({ name, start }) =>
            update((p) =>
              addAsset(
                p,
                'charsets',
                createCharset({
                  name,
                  ...(start === 'blank' ? {} : { data: petsciiData(start) }),
                }),
              ),
            )
          }
        />
      )}
      {dialog?.kind === 'newMap' && (
        <NewMapDialog
          project={project}
          onOpenChange={close}
          onCreate={(init) =>
            update((p) => addAsset(p, 'maps', createCharmap(init)))
          }
        />
      )}
    </WorksheetLayout>
  )
}

function AssetSection({
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

function AssetCard({
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

function DeleteCharsetDialog({
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
              ? ' Choose a charset for those maps to use instead.'
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

function NewMapDialog({
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

function NewCharsetDialog({
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
