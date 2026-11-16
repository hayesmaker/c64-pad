import {
  BoxSelect,
  Ellipsis,
  Eraser,
  Grid3x3,
  Hand,
  PaintBucket,
  Palette,
  Pencil,
  Pin,
  Pipette,
  Tags,
} from 'lucide-react'
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { useCompact } from '@/lib/compact'
import { ToolButton, zoomLabel } from '../grid-parts'
import { CharIcon } from './map-brush'
import { hex } from '../hex'
import { COL_HEADER_H } from './map-rulers'
import type { Charmap } from '@/c64/charmap'
import type { Charset } from '@/c64/charset'
import type { MapTool } from './use-map-strokes'

const TOOLS = [
  ['paint', 'Paint with the brush (double-tap to undo a stamp)', Pencil],
  ['erase', 'Erase (writes the Blank Char)', Eraser],
  ['fill', 'Fill with the brush char', PaintBucket],
  ['colour', 'Colour cells (bitmap): set a cell’s own colours', Palette],
  ['pick', 'Pick a char from the map', Pipette],
  ['select', 'Select an area', BoxSelect],
  ['pan', 'Hand: drag to move around the map', Hand],
  [
    'pin',
    'Pin for char tracing: tap a cell to trace the brush char(s) from there',
    Pin,
  ],
] as const

/** Small screens: these fold into the rail's "More" menu so the rail fits. */
const FOLDED: ReadonlyArray<MapTool> = ['pan', 'pin']

/** The Screen Worksheet's vertical tool bar. */
export function MapToolRail({
  tool,
  onTool,
  map,
  charset,
  onBlank,
  showGrid,
  onToggleGrid,
  showAttributes,
  onToggleAttributes,
  zoom,
  onZoom,
}: {
  tool: MapTool
  onTool: (tool: MapTool) => void
  map: Charmap
  charset: Charset
  /** Open the Blank Char dialog. */
  onBlank: () => void
  showGrid: boolean
  onToggleGrid: () => void
  showAttributes: boolean
  onToggleAttributes: () => void
  zoom: number
  /** Zoom in, or reset when zoomed. */
  onZoom: () => void
}) {
  const compact = useCompact()
  const tools = TOOLS.filter(
    ([value]) => value !== 'colour' || charset.mode === 'bitmap',
  )
  const blankLabel = `Blank char: ${hex(map.blank)} (fills new cells; Erase writes it)`
  if (compact) {
    const folded = tools.filter(([value]) => FOLDED.includes(value))
    return (
      <div
        role="toolbar"
        aria-label="Map tools"
        aria-orientation="vertical"
        className="flex shrink-0 flex-col gap-1"
        style={{ paddingTop: COL_HEADER_H + 2 }}
      >
        {tools
          .filter(([value]) => !FOLDED.includes(value))
          .map(([value, label, Icon]) => (
            <ToolButton
              key={value}
              label={label}
              pressed={tool === value}
              onClick={() => onTool(value)}
            >
              <Icon />
            </ToolButton>
          ))}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <ToolButton label="More tools" pressed={FOLDED.includes(tool)}>
              <Ellipsis />
            </ToolButton>
          </DropdownMenuTrigger>
          <DropdownMenuContent side="right" align="end" className="w-64">
            <DropdownMenuRadioGroup
              value={tool}
              onValueChange={(v) => onTool(v as MapTool)}
            >
              {folded.map(([value, label, Icon]) => (
                <DropdownMenuRadioItem key={value} value={value}>
                  <Icon aria-hidden="true" /> {label}
                </DropdownMenuRadioItem>
              ))}
            </DropdownMenuRadioGroup>
            <DropdownMenuSeparator />
            <DropdownMenuItem onSelect={onBlank}>
              <CharIcon charset={charset} code={map.blank} /> {blankLabel}
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuCheckboxItem
              checked={showGrid}
              onCheckedChange={onToggleGrid}
            >
              Grid lines
            </DropdownMenuCheckboxItem>
            <DropdownMenuCheckboxItem
              checked={showAttributes}
              onCheckedChange={onToggleAttributes}
            >
              Char attributes (shown over the map)
            </DropdownMenuCheckboxItem>
          </DropdownMenuContent>
        </DropdownMenu>
        <ToolButton
          label={
            zoom !== 1 ? 'Reset zoom (pinch to zoom)' : 'Zoom in (or pinch)'
          }
          pressed={zoom !== 1}
          onClick={onZoom}
        >
          <span className="font-mono text-[11px] font-medium">
            {zoomLabel(zoom)}
          </span>
        </ToolButton>
      </div>
    )
  }
  return (
    <div
      role="toolbar"
      aria-label="Map tools"
      aria-orientation="vertical"
      className="flex shrink-0 flex-col gap-1"
      style={{ paddingTop: COL_HEADER_H + 2 }}
    >
      {tools.map(([value, label, Icon]) => (
        <ToolButton
          key={value}
          label={label}
          pressed={tool === value}
          onClick={() => onTool(value)}
        >
          <Icon />
        </ToolButton>
      ))}
      <ToolButton label={blankLabel} onClick={onBlank}>
        <CharIcon charset={charset} code={map.blank} />
      </ToolButton>
      <div aria-hidden="true" className="mx-1.5 my-1 h-px bg-rule-soft" />
      <ToolButton label="Grid lines" pressed={showGrid} onClick={onToggleGrid}>
        <Grid3x3 />
      </ToolButton>
      <ToolButton
        label="Char attributes (shown over the map)"
        pressed={showAttributes}
        onClick={onToggleAttributes}
      >
        <Tags />
      </ToolButton>
      <ToolButton
        label={zoom !== 1 ? 'Reset zoom (pinch to zoom)' : 'Zoom in (or pinch)'}
        pressed={zoom !== 1}
        onClick={onZoom}
      >
        <span className="font-mono text-[11px] font-medium">
          {zoomLabel(zoom)}
        </span>
      </ToolButton>
    </div>
  )
}
