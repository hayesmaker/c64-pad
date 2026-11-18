import { Capacitor } from '@capacitor/core'
import { App } from '@capacitor/app'
import { Browser } from '@capacitor/browser'
import { CloudError } from './types'
import type { DropboxSettings } from './settings'

/**
 * The Dropbox app's key (App folder access, PKCE). App keys aren't secret;
 * there is no app secret in C64-Pad.
 */
export const DROPBOX_APP_KEY: string =
  (import.meta.env.VITE_DROPBOX_APP_KEY as string | undefined) ??
  'bvuax6ay3y23z6t'

export const dropboxAvailable = () => DROPBOX_APP_KEY !== ''

/** Registered in the Dropbox App Console and in AndroidManifest.xml. */
export const NATIVE_REDIRECT = 'com.hayesmaker64.c64pad://dropbox-auth'
/** The page the web popup lands on: public/dropbox-auth.html. */
export const AUTH_CHANNEL = 'c64pad-dropbox-auth'

const API = 'https://api.dropboxapi.com'

const redirectUri = () =>
  Capacitor.isNativePlatform()
    ? NATIVE_REDIRECT
    : `${location.origin}/dropbox-auth.html`

const base64url = (bytes: Uint8Array) =>
  btoa(String.fromCharCode(...bytes))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '')

const randomString = () => base64url(crypto.getRandomValues(new Uint8Array(32)))

/** The sign-in in progress; a new one cancels it. */
let cancelPending: (() => void) | null = null

/**
 * Sign in to Dropbox and allow C64-Pad its app folder. On the web this opens
 * a popup, so call it straight from a tap.
 */
export async function signInToDropbox(): Promise<DropboxSettings> {
  if (!dropboxAvailable())
    throw new CloudError("Dropbox isn't set up in this build of C64-Pad.")
  const native = Capacitor.isNativePlatform()
  // Before any await, or the browser blocks the popup.
  const popup = native
    ? null
    : window.open('', 'c64pad-dropbox', 'width=520,height=720')
  if (!native && !popup)
    throw new CloudError(
      'The Dropbox sign-in window was blocked. Allow pop-ups and try again.',
    )

  cancelPending?.()
  const verifier = randomString()
  const state = randomString()
  const challenge = base64url(
    new Uint8Array(
      await crypto.subtle.digest('SHA-256', new TextEncoder().encode(verifier)),
    ),
  )
  const url = `https://www.dropbox.com/oauth2/authorize?${new URLSearchParams({
    client_id: DROPBOX_APP_KEY,
    response_type: 'code',
    code_challenge: challenge,
    code_challenge_method: 'S256',
    redirect_uri: redirectUri(),
    token_access_type: 'offline',
    state,
  })}`

  const search = await (native
    ? waitForDeepLink(url)
    : waitForPopup(popup as Window, url))
  const params = new URLSearchParams(search)
  if (params.get('state') !== state)
    throw new CloudError('Dropbox sign-in was interrupted. Try again.')
  const code = params.get('code')
  if (!code)
    throw new CloudError(
      params.get('error') === 'access_denied'
        ? 'Sign-in was cancelled.'
        : `Dropbox didn't sign you in (${params.get('error_description') ?? params.get('error') ?? 'no code'}).`,
    )

  const tokens = await tokenRequest({
    grant_type: 'authorization_code',
    code,
    code_verifier: verifier,
    redirect_uri: redirectUri(),
  })
  if (!tokens.refresh_token)
    throw new CloudError("Dropbox didn't allow C64-Pad to stay signed in.")
  remember(tokens.refresh_token, tokens)
  const account = await accountOf(tokens.access_token)
  return {
    provider: 'dropbox',
    email: account.email,
    accountId: account.account_id,
    refreshToken: tokens.refresh_token,
  }
}

