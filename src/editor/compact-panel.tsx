import type { C64Color } from '@/c64/palette'

/** Height of the compact pens row under the char grid (ZenPens layout="row"). */
export const COMPACT_PENS_H = 120

/** All 16 colours, for the compact pens column. */
export const ALL_COLORS: ReadonlyArray<C64Color> = Array.from(
  { length: 16 },
  (_, i) => i,
)

/**
 * Classes that turn an editor's left panel into a drawer over the grid on
 * small screens (its parent must be `relative`).
 */
export const COMPACT_DRAWER =
  'absolute inset-y-0 left-0 z-30 m-0 w-[280px] border-r border-rule bg-paper p-3 shadow-[6px_0_24px_var(--shadow)]'

/** Tapping beside an open drawer closes it. */
export function CompactDrawerBackdrop({ onClose }: { onClose: () => void }) {
  return (
    <button
      type="button"
      aria-label="Close panel"
      onClick={onClose}
      className="absolute inset-0 z-20 cursor-default bg-black/30"
    />
  )
}
