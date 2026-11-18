import { Capacitor } from '@capacitor/core'
import { SocialLogin } from '@capgo/capacitor-social-login'
import { CloudError } from './types'

/**
 * The Google Cloud project's *Web* OAuth client ID (Android uses it too; the
 * Android client is only registered in the console, by package + SHA-1).
 * Client IDs aren't secret.
 */
export const GOOGLE_WEB_CLIENT_ID: string =
  (import.meta.env.VITE_GOOGLE_WEB_CLIENT_ID as string | undefined) ??
  '309312526653-vficeonmhed9gc776dr24bhnu4gmcfnp.apps.googleusercontent.com'

/** Only files this app creates or opens: never the rest of the Drive. */
const DRIVE_SCOPE = 'https://www.googleapis.com/auth/drive.file'

export const googleDriveAvailable = () => GOOGLE_WEB_CLIENT_ID !== ''

let ready: Promise<void> | null = null
function init() {
  if (!googleDriveAvailable())
    throw new CloudError("Google Drive isn't set up in this build of C64-Pad.")
  ready ??= SocialLogin.initialize({
    google: { webClientId: GOOGLE_WEB_CLIENT_ID, mode: 'online' },
  })
  return ready
}

/** Access tokens last an hour; renew a little early. */
const TOKEN_LIFE = 50 * 60 * 1000
let token: { value: string; expires: number } | null = null

/**
 * Sign in and allow C64-Pad its Drive folder. On the web this opens a popup,
 * so call it straight from a tap.
 */
export async function signInToGoogle(): Promise<{ email: string }> {
  await init()
  const { result } = await SocialLogin.login({
    provider: 'google',
    options: { scopes: [DRIVE_SCOPE] },
  })
  if (!('accessToken' in result) || !result.accessToken?.token)
    throw new CloudError("Google didn't allow access to Drive.")
  token = { value: result.accessToken.token, expires: Date.now() + TOKEN_LIFE }
  return { email: result.profile.email ?? 'Google account' }
}

export async function signOutOfGoogle() {
  token = null
  try {
    await init()
    await SocialLogin.logout({ provider: 'google' })
  } catch {
    // Already signed out, or never set up.
  }
}

/** A Drive access token; `renew` after Drive rejected the last one. */
export async function googleToken({ renew = false } = {}): Promise<string> {
  if (!renew && token && token.expires > Date.now()) return token.value
  await init()
  token = null
  const native = Capacitor.isNativePlatform()
  try {
    // Android keeps the sign-in and can renew it; the web can't.
    if (renew && native)
      await SocialLogin.refresh({ provider: 'google', options: {} })
    const { accessToken } = await SocialLogin.getAuthorizationCode({
      provider: 'google',
    })
    if (accessToken) {
      token = { value: accessToken, expires: Date.now() + TOKEN_LIFE }
      return accessToken
    }
  } catch {
    // Fall through: sign in again.
  }
  if (native) {
    // No popup rules on Android: show Google's sign-in right away.
    await signInToGoogle()
    if (token) return token.value
  }
  throw new CloudError('Your Google sign-in has expired. Sign in again.', {
    needsSignIn: true,
  })
}
