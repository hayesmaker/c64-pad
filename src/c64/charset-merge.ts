import { encodeTile, fitCharset } from './char-fit'
import { charLook } from './charset-match'
import { CHAR_BYTES, charCount, getCharBytes } from './charset'
import { COLOR_NAMES } from './palette'
import { newId } from './ids'
import { addAsset, mapsUsingCharset } from './project'
import type { Charmap } from './charmap'
import type { Charset } from './charset'
import type { Project } from './project'

/**
 * Merging chars into a new charset: a copy of a base charset with chars
 * from another (all its used chars, or a chosen few) added. Nothing
 * existing changes; maps are switched to the new charset by hand.
 *
 * The base's chars keep their slots, so the base's maps can use the new
 * charset as they are. Added chars only go into free slots: empty chars no
 * map of the base uses. Each added char is re-fitted to the base's mode and
 * background / MC1 / MC2, keeping its colours wherever those registers
 * allow; its background pixels stay background. A char the base already has
 * (after fitting) is reused instead of added.
 */

export function isCharEmpty(cs: Charset, index: number): boolean {
  return getCharBytes(cs, index).every((b) => b === 0)
}

/** Chars with any pixels set, in order. */
export function usedChars(cs: Charset): Array<number> {
  return Array.from({ length: charCount(cs.mode) }, (_, i) => i).filter(
    (i) => !isCharEmpty(cs, i),
  )
}

/** Screen codes the maps use, blank chars included. */
function codesUsedBy(maps: ReadonlyArray<Charmap>): Set<number> {
  const codes = new Set<number>()
  for (const m of maps) {
    codes.add(m.blank)
    for (const c of m.cells) codes.add(c)
  }
  return codes
}

/**
 * The chars as the target would store them: each source char's colours
 * (background pixels left transparent, so they stay background) fitted to
 * the target's mode and registers.
 */
function fitToTarget(
  source: Charset,
  target: Charset,
  chars: ReadonlyArray<number>,
): Array<{ bytes: Uint8Array; color: number; problem: string | null }> {
  const tiles = chars.map((i) => charLook(source, i))
  const mc = target.mode === 'multicolor'
  const fit = fitCharset(
    // Tile 0 of a fit is the empty tile.
    { tiles: [new Int8Array(64).fill(-1), ...tiles], transparent: true },
    mc
      ? {
          mode: 'multicolor',
          background: target.background,
          multicolor1: target.multicolor1,
          multicolor2: target.multicolor2,
        }
      : { mode: 'hires', background: target.background },
  )
  return tiles.map((tile, k) => {
    const t = fit.tiles[k + 1]
    return {
      bytes: encodeTile(tile, fit, t.mode),
      // In a multicolour set, colour RAM bit 3 marks a multicolour char.
      color: mc ? (t.mode === 'multicolor' ? 8 : 0) | (t.color & 7) : t.color,
      problem: t.problem,
    }
  })
}

/** Same look: same pixels and colour (an empty char is background whatever its colour). */
function sameChar(
  aBytes: Uint8Array,
  aColor: number,
  bBytes: Uint8Array,
  bColor: number,
) {
  const empty = aBytes.every((b) => b === 0)
  return aBytes.every((b, i) => b === bBytes[i]) && (empty || aColor === bColor)
}

export interface CharMove {
  readonly from: number
  readonly to: number
  /** The target already had this char; nothing was copied. */
  readonly reused: boolean
}

export interface CharMergePlan {
  readonly source: Charset
  readonly target: Charset
  /** Where each selected char goes, in selection order. */
  readonly moves: ReadonlyArray<CharMove>
  /** The target's chars with the copied ones added (not yet in the project). */
  readonly merged: Charset
  /** Copied chars that won't look the same in the target. */
  readonly problems: ReadonlyArray<{ char: number; problem: string }>
  /** Differences that change how copied chars look (the background). */
  readonly warnings: ReadonlyArray<string>
  /** Free slots in the target before copying. */
  readonly free: number
  /** Why it can't be done (null = it can). */
  readonly error: string | null
}

