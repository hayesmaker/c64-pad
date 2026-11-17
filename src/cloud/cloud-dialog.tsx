import { useEffect, useState } from 'react'
import { RefreshCw, Settings, Trash2 } from 'lucide-react'
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Field } from '@/components/worksheet/field'
import { DEFAULT_FOLDER, isComplete, saveCloudSettings } from './settings'
import { describeStatus } from './sync'
import type { CloudSettings } from './settings'
import type { Cloud, CloudConflict, PullMode } from './use-cloud'
import type { ProjectSummary } from '@/storage/repository'

const dateFormat = new Intl.DateTimeFormat(undefined, {
  dateStyle: 'medium',
  timeStyle: 'short',
})

/** The projects in the cloud, or the settings when it isn't set up yet. */
export function CloudDialog({
  open,
  onOpenChange,
  cloud,
  local,
  onOpen,
  onDelete,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  cloud: Cloud
  /** Projects on this device, to show how each cloud copy compares. */
  local: ReadonlyArray<ProjectSummary>
  onOpen: (id: string) => void
  onDelete: (project: { id: string; name: string }) => void
}) {
  const [editing, setEditing] = useState(false)
  useEffect(() => {
    if (open) setEditing(false)
  }, [open])
  const showSettings = editing || !cloud.settings

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90dvh] overflow-auto sm:max-w-lg">
        {showSettings ? (
          <CloudSettingsForm
            initial={cloud.settings}
            onDone={() => setEditing(false)}
            onCancel={() =>
              cloud.settings ? setEditing(false) : onOpenChange(false)
            }
          />
        ) : (
          <>
            <DialogHeader>
              <DialogTitle>Cloud</DialogTitle>
              <DialogDescription>
                Projects in {cloud.settings?.bucket}/{cloud.settings?.folder}
              </DialogDescription>
            </DialogHeader>
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                disabled={cloud.loading}
                onClick={() => void cloud.refresh()}
              >
                <RefreshCw
                  aria-hidden="true"
                  className={cloud.loading ? 'animate-spin' : undefined}
                />
                Refresh
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setEditing(true)}
              >
                <Settings aria-hidden="true" />
                Settings
              </Button>
            </div>
            {cloud.error && (
              <p role="alert" className="text-sm text-destructive">
                {cloud.error}
              </p>
            )}
            {cloud.summaries?.length === 0 && (
              <p className="text-sm text-muted-foreground">
                Nothing in the cloud yet. Use “Save to cloud” on a project.
              </p>
            )}
            <ul className="flex flex-col divide-y divide-rule">
              {cloud.summaries?.map((s) => {
                const here = local.find((p) => p.id === s.id)
                const status = cloud.statusOf(s.id, here?.updatedAt)
                return (
                  <li key={s.id} className="flex items-center gap-2 py-2">
                    <div className="min-w-0 flex-1">
                      <div className="truncate font-medium">{s.name}</div>
                      <div className="font-mono text-xs text-muted-foreground">
                        {s.counts.sprites} sprites · {s.counts.charsets}{' '}
                        charsets · {s.counts.maps} maps
                      </div>
                      <div className="text-xs text-muted-foreground">
                        Edited {dateFormat.format(new Date(s.updatedAt))}
                        {status && ` · ${describeStatus(status)}`}
                      </div>
                    </div>
                    <Button size="sm" onClick={() => onOpen(s.id)}>
                      {here ? 'Open' : 'Download'}
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      aria-label={`Delete ${s.name} from the cloud`}
                      onClick={() => onDelete(s)}
                    >
                      <Trash2 aria-hidden="true" />
                    </Button>
                  </li>
                )
              })}
            </ul>
          </>
        )}
      </DialogContent>
    </Dialog>
  )
}

