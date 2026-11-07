import { describe, expect, it } from 'vitest'
import {
  DEFAULT_VIEW,
  clampView,
  clampViewTo,
  zoomAround,
  zoomAroundIn,
} from './view'

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

describe('content larger or smaller than the frame', () => {
  const b = {
    frameW: 100,
    frameH: 100,
    contentW: 300,
    contentH: 50,
    minZoom: 0.5,
    maxZoom: 8,
  }
  it('pans across larger content without gaps, pins smaller content to the start', () => {
    expect(clampViewTo({ zoom: 1, x: -500, y: 80 }, b)).toEqual({
      zoom: 1,
      x: -200,
      y: 0,
    })
    expect(clampViewTo({ zoom: 1, x: 20, y: -10 }, b)).toEqual({
      zoom: 1,
      x: 0,
      y: 0,
    })
  })
  it('zooms out below 1 when allowed', () => {
    expect(zoomAroundIn(DEFAULT_VIEW, 0.1, { x: 0, y: 0 }, b).zoom).toBe(0.5)
  })
})
