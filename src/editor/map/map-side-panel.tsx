import { Expand, Plus } from 'lucide-react'
import { MAX_MAP_SIZE, resizeCharmap } from '@/c64/charmap'
import { Field } from '@/components/worksheet/field'
import { Button } from '@/components/ui/button'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { describeScreens } from './map-size'
import type { Charmap } from '@/c64/charmap'
import type { Project } from '@/c64/project'
import type { CellRect } from './map-canvas'

/** Map size, its charset and quick "add a screen" buttons. */
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
          <Select
            value={map.charsetId}
            onValueChange={(id) => onChange((m) => ({ ...m, charsetId: id }))}
          >
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

/** What to do with a finished selection. */
export function SelectionActions({
  selection,
  onUseAsBrush,
  onClear,
}: {
  selection: CellRect
  onUseAsBrush: () => void
  onClear: () => void
}) {
  return (
    <div className="flex flex-col gap-1">
      <span className="text-xs text-muted-foreground">
        Selection · {selection.width}×{selection.height} at x {selection.x}, y{' '}
        {selection.y}
      </span>
      <div className="grid grid-cols-2 gap-1.5">
        <Button
          variant="outline"
          className="border-primary bg-accent text-primary hover:bg-accent"
          onClick={onUseAsBrush}
        >
          Use as brush
        </Button>
        <Button variant="outline" onClick={onClear}>
          Clear area
        </Button>
      </div>
    </div>
  )
}
