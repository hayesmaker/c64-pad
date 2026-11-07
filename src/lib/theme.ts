import { useSyncExternalStore } from 'react'

const QUERY = '(prefers-color-scheme: dark)'

function subscribe(onChange: () => void) {
  const mq = window.matchMedia(QUERY)
  mq.addEventListener('change', onChange)
  return () => mq.removeEventListener('change', onChange)
}

/** The device's light / dark setting, live. */
export function useColorScheme(): 'light' | 'dark' {
  return useSyncExternalStore(
    subscribe,
    () => (window.matchMedia(QUERY).matches ? 'dark' : 'light'),
    () => 'light',
  )
}

/** A colour token's current value, for canvas drawing (e.g. `cssVar('--paper')`). */
export function cssVar(name: string): string {
  return getComputedStyle(document.documentElement)
    .getPropertyValue(name)
    .trim()
}
