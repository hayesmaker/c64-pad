import { useEffect, useRef } from 'react'

/**
 * Gamepad input, for handhelds like the Retroid Pocket. Buttons follow the
 * browser's "standard" layout (the Retroid's controller reports that order
 * even though its `mapping` is empty).
 */
export const PAD = {
  A: 0,
  B: 1,
  X: 2,
  Y: 3,
  L1: 4,
  R1: 5,
  L2: 6,
  R2: 7,
  SELECT: 8,
  START: 9,
  L3: 10,
  R3: 11,
  UP: 12,
  DOWN: 13,
  LEFT: 14,
  RIGHT: 15,
} as const

export type PadEvent =
  | { type: 'press'; button: number }
  | { type: 'release'; button: number }
  /** One step of the d-pad or left stick; repeats while held. */
  | { type: 'move'; dx: -1 | 0 | 1; dy: -1 | 0 | 1 }

export interface PadSnapshot {
  pressed: ReadonlyArray<boolean>
  axes: ReadonlyArray<number>
}

/** The stick must lean this far to count. */
const STICK_DEADZONE = 0.5
/** Hold a direction this long before it repeats… */
export const REPEAT_DELAY = 260
/** …then step this often. */
export const REPEAT_EVERY = 70

const DIRECTION_BUTTONS = new Set<number>([
  PAD.UP,
  PAD.DOWN,
  PAD.LEFT,
  PAD.RIGHT,
])

const sign = (v: number) =>
  v > STICK_DEADZONE ? 1 : v < -STICK_DEADZONE ? -1 : 0

/**
 * Turns gamepad snapshots (polled each frame) into presses, releases and
 * direction steps with key-style auto-repeat. The d-pad and left stick are
 * one direction; diagonals step both ways at once.
 */
export class PadReader {
  private pressed: Array<boolean> = []
  private dir: [number, number] = [0, 0]
  private nextRepeat = 0

  update(pad: PadSnapshot, now: number): Array<PadEvent> {
    const events: Array<PadEvent> = []
    pad.pressed.forEach((down, button) => {
      if (DIRECTION_BUTTONS.has(button)) return
      const was = this.pressed[button] ?? false
      if (down && !was) events.push({ type: 'press', button })
      if (!down && was) events.push({ type: 'release', button })
    })
    this.pressed = [...pad.pressed]

    const at = (b: number) => (pad.pressed[b] ? 1 : 0)
    const dx = Math.sign(
      at(PAD.RIGHT) - at(PAD.LEFT) || sign(pad.axes[0] ?? 0),
    ) as -1 | 0 | 1
    const dy = Math.sign(
      at(PAD.DOWN) - at(PAD.UP) || sign(pad.axes[1] ?? 0),
    ) as -1 | 0 | 1
    const changed = dx !== this.dir[0] || dy !== this.dir[1]
    this.dir = [dx, dy]
    if (dx === 0 && dy === 0) return events
    if (changed) {
      events.push({ type: 'move', dx, dy })
      this.nextRepeat = now + REPEAT_DELAY
    } else if (now >= this.nextRepeat) {
      events.push({ type: 'move', dx, dy })
      this.nextRepeat = now + REPEAT_EVERY
    }
    return events
  }

  /** Is a (non-direction) button held? */
  isDown(button: number) {
    return this.pressed[button] ?? false
  }
}

/** Listeners, newest last: only the newest gets events (an overlay wins). */
const listeners: Array<{ current: (e: PadEvent, reader: PadReader) => void }> =
  []
const reader = new PadReader()
let frame = 0

function poll() {
  frame = requestAnimationFrame(poll)
  if (!document.hasFocus()) return
  const pad = [...navigator.getGamepads()].find((g) => g?.connected)
  if (!pad) return
  const events = reader.update(
    { pressed: pad.buttons.map((b) => b.pressed), axes: pad.axes },
    performance.now(),
  )
  const top = listeners.at(-1)
  if (top) for (const e of events) top.current(e, reader)
}

/**
 * Gamepad events for this component while `enabled`. When several are
 * enabled, the most recently enabled one gets them, so an overlay (like Zen
 * mode) takes over from the page under it and hands back when it closes.
 */
export function useGamepad(
  onEvent: (e: PadEvent, reader: PadReader) => void,
  enabled = true,
) {
  const live = useRef(onEvent)
  live.current = onEvent
  useEffect(() => {
    if (!enabled || typeof navigator.getGamepads !== 'function') return
    listeners.push(live)
    if (listeners.length === 1) frame = requestAnimationFrame(poll)
    return () => {
      listeners.splice(listeners.indexOf(live), 1)
      if (listeners.length === 0) cancelAnimationFrame(frame)
    }
  }, [enabled])
}
