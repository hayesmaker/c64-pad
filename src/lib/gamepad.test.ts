import { describe, expect, it } from 'vitest'
import { PAD, PadReader, REPEAT_DELAY, REPEAT_EVERY } from './gamepad'

const snap = (buttons: Array<number> = [], axes: Array<number> = [0, 0]) => {
  const pressed = Array.from({ length: 17 }, (_, i) => buttons.includes(i))
  return { pressed, axes }
}

describe('PadReader', () => {
  it('reports a press once, then a release', () => {
    const r = new PadReader()
    expect(r.update(snap([PAD.A]), 0)).toEqual([
      { type: 'press', button: PAD.A },
    ])
    expect(r.update(snap([PAD.A]), 16)).toEqual([])
    expect(r.isDown(PAD.A)).toBe(true)
    expect(r.update(snap(), 32)).toEqual([{ type: 'release', button: PAD.A }])
    expect(r.isDown(PAD.A)).toBe(false)
  })

  it('steps the d-pad at once, then repeats after a delay', () => {
    const r = new PadReader()
    expect(r.update(snap([PAD.RIGHT]), 0)).toEqual([
      { type: 'move', dx: 1, dy: 0 },
    ])
    expect(r.update(snap([PAD.RIGHT]), REPEAT_DELAY - 1)).toEqual([])
    expect(r.update(snap([PAD.RIGHT]), REPEAT_DELAY)).toHaveLength(1)
    expect(r.update(snap([PAD.RIGHT]), REPEAT_DELAY + 1)).toEqual([])
    expect(
      r.update(snap([PAD.RIGHT]), REPEAT_DELAY + REPEAT_EVERY),
    ).toHaveLength(1)
  })

  it('d-pad buttons are directions, not presses', () => {
    const r = new PadReader()
    const events = r.update(snap([PAD.UP]), 0)
    expect(events).toEqual([{ type: 'move', dx: 0, dy: -1 }])
    expect(r.update(snap(), 16)).toEqual([])
  })

  it('a new direction steps at once, diagonals step both ways', () => {
    const r = new PadReader()
    r.update(snap([PAD.UP]), 0)
    expect(r.update(snap([PAD.UP, PAD.LEFT]), 16)).toEqual([
      { type: 'move', dx: -1, dy: -1 },
    ])
  })

  it('reads the left stick past its deadzone', () => {
    const r = new PadReader()
    expect(r.update(snap([], [0.3, -0.2]), 0)).toEqual([])
    expect(r.update(snap([], [0.9, -0.2]), 16)).toEqual([
      { type: 'move', dx: 1, dy: 0 },
    ])
  })

  it('the d-pad wins over the stick on its axis', () => {
    const r = new PadReader()
    expect(r.update(snap([PAD.LEFT], [1, 0]), 0)).toEqual([
      { type: 'move', dx: -1, dy: 0 },
    ])
  })
})
