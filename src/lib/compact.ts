import { useSyncExternalStore } from 'react'

/**
 * Small screens: handhelds like the Retroid Pocket (about 640×456 CSS px) and
 * phones. The same query as the `compact:` variant in styles.css.
 */
export const COMPACT_QUERY = '(max-height: 600px), (max-width: 700px)'

function subscribe(onChange: () => void) {
  const mq = window.matchMedia(COMPACT_QUERY)
  mq.addEventListener('change', onChange)
  return () => mq.removeEventListener('change', onChange)
}

/** True on small screens, where the editors use their compact layout. */
export function useCompact() {
  return useSyncExternalStore(
    subscribe,
    () => window.matchMedia(COMPACT_QUERY).matches,
    () => false,
  )
}
