import type { SaveStatus as Status } from '@/storage/session'

const LABELS: Record<Status, string> = {
  saved: 'Saved',
  pending: 'Unsaved changes',
  saving: 'Saving…',
  error: 'Save failed',
}

export function SaveStatus({
  status,
  error,
}: {
  status: Status
  error: string | null
}) {
  return (
    <span
      role="status"
      title={error ?? undefined}
      className={
        status === 'error'
          ? 'text-sm text-destructive'
          : 'text-sm text-muted-foreground'
      }
    >
      {LABELS[status]}
    </span>
  )
}
