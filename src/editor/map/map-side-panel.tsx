import { useState } from 'react'
import { Expand, Plus, X } from 'lucide-react'
import { MAX_MAP_SIZE, resizeCharmap } from '@/c64/charmap'
import { switchMapCharset } from '@/c64/charset-match'
import { Note } from '@/components/report'
import { Field } from '@/components/worksheet/field'
import { Button } from '@/components/ui/button'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { hex } from '../hex'
import { describeScreens } from './map-size'
import type { CharsetSwitch } from '@/c64/charset-match'
import type { Charmap } from '@/c64/charmap'
import type { Project } from '@/c64/project'
import type { CellRect } from './map-canvas'

/**
 * Map size, its charset and quick "add a screen" buttons. Switching the
 * charset renumbers the map's cells to the chars that look the same in the
 * new one, and says how that went.
 */
export function MapSettings({
  project,
  map,
  onChange,
  onResize,
}: {
  project: Project
  map: Charmap
  /** Change the map (an undoable step). */
  onChange: (fn: (m: Charmap) => Charmap) => void
  /** Open the resize dialog. */
  onResize: () => void
}) {
  const [switched, setSwitched] = useState<{
    charsetId: string
    result: CharsetSwitch
  } | null>(null)
  const switchTo = (id: string) => {
    const from = project.charsets.find((c) => c.id === map.charsetId)
    const to = project.charsets.find((c) => c.id === id)
    if (!from || !to) {
      onChange((m) => ({ ...m, charsetId: id }))
      return
    }
    const result = switchMapCharset(map, from, to)
    onChange(() => result.map)
    setSwitched({ charsetId: id, result })
  }
  // Only while the map is still on that charset (an undo forgets it).
  const report = switched?.charsetId === map.charsetId ? switched.result : null

  return (
    <>
      <div className="flex gap-2">
        <Field label="Map size" className="w-[104px]">
          <Button
            variant="outline"
            className="justify-between px-2.5 font-mono"
            onClick={onResize}
            aria-label={`Resize map, now ${map.width} by ${map.height} chars`}
          >
            {map.width}×{map.height}
            <Expand aria-hidden="true" className="text-muted-foreground" />
          </Button>
        </Field>
        <Field label="Charset" className="min-w-0 flex-1">
          <Select value={map.charsetId} onValueChange={switchTo}>
            <SelectTrigger className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {project.charsets.map((c) => (
                <SelectItem key={c.id} value={c.id}>
                  {c.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field>
      </div>
      {report && <SwitchNote result={report} />}
      <div className="flex flex-col gap-1">
        <span className="text-xs text-muted-foreground">
          {describeScreens(map.width, map.height)} · add a screen
        </span>
        <div className="grid grid-cols-2 gap-1.5">
          <Button
            variant="outline"
            disabled={map.width + 40 > MAX_MAP_SIZE}
            onClick={() =>
              onChange((m) => resizeCharmap(m, m.width + 40, m.height))
            }
            title="Add a screen to the right (+40 columns)"
          >
            <Plus aria-hidden="true" /> Right →
          </Button>
          <Button
            variant="outline"
            disabled={map.height + 25 > MAX_MAP_SIZE}
            onClick={() =>
              onChange((m) => resizeCharmap(m, m.width, m.height + 25))
            }
            title="Add a screen below (+25 rows)"
          >
            <Plus aria-hidden="true" /> Below ↓
          </Button>
        </div>
      </div>
    </>
  )
}

/**
 * What to do with a finished selection: a bar floating over the map's
 * bottom-left corner, so it's in view however long the side panel is.
 */
export function SelectionActions({
  selection,
  onUseAsBrush,
  onClear,
  onDeselect,
}: {
  selection: CellRect
  onUseAsBrush: () => void
  onClear: () => void
  onDeselect: () => void
}) {
  return (
    <div
      role="toolbar"
      aria-label="Selection"
      className="absolute bottom-2 left-2 flex animate-in items-center gap-1.5 rounded-lg border border-rule bg-paper/95 p-1 pl-2.5 shadow-[0_4px_16px_var(--shadow)] duration-150 fade-in slide-in-from-bottom-1"
    >
      <span className="font-mono text-[11px] whitespace-nowrap text-muted-foreground">
        {selection.width}×{selection.height} at {selection.x},{selection.y}
      </span>
      <Button size="sm" className="whitespace-nowrap" onClick={onUseAsBrush}>
        Use as brush
      </Button>
      <Button
        size="sm"
        variant="outline"
        className="whitespace-nowrap"
        onClick={onClear}
      >
        Clear area
      </Button>
      <Button
        size="icon"
        variant="ghost"
        className="size-8"
        aria-label="Deselect"
        onClick={onDeselect}
      >
        <X aria-hidden="true" />
      </Button>
    </div>
  )
}

/** How switching charsets went: what was renumbered, what didn't match. */
function SwitchNote({ result }: { result: CharsetSwitch }) {
  const { renumbered, unmatched, ecm } = result
  const list = (codes: ReadonlyArray<number>) =>
    codes
      .slice(0, 6)
      .map((c) => hex(c))
      .join(', ') + (codes.length > 6 ? '…' : '')
  if (ecm) {
    return (
      <p className="text-xs text-muted-foreground">
        ECM charsets aren't matched: the map's screen codes are kept.
      </p>
    )
  }
  return (
    <>
      <p className="text-xs text-muted-foreground">
        {renumbered.length === 0
          ? 'Every char already matched; no screen codes changed.'
          : `${renumbered.length} char${renumbered.length === 1 ? '' : 's'} renumbered to the matching char${renumbered.length === 1 ? '' : 's'} (${renumbered
              .slice(0, 4)
              .map((r) => `${hex(r.from)}→${hex(r.to)}`)
              .join(', ')}${renumbered.length > 4 ? '…' : ''}).`}
      </p>
      {unmatched.length > 0 && (
        <Note>
          No matching char for {list(unmatched)}: kept as they were, so they may
          look different.
        </Note>
      )}
    </>
  )
}
