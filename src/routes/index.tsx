import { useRef, useState } from 'react'
import { Capacitor } from '@capacitor/core'
import {
  Link,
  createFileRoute,
  useNavigate,
  useRouter,
} from '@tanstack/react-router'
import { Cloud, EllipsisVertical, FileUp, Plus } from 'lucide-react'
import { createProject, renameProject } from '@/c64/project'
import { newId } from '@/c64/ids'
import { WorksheetLayout } from '@/components/worksheet/worksheet-layout'
import { Breadcrumbs } from '@/components/worksheet/breadcrumbs'
import { ConfirmDialog, PromptDialog } from '@/components/dialogs'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { projectRepository } from '@/storage/repository'
import {
  PROJECT_FILE_EXTENSION,
  exportProjectFile,
  importProjectFile,
} from '@/storage/project-file'
import { discardSession, openSession } from '@/storage/sessions'
import { safeFileName, saveTextFile } from '@/platform/save-file'
import { CloudConflictDialog, CloudDialog } from '@/cloud/cloud-dialog'
import { describeStatus } from '@/cloud/sync'
import { cloudLabel } from '@/cloud/settings'
import { useCloud } from '@/cloud/use-cloud'
import { showToast } from '@/components/toast'
import { TransferButton } from '@/components/transfer-button'
import type { CloudConflict, PullMode } from '@/cloud/use-cloud'
import type { ProjectSummary } from '@/storage/repository'
import type { Project } from '@/c64/project'

export const Route = createFileRoute('/')({
  loader: () => projectRepository.list(),
  component: Projects,
})

const dateFormat = new Intl.DateTimeFormat(undefined, {
  dateStyle: 'medium',
  timeStyle: 'short',
})

type DialogState =
  | { kind: 'new' }
  | { kind: 'rename'; project: ProjectSummary }
  | { kind: 'delete'; project: ProjectSummary }
  | { kind: 'cloud-delete'; project: { id: string; name: string } }
  | { kind: 'discard'; project: ProjectSummary }
  | null

