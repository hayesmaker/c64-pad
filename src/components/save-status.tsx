import { TriangleAlert } from 'lucide-react'
import type { SaveStatus as Status } from '@/storage/session'

/**
 * Saving is automatic (within half a second of a change), so nothing shows
 * while it works. Only a failed save is shown, because then work could be lost.
 */
export function SaveStatus({
  status,
  error,
}: {
  status: Status
  error: string | null
}) {
  return (
    <span role="status" className="contents">
      {status === 'error' && (
        <span
          title={`${error ?? 'Couldn’t save'}. It tries again on your next change.`}
          className="flex items-center gap-1.5 text-sm whitespace-nowrap text-destructive"
        >
          <TriangleAlert aria-hidden="true" className="size-4" />
          Not saved
        </span>
      )}
    </span>
  )
}
