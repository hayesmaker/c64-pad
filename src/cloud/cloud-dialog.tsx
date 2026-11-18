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
import { showToast } from '@/components/toast'
import {
  DEFAULT_FOLDER,
  cloudLabel,
  forgetCloudSettings,
  isComplete,
  saveCloudSettings,
  savedCloudSettings,
} from './settings'
import { DRIVE_FOLDER } from './drive'
import { googleDriveAvailable, signInToGoogle, signOutOfGoogle } from './google'
import { describeStatus } from './sync'
import type { CloudSettings, DriveSettings, SpacesSettings } from './settings'
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
                Projects in {cloud.settings ? cloudLabel(cloud.settings) : ''}
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
            {cloud.needsSignIn && (
              <Button
                className="self-start"
                onClick={() =>
                  void signInToGoogle().then(
                    () => cloud.refresh(),
                    (e: unknown) => showToast(signInError(e), 4000),
                  )
                }
              >
                Sign in again
              </Button>
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
  const [provider, setProvider] = useState<CloudSettings['provider']>(
    initial?.provider ?? (googleDriveAvailable() ? 'gdrive' : 'spaces'),
  )
  return (
    <div className="flex flex-col gap-3">
      <DialogHeader>
        <DialogTitle>Cloud settings</DialogTitle>
        <DialogDescription>
          Where to keep projects so your devices can share them.
        </DialogDescription>
      </DialogHeader>
      <div
        role="radiogroup"
        aria-label="Cloud storage"
        className="grid grid-cols-2 gap-2"
      >
        {(
          [
            ['gdrive', 'Google Drive'],
            ['spaces', 'DigitalOcean Space'],
          ] as const
        ).map(([value, label]) => (
          <button
            key={value}
            type="button"
            role="radio"
            aria-checked={provider === value}
            onClick={() => setProvider(value)}
            className="rounded-lg border border-rule px-3 py-2 text-sm font-medium aria-checked:border-primary aria-checked:bg-primary/10"
          >
            {label}
          </button>
        ))}
      </div>
      {provider === 'gdrive' ? (
        <DriveSettingsForm
          initial={savedCloudSettings('gdrive') ?? null}
          inUse={initial?.provider === 'gdrive'}
          onDone={onDone}
          onCancel={onCancel}
        />
      ) : (
        <SpacesSettingsForm
          initial={savedCloudSettings('spaces') ?? null}
          inUse={initial?.provider === 'spaces'}
          onDone={onDone}
          onCancel={onCancel}
        />
      )}
    </div>
  )
}

function DriveSettingsForm({
  initial,
  inUse,
  onDone,
  onCancel,
}: {
  initial: DriveSettings | null
  /** Drive is this device's cloud now (not just signed in earlier). */
  inUse: boolean
  onDone: () => void
  onCancel: () => void
}) {
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const signIn = async () => {
    setBusy(true)
    setError(null)
    try {
      const { email } = await signInToGoogle()
      saveCloudSettings({ provider: 'gdrive', email })
      onDone()
    } catch (e) {
      setError(signInError(e))
    } finally {
      setBusy(false)
    }
  }
  return (
    <>
      <p className="text-sm text-muted-foreground">
        Projects go in a “{DRIVE_FOLDER}” folder in your Google Drive, as{' '}
        .c64pad files. C64-Pad can only see the files it made there.
      </p>
      {!googleDriveAvailable() && (
        <p className="text-sm text-destructive">
          Google Drive isn't set up in this build of C64-Pad.
        </p>
      )}
      {initial && (
        <p className="text-sm">
          Signed in as <span className="font-medium">{initial.email}</span>
        </p>
      )}
      {error && (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      )}
      <DialogFooter className="gap-2">
        {initial && (
          <Button
            type="button"
            variant="ghost"
            className="mr-auto text-destructive"
            onClick={() => {
              void signOutOfGoogle()
              forgetCloudSettings('gdrive')
              onCancel()
            }}
          >
            Sign out
          </Button>
        )}
        <Button type="button" variant="outline" onClick={onCancel}>
          Cancel
        </Button>
        <Button
          type="button"
          variant={initial && !inUse ? 'outline' : 'default'}
          disabled={busy || !googleDriveAvailable()}
          onClick={() => void signIn()}
        >
          {initial ? 'Switch account' : 'Sign in with Google'}
        </Button>
        {initial && !inUse && (
          <Button
            type="button"
            onClick={() => {
              saveCloudSettings(initial)
              onDone()
            }}
          >
            Use Google Drive
          </Button>
        )}
      </DialogFooter>
    </>
  )
}

/** Google's errors, or a cancelled sign-in, in a sentence. */
export function signInError(e: unknown) {
  const message = e instanceof Error ? e.message : String(e)
  if (/cancel/i.test(message)) return 'Sign-in was cancelled.'
  if (/popup/i.test(message))
    return 'The Google sign-in window was blocked. Allow pop-ups and try again.'
  return `Couldn't sign in to Google (${message}).`
}

function SpacesSettingsForm({
  initial,
  inUse,
  onDone,
  onCancel,
}: {
  initial: SpacesSettings | null
  /** The Space is this device's cloud now. */
  inUse: boolean
  onDone: () => void
  onCancel: () => void
}) {
  const [form, setForm] = useState<SpacesSettings>(
    initial ?? {
      provider: 'spaces',
      region: '',
      bucket: '',
      accessKey: '',
      secretKey: '',
      folder: DEFAULT_FOLDER,
    },
  )
  const field = (key: Exclude<keyof SpacesSettings, 'provider'>) => ({
    value: form[key],
    onChange: (e: React.ChangeEvent<HTMLInputElement>) =>
      setForm((f) => ({ ...f, [key]: e.target.value })),
    autoComplete: 'off',
    autoCapitalize: 'off',
    spellCheck: false,
  })
  const trimmed: SpacesSettings = {
    provider: 'spaces',
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
      <p className="text-sm text-muted-foreground">
        Use a Spaces key limited to this Space; it's kept only on this device.
      </p>
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
              forgetCloudSettings('spaces')
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
          {inUse || !initial ? 'Save' : 'Save and use this Space'}
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
