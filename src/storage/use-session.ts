import { useSyncExternalStore } from 'react'
import type { ProjectSession, SessionState } from './session'

export function useSessionState(session: ProjectSession): SessionState {
  return useSyncExternalStore(
    session.subscribe,
    session.getSnapshot,
    session.getSnapshot,
  )
}
