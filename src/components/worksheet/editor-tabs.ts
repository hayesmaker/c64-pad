import type { EdgeTab } from './edge-tabs'

export type EditorKind = 'sprites' | 'charsets' | 'maps'

/**
 * Edge tabs for a project's editors. Tabs for other editors go to the project
 * page until the project model can tell us the last-opened asset of each kind.
 */
export function editorTabs(
  projectId: string,
  current: EditorKind,
): Array<EdgeTab> {
  const tab = (label: string, kind: EditorKind): EdgeTab => ({
    label,
    current: kind === current,
    link: { to: '/projects/$projectId', params: { projectId } },
  })
  return [
    tab('SPRITES', 'sprites'),
    tab('CHARS', 'charsets'),
    tab('SCREEN', 'maps'),
  ]
}
