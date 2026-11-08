import { setProjectPalette } from '@/c64/project'
import { PaletteSelect } from '@/components/c64/palette-select'
import { Field, worksheetInputClass } from '@/components/worksheet/field'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import type { Project } from '@/c64/project'

/** The worksheet fields: name, program, date, palette and notes. */
export function ProjectFields({
  project,
  update,
}: {
  project: Project
  update: (fn: (p: Project) => Project) => void
}) {
  return (
    <div className="flex w-[260px] shrink-0 flex-col gap-3">
      <Field label="Project name">
        <Input
          value={project.name}
          onChange={(e) => update((p) => ({ ...p, name: e.target.value }))}
        />
      </Field>
      <Field label="Program">
        <Input
          value={project.program}
          placeholder="e.g. the game these graphics are for"
          onChange={(e) => update((p) => ({ ...p, program: e.target.value }))}
        />
      </Field>
      <Field label="Date designed">
        <input
          type="date"
          className={worksheetInputClass}
          value={project.dateDesigned}
          onChange={(e) =>
            update((p) => ({ ...p, dateDesigned: e.target.value }))
          }
        />
      </Field>
      <div className="flex flex-col gap-[3px] text-xs text-muted-foreground">
        <label htmlFor="project-palette">Colour palette</label>
        <PaletteSelect
          id="project-palette"
          value={project.palette}
          onChange={(id) => update((p) => setProjectPalette(p, id))}
        />
        <span className="leading-snug">
          How colours look in C64-Pad. Data and exports are unchanged.
        </span>
      </div>
      <Field label="Notes">
        <Textarea
          rows={6}
          className="resize-none bg-paper text-base"
          value={project.notes}
          onChange={(e) => update((p) => ({ ...p, notes: e.target.value }))}
        />
      </Field>
    </div>
  )
}