function Projects() {
  const projects = Route.useLoaderData()
  const router = useRouter()
  const navigate = useNavigate()
  const fileInput = useRef<HTMLInputElement>(null)
  const [dialog, setDialog] = useState<DialogState>(null)
  const [error, setError] = useState<string | null>(null)
  const cloud = useCloud()
  const [cloudOpen, setCloudOpen] = useState(false)
  const [conflict, setConflict] = useState<CloudConflict | null>(null)

  const refresh = () => router.invalidate()

  const run = async (action: () => Promise<void>) => {
    setError(null)
    try {
      await action()
    } catch (e) {
      setError((e as Error).message)
    }
  }

  /** Change a stored project through its session so open editors stay in sync. */
  const change = (id: string, fn: (p: Project) => Project) =>
    run(async () => {
      const session = await openSession(id)
      session.update(fn)
      await session.flush()
      await refresh()
    })

  const create = (name: string) =>
    run(async () => {
      const project = createProject({ name })
      await projectRepository.save(project)
      await navigate({
        to: '/projects/$projectId',
        params: { projectId: project.id },
      })
    })

  const duplicate = (summary: ProjectSummary) =>
    run(async () => {
      const original = (await openSession(summary.id)).getSnapshot().project
      const now = new Date().toISOString()
      await projectRepository.save({
        ...structuredClone(original),
        id: newId(),
        name: `${original.name} copy`,
        createdAt: now,
        updatedAt: now,
      })
      await refresh()
    })

  const exportFile = (summary: ProjectSummary) =>
    run(async () => {
      const session = await openSession(summary.id)
      await session.flush()
      const project = session.getSnapshot().project
      await saveTextFile(
        safeFileName(project.name) + PROJECT_FILE_EXTENSION,
        exportProjectFile(project),
      )
    })

  const saveToCloud = (id: string, force = false) =>
    run(async () => {
      if (!cloud.settings) {
        setCloudOpen(true)
        return
      }
      showToast('Saving to the cloud…')
      const asked = await cloud.push(id, { force })
      if (asked) setConflict(asked)
      else showToast('Saved to the cloud')
    })

  const openFromCloud = (id: string, mode?: PullMode) =>
    run(async () => {
      const result = await cloud.pull(id, mode)
      if ('action' in result) {
        setConflict(result)
        return
      }
      setCloudOpen(false)
      await navigate({
        to: '/projects/$projectId',
        params: { projectId: result.id },
      })
    })

  /** Throw away this device's changes: take the cloud copy instead. */
  const revertToCloud = (id: string) =>
    run(async () => {
      await cloud.pull(id, 'replace')
      await refresh()
      showToast('Changes discarded: this is the cloud copy now')
    })

  const cloudKind = (p: ProjectSummary) =>
    cloud.statusOf(p.id, p.updatedAt)?.kind

  const removeFromCloud = (id: string) =>
    run(async () => {
      await cloud.remove(id)
      showToast('Deleted from the cloud')
    })

  const remove = (summary: ProjectSummary) =>
    run(async () => {
      discardSession(summary.id)
      await projectRepository.delete(summary.id)
      await refresh()
    })

  const importFile = (file: File) =>
    run(async () => {
      let project = importProjectFile(await file.text())
      // Never overwrite a project already on this device.
      if (await projectRepository.get(project.id)) {
        project = {
          ...project,
          id: newId(),
          name: `${project.name} (imported)`,
        }
      }
      await projectRepository.save(project)
      await navigate({
        to: '/projects/$projectId',
        params: { projectId: project.id },
      })
    })

  return (
    <WorksheetLayout
      title="My Projects"
      breadcrumbs={<Breadcrumbs items={[]} />}
      actions={
        <>
          <TransferButton
            description="Move projects between your devices."
            options={[
              {
                icon: Cloud,
                label: 'Cloud',
                description: cloud.settings
                  ? `Open or download projects from ${cloudLabel(cloud.settings)}`
                  : 'Keep projects in Google Drive or a DigitalOcean Space',
                onSelect: () => setCloudOpen(true),
              },
              {
                icon: FileUp,
                label: 'Import',
                description: `Open a ${PROJECT_FILE_EXTENSION} project file`,
                onSelect: () => fileInput.current?.click(),
              },
            ]}
          />
          <Button onClick={() => setDialog({ kind: 'new' })}>
            <Plus aria-hidden="true" />
            New project
          </Button>
        </>
      }
      className="overflow-auto p-6"
    >
      <input
        ref={fileInput}
        type="file"
        // Android's picker only filters by MIME type and has none for
        // .c64pad (downloads arrive as application/octet-stream), so any
        // filter there greys the file out. Accept anything; import validates.
        accept={
          Capacitor.isNativePlatform()
            ? undefined
            : `${PROJECT_FILE_EXTENSION},application/json`
        }
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0]
          e.target.value = ''
          if (file) void importFile(file)
        }}
      />

      {error && (
        <p
          role="alert"
          className="mb-4 rounded-lg border border-destructive px-4 py-3 text-destructive"
        >
          {error}
        </p>
      )}

      {projects.length === 0 ? (
        <div className="mx-auto mt-16 flex max-w-md flex-col items-center gap-4 text-center">
          <p className="text-lg">No projects on this device yet.</p>
          <p className="text-muted-foreground">
            A project holds your sprite sets, character sets and screen maps.
          </p>
          <Button size="lg" onClick={() => setDialog({ kind: 'new' })}>
            <Plus aria-hidden="true" />
            New project
          </Button>
        </div>
      ) : (
        <ul className="grid grid-cols-[repeat(auto-fill,minmax(260px,1fr))] gap-4">
          {projects.map((p) => (
            <li
              key={p.id}
              className="relative flex flex-col gap-1 rounded-lg border border-rule bg-paper p-4 hover:border-primary"
            >
              <Link
                to="/projects/$projectId"
                params={{ projectId: p.id }}
                className="pr-10 text-lg font-medium after:absolute after:inset-0"
              >
                {p.name}
              </Link>
              <span className="text-sm text-muted-foreground">
                {p.program || 'No program set'}
              </span>
              <span className="mt-2 font-mono text-xs text-muted-foreground">
                {p.counts.sprites} sprites · {p.counts.charsets} charsets ·{' '}
                {p.counts.maps} maps
              </span>
              <span className="text-xs text-muted-foreground">
                Edited {dateFormat.format(new Date(p.updatedAt))}
              </span>
              <CloudStatus status={cloud.statusOf(p.id, p.updatedAt)} />
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    aria-label={`Actions for ${p.name}`}
                    className="absolute top-2 right-2 z-10"
                  >
                    <EllipsisVertical aria-hidden="true" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem
                    onSelect={() => setDialog({ kind: 'rename', project: p })}
                  >
                    Rename
                  </DropdownMenuItem>
                  <DropdownMenuItem onSelect={() => void duplicate(p)}>
                    Duplicate
                  </DropdownMenuItem>
                  <DropdownMenuItem onSelect={() => void exportFile(p)}>
                    Export
                  </DropdownMenuItem>
                  <DropdownMenuItem onSelect={() => void saveToCloud(p.id)}>
                    Save to cloud
                  </DropdownMenuItem>
                  {cloudKind(p) === 'cloud-newer' && (
                    <DropdownMenuItem onSelect={() => void openFromCloud(p.id)}>
                      Update from cloud
                    </DropdownMenuItem>
                  )}
                  {(cloudKind(p) === 'device-newer' ||
                    cloudKind(p) === 'conflict') && (
                    <DropdownMenuItem
                      onSelect={() =>
                        setDialog({ kind: 'discard', project: p })
                      }
                    >
                      Discard changes…
                    </DropdownMenuItem>
                  )}
                  <DropdownMenuSeparator />
                  <DropdownMenuItem
                    variant="destructive"
                    onSelect={() => setDialog({ kind: 'delete', project: p })}
                  >
                    Delete
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </li>
          ))}
        </ul>
      )}

      <PromptDialog
        open={dialog?.kind === 'new'}
        onOpenChange={(open) => !open && setDialog(null)}
        title="New project"
        label="Project name"
        submitLabel="Create"
        onSubmit={(name) => void create(name)}
      />
      <PromptDialog
        open={dialog?.kind === 'rename'}
        onOpenChange={(open) => !open && setDialog(null)}
        title="Rename project"
        label="Project name"
        initialValue={dialog?.kind === 'rename' ? dialog.project.name : ''}
        onSubmit={(name) =>
          dialog?.kind === 'rename' &&
          void change(dialog.project.id, (p) => renameProject(p, name))
        }
      />
      <ConfirmDialog
        open={dialog?.kind === 'delete'}
        onOpenChange={(open) => !open && setDialog(null)}
        title="Delete project?"
        description={
          dialog?.kind === 'delete' && (
            <>
              “{dialog.project.name}” and everything in it will be removed from
              this device. Export it first if you want a copy.
            </>
          )
        }
        onConfirm={() =>
          dialog?.kind === 'delete' && void remove(dialog.project)
        }
      />
      <CloudDialog
        open={cloudOpen}
        onOpenChange={setCloudOpen}
        cloud={cloud}
        local={projects}
        onOpen={(id) => void openFromCloud(id)}
        onDelete={(project) => setDialog({ kind: 'cloud-delete', project })}
      />
      <CloudConflictDialog
        conflict={conflict}
        onClose={() => setConflict(null)}
        onPush={(id) => void saveToCloud(id, true)}
        onPull={(id, mode) => void openFromCloud(id, mode)}
      />
      <ConfirmDialog
        open={dialog?.kind === 'discard'}
        onOpenChange={(open) => !open && setDialog(null)}
        title="Discard changes?"
        confirmLabel="Discard changes"
        description={
          dialog?.kind === 'discard' && (
            <>
              This device's copy of “{dialog.project.name}” will be replaced by
              the cloud copy
              {(() => {
                const saved = cloud.summaries?.find(
                  (s) => s.id === dialog.project.id,
                )
                return saved
                  ? ` (edited ${dateFormat.format(new Date(saved.updatedAt))})`
                  : ''
              })()}
              . Changes made here since then are lost.
            </>
          )
        }
        onConfirm={() =>
          dialog?.kind === 'discard' && void revertToCloud(dialog.project.id)
        }
      />
      <ConfirmDialog
        open={dialog?.kind === 'cloud-delete'}
        onOpenChange={(open) => !open && setDialog(null)}
        title="Delete from the cloud?"
        description={
          dialog?.kind === 'cloud-delete' && (
            <>
              The cloud copy of “{dialog.project.name}” will be removed. Copies
              on your devices are kept.
            </>
          )
        }
        onConfirm={() =>
          dialog?.kind === 'cloud-delete' &&
          void removeFromCloud(dialog.project.id)
        }
      />
    </WorksheetLayout>
  )
}

/** How this device's copy compares with the cloud's, once the list loads. */
function CloudStatus({
  status,
}: {
  status: ReturnType<ReturnType<typeof useCloud>['statusOf']>
}) {
  if (!status) return null
  const attention = status.kind !== 'synced' && status.kind !== 'device-only'
  return (
    <span
      className={
        attention
          ? 'flex items-center gap-1 text-xs text-primary'
          : 'flex items-center gap-1 text-xs text-muted-foreground'
      }
    >
      <Cloud aria-hidden="true" className="size-3" />
      {describeStatus(status)}
    </span>
  )
}
