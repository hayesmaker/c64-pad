import { describe, expect, it } from 'vitest'
import { tileAttributes } from './attributes'

describe('tileAttributes', () => {
  it('numbers each distinct tag, naming it after the text', () => {
    const t = tileAttributes(['', 'solid', 'ladder', ' solid ', ''])
    expect(t.values).toEqual([0, 1, 2, 1, 0])
    expect(t.names.slice(0, 3)).toEqual(['', 'solid', 'ladder'])
    expect(t.dropped).toEqual([])
  })

  it('uses numbers 1-15 as they are and skips them when numbering text', () => {
    const t = tileAttributes(['solid', '1', '15', '16', '0'])
    expect(t.values).toEqual([2, 1, 15, 3, 0])
    expect(t.names[1]).toBe('')
    expect(t.names[2]).toBe('solid')
    // "16" is not an attribute number, so it is a name.
    expect(t.names[3]).toBe('16')
  })

  it('drops tags past the fifteenth', () => {
    const tags = Array.from({ length: 17 }, (_, i) => `t${i}`)
    const t = tileAttributes(tags)
    expect(t.values.slice(13)).toEqual([14, 15, 0, 0])
    expect(t.dropped).toEqual(['t15', 't16'])
  })
})
