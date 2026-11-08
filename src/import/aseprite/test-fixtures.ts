import { readFileSync } from 'node:fs'

/** The Rainbow Islands sample files in __fixtures__ (tests only). */
export type FixtureName =
  'island1_round4' | 'island-8-1_test' | 'island-8-2_test'

export function fixture(name: FixtureName): Uint8Array {
  return new Uint8Array(
    readFileSync(new URL(`./__fixtures__/${name}.aseprite`, import.meta.url)),
  )
}
