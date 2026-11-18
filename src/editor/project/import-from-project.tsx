import { useEffect, useMemo, useState } from 'react'
import {
  importAssets,
  importCandidates,
  requiredCharsets,
} from '@/c64/import-assets'
import { useCloud } from '@/cloud/use-cloud'
import { createCloudClient } from '@/cloud/client'
import { showToast } from '@/components/toast'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { projectRepository } from '@/storage/repository'
import { openSession } from '@/storage/sessions'
import type { AssetPick, ImportCandidate } from '@/c64/import-assets'
import type { AssetKind, Project } from '@/c64/project'
import type { ProjectSummary } from '@/storage/repository'

const KIND_LABEL: Record<AssetKind, string> = {
  spriteSets: 'Sprite sets',
  charsets: 'Charsets',
  maps: 'Screens',
}

type Source = { from: 'device' | 'cloud'; id: string; name: string }

/**
 * "From project": bring sprite sets, charsets and screens over from another
 * project on this device or in the cloud. The other project isn't changed,
 * and the import is one undo step here.
 */
export function ImportFromProjectDialog({
  open,
  onOpenChange,
  project,
  onImport,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  project: Project
  onImport: (change: (p: Project) => Project) => void
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90dvh] overflow-auto sm:max-w-lg">
        {open && (
          <ImportFromProject
            project={project}
            onImport={(change, count) => {
              onImport(change)
              onOpenChange(false)
              showToast(`Imported ${count} ${count === 1 ? 'item' : 'items'}`)
            }}
            onCancel={() => onOpenChange(false)}
          />
        )}
      </DialogContent>
    </Dialog>
  )
}

