import { useState } from 'react'
import type { C64Color } from '@/c64/palette'

const BG_KEY = 'c64pad:sprite-background'

/** Grid/preview background (null = paper), remembered on this device. */
export function useStoredBackground() {
  const [bg, setBg] = useState<C64Color | null>(() => {
    try {
      const v = localStorage.getItem(BG_KEY)
      return v === null || v === 'paper' ? null : Number(v)
    } catch {
      return null
    }
  })
  const set = (color: C64Color | null) => {
    setBg(color)
    try {
      localStorage.setItem(BG_KEY, color === null ? 'paper' : String(color))
    } catch {
      // storage unavailable: keep for this session only
    }
  }
  return [bg, set] as const
}
