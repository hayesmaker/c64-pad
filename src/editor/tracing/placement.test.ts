import { describe, expect, it } from 'vitest'
import {
  DEFAULT_TRACING,
  clampCrop,
  placeTracing,
  sizeCheck,
} from './placement'

const round = { width: 322, height: 1828 } // an arcade round reference
const map = { width: 320, height: 2048 } // 40 × 256 chars

describe('placeTracing', () => {
  it('puts the image 1:1 at the top left by default', () => {
    const p = placeTracing(round, map, DEFAULT_TRACING)
    expect(p.target).toEqual({ x: 0, y: 0, width: 322, height: 1828 })
    expect(p.source).toEqual({ x: 0, y: 0, width: 322, height: 1828 })
  })

  it('crops, then anchors bottom left and nudges', () => {
    const p = placeTracing(round, map, {
      ...DEFAULT_TRACING,
      crop: { top: 0, bottom: 208, left: 0, right: 2 },
      anchor: 6,
      nudge: { x: 0, y: -16 },
    })
    expect(p.source).toEqual({ x: 0, y: 0, width: 320, height: 1620 })
    expect(p.target).toEqual({
      x: 0,
      y: 2048 - 1620 - 16,
      width: 320,
      height: 1620,
    })
  })

  it('scales to fit width, fit height, fit all, stretch and custom', () => {
    const at = (size: typeof DEFAULT_TRACING.size, customPercent = 100) =>
      placeTracing(
        { width: 640, height: 400 },
        { width: 320, height: 400 },
        {
          ...DEFAULT_TRACING,
          size,
          customPercent,
        },
      )
    expect(at('width').target).toMatchObject({ width: 320, height: 200 })
    expect(at('height').target).toMatchObject({ width: 640, height: 400 })
    expect(at('fit').target).toMatchObject({ width: 320, height: 200 })
    expect(at('stretch').target).toMatchObject({ width: 320, height: 400 })
    expect(at('custom', 25).target).toMatchObject({ width: 160, height: 100 })
  })

  it('centres with anchor 4', () => {
    const p = placeTracing(
      { width: 10, height: 10 },
      { width: 24, height: 21 },
      {
        ...DEFAULT_TRACING,
        anchor: 4,
      },
    )
    expect([p.target.x, p.target.y]).toEqual([7, 5.5])
  })
})

describe('crop and size check', () => {
  it('keeps at least one pixel', () => {
    expect(
      clampCrop({ top: 50, bottom: 50, left: -3, right: 99 }, 10, 60),
    ).toEqual({
      top: 50,
      bottom: 9,
      left: 0,
      right: 9,
    })
  })

  it('reports how the cropped image differs from the target', () => {
    expect(sizeCheck(round, map, DEFAULT_TRACING.crop)).toEqual({
      width: 322,
      height: 1828,
      wider: 2,
      taller: -220,
    })
  })
})
