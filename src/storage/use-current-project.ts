import { getRouteApi } from '@tanstack/react-router'
import { getOpenSession } from './sessions'
import { useSessionState } from './use-session'

const projectRoute = getRouteApi('/projects/$projectId')

/** The open project for pages under /projects/$projectId. */
export function useCurrentProject() {
  const { projectId } = projectRoute.useParams()
  const session = getOpenSession(projectId)
  const state = useSessionState(session)
  return { session, ...state }
}
