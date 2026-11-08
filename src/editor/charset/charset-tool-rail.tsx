import {
  ArrowDown,
  ArrowLeft,
  ArrowRight,
  ArrowUp,
  Contrast,
  Eraser,
  Move,
  PaintBucket,
  Pencil,
  RotateCw,
  Trash2,
  TrianglesCenterlineDashedHorizontal,
  TrianglesCenterlineDashedVertical,
} from 'lucide-react'
import {
  clearChar,
  flipCharHorizontal,
  flipCharVertical,
  invertChar,
  rotateCharClockwise,
  shiftChar,
} from '@/c64/charset'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { BIT_HEADER_H, ToolButton, zoomLabel } from '../grid-parts'
import type { Charset } from '@/c64/charset'
import type { CharTool } from './use-char-tools'

const SHIFTS = [
  ['Shift up', 0, -1, ArrowUp],
  ['Shift down', 0, 1, ArrowDown],
  ['Shift left', -1, 0, ArrowLeft],
  ['Shift right', 1, 0, ArrowRight],
] as const

/** Drawing tools, char transforms and zoom, beside the grid. */
export function CharsetToolRail({
  tool,
  onTool,
  multicolor,
  onTransform,
  zoom,
  onZoom,
}: {
  tool: CharTool
  onTool: (tool: CharTool) => void
  /** The char is multicolour (it can't be rotated). */
  multicolor: boolean
  /** Apply a transform to the selected char (an undoable step). */
  onTransform: (fn: (cs: Charset, index: number) => Charset) => void
  zoom: number
  /** Zoom in, or reset when zoomed. */
  onZoom: () => void
}) {
  return (
    <div
      role="toolbar"
      aria-label="Drawing tools"
      aria-orientation="vertical"
      className="flex shrink-0 flex-col gap-1"
      style={{ paddingTop: BIT_HEADER_H + 2 }}
    >
      <ToolButton
        label="Draw (double-tap a pixel to clear it)"
        pressed={tool === 'draw'}
        onClick={() => onTool('draw')}
      >
        <Pencil />
      </ToolButton>
      <ToolButton
        label="Erase"
        pressed={tool === 'erase'}
        onClick={() => onTool('erase')}
      >
        <Eraser />
      </ToolButton>
      <ToolButton
        label="Fill"
        pressed={tool === 'fill'}
        onClick={() => onTool('fill')}
      >
        <PaintBucket />
      </ToolButton>
      <div aria-hidden="true" className="mx-1.5 my-1 h-px bg-rule-soft" />
      <ToolButton
        label="Flip horizontally"
        onClick={() => onTransform(flipCharHorizontal)}
      >
        <TrianglesCenterlineDashedVertical />
      </ToolButton>
      <ToolButton
        label="Flip vertically"
        onClick={() => onTransform(flipCharVertical)}
      >
        <TrianglesCenterlineDashedHorizontal />
      </ToolButton>
      <ToolButton
        label={multicolor ? 'Rotate (hires chars only)' : 'Rotate clockwise'}
        disabled={multicolor}
        onClick={() => onTransform(rotateCharClockwise)}
      >
        <RotateCw />
      </ToolButton>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <ToolButton label="Shift (wraps around)">
            <Move />
          </ToolButton>
        </DropdownMenuTrigger>
        <DropdownMenuContent side="right" align="start">
          {SHIFTS.map(([label, dx, dy, Icon]) => (
            <DropdownMenuItem
              key={label}
              onSelect={() => onTransform((cs, i) => shiftChar(cs, i, dx, dy))}
            >
              <Icon aria-hidden="true" /> {label}
            </DropdownMenuItem>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>
      <ToolButton label="Invert" onClick={() => onTransform(invertChar)}>
        <Contrast />
      </ToolButton>
      <ToolButton
        label="Clear character"
        onClick={() => onTransform(clearChar)}
      >
        <Trash2 />
      </ToolButton>
      <div aria-hidden="true" className="mx-1.5 my-1 h-px bg-rule-soft" />
      <ToolButton
        label={zoom > 1 ? 'Reset zoom (pinch to zoom)' : 'Zoom in (or pinch)'}
        pressed={zoom > 1}
        onClick={onZoom}
      >
        <span className="font-mono text-[11px] font-medium">
          {zoomLabel(zoom)}
        </span>
      </ToolButton>
    </div>
  )
}
