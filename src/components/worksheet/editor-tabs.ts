import type { EdgeTab } from './edge-tabs'
import type { Project } from '@/c64/project'

export type EditorKind = 'sprites' | 'charsets' | 'maps'

/** The last asset opened in each editor, per project (for this app session). */
const lastOpened = new Map<string, Partial<Record<EditorKind, string>>>()

/**
 * Which asset each edge tab opens, from the one being edited:
 * - CHARS from a screen opens that screen's charset;
 * - SCREEN from a charset opens a screen using it (the last one opened, if
 *   it does);
 * - otherwise the last one opened of that kind, or the first.
 */
export function editorTargets(
  project: Project,
  current: EditorKind,
  currentId: string,
): Record<EditorKind, string | undefined> {
  const last = { ...lastOpened.get(project.id), [current]: currentId }
  const pick = <T extends { id: string }>(
    items: ReadonlyArray<T>,
    kind: EditorKind,
    prefer: (item: T) => boolean = () => true,
  ) => {
    const candidates = items.filter(prefer)
    const pool = candidates.length > 0 ? candidates : items
    return (pool.find((i) => i.id === last[kind]) ?? pool.at(0))?.id
  }
  const map =
    current === 'maps'
      ? project.maps.find((m) => m.id === currentId)
      : undefined
  return {
    sprites: pick(project.spriteSets, 'sprites'),
    charsets: pick(project.charsets, 'charsets', (c) =>
      map ? c.id === map.charsetId : true,
    ),
    maps: pick(project.maps, 'maps', (m) =>
      current === 'charsets' ? m.charsetId === currentId : true,
    ),
  }
}

/** Remember the asset being edited, so the tabs come back to it. */
function remember(projectId: string, kind: EditorKind, id: string) {
  lastOpened.set(projectId, { ...lastOpened.get(projectId), [kind]: id })
}

/** Edge tabs for a project's editors (the project page if a kind has none). */
export function editorTabs(
  project: Project,
  current: EditorKind,
  currentId: string,
): Array<EdgeTab> {
  remember(project.id, current, currentId)
  const projectId = project.id
  const toProject: EdgeTab['link'] = {
    to: '/projects/$projectId',
    params: { projectId },
  }
  const target = editorTargets(project, current, currentId)
  return [
    {
      label: 'SPRITES',
      current: current === 'sprites',
      link: target.sprites
        ? {
            to: '/projects/$projectId/sprites/$setId',
            params: { projectId, setId: target.sprites },
          }
        : toProject,
    },
    {
      label: 'CHARS',
      current: current === 'charsets',
      link: target.charsets
        ? {
            to: '/projects/$projectId/charsets/$charsetId',
            params: { projectId, charsetId: target.charsets },
          }
        : toProject,
    },
    {
      label: 'SCREEN',
      current: current === 'maps',
      link: target.maps
        ? {
            to: '/projects/$projectId/maps/$mapId',
            params: { projectId, mapId: target.maps },
          }
        : toProject,
    },
  ]
}
