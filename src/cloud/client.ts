import { createDriveClient } from './drive'
import { createDropboxClient } from './dropbox'
import { signInToDropbox } from './dropbox-auth'
import { signInToGoogle } from './google'
import { saveCloudSettings } from './settings'
import { createSpacesClient } from './spaces'
import type { CloudSettings } from './settings'
import type { CloudClient } from './types'

export function createCloudClient(settings: CloudSettings): CloudClient {
  switch (settings.provider) {
    case 'gdrive':
      return createDriveClient()
    case 'dropbox':
      return createDropboxClient(settings)
    case 'spaces':
      return createSpacesClient(settings)
  }
}

/** After a sign-in expired or was revoked. Call it straight from a tap. */
export async function signInAgain(settings: CloudSettings) {
  switch (settings.provider) {
    case 'gdrive':
      await signInToGoogle()
      return
    case 'dropbox':
      // A new refresh token.
      saveCloudSettings(await signInToDropbox())
      return
    case 'spaces':
      return
  }
}