/** Work out a merge of `selection` (source char indices) with the target. */
export function planCharMerge(
  project: Project,
  sourceId: string,
  targetId: string,
  selection: ReadonlyArray<number>,
): CharMergePlan {
  const source = project.charsets.find((c) => c.id === sourceId)
  const target = project.charsets.find((c) => c.id === targetId)
  if (!source || !target) throw new RangeError('No such charset')
  const base = {
    source,
    target,
    merged: target,
    moves: [],
    problems: [],
    warnings: [],
    free: 0,
  }
  if (sourceId === targetId) {
    return { ...base, error: 'Choose another charset to merge with' }
  }
  if (source.mode === 'ecm' || target.mode === 'ecm') {
    return { ...base, error: "ECM charsets can't be merged yet" }
  }

  const count = charCount(target.mode)
  const reserved = codesUsedBy(mapsUsingCharset(project, targetId))
  const free: Array<number> = []
  for (let i = 0; i < count; i++) {
    if (isCharEmpty(target, i) && !reserved.has(i)) free.push(i)
  }
  const occupied = Array.from({ length: count }, (_, i) => i).filter(
    (i) => !free.includes(i),
  )

  const data = target.data.slice()
  const colors = target.colors.slice()
  const charAt = (i: number) =>
    data.subarray(i * CHAR_BYTES, (i + 1) * CHAR_BYTES)
  const moves: Array<CharMove> = []
  const problems: Array<{ char: number; problem: string }> = []
  let nextFree = 0
  const fitted = fitToTarget(source, target, selection)
  for (const [k, from] of selection.entries()) {
    const { bytes, color: value, problem } = fitted[k]
    const same = occupied.find((i) =>
      sameChar(bytes, value, charAt(i), colors[i]),
    )
    if (same !== undefined) {
      moves.push({ from, to: same, reused: true })
      continue
    }
    if (nextFree >= free.length) {
      return {
        ...base,
        free: free.length,
        error: `Not enough room: “${target.name}” has ${free.length} free slot${free.length === 1 ? '' : 's'} for these chars`,
      }
    }
    const to = free[nextFree++]
    data.set(bytes, to * CHAR_BYTES)
    colors[to] = value
    occupied.push(to)
    moves.push({ from, to, reused: false })
    if (problem) problems.push({ char: from, problem })
  }

  const copiedAny = moves.some((m) => !m.reused)
  const warnings: Array<string> = []
  if (copiedAny && source.background !== target.background) {
    warnings.push(
      `Background: “${source.name}” uses ${COLOR_NAMES[source.background]}, “${target.name}” uses ${COLOR_NAMES[target.background]}. Copied chars' background pixels show ${COLOR_NAMES[target.background]}.`,
    )
  }

  const merged: Charset = { ...target, data, colors }
  return {
    ...base,
    merged,
    moves,
    problems,
    warnings,
    free: free.length,
    error: null,
  }
}

/** “base + other”, or “base + other 2”… if that name is taken. */
export function mergedCharsetName(project: Project, plan: CharMergePlan) {
  const base = `${plan.target.name} + ${plan.source.name}`
  const taken = new Set(project.charsets.map((c) => c.name))
  if (!taken.has(base)) return base
  for (let n = 2; ; n++) if (!taken.has(`${base} ${n}`)) return `${base} ${n}`
}

/** Add the merged chars to the project as a new charset (nothing else changes). */
export function addMergedCharset(
  project: Project,
  plan: CharMergePlan,
  name: string,
): Project {
  if (plan.error) throw new RangeError(plan.error)
  return addAsset(project, 'charsets', {
    ...plan.merged,
    id: newId(),
    name,
    notes: `Merged from “${plan.target.name}” and “${plan.source.name}”.`,
  })
}