function CloudSettingsForm({
  initial,
  onDone,
  onCancel,
}: {
  initial: CloudSettings | null
  onDone: () => void
  onCancel: () => void
}) {
  const [form, setForm] = useState<CloudSettings>(
    initial ?? {
      region: '',
      bucket: '',
      accessKey: '',
      secretKey: '',
      folder: DEFAULT_FOLDER,
    },
  )
  const field = (key: keyof CloudSettings) => ({
    value: form[key],
    onChange: (e: React.ChangeEvent<HTMLInputElement>) =>
      setForm((f) => ({ ...f, [key]: e.target.value })),
    autoComplete: 'off',
    autoCapitalize: 'off',
    spellCheck: false,
  })
  const trimmed: CloudSettings = {
    region: form.region.trim().toLowerCase(),
    bucket: form.bucket.trim(),
    accessKey: form.accessKey.trim(),
    secretKey: form.secretKey.trim(),
    folder: form.folder.trim() || DEFAULT_FOLDER,
  }

  return (
    <form
      className="flex flex-col gap-3"
      onSubmit={(e) => {
        e.preventDefault()
        if (!isComplete(trimmed)) return
        saveCloudSettings(trimmed)
        onDone()
      }}
    >
      <DialogHeader>
        <DialogTitle>Cloud settings</DialogTitle>
        <DialogDescription>
          A DigitalOcean Space to keep projects in. Use a Spaces key limited to
          this Space; it's kept only on this device.
        </DialogDescription>
      </DialogHeader>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Region">
          <Input placeholder="lon1" {...field('region')} />
        </Field>
        <Field label="Space name">
          <Input {...field('bucket')} />
        </Field>
      </div>
      <Field label="Folder">
        <Input {...field('folder')} />
      </Field>
      <Field label="Access key">
        <Input {...field('accessKey')} />
      </Field>
      <Field label="Secret key">
        <Input type="password" {...field('secretKey')} />
      </Field>
      <DialogFooter className="gap-2">
        {initial && (
          <Button
            type="button"
            variant="ghost"
            className="mr-auto text-destructive"
            onClick={() => {
              saveCloudSettings(null)
              onCancel()
            }}
          >
            Forget on this device
          </Button>
        )}
        <Button type="button" variant="outline" onClick={onCancel}>
          Cancel
        </Button>
        <Button type="submit" disabled={!isComplete(trimmed)}>
          Save
        </Button>
      </DialogFooter>
    </form>
  )
}

/** Ask before a save or open overwrites changes. */
export function CloudConflictDialog({
  conflict,
  onClose,
  onPush,
  onPull,
}: {
  conflict: CloudConflict | null
  onClose: () => void
  onPush: (id: string) => void
  onPull: (id: string, mode: PullMode) => void
}) {
  const name = conflict ? `“${conflict.name}”` : ''
  const status = conflict?.status.kind
  const why =
    status === 'conflict'
      ? `${name} has changed on this device and in the cloud since they were last in step.`
      : status === 'cloud-newer'
        ? `The cloud copy of ${name} is newer than this device's.`
        : status === 'device-newer'
          ? `This device's copy of ${name} is newer than the cloud's.`
          : ''
  const unsure =
    conflict && 'sure' in conflict.status && !conflict.status.sure
      ? " This device hasn't synced it before, so the other copy may have changes this one doesn't."
      : ''

  return (
    <AlertDialog open={!!conflict} onOpenChange={(o) => !o && onClose()}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>
            {conflict?.action === 'push'
              ? 'Replace the cloud copy?'
              : "Replace this device's copy?"}
          </AlertDialogTitle>
          <AlertDialogDescription>
            {why}
            {unsure}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancel</AlertDialogCancel>
          {conflict?.action === 'push' ? (
            <Button
              variant="destructive"
              onClick={() => {
                onClose()
                onPush(conflict.id)
              }}
            >
              Replace cloud copy
            </Button>
          ) : (
            conflict && (
              <>
                <Button
                  variant="outline"
                  onClick={() => {
                    onClose()
                    onPull(conflict.id, 'copy')
                  }}
                >
                  Keep both
                </Button>
                <Button
                  variant="destructive"
                  onClick={() => {
                    onClose()
                    onPull(conflict.id, 'replace')
                  }}
                >
                  Replace
                </Button>
              </>
            )
          )}
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}
