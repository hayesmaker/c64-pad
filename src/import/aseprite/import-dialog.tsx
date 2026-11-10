import { useMemo, useState } from 'react'
import { addAsset, setProjectPalette } from '@/c64/project'
import { COLOR_NAMES, PALETTES } from '@/c64/palette'
import { renderCharsetSheet } from '@/c64/render'
import { IndexedCanvas } from '@/components/c64/indexed-canvas'
import { PaletteScope, usePalette } from '@/components/c64/palette-context'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Segmented } from '@/editor/segmented'
import { CheckLine, Note, ReportSection } from '@/components/report'
import { ColorMenuGrid } from '@/components/c64/color-menu-grid'
import { tileAttributes } from './attributes'
import { baseName, buildCharset, buildMap, uniqueName } from './convert'
import { analyseColours, checkStructure, fitCharset, mapSize } from './validate'
import type { C64Color } from '@/c64/palette'
import type { Project } from '@/c64/project'
import type { AsepriteDoc } from './parse'
import type { FitChoice } from './validate'

/** A picked file: parsed, or why it couldn't be read. */
export type AsepriteFile =
  | { fileName: string; doc: AsepriteDoc; error?: undefined }
  | { fileName: string; doc?: undefined; error: string }

const MAX_LISTED = 6

/**
 * Import an Aseprite tileset + tilemap as a new charset and screen map: checks
 * the file, matches its palette, fits the colours to the C64, previews the
 * charset and adds it. Nothing in the project is replaced.
 */
