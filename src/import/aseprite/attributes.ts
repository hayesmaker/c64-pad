import { ATTRIBUTE_COUNT, MAX_ATTRIBUTE_NAME } from '@/c64/charset'

export interface TileAttributes {
  /** Attribute per tile (0 = none). */
  readonly values: ReadonlyArray<number>
  /** Names for attributes 0-15 (index 0 is ''). */
  readonly names: ReadonlyArray<string>
  /** Tag texts that got no attribute (all 15 were taken). */
  readonly dropped: ReadonlyArray<string>
}

/**
 * Tile user data (Aseprite's tile properties text) as char attributes: text
 * that is just a number 1-15 is that attribute; any other text gets the next
 * free number, with the text as its name; "0" means none. Text past the
 * 15th is dropped.
 */
export function tileAttributes(
  tileUserData: ReadonlyArray<string>,
): TileAttributes {
  const texts = tileUserData.map((t) => t.trim())
  const numeric = (t: string) => {
    if (!/^\d+$/.test(t)) return 0
    const n = Number(t)
    return n >= 1 && n < ATTRIBUTE_COUNT ? n : 0
  }
  const taken = new Set(texts.map(numeric).filter(Boolean))
  const byText = new Map<string, number>()
  const names = Array<string>(ATTRIBUTE_COUNT).fill('')
  const dropped: Array<string> = []
  let next = 1
  for (const t of texts) {
    if (!t || t === '0' || numeric(t) || byText.has(t) || dropped.includes(t))
      continue
    while (next < ATTRIBUTE_COUNT && taken.has(next)) next++
    if (next >= ATTRIBUTE_COUNT) {
      dropped.push(t)
      continue
    }
    byText.set(t, next)
    taken.add(next)
    names[next] = t.slice(0, MAX_ATTRIBUTE_NAME)
  }
  return {
    values: texts.map((t) => numeric(t) || (byText.get(t) ?? 0)),
    names,
    dropped,
  }
}
