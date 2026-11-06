import type { EdgeTab } from './edge-tabs'
import type { Project } from '@/c64/project'

export type EditorKind = 'sprites' | 'charsets' | 'maps'

/**
 * Edge tabs for a project's editors. Each opens the first asset of its kind
 * (or the project page if there is none).
 */
export function editorTabs(
  project: Project,
  current: EditorKind,
): Array<EdgeTab> {
  const projectId = project.id
  const toProject: EdgeTab['link'] = {
    to: '/projects/$projectId',
    params: { projectId },
  }
  const set = project.spriteSets.at(0)
  const charset = project.charsets.at(0)
  const map = project.maps.at(0)
  return [
    {
      label: 'SPRITES',
      current: current === 'sprites',
      link: set
        ? {
            to: '/projects/$projectId/sprites/$setId',
            params: { projectId, setId: set.id },
          }
        : toProject,
    },
    {
      label: 'CHARS',
      current: current === 'charsets',
      link: charset
        ? {
            to: '/projects/$projectId/charsets/$charsetId',
            params: { projectId, charsetId: charset.id },
          }
        : toProject,
    },
    {
      label: 'SCREEN',
      current: current === 'maps',
      link: map
        ? {
            to: '/projects/$projectId/maps/$mapId',
            params: { projectId, mapId: map.id },
          }
        : toProject,
    },
  ]
}
