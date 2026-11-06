import { describe, expect, it } from 'vitest'
import { base64ToBytes, bytesToBase64 } from './bytes'

describe('base64', () => {
  it('matches the standard encoding', () => {
    const text = 'C64-Pad!'
    const bytes = new TextEncoder().encode(text)
    expect(bytesToBase64(bytes)).toBe(Buffer.from(text).toString('base64'))
  })

  it('round-trips every length and byte value', () => {
    for (let n = 0; n < 20; n++) {
      const bytes = Uint8Array.from({ length: n }, (_, i) => (i * 97 + n) & 255)
      expect(base64ToBytes(bytesToBase64(bytes))).toEqual(bytes)
    }
    const all = Uint8Array.from({ length: 256 }, (_, i) => i)
    expect(base64ToBytes(bytesToBase64(all))).toEqual(all)
  })

  it('rejects junk', () => {
    expect(() => base64ToBytes('ab$d')).toThrow()
  })
})
