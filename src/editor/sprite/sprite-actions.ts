import { createSprite } from '@/c64/sprite'
import {
  addOverlaySprite,
  addSprite,
  duplicateSprite,
  moveSprite,
  removeSprite,
  setOverlay,
} from '@/c64/sprite-set'
import { ModelError } from '@/c64/errors'
import type { Sprite } from '@/c64/sprite'
import type { SpriteSet } from '@/c64/sprite-set'
import type { StripActions } from './sprite-strip'
import type { SpriteSetHistory } from './use-sprite-tools'

/** Pixels copied with "Copy pixels", kept for the app session. */
let clipboard: Pick<Sprite, 'data' | 'mode'> | null = null

/** What the sprite strip's buttons do to the set and the selection. */
export function spriteStripActions({
  set,
  selected,
  pairBase,
  history,
  select,
  changeSprite,
}: {
  set: SpriteSet
  selected: Sprite
  /** The back sprite of the selected overlay pair, if any. */
  pairBase: Sprite | null
  history: SpriteSetHistory
  select: (id: string) => void
  changeSprite: (fn: (s: Sprite) => Sprite) => void
}): StripActions {
  return {
    select,
    add: () => {
      const created = createSprite({
        name: `Sprite ${set.sprites.length}`,
        mode: selected.mode,
      })
      history.change((s) => addSprite(s, created))
      select(created.id)
    },
    duplicate: () => {
      history.change((s) => duplicateSprite(s, selected.id))
    },
    copy: () => {
      clipboard = { data: selected.data.slice(), mode: selected.mode }
    },
    paste: clipboard
      ? () => {
          const c = clipboard!
          changeSprite((s) => ({
            ...s,
            data: c.data.slice(),
            mode: c.mode,
          }))
        }
      : null,
    move: (delta) => {
      const from = set.sprites.indexOf(selected)
      history.change((s) => moveSprite(s, from, from + delta))
    },
    remove:
      set.sprites.length > 1
        ? () => {
            const i = set.sprites.indexOf(selected)
            const next = set.sprites[i + 1] ?? set.sprites[i - 1]
            history.change((s) => removeSprite(s, selected.id))
            select(next.id)
          }
        : null,
    setOverlay: (overlayId) => {
      try {
        history.change((s) => setOverlay(s, selected.id, overlayId))
        if (overlayId) select(overlayId)
      } catch (e) {
        if (!(e instanceof ModelError)) throw e
      }
    },
    addOverlay: () => {
      let created = ''
      history.change((s) => {
        const r = addOverlaySprite(s, selected.id)
        created = r.overlayId
        return r.set
      })
      if (created) select(created)
    },
    unlinkOverlay: pairBase
      ? () => history.change((s) => setOverlay(s, pairBase.id, null))
      : null,
  }
}
