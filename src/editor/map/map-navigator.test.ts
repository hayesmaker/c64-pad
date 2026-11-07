import { describe, expect, it } from 'vitest'
import { mapBounds } from './map-canvas'
import { centerViewOn, navigatorScale, visibleChars } from './map-navigator'

// A 40 × 100 map at 10 px per char in a one-screen frame (400 × 250).
const map = { width: 40, height: 100 }
const bounds = mapBounds(map, 10, { width: 400, height: 250 })

describe('map navigator', () => {
  it('fits the whole map in the navigator', () => {
    const frame = { width: 1000, height: 700 }
    // Tall: limited by height (360 px).
    expect(navigatorScale(map, frame)).toBeCloseTo(3.6)
    expect(navigatorScale({ width: 40, height: 275 }, frame)).toBeCloseTo(
      360 / 275,
    )
    // Wide: limited by width (240 px).
    expect(navigatorScale({ width: 400, height: 25 }, frame)).toBeCloseTo(0.6)
    // A small frame shrinks it.
    expect(
      navigatorScale({ width: 400, height: 25 }, { width: 300, height: 200 }),
    ).toBeCloseTo(0.25)
  })

  it('boxes the visible chars', () => {
    expect(visibleChars(map, { zoom: 1, x: 0, y: -300 }, bounds)).toEqual({
      x: 0,
      y: 30,
      width: 40,
      height: 25,
    })
    expect(visibleChars(map, { zoom: 2, x: -100, y: -200 }, bounds)).toEqual({
      x: 5,
      y: 10,
      width: 20,
      height: 12.5,
    })
  })

  it('centres the view on a point, clamped to the map', () => {
    expect(centerViewOn(map, { zoom: 1, x: 0, y: 0 }, bounds, 20, 50)).toEqual({
      zoom: 1,
      x: 0,
      y: -375,
    })
    // Past the bottom edge: the last screen.
    expect(centerViewOn(map, { zoom: 1, x: 0, y: 0 }, bounds, 20, 99)).toEqual({
      zoom: 1,
      x: 0,
      y: -750,
    })
    // Zoomed in, x moves too.
    expect(centerViewOn(map, { zoom: 2, x: 0, y: 0 }, bounds, 30, 10)).toEqual({
      zoom: 2,
      x: -400,
      y: -75,
    })
  })
})
