import { createContext, useContext, useLayoutEffect } from 'react'
import { DEFAULT_PALETTE_ID, PALETTES, paletteRgb } from '@/c64/palette'
import type { ReactNode } from 'react'
import type { Palette, PaletteId, Rgb } from '@/c64/palette'

export interface ActivePalette extends Palette {
  /** RGB triples by colour index, for canvas drawing. */
  readonly rgb: ReadonlyArray<Rgb>
}

function active(id: PaletteId): ActivePalette {
  return { ...PALETTES[id], rgb: paletteRgb(id) }
}

const ACTIVE = Object.fromEntries(
  Object.keys(PALETTES).map((id) => [id, active(id as PaletteId)]),
) as Record<PaletteId, ActivePalette>

const PaletteContext = createContext<ActivePalette>(ACTIVE[DEFAULT_PALETTE_ID])

/** The palette colours are drawn in: the open project's, else the default. */
export function usePalette(): ActivePalette {
  return useContext(PaletteContext)
}

/**
 * Draw canvases below in another palette (e.g. a preview of a palette switch)
 * without touching the page's CSS colours.
 */
export function PaletteScope({
  id,
  children,
}: {
  id: PaletteId
  children: ReactNode
}) {
  return <PaletteContext value={ACTIVE[id]}>{children}</PaletteContext>
}

/**
 * Draw everything below in a palette. Also points the `--c64-screen` /
 * `--c64-border` CSS colours (blue / light blue) at it, on the document root
 * so dialogs rendered in portals follow too.
 */
export function PaletteProvider({
  id,
  children,
}: {
  id: PaletteId
  children: ReactNode
}) {
  const palette = ACTIVE[id]
  useLayoutEffect(() => {
    const style = document.documentElement.style
    style.setProperty('--c64-screen', palette.hex[6])
    style.setProperty('--c64-border', palette.hex[14])
    return () => {
      style.removeProperty('--c64-screen')
      style.removeProperty('--c64-border')
    }
  }, [palette])
  return <PaletteContext value={palette}>{children}</PaletteContext>
}
