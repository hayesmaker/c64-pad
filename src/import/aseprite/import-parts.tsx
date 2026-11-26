import { COLOR_NAMES, PALETTES } from '@/c64/palette'
import { usePalette } from '@/components/c64/palette-context'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Segmented } from '@/editor/segmented'
import { Note, ReportSection } from '@/components/report'
import { ColorMenuGrid } from '@/components/c64/color-menu-grid'
import type { C64Color } from '@/c64/palette'
import type { Project } from '@/c64/project'
import type { PixelReport } from './validate'

/** Parts shared by the charset and sprite imports. */

/** How the file's colours match the C64 palettes, and switching to theirs. */
export function PaletteSection({
  colours,
  project,
  canSwitch,
  switchPalette,
  onSwitchPalette,
}: {
  colours: PaletteReport
  project: Project
  canSwitch: boolean
  switchPalette: boolean
  onSwitchPalette: (on: boolean) => void
}) {
  return (
    <ReportSection title="Palette">
      <p>{paletteText(colours, project.palette)}</p>
      {canSwitch && (
        <>
          <Segmented
            label="Project palette"
            value={switchPalette ? 'switch' : 'keep'}
            options={[
              {
                value: 'switch',
                label: `Switch project to ${PALETTES[colours.palette].name}`,
              },
              {
                value: 'keep',
                label: `Keep ${PALETTES[project.palette].name}`,
              },
            ]}
            onChange={(v) => onSwitchPalette(v === 'switch')}
          />
          <p className="text-xs text-muted-foreground">
            Both import the same colours; this only changes how the whole
            project looks.
          </p>
        </>
      )}
      {colours.guessed.length > 0 && (
        <Note>
          No C64 palette is close to {colours.guessed.join(', ')}; they were
          matched to the nearest {PALETTES[colours.palette].name} colours.
        </Note>
      )}
    </ReportSection>
  )
}

/** What PaletteSection needs of a colour report. */
type PaletteReport = Pick<
  PixelReport,
  'verdict' | 'palette' | 'worst' | 'guessed'
>

/** The file's palette can be switched to: it matches exactly or nearly. */
export function canSwitchTo(colours: PaletteReport, project: Project) {
  return (
    colours.palette !== project.palette &&
    (colours.verdict === 'other-exact' || colours.verdict === 'near')
  )
}

function paletteText(colours: PaletteReport, project: Project['palette']) {
  const name = (id: Project['palette']) => PALETTES[id].name
  switch (colours.verdict) {
    case 'project':
      return `The file uses the project's palette (${name(project)}).`
    case 'other-exact':
      return `The file uses the ${name(colours.palette)} palette; the project uses ${name(project)}.`
    case 'near':
      return `The file's colours are close to ${name(colours.palette)} (off by up to ${Math.round(colours.worst)}), and are read as ${name(colours.palette)} colours.`
    case 'far':
      return `The file's colours aren't close to any C64 palette; each is read as the nearest ${name(project)} colour.`
  }
}

/** A VIC colour register: swatch button opening a 16-colour grid. */
export function RegisterPicker({
  label,
  value,
  onChange,
}: {
  label: string
  value: C64Color
  onChange: (color: C64Color) => void
}) {
  const palette = usePalette()
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          className="flex h-10 items-center gap-2 rounded-lg border border-rule px-3"
          aria-label={`${label}: ${COLOR_NAMES[value]}`}
        >
          <span
            aria-hidden="true"
            className="size-5 rounded-[5px] border border-rule"
            style={{ background: palette.hex[value] }}
          />
          <span className="text-xs text-muted-foreground">{label}</span>
          {COLOR_NAMES[value]}
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent className="w-56">
        <ColorMenuGrid value={value} onPick={onChange} />
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
