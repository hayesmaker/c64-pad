import { createDriveClient } from './drive'
import { createSpacesClient } from './spaces'
import type { CloudSettings } from './settings'
import type { CloudClient } from './types'

export function createCloudClient(settings: CloudSettings): CloudClient {
  return settings.provider === 'gdrive'
    ? createDriveClient()
    : createSpacesClient(settings)
}
