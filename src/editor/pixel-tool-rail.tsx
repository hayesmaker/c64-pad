import {
  ArrowDown,
  ArrowLeft,
  ArrowRight,
  ArrowUp,
  Contrast,
  Ellipsis,
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
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { useCompact } from '@/lib/compact'
import { BIT_HEADER_H, ToolButton, zoomLabel } from './grid-parts'

export type PixelTool = 'draw' | 'erase' | 'fill'

const SHIFTS = [
  ['Shift up', 0, -1, ArrowUp],
  ['Shift down', 0, 1, ArrowDown],
  ['Shift left', -1, 0, ArrowLeft],
  ['Shift right', 1, 0, ArrowRight],
] as const

/**
 * The tool bar beside a pixel grid (sprite or char): draw / erase / fill, the
 * whole-image transforms, and zoom. On small screens the transforms fold into
 * one menu so the rail fits the height.
 */
export function PixelToolRail({
  tool,
  onTool,
  drawLabel = 'Draw',
  onFlipHorizontal,
  onFlipVertical,
  rotate,
  onShift,
  onInvert,
  clearLabel,
  onClear,
  zoom,
  onZoom,
}: {
  tool: PixelTool
  onTool: (tool: PixelTool) => void
  drawLabel?: string
  onFlipHorizontal: () => void
  onFlipVertical: () => void
  /** Rotate clockwise, if this grid can (chars can, sprites can't). */
  rotate?: { label: string; disabled: boolean; onRotate: () => void }
  /** Shift by one pixel, wrapping around. */
  onShift: (dx: number, dy: number) => void
  onInvert: () => void
  clearLabel: string
  onClear: () => void
  zoom: number
  /** Zoom in, or reset when zoomed. */
  onZoom: () => void
}) {
  const compact = useCompact()
  return (
    <div
      role="toolbar"
      aria-label="Drawing tools"
      aria-orientation="vertical"
      className="flex shrink-0 flex-col gap-1"
      style={{ paddingTop: BIT_HEADER_H + 2 }}
    >
      <ToolButton
        label={drawLabel}
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
      {compact ? (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <ToolButton label="More tools">
              <Ellipsis />
            </ToolButton>
          </DropdownMenuTrigger>
          <DropdownMenuContent side="right" align="start">
            <DropdownMenuItem onSelect={onFlipHorizontal}>
              <TrianglesCenterlineDashedVertical aria-hidden="true" /> Flip
              horizontally
            </DropdownMenuItem>
            <DropdownMenuItem onSelect={onFlipVertical}>
              <TrianglesCenterlineDashedHorizontal aria-hidden="true" /> Flip
              vertically
            </DropdownMenuItem>
            {rotate && (
              <DropdownMenuItem
                disabled={rotate.disabled}
                onSelect={rotate.onRotate}
              >
                <RotateCw aria-hidden="true" /> {rotate.label}
              </DropdownMenuItem>
            )}
            <DropdownMenuSeparator />
            {SHIFTS.map(([label, dx, dy, Icon]) => (
              <DropdownMenuItem key={label} onSelect={() => onShift(dx, dy)}>
                <Icon aria-hidden="true" /> {label} (wraps)
              </DropdownMenuItem>
            ))}
            <DropdownMenuSeparator />
            <DropdownMenuItem onSelect={onInvert}>
              <Contrast aria-hidden="true" /> Invert
            </DropdownMenuItem>
            <DropdownMenuItem onSelect={onClear}>
              <Trash2 aria-hidden="true" /> {clearLabel}
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      ) : (
        <>
          <ToolButton label="Flip horizontally" onClick={onFlipHorizontal}>
            <TrianglesCenterlineDashedVertical />
          </ToolButton>
          <ToolButton label="Flip vertically" onClick={onFlipVertical}>
            <TrianglesCenterlineDashedHorizontal />
          </ToolButton>
          {rotate && (
            <ToolButton
              label={rotate.label}
              disabled={rotate.disabled}
              onClick={rotate.onRotate}
            >
              <RotateCw />
            </ToolButton>
          )}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <ToolButton label="Shift (wraps around)">
                <Move />
              </ToolButton>
            </DropdownMenuTrigger>
            <DropdownMenuContent side="right" align="start">
              {SHIFTS.map(([label, dx, dy, Icon]) => (
                <DropdownMenuItem key={label} onSelect={() => onShift(dx, dy)}>
                  <Icon aria-hidden="true" /> {label}
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
          <ToolButton label="Invert" onClick={onInvert}>
            <Contrast />
          </ToolButton>
          <ToolButton label={clearLabel} onClick={onClear}>
            <Trash2 />
          </ToolButton>
        </>
      )}
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