/** The popup lands on dropbox-auth.html, which broadcasts its query. */
function waitForPopup(popup: Window, url: string) {
  popup.location.href = url
  return new Promise<string>((resolve, reject) => {
    const channel = new BroadcastChannel(AUTH_CHANNEL)
    const done = () => {
      channel.close()
      cancelPending = null
    }
    channel.onmessage = (e: MessageEvent) => {
      done()
      try {
        popup.close()
      } catch {
        // It closes itself.
      }
      resolve(String(e.data))
    }
    cancelPending = () => {
      done()
      reject(new CloudError('Sign-in was cancelled.'))
    }
  })
}

/** A Custom Tab, then the app is opened again at NATIVE_REDIRECT. */
async function waitForDeepLink(url: string) {
  let finish: (search: string | null) => void = () => {}
  const result = new Promise<string | null>((resolve) => (finish = resolve))
  const opened = await App.addListener('appUrlOpen', ({ url: link }) => {
    if (link.startsWith(NATIVE_REDIRECT)) finish(new URL(link).search)
  })
  // Closing the tab cancels, unless the redirect is just behind it.
  const closed = await Browser.addListener('browserFinished', () =>
    setTimeout(() => finish(null), 1500),
  )
  cancelPending = () => finish(null)
  try {
    await Browser.open({ url })
    const search = await result
    if (search === null) throw new CloudError('Sign-in was cancelled.')
    return search
  } finally {
    cancelPending = null
    void opened.remove()
    void closed.remove()
    void Browser.close().catch(() => {})
  }
}

interface Tokens {
  access_token: string
  expires_in: number
  refresh_token?: string
}

async function tokenRequest(body: Record<string, string>): Promise<Tokens> {
  let res: Response
  try {
    res = await fetch(`${API}/oauth2/token`, {
      method: 'POST',
      body: new URLSearchParams({ ...body, client_id: DROPBOX_APP_KEY }),
    })
  } catch {
    throw new CloudError("Couldn't reach Dropbox. Check that you're online.")
  }
  if (res.ok) return (await res.json()) as Tokens
  const error = (await res.json().catch(() => null)) as {
    error?: string
    error_description?: string
  } | null
  if (error?.error === 'invalid_grant')
    throw new CloudError('Your Dropbox sign-in has expired. Sign in again.', {
      needsSignIn: true,
    })
  throw new CloudError(
    `Dropbox didn't sign you in (${error?.error_description ?? error?.error ?? res.status}).`,
  )
}

async function accountOf(accessToken: string) {
  const res = await fetch(`${API}/2/users/get_current_account`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${accessToken}` },
  })
  if (!res.ok) throw new CloudError("Couldn't read your Dropbox account.")
  return (await res.json()) as { account_id: string; email: string }
}

/** Access tokens, by refresh token; they last about four hours. */
const tokens = new Map<string, { value: string; expires: number }>()

function remember(refreshToken: string, t: Tokens) {
  tokens.set(refreshToken, {
    value: t.access_token,
    // Renew a few minutes early.
    expires: Date.now() + (t.expires_in - 300) * 1000,
  })
}

/** A Dropbox access token; `renew` after Dropbox rejected the last one. */
export async function dropboxToken(
  settings: DropboxSettings,
  { renew = false } = {},
): Promise<string> {
  const cached = tokens.get(settings.refreshToken)
  if (!renew && cached && cached.expires > Date.now()) return cached.value
  const t = await tokenRequest({
    grant_type: 'refresh_token',
    refresh_token: settings.refreshToken,
  })
  remember(settings.refreshToken, t)
  return t.access_token
}

/** Revoke this device's sign-in. */
export async function signOutOfDropbox(settings: DropboxSettings) {
  try {
    const token = await dropboxToken(settings)
    await fetch(`${API}/2/auth/token/revoke`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` },
    })
  } catch {
    // Already revoked, or offline: the token is forgotten either way.
  }
  tokens.delete(settings.refreshToken)
}
