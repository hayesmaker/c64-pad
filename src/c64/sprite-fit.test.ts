import { describe, expect, it } from 'vitest'
import { encodeSprite, fitSprites } from './sprite-fit'
import { createSprite } from './sprite'
import { createSpriteSet, renderSprite } from './sprite-set'

const W = 24
const H = 21

/** A 24×21 image from a function of x, y (-1 = transparent). */
function image(at: (x: number, y: number) => number): Int8Array {
  const img = new Int8Array(W * H)
  for (let y = 0; y < H; y++)
    for (let x = 0; x < W; x++) img[y * W + x] = at(x, y)
  return img
}

/** Encode as fitted, build the set, and render it back to colours. */
function roundTrip(images: Array<Int8Array>) {
  const fit = fitSprites(images)
  const sprites = images.flatMap((img, i) => {
    const { sprite, overlay } = encodeSprite(img, fit.sprites[i], fit)
    const front = overlay && createSprite(overlay)
    return [
      createSprite({ ...sprite, overlayId: front?.id ?? null }),
      ...(front ? [front] : []),
    ]
  })
  const set = createSpriteSet({
    sprites,
    multicolor1: fit.multicolor1,
    multicolor2: fit.multicolor2,
  })
  const bases = sprites.filter(
    (s) => !sprites.some((o) => o.overlayId === s.id),
  )
  return { fit, rendered: bases.map((s) => renderSprite(set, s)) }
}

// Wide (double) pixels: colour by pair.
const wide = (f: (px: number, y: number) => number) =>
  image((x, y) => f(x >> 1, y))

describe('fitSprites', () => {
  it('keeps one-colour art hires, with the default multicolours', () => {
    const img = image((x, y) => ((x + y) % 3 === 0 ? 5 : -1))
    const { fit, rendered } = roundTrip([img])
    expect(fit.sprites[0]).toMatchObject({
      kind: 'hires',
      color: 5,
      problem: null,
    })
    expect([fit.multicolor1, fit.multicolor2]).toEqual([11, 1])
    expect(rendered[0]).toEqual(img)
  })

  it('finds shared multicolours for multicolour art', () => {
    // Every sprite uses 0 and 1; each has one more colour of its own.
    const images = [2, 3, 4].map((own) =>
      wide((px, y) => (px < 4 ? 0 : px < 8 ? 1 : y % 2 ? own : -1)),
    )
    const { fit, rendered } = roundTrip(images)
    expect([fit.multicolor1, fit.multicolor2]).toEqual([0, 1])
    expect(fit.sprites.map((s) => [s.kind, s.color])).toEqual([
      ['multicolor', 2],
      ['multicolor', 3],
      ['multicolor', 4],
    ])
    expect(fit.failures).toEqual([])
    rendered.forEach((r, i) => expect(r).toEqual(images[i]))
  })

  it('splits single-pixel detail into a hires overlay', () => {
    // A multicolour body in 2 / 3 / 4, with single-pixel detail in blue (6).
    const img = wide((px, y) => (px < 6 ? 2 : y < 10 ? 3 : 4))
    for (let y = 0; y < H; y += 2) img[y * W + 5] = 6 // odd column: half a pair
    const { fit, rendered } = roundTrip([img])
    expect(fit.sprites[0]).toMatchObject({
      kind: 'overlay',
      overlayColor: 6,
      problem: null,
    })
    expect(rendered[0]).toEqual(img)
  })

  it('reports art that cannot fit and imports it as close as it can', () => {
    // Hires pixels in four colours.
    const img = image((x) => [2, 3, 4, 5][x % 4])
    const { fit } = roundTrip([img])
    expect(fit.failures).toEqual([
      { sprite: 0, problem: 'hires pixels in 4 colours' },
    ])
  })

  it('keeps the overlay when the body has a colour too many', () => {
    const img = wide((px) => [2, 3, 4, 5][px % 4])
    img[5] = 6
    const fit = fitSprites([img])
    expect(fit.sprites[0]).toMatchObject({ kind: 'overlay', overlayColor: 6 })
    expect(fit.failures[0].problem).toBe(
      '2 colours besides the two multicolours (a sprite has room for 1), even with a hi-res overlay',
    )
  })

  it('uses chosen multicolours', () => {
    const img = wide((px) => [7, 8, 9][px % 3])
    const fit = fitSprites([img], { multicolor1: 8, multicolor2: 9 })
    expect([fit.multicolor1, fit.multicolor2]).toEqual([8, 9])
    expect(fit.sprites[0]).toMatchObject({ kind: 'multicolor', color: 7 })
  })
})
