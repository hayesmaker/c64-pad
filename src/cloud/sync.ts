/**
 * How a project on this device compares with its cloud copy.
 *
 * `base` is the version (updatedAt) this device last pushed or pulled. With
 * it we can tell which side changed; without it (never synced here) only
 * the dates say which is newer, so `sure` is false and overwriting asks.
 */
export type SyncStatus =
  | { kind: 'device-only' }
  | { kind: 'cloud-only' }
  | { kind: 'synced' }
  | { kind: 'device-newer'; sure: boolean }
  | { kind: 'cloud-newer'; sure: boolean }
  /** Changed on this device and in the cloud since the last sync. */
  | { kind: 'conflict' }

export function syncStatus(
  local: string | undefined,
  cloud: string | undefined,
  base: string | undefined,
): SyncStatus {
  if (!cloud) return { kind: 'device-only' }
  if (!local) return { kind: 'cloud-only' }
  if (local === cloud) return { kind: 'synced' }
  if (base) {
    const localChanged = local !== base
    const cloudChanged = cloud !== base
    if (localChanged && cloudChanged) return { kind: 'conflict' }
    if (localChanged) return { kind: 'device-newer', sure: true }
    if (cloudChanged) return { kind: 'cloud-newer', sure: true }
  }
  return local > cloud
    ? { kind: 'device-newer', sure: false }
    : { kind: 'cloud-newer', sure: false }
}

/** Saving to the cloud would lose cloud changes this device hasn't seen. */
export function pushNeedsConfirm(status: SyncStatus) {
  return (
    status.kind === 'conflict' ||
    status.kind === 'cloud-newer' ||
    (status.kind === 'device-newer' && !status.sure)
  )
}

/** Opening from the cloud would lose changes made on this device. */
export function pullNeedsConfirm(status: SyncStatus) {
  return (
    status.kind === 'conflict' ||
    status.kind === 'device-newer' ||
    (status.kind === 'cloud-newer' && !status.sure)
  )
}

export function describeStatus(status: SyncStatus): string {
  switch (status.kind) {
    case 'device-only':
      return 'Not in the cloud'
    case 'cloud-only':
      return 'Not on this device'
    case 'synced':
      return 'Up to date'
    case 'device-newer':
      return 'Newer on this device'
    case 'cloud-newer':
      return 'Newer in the cloud'
    case 'conflict':
      return 'Changed on both'
  }
}
