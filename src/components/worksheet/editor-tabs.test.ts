import { describe, expect, it } from 'vitest'
import { createCharmap } from '@/c64/charmap'
import { createCharset } from '@/c64/charset'
import { addAsset, createProject } from '@/c64/project'
import { editorTabs, editorTargets } from './editor-tabs'

function project() {
  const cs1 = createCharset({ name: 'Charset 1' })
  const cs2 = createCharset({ name: 'Charset 2' })
  const m1 = createCharmap({ name: 'Screen 1', charsetId: cs1.id })
  const m2 = createCharmap({ name: 'Screen 2', charsetId: cs2.id })
  const m3 = createCharmap({ name: 'Screen 3', charsetId: cs2.id })
  let p = createProject()
  p = addAsset(p, 'charsets', cs1)
  p = addAsset(p, 'charsets', cs2)
  for (const m of [m1, m2, m3]) p = addAsset(p, 'maps', m)
  return { p, cs1, cs2, m1, m2, m3 }
}

describe('editorTargets', () => {
  it("opens a screen's own charset", () => {
    const { p, cs2, m2 } = project()
    expect(editorTargets(p, 'maps', m2.id).charsets).toBe(cs2.id)
  })

  it('opens a screen using the charset, preferring the last one opened', () => {
    const { p, cs1, cs2, m1, m3 } = project()
    expect(editorTargets(p, 'charsets', cs2.id).maps).not.toBe(m1.id)
    editorTabs(p, 'maps', m3.id) // open Screen 3…
    editorTabs(p, 'charsets', cs2.id) // …then its charset
    expect(editorTargets(p, 'charsets', cs2.id).maps).toBe(m3.id)
    // Screen 3 doesn't use Charset 1, so Charset 1 opens Screen 1.
    expect(editorTargets(p, 'charsets', cs1.id).maps).toBe(m1.id)
  })

  it('falls back to the last opened, then the first', () => {
    const { p, m3 } = project()
    const lone = createCharset({ name: 'Unused' })
    const q = addAsset(p, 'charsets', lone)
    // No screen uses it: the last screen opened.
    editorTabs(q, 'maps', m3.id)
    expect(editorTargets(q, 'charsets', lone.id).maps).toBe(m3.id)
  })
})
