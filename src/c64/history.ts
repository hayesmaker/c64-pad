/**
 * Undo/redo for any immutable document.
 *
 * Changes recorded with the same `group` while that group is open replace the
 * present state instead of adding an undo step, so a whole pen stroke undoes
 * in one go. Start each stroke with a fresh group key and call `closeGroup`
 * when it ends.
 */
export interface History<T> {
  readonly past: ReadonlyArray<T>
  readonly present: T
  readonly future: ReadonlyArray<T>
  /** Group currently being coalesced, if any. */
  readonly group: string | null
}

export const DEFAULT_HISTORY_LIMIT = 100

export function createHistory<T>(present: T): History<T> {
  return { past: [], present, future: [], group: null }
}

export function record<T>(
  history: History<T>,
  next: T,
  {
    group,
    limit = DEFAULT_HISTORY_LIMIT,
  }: { group?: string; limit?: number } = {},
): History<T> {
  if (next === history.present) return history
  if (group !== undefined && history.group === group) {
    return { ...history, present: next, future: [] }
  }
  return {
    past: [...history.past, history.present].slice(-limit),
    present: next,
    future: [],
    group: group ?? null,
  }
}

/** End the current group so the next change starts a new undo step. */
export function closeGroup<T>(history: History<T>): History<T> {
  return history.group === null ? history : { ...history, group: null }
}

export function canUndo<T>(history: History<T>): boolean {
  return history.past.length > 0
}

export function canRedo<T>(history: History<T>): boolean {
  return history.future.length > 0
}

export function undo<T>(history: History<T>): History<T> {
  if (!canUndo(history)) return history
  return {
    past: history.past.slice(0, -1),
    present: history.past[history.past.length - 1],
    future: [history.present, ...history.future],
    group: null,
  }
}

export function redo<T>(history: History<T>): History<T> {
  if (!canRedo(history)) return history
  return {
    past: [...history.past, history.present],
    present: history.future[0],
    future: history.future.slice(1),
    group: null,
  }
}

/**
 * Drop the open group's change as if it never happened (a cancelled stroke):
 * it leaves no undo or redo step. Without an open group nothing changes.
 */
export function discardGroup<T>(history: History<T>): History<T> {
  if (history.group === null || !canUndo(history)) return history
  return {
    past: history.past.slice(0, -1),
    present: history.past[history.past.length - 1],
    future: [],
    group: null,
  }
}
