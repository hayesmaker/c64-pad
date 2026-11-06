import { createCharmap } from './charmap'
import { createCharset } from './charset'
import { ModelError } from './errors'
import { newId } from './ids'
import { createSpriteSet } from './sprite-set'
import type { Charmap } from './charmap'
import type { Charset } from './charset'
import type { SpriteSet } from './sprite-set'

/** Bump when the stored shape changes; persistence migrates older versions. */
export const PROJECT_VERSION = 1

/** The unit of saving and export: holds any number of sprite sets, charsets and maps. */
export interface Project {
  readonly version: typeof PROJECT_VERSION
  readonly id: string
  readonly name: string
  /** The program the designs are for (worksheet "Program" field). */
  readonly program: string
  readonly notes: string
  /** Worksheet "Date designed", YYYY-MM-DD. */
  readonly dateDesigned: string
  readonly createdAt: string
  readonly updatedAt: string
  readonly spriteSets: ReadonlyArray<SpriteSet>
  readonly charsets: ReadonlyArray<Charset>
  readonly maps: ReadonlyArray<Charmap>
}

export type AssetKind = 'spriteSets' | 'charsets' | 'maps'

/** A new project with one sprite set, one charset and a 40×25 map using it. */
export function createProject(
  init: Partial<Omit<Project, 'version'>> = {},
  now: Date = new Date(),
): Project {
  const charset = createCharset({ name: 'Charset 1' })
  const iso = now.toISOString()
  const project: Project = {
    version: PROJECT_VERSION,
    id: newId(),
    name: 'Untitled project',
    program: '',
    notes: '',
    dateDesigned: iso.slice(0, 10),
    createdAt: iso,
    updatedAt: iso,
    spriteSets: [createSpriteSet({ name: 'Sprites 1' })],
    charsets: [charset],
    maps: [createCharmap({ name: 'Map 1', charsetId: charset.id })],
    ...init,
  }
  checkIntegrity(project)
  return project
}

/** Throws if any map points at a charset that isn't in the project. */
export function checkIntegrity(project: Project): void {
  const ids = new Set<string>()
  for (const asset of [
    ...project.spriteSets,
    ...project.charsets,
    ...project.maps,
  ]) {
    if (ids.has(asset.id))
      throw new ModelError(`Duplicate asset id ${asset.id}`)
    ids.add(asset.id)
  }
  for (const map of project.maps) {
    if (!project.charsets.some((c) => c.id === map.charsetId)) {
      throw new ModelError(
        `Map ${map.name} uses missing charset ${map.charsetId}`,
      )
    }
  }
}

/** Stamp the modification time (call when saving). */
export function touchProject(
  project: Project,
  now: Date = new Date(),
): Project {
  return { ...project, updatedAt: now.toISOString() }
}

export function renameProject(project: Project, name: string): Project {
  return { ...project, name }
}

// ---- generic asset helpers

type AssetOf<TKind extends AssetKind> = Project[TKind][number]

export function findAsset<TKind extends AssetKind>(
  project: Project,
  kind: TKind,
  id: string,
): AssetOf<TKind> | undefined {
  return (project[kind] as ReadonlyArray<AssetOf<TKind>>).find(
    (a) => a.id === id,
  )
}

function requireAsset<TKind extends AssetKind>(
  project: Project,
  kind: TKind,
  id: string,
) {
  const asset = findAsset(project, kind, id)
  if (!asset) throw new ModelError(`No ${kind} entry ${id}`)
  return asset
}

function replaceList<TKind extends AssetKind>(
  project: Project,
  kind: TKind,
  list: Array<AssetOf<TKind>>,
): Project {
  return { ...project, [kind]: list }
}

/** Apply a change to one asset. The id cannot be changed; integrity is checked. */
export function updateAsset<TKind extends AssetKind>(
  project: Project,
  kind: TKind,
  id: string,
  change: (asset: AssetOf<TKind>) => AssetOf<TKind>,
): Project {
  const current = requireAsset(project, kind, id)
  const next = change(current)
  if (next === current) return project
  if (next.id !== id) throw new ModelError('updateAsset cannot change an id')
  const list = (project[kind] as ReadonlyArray<AssetOf<TKind>>).map((a) =>
    a.id === id ? next : a,
  )
  const updated = replaceList(project, kind, list)
  checkIntegrity(updated)
  return updated
}

export function addAsset<TKind extends AssetKind>(
  project: Project,
  kind: TKind,
  asset: AssetOf<TKind>,
): Project {
  const updated = replaceList(project, kind, [
    ...(project[kind] as ReadonlyArray<AssetOf<TKind>>),
    asset,
  ])
  checkIntegrity(updated)
  return updated
}

export function renameAsset(
  project: Project,
  kind: AssetKind,
  id: string,
  name: string,
): Project {
  return updateAsset(project, kind, id, (a) => ({ ...a, name }))
}

// ---- specific rules

export function mapsUsingCharset(
  project: Project,
  charsetId: string,
): Array<Charmap> {
  return project.maps.filter((m) => m.charsetId === charsetId)
}

export function removeSpriteSet(project: Project, id: string): Project {
  requireAsset(project, 'spriteSets', id)
  return {
    ...project,
    spriteSets: project.spriteSets.filter((s) => s.id !== id),
  }
}

export function removeMap(project: Project, id: string): Project {
  requireAsset(project, 'maps', id)
  return { ...project, maps: project.maps.filter((m) => m.id !== id) }
}

/**
 * Remove a charset. If maps use it, `reassignTo` must name another charset
 * for them; otherwise this throws.
 */
export function removeCharset(
  project: Project,
  id: string,
  { reassignTo }: { reassignTo?: string } = {},
): Project {
  requireAsset(project, 'charsets', id)
  const users = mapsUsingCharset(project, id)
  if (users.length > 0) {
    if (!reassignTo) {
      throw new ModelError(
        `Charset is used by ${users.map((m) => m.name).join(', ')}; choose another charset for them first`,
      )
    }
    if (reassignTo === id)
      throw new ModelError('Cannot reassign maps to the charset being removed')
    requireAsset(project, 'charsets', reassignTo)
  }
  const updated: Project = {
    ...project,
    charsets: project.charsets.filter((c) => c.id !== id),
    maps: project.maps.map((m) =>
      m.charsetId === id && reassignTo ? { ...m, charsetId: reassignTo } : m,
    ),
  }
  checkIntegrity(updated)
  return updated
}

/** Point a map at a different charset in the project. */
export function setMapCharset(
  project: Project,
  mapId: string,
  charsetId: string,
): Project {
  requireAsset(project, 'charsets', charsetId)
  return updateAsset(project, 'maps', mapId, (m) => ({ ...m, charsetId }))
}

/** Copy an asset with a new id (and " copy" name) after the original. */
export function duplicateAsset(
  project: Project,
  kind: AssetKind,
  id: string,
): Project {
  const original = requireAsset(project, kind, id)
  const copy = structuredClone(original)
  const renamed = { ...copy, id: newId(), name: `${original.name} copy` }
  const list = [...(project[kind] as ReadonlyArray<AssetOf<typeof kind>>)]
  list.splice(list.indexOf(original) + 1, 0, renamed)
  const updated = replaceList(project, kind, list)
  checkIntegrity(updated)
  return updated
}
