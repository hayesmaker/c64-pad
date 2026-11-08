import { CHAR_SHAPE, readPixels } from './bitmap'
import { charCount, charPixelMode, getCharBytes, renderChar } from './charset'
import type { Charmap } from './charmap'
import type { Charset } from './charset'
import type { Project } from './project'

/**
 * A char as the colours it shows, 64 row-major, with background pixels as
 * -1: the background is the screen's, so two chars look alike whatever
 * their charsets' background colours (and every empty char is alike).
 */
export function charLook(cs: Charset, index: number): Int8Array {
  const mode = charPixelMode(cs, index)
  const values = readPixels(getCharBytes(cs, index), CHAR_SHAPE, mode)
  const colors = renderChar(cs, index)
  const scale = mode === 'multicolor' ? 2 : 1
  const look = new Int8Array(64)
  for (let y = 0; y < 8; y++) {
    for (let x = 0; x < 8; x++) {
      const v = values[y * (8 / scale) + Math.floor(x / scale)]
      look[y * 8 + x] = v === 0 ? -1 : colors[y * 8 + x]
    }
  }
  return look
}

const key = (look: Int8Array) => look.join(',')

export interface CharsetSwitch {
  /** The map on the new charset, cells renumbered to matching chars. */
  readonly map: Charmap
  /** Screen codes that changed number (old → new). */
  readonly renumbered: ReadonlyArray<{ from: number; to: number }>
  /** Codes with no matching char in the new charset; they keep their number. */
  readonly unmatched: ReadonlyArray<number>
  /** ECM charsets aren't matched: codes are kept as they are. */
  readonly ecm: boolean
}

/**
 * Point a map at another charset, renumbering each screen code to a char
 * that looks the same there: the same code if it matches, else the first
 * matching char. Codes with no match keep their number.
 */
export function switchMapCharset(
  map: Charmap,
  from: Charset,
  to: Charset,
): CharsetSwitch {
  if (from.mode === 'ecm' || to.mode === 'ecm' || from.id === to.id) {
    return {
      map: { ...map, charsetId: to.id },
      renumbered: [],
      unmatched: [],
      ecm: from.id !== to.id,
    }
  }
  const toCount = charCount(to.mode)
  const looks = Array.from({ length: toCount }, (_, i) => key(charLook(to, i)))
  const first = new Map<string, number>()
  looks.forEach((k, i) => {
    if (!first.has(k)) first.set(k, i)
  })

  const used = new Set<number>([map.blank, ...map.cells])
  const code = new Map<number, number>()
  const renumbered: Array<{ from: number; to: number }> = []
  const unmatched: Array<number> = []
  for (const c of [...used].sort((a, b) => a - b)) {
    const k = key(charLook(from, c))
    const target = c < toCount && looks[c] === k ? c : first.get(k)
    if (target === undefined) {
      unmatched.push(c)
    } else if (target !== c) {
      code.set(c, target)
      renumbered.push({ from: c, to: target })
    }
  }
  const remap = (c: number) => code.get(c) ?? c
  return {
    map: {
      ...map,
      charsetId: to.id,
      cells: code.size > 0 ? map.cells.map(remap) : map.cells,
      blank: remap(map.blank),
    },
    renumbered,
    unmatched,
    ecm: false,
  }
}

/** Move every map using one charset to another, matching their chars. */
export function switchMapsToCharset(
  project: Project,
  fromId: string,
  toId: string,
): Project {
  const from = project.charsets.find((c) => c.id === fromId)
  const to = project.charsets.find((c) => c.id === toId)
  if (!from || !to) throw new RangeError('No such charset')
  return {
    ...project,
    maps: project.maps.map((m) =>
      m.charsetId === fromId ? switchMapCharset(m, from, to).map : m,
    ),
  }
}
