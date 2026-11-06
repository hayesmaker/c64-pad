import { describe, expect, it } from 'vitest'
import { DEFAULT_VIEW, clampView, zoomAround } from './view'

describe('grid view', () => {
  it('clamps zoom to 1-8 and keeps the content covering the frame', () => {
    expect(clampView({ zoom: 0.5, x: 10, y: 10 }, 100, 100)).toEqual(
      DEFAULT_VIEW,
    )
    expect(clampView({ zoom: 20, x: -5000, y: 0 }, 100, 100)).toEqual({
      zoom: 8,
      x: -700,
      y: 0,
    })
  })

  it('zooms around a point, keeping it fixed', () => {
    const v = zoomAround(DEFAULT_VIEW, 2, { x: 50, y: 50 }, 100, 100)
    expect(v).toEqual({ zoom: 2, x: -50, y: -50 })
    // the content point that was under (50,50) is still there
    expect((50 - v.x) / v.zoom).toBe(50)
  })

  it('zooming out fully returns to the default view', () => {
    const zoomed = zoomAround(DEFAULT_VIEW, 4, { x: 10, y: 90 }, 100, 100)
    expect(zoomAround(zoomed, 1, { x: 30, y: 30 }, 100, 100)).toEqual(
      DEFAULT_VIEW,
    )
  })
})