function ImportFromProject({
  project,
  onImport,
  onCancel,
}: {
  project: Project
  onImport: (change: (p: Project) => Project, count: number) => void
  onCancel: () => void
}) {
  const cloud = useCloud()
  const [local, setLocal] = useState<Array<ProjectSummary>>([])
  const [source, setSource] = useState<Source | null>(null)
  const [other, setOther] = useState<Project | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [picked, setPicked] = useState<Set<string>>(new Set())

  useEffect(() => {
    void projectRepository
      .list()
      .then((list) => setLocal(list.filter((p) => p.id !== project.id)))
  }, [project.id])

  // Load the chosen project; new items start ticked.
  useEffect(() => {
    if (!source) return
    let cancelled = false
    setOther(null)
    setError(null)
    const load = async (): Promise<Project> => {
      if (source.from === 'cloud') {
        if (!cloud.settings) throw new Error('Set up the cloud first.')
        return createCloudClient(cloud.settings).get(source.id)
      }
      const session = await openSession(source.id)
      await session.flush()
      return session.getSnapshot().project
    }
    load().then(
      (p) => {
        if (cancelled) return
        setOther(p)
        setPicked(
          new Set(
            importCandidates(project, p)
              .filter((c) => c.state === 'new')
              .map(keyOf),
          ),
        )
      },
      (e: Error) => !cancelled && setError(e.message),
    )
    return () => {
      cancelled = true
    }
    // Only when the source changes: edits here don't reload it.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [source])

  const candidates = useMemo(
    () => (other ? importCandidates(project, other) : []),
    [project, other],
  )
  const picks: Array<AssetPick> = candidates
    .filter((c) => picked.has(keyOf(c)))
    .map(({ kind, id }) => ({ kind, id }))
  const needed = other ? requiredCharsets(project, other, picks) : new Set()
  const count =
    picks.filter((p) => !(p.kind === 'charsets' && needed.has(p.id))).length +
    needed.size

  if (!source) {
    const cloudOnly = (cloud.summaries ?? []).filter((s) => s.id !== project.id)
    return (
      <>
        <DialogHeader>
          <DialogTitle>Import from another project</DialogTitle>
          <DialogDescription>
            Bring sprite sets, charsets and screens into “{project.name}”.
          </DialogDescription>
        </DialogHeader>
        <SourceList
          title="On this device"
          items={local}
          onPick={(p) => setSource({ from: 'device', ...p })}
        />
        {cloud.settings && (
          <SourceList
            title="In the cloud"
            items={cloudOnly}
            loading={cloud.loading}
            error={cloud.error}
            onPick={(p) => setSource({ from: 'cloud', ...p })}
          />
        )}
        <DialogFooter>
          <Button variant="outline" onClick={onCancel}>
            Cancel
          </Button>
        </DialogFooter>
      </>
    )
  }

  return (
    <>
      <DialogHeader>
        <DialogTitle>Import from “{source.name}”</DialogTitle>
        <DialogDescription>
          {source.from === 'cloud' ? 'The cloud copy. ' : ''}Changed items come
          in as copies beside this project's own.
        </DialogDescription>
      </DialogHeader>
      {error && (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      )}
      {!other && !error && (
        <p className="text-sm text-muted-foreground">Loading…</p>
      )}
      {(['spriteSets', 'charsets', 'maps'] as const).map((kind) => {
        const items = candidates.filter((c) => c.kind === kind)
        if (items.length === 0) return null
        return (
          <fieldset key={kind} className="flex flex-col gap-1">
            <legend className="mb-1 text-xs text-muted-foreground">
              {KIND_LABEL[kind]}
            </legend>
            {items.map((c) => {
              const auto = kind === 'charsets' && needed.has(c.id)
              const checked = auto || picked.has(keyOf(c))
              return (
                <label
                  key={c.id}
                  className="flex items-center gap-2 text-sm has-disabled:opacity-60"
                >
                  <input
                    type="checkbox"
                    className="size-4 accent-primary"
                    aria-label={c.name}
                    aria-describedby={`import-state-${c.id}`}
                    disabled={c.state === 'same' || auto}
                    checked={c.state !== 'same' && checked}
                    onChange={(e) =>
                      setPicked((s) => {
                        const next = new Set(s)
                        if (e.target.checked) next.add(keyOf(c))
                        else next.delete(keyOf(c))
                        return next
                      })
                    }
                  />
                  <span className="min-w-0 flex-1 truncate">{c.name}</span>
                  <span
                    id={`import-state-${c.id}`}
                    className="text-xs text-muted-foreground"
                  >
                    {auto ? 'Needed by a screen' : STATE_LABEL[c.state]}
                  </span>
                </label>
              )
            })}
          </fieldset>
        )
      })}
      <DialogFooter>
        <Button variant="outline" onClick={() => setSource(null)}>
          Back
        </Button>
        <Button
          disabled={!other || count === 0}
          onClick={() =>
            other && onImport((p) => importAssets(p, other, picks), count)
          }
        >
          Import{count > 0 ? ` ${count}` : ''}
        </Button>
      </DialogFooter>
    </>
  )
}

const STATE_LABEL: Record<ImportCandidate['state'], string> = {
  new: 'Not in this project',
  same: 'Already here',
  different: 'Changed: adds a copy',
}

const keyOf = (c: { kind: AssetKind; id: string }) => `${c.kind}:${c.id}`

function SourceList({
  title,
  items,
  loading,
  error,
  onPick,
}: {
  title: string
  items: ReadonlyArray<ProjectSummary>
  loading?: boolean
  error?: string | null
  onPick: (p: { id: string; name: string }) => void
}) {
  return (
    <section className="flex flex-col gap-1">
      <h3 className="text-xs text-muted-foreground">{title}</h3>
      {error && <p className="text-sm text-destructive">{error}</p>}
      {items.length === 0 && !error && (
        <p className="text-sm text-muted-foreground">
          {loading ? 'Loading…' : 'No other projects.'}
        </p>
      )}
      {items.map((p) => (
        <button
          key={p.id}
          type="button"
          onClick={() => onPick(p)}
          className="flex items-baseline justify-between gap-2 rounded-lg border border-rule px-3 py-2 text-left hover:border-primary"
        >
          <span className="truncate font-medium">{p.name}</span>
          <span className="shrink-0 font-mono text-xs text-muted-foreground">
            {p.counts.sprites} spr · {p.counts.charsets} cs · {p.counts.maps}{' '}
            scr
          </span>
        </button>
      ))}
    </section>
  )
}
