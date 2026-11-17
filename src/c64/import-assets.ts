import { checkIntegrity } from './project'
import { newId } from './ids'
import type { AssetKind, Project } from './project'

/**
 * Bringing sprite sets, charsets and maps over from another project.
 *
 * Copies of a project (an export, a cloud copy, Keep both) keep their asset
 * ids, so an asset is matched by id: `new` isn't in this project, `same` is
 * here unchanged (nothing to import), `different` has changed on one side
 * and is imported as a copy beside this project's own.
 */
export type ImportState = 'new' | 'same' | 'different'

export interface ImportCandidate {
  kind: AssetKind
  id: string
  name: string
  state: ImportState
}

export interface AssetPick {
  kind: AssetKind
  id: string
}

const KINDS: ReadonlyArray<AssetKind> = ['spriteSets', 'charsets', 'maps']

export function importCandidates(
  target: Project,
  source: Project,
): Array<ImportCandidate> {
  return KINDS.flatMap((kind) =>
    source[kind].map((asset) => {
      const here = target[kind].find((a) => a.id === asset.id)
      const state: ImportState = !here
        ? 'new'
        : sameAsset(here, asset)
          ? 'same'
          : 'different'
      return { kind, id: asset.id, name: asset.name, state }
    }),
  )
}

/**
 * Charsets that must come along with the picked maps: a map's charset unless
 * this project already has it unchanged.
 */
export function requiredCharsets(
  target: Project,
  source: Project,
  picks: ReadonlyArray<AssetPick>,
): Set<string> {
  const needed = new Set<string>()
  for (const pick of picks) {
    if (pick.kind !== 'maps') continue
    const map = source.maps.find((m) => m.id === pick.id)
    const mapHere = target.maps.find((m) => m.id === pick.id)
    // An unchanged map isn't imported, so it needs nothing.
    if (!map || (mapHere && sameAsset(mapHere, map))) continue
    const here = target.charsets.find((c) => c.id === map.charsetId)
    const there = source.charsets.find((c) => c.id === map.charsetId)
    if (there && !(here && sameAsset(here, there))) needed.add(there.id)
  }
  return needed
}

/**
 * Add the picked assets (and the charsets their maps need) to `target`.
 * New assets keep their ids; changed ones come in as copies with new ids,
 * named after the project they came from, and maps follow their charset.
 */
export function importAssets(
  target: Project,
  source: Project,
  picks: ReadonlyArray<AssetPick>,
): Project {
  const states = new Map(
    importCandidates(target, source).map((c) => [`${c.kind}:${c.id}`, c]),
  )
  const picked = new Set(picks.map((p) => `${p.kind}:${p.id}`))
  for (const id of requiredCharsets(target, source, picks))
    picked.add(`charsets:${id}`)

  /** Ids given to imported copies, so maps can follow their charset. */
  const renamed = new Map<string, string>()
  const bring = <T extends { id: string; name: string }>(
    kind: AssetKind,
    assets: ReadonlyArray<T>,
  ): Array<T> =>
    assets.flatMap((asset) => {
      const state = states.get(`${kind}:${asset.id}`)?.state
      if (!picked.has(`${kind}:${asset.id}`) || state === 'same') return []
      if (state === 'new') return [structuredClone(asset)]
      const id = newId()
      renamed.set(asset.id, id)
      return [
        {
          ...structuredClone(asset),
          id,
          name: `${asset.name} (${source.name})`,
        },
      ]
    })

  const spriteSets = bring('spriteSets', source.spriteSets)
  const charsets = bring('charsets', source.charsets)
  const maps = bring('maps', source.maps).map((m) => ({
    ...m,
    charsetId: renamed.get(m.charsetId) ?? m.charsetId,
  }))
  const updated: Project = {
    ...target,
    spriteSets: [...target.spriteSets, ...spriteSets],
    charsets: [...target.charsets, ...charsets],
    maps: [...target.maps, ...maps],
  }
  checkIntegrity(updated)
  return updated
}

/** Deep equality of stored data (Uint8Arrays compared by content). */
export function sameAsset(a: unknown, b: unknown): boolean {
  if (a === b) return true
  if (a instanceof Uint8Array || b instanceof Uint8Array) {
    if (!(a instanceof Uint8Array && b instanceof Uint8Array)) return false
    return a.length === b.length && a.every((v, i) => v === b[i])
  }
  if (Array.isArray(a) || Array.isArray(b)) {
    if (!(Array.isArray(a) && Array.isArray(b)) || a.length !== b.length)
      return false
    return a.every((v, i) => sameAsset(v, b[i]))
  }
  if (typeof a !== 'object' || typeof b !== 'object' || !a || !b) return false
  const ka = Object.keys(a)
  const kb = Object.keys(b)
  if (ka.length !== kb.length) return false
  return ka.every((k) =>
    sameAsset(
      (a as Record<string, unknown>)[k],
      (b as Record<string, unknown>)[k],
    ),
  )
}