export function ImportAsepriteDialog({
  file,
  project,
  onImport,
  onOpenChange,
}: {
  file: AsepriteFile
  project: Project
  onImport: (change: (p: Project) => Project) => void
  onOpenChange: (open: boolean) => void
}) {
  return (
    <Dialog open onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[92dvh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Import Aseprite file</DialogTitle>
          <DialogDescription>
            {file.fileName}
            {file.doc &&
              ` · ${file.doc.width}×${file.doc.height} px · ${depthLabel(file.doc)}`}
          </DialogDescription>
        </DialogHeader>
        {file.doc ? (
          <ImportBody
            fileName={file.fileName}
            doc={file.doc}
            project={project}
            onImport={(change) => {
              onImport(change)
              onOpenChange(false)
            }}
            onCancel={() => onOpenChange(false)}
          />
        ) : (
          <>
            <CheckLine ok={false}>{file.error}</CheckLine>
            <DialogFooter>
              <Button variant="outline" onClick={() => onOpenChange(false)}>
                Close
              </Button>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  )
}

function depthLabel(doc: AsepriteDoc) {
  return doc.depth === 8
    ? '8-bit indexed'
    : doc.depth === 16
      ? 'greyscale'
      : 'RGBA'
}

function ImportBody({
  fileName,
  doc,
  project,
  onImport,
  onCancel,
}: {
  fileName: string
  doc: AsepriteDoc
  project: Project
  onImport: (change: (p: Project) => Project) => void
  onCancel: () => void
}) {
  const [layerIndex, setLayerIndex] = useState<number | undefined>()
  const [choice, setChoice] = useState<FitChoice>({})
  const [switchPalette, setSwitchPalette] = useState(false)
  const [addMap, setAddMap] = useState(true)

  const structure = useMemo(
    () => checkStructure(doc, layerIndex),
    [doc, layerIndex],
  )
  const source = structure.ok ? structure.source : null
  const colours = useMemo(
    () => source && analyseColours(doc, source.tileset, project.palette),
    [doc, source, project.palette],
  )
  const fit = useMemo(
    () => colours && fitCharset(colours, choice),
    [colours, choice],
  )
  const base = baseName(fileName)
  const charsetName = uniqueName(base, project.charsets)
  const mapName = uniqueName(base, project.maps)
  const sheet = useMemo(
    () =>
      colours &&
      fit &&
      renderCharsetSheet(
        buildCharset('', colours, fit),
        16,
        colours.tiles.length,
      ),
    [colours, fit],
  )

  const canSwitch =
    !!colours &&
    colours.palette !== project.palette &&
    (colours.verdict === 'other-exact' || colours.verdict === 'near')
  const shownPalette =
    canSwitch && switchPalette ? colours.palette : project.palette
  const size = mapSize(doc)

  const runImport = () => {
    if (!source || !colours || !fit) return
    onImport((p) => {
      let next =
        canSwitch && switchPalette ? setProjectPalette(p, colours.palette) : p
      const charset = buildCharset(
        uniqueName(base, next.charsets),
        colours,
        fit,
        source.tileset.tileUserData,
      )
      next = addAsset(next, 'charsets', charset)
      if (addMap) {
        next = addAsset(
          next,
          'maps',
          buildMap(uniqueName(base, next.maps), doc, source, charset.id),
        )
      }
      return next
    })
  }

  return (
    <div className="flex flex-col gap-5 text-sm">
      <ReportSection title="File">
        <ul className="flex flex-col gap-1">
          {structure.checks.map((c) => (
            <li key={c.text}>
              <CheckLine ok={c.ok}>{c.text}</CheckLine>
            </li>
          ))}
        </ul>
        {structure.sources.length > 1 && (
          <Select
            value={String(structure.source?.layer.index)}
            onValueChange={(v) => {
              setLayerIndex(Number(v))
              setChoice({})
            }}
          >
            <SelectTrigger className="w-full" aria-label="Tilemap layer">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {structure.sources.map((s) => (
                <SelectItem key={s.layer.index} value={String(s.layer.index)}>
                  Layer “{s.layer.name}” · {s.tilemap.width}×{s.tilemap.height}{' '}
                  tiles
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
        {source && <TagNote tileUserData={source.tileset.tileUserData} />}
        {structure.warnings.length > 0 && (
          <ul className="flex flex-col gap-1">
            {structure.warnings.map((w) => (
              <li key={w}>
                <Note>{w}</Note>
              </li>
            ))}
          </ul>
        )}
      </ReportSection>

      {colours && fit && sheet && (
        <>
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
                  onChange={(v) => setSwitchPalette(v === 'switch')}
                />
                <p className="text-xs text-muted-foreground">
                  Both import the same chars and colours; this only changes how
                  the whole project looks.
                </p>
              </>
            )}
            {colours.guessed.length > 0 && (
              <Note>
                No C64 palette is close to {colours.guessed.join(', ')}; they
                were matched to the nearest {PALETTES[colours.palette].name}{' '}
                colours.
              </Note>
            )}
          </ReportSection>

          <ReportSection title="C64 colours">
            <p>
              {fit.mode === 'multicolor'
                ? 'Multicolour charset (hires and multicolour chars mixed).'
                : 'Hires charset.'}
              {colours.transparent &&
                ' Transparent pixels use the background colour'}
              {colours.transparent &&
                (fit.backgroundFrom === 'file'
                  ? ` (${COLOR_NAMES[fit.background]}, the file's transparent colour).`
                  : fit.backgroundFrom === 'fit'
                    ? "; the file doesn't say which, so this is a best guess."
                    : '.')}
            </p>
            <PaletteScope id={shownPalette}>
              <div className="flex flex-wrap items-center gap-2">
                <RegisterPicker
                  label="Background"
                  value={fit.background}
                  onChange={(c) =>
                    setChoice((ch) => ({ ...ch, background: c }))
                  }
                />
                {fit.mode === 'multicolor' && (
                  <>
                    <RegisterPicker
                      label="MC1"
                      value={fit.multicolor1}
                      onChange={(c) =>
                        setChoice((ch) => ({ ...ch, multicolor1: c }))
                      }
                    />
                    <RegisterPicker
                      label="MC2"
                      value={fit.multicolor2}
                      onChange={(c) =>
                        setChoice((ch) => ({ ...ch, multicolor2: c }))
                      }
                    />
                  </>
                )}
                {Object.keys(choice).length > 0 && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setChoice({})}
                  >
                    Reset colours
                  </Button>
                )}
              </div>
              {fit.backgroundDrawn.length > 0 && (
                <Note>
                  {COLOR_NAMES[fit.background]} is also drawn in{' '}
                  {fit.backgroundDrawn.length === 1 ? 'tile' : 'tiles'}{' '}
                  {listTiles(fit.backgroundDrawn)}. Those pixels become
                  background, so they'll change colour if you change the
                  background later.
                </Note>
              )}
              {fit.failures.length === 0 ? (
                <CheckLine ok>
                  All {fit.tiles.length - 1} tiles fit exactly
                </CheckLine>
              ) : (
                <div className="flex flex-col gap-1">
                  <CheckLine ok={false}>
                    {fit.failures.length} of {fit.tiles.length - 1} tiles don't
                    fit exactly; they're imported as close as possible:
                  </CheckLine>
                  <ul className="ml-7 list-disc text-xs text-muted-foreground">
                    {fit.failures.slice(0, MAX_LISTED).map((f) => (
                      <li key={f.tile}>
                        Tile {f.tile}: {f.problem}
                      </li>
                    ))}
                    {fit.failures.length > MAX_LISTED && (
                      <li>…and {fit.failures.length - MAX_LISTED} more</li>
                    )}
                  </ul>
                </div>
              )}
              <IndexedCanvas
                image={sheet}
                label="Preview of the imported charset"
                className="w-full max-w-[384px] rounded-sm border border-rule"
              />
            </PaletteScope>
          </ReportSection>

          <ReportSection title="Adds to the project">
            <CheckLine ok>
              Charset “{charsetName}” ({fit.tiles.length} chars)
            </CheckLine>
            <label className="flex items-center gap-2.5">
              <input
                type="checkbox"
                className="size-5 accent-primary"
                checked={addMap}
                onChange={(e) => setAddMap(e.target.checked)}
              />
              Screen map “{mapName}” ({size.width}×{size.height}) using it
            </label>
            <p className="text-xs text-muted-foreground">
              Existing charsets and maps are not changed.
            </p>
          </ReportSection>
        </>
      )}

      <DialogFooter>
        <Button variant="outline" onClick={onCancel}>
          Cancel
        </Button>
        <Button disabled={!fit} onClick={runImport}>
          Import
        </Button>
      </DialogFooter>
    </div>
  )
}

function listTiles(tiles: ReadonlyArray<number>) {
  const shown = tiles.slice(0, MAX_LISTED).join(', ')
  return tiles.length > MAX_LISTED
    ? `${shown} and ${tiles.length - MAX_LISTED} more`
    : shown
}

function paletteText(
  colours: NonNullable<ReturnType<typeof analyseColours>>,
  project: Project['palette'],
) {
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
function RegisterPicker({
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

/** Which tile tags become which char attributes. */
function TagNote({ tileUserData }: { tileUserData: ReadonlyArray<string> }) {
  const { values, names } = tileAttributes(tileUserData)
  const counts = new Map<number, number>()
  values.forEach((v) => v && counts.set(v, (counts.get(v) ?? 0) + 1))
  if (counts.size === 0) return null
  const parts = [...counts.keys()]
    .sort((a, b) => a - b)
    .map((v) => {
      const n = counts.get(v) ?? 0
      return `${names[v] ? `“${names[v]}” → ` : ''}${v} (${n} tile${n === 1 ? '' : 's'})`
    })
  return <p>Tile tags become char attributes: {parts.join(', ')}.</p>
}
