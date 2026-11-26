import { useMemo, useState } from 'react'
import { addAsset, setProjectPalette } from '@/c64/project'
import { COLOR_NAMES } from '@/c64/palette'
import { fitSprites } from '@/c64/sprite-fit'
import { SPRITE_HEIGHT } from '@/c64/sprite'
import {
  SPRITE_RENDER_WIDTH,
  overlayBase,
  renderSprite,
} from '@/c64/sprite-set'
import { IndexedCanvas } from '@/components/c64/indexed-canvas'
import { PaletteScope } from '@/components/c64/palette-context'
import { Button } from '@/components/ui/button'
import { DialogFooter } from '@/components/ui/dialog'
import { CheckLine, Note, ReportSection } from '@/components/report'
import { baseName, uniqueName } from './convert'
import { PaletteSection, RegisterPicker, canSwitchTo } from './import-parts'
import {
  MAX_SPRITES,
  buildSpriteSet,
  checkSpriteStructure,
  collectSprites,
  guessTransparent,
  readSpriteCells,
  spriteCount,
} from './sprites'
import { analysePixels } from './validate'
import type { C64Color } from '@/c64/palette'
import type { Project } from '@/c64/project'
import type { SpriteFitChoice } from '@/c64/sprite-fit'
import type { AsepriteDoc } from './parse'

const MAX_LISTED = 6
/** Sprites shown in the preview. */
const MAX_PREVIEW = 48

const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? '' : 's'}`

/**
 * Import an Aseprite file's image layers as a new sprite set: each frame
 * flattened and cut into 24×21 sprites, the colours fitted to hires,
 * multicolour or multicolour + hi-res overlay, tags as animations.
 */
export function SpriteImport({
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
  const [choice, setChoice] = useState<SpriteFitChoice>({})
  const [seeThrough, setSeeThrough] = useState<C64Color | undefined>()
  const [switchPalette, setSwitchPalette] = useState(false)

  const structure = useMemo(() => checkSpriteStructure(doc), [doc])
  const cells = useMemo(() => readSpriteCells(doc, structure), [doc, structure])
  const colours = useMemo(
    () =>
      structure.ok
        ? analysePixels(
            doc,
            cells.map((c) => c.rgba),
            project.palette,
          )
        : null,
    [doc, structure, cells, project.palette],
  )
  const guessed = useMemo(
    () => colours && guessTransparent(colours.images),
    [colours],
  )
  const transparent = seeThrough ?? guessed ?? null
  const sheet = useMemo(
    () => colours && collectSprites(colours.images, transparent),
    [colours, transparent],
  )
  const fit = useMemo(
    () => sheet && fitSprites(sheet.images, choice),
    [sheet, choice],
  )
  const base = baseName(fileName)
  const setName = uniqueName(base, project.spriteSets)
  const preview = useMemo(
    () => sheet && fit && buildSpriteSet(setName, doc, structure, sheet, fit),
    [sheet, fit, setName, doc, structure],
  )

  const canSwitch = !!colours && canSwitchTo(colours, project)
  const shownPalette =
    canSwitch && switchPalette ? colours.palette : project.palette
  const count = fit ? spriteCount(fit) : 0
  const tooMany = count > MAX_SPRITES
  const nothing = !!sheet && sheet.images.length === 0
  const blocked = tooMany || nothing
  const usesShared = !!fit && fit.sprites.some((s) => s.kind !== 'hires')
  const kinds = fit
    ? (['hires', 'multicolor', 'overlay'] as const).map(
        (k) => fit.sprites.filter((s) => s.kind === k).length,
      )
    : [0, 0, 0]

  const runImport = () => {
    if (!colours || !sheet || !fit || blocked) return
    onImport((p) => {
      const next =
        canSwitch && switchPalette ? setProjectPalette(p, colours.palette) : p
      return addAsset(
        next,
        'spriteSets',
        buildSpriteSet(
          uniqueName(base, next.spriteSets),
          doc,
          structure,
          sheet,
          fit,
        ),
      )
    })
  }

  const frames = doc.frames
  const perFrame = structure.grid
    ? structure.grid.columns * structure.grid.rows
    : 0

  return (
    <>
      <ReportSection title="File">
        <ul className="flex flex-col gap-1">
          {structure.checks.map((c) => (
            <li key={c.text}>
              <CheckLine ok={c.ok}>{c.text}</CheckLine>
            </li>
          ))}
          {sheet && (
            <li>
              <CheckLine ok={!blocked}>
                {plural(frames, 'frame')}
                {perFrame > 1 && ` × ${perFrame} cells`} →{' '}
                {plural(sheet.images.length, 'sprite')}
                {tooMany &&
                  `; with overlays that's ${count}, and a set holds ${MAX_SPRITES}`}
                {nothing && ': every cell is empty'}
              </CheckLine>
            </li>
          )}
        </ul>
        {sheet && (sheet.empty > 0 || sheet.duplicates > 0) && (
          <p className="text-xs text-muted-foreground">
            {[
              sheet.empty > 0 &&
                `${plural(sheet.empty, 'empty cell')} left out`,
              sheet.duplicates > 0 &&
                `${plural(sheet.duplicates, 'repeated cell')} share${sheet.duplicates === 1 ? 's' : ''} a sprite`,
            ]
              .filter(Boolean)
              .join('; ')}
            .
          </p>
        )}
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

      {colours && fit && preview && !nothing && (
        <>
          <PaletteSection
            colours={colours}
            project={project}
            canSwitch={canSwitch}
            switchPalette={switchPalette}
            onSwitchPalette={setSwitchPalette}
          />

          <ReportSection title="C64 colours">
            <PaletteScope id={shownPalette}>
              {transparent !== null && guessed !== null && (
                <div className="flex flex-col gap-2">
                  <p>
                    The art has no transparent pixels, so one colour is read as
                    see-through (the screen behind the sprites).
                    {seeThrough === undefined &&
                      ` ${COLOR_NAMES[transparent]} is the most common colour in the corners.`}
                  </p>
                  <div>
                    <RegisterPicker
                      label="See-through"
                      value={transparent}
                      onChange={setSeeThrough}
                    />
                  </div>
                </div>
              )}
              {usesShared && (
                <div className="flex flex-wrap items-center gap-2">
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
              )}
              {usesShared && (
                <p className="text-xs text-muted-foreground">
                  Multicolour 1 and 2 are shared by every sprite in the set.
                </p>
              )}
              {fit.failures.length === 0 ? (
                <CheckLine ok>
                  {fit.sprites.length === 1
                    ? 'The sprite fits exactly'
                    : `All ${fit.sprites.length} sprites fit exactly`}
                  {': '}
                  {[
                    kinds[0] > 0 && `${kinds[0]} hires`,
                    kinds[1] > 0 && `${kinds[1]} multicolour`,
                    kinds[2] > 0 &&
                      `${kinds[2]} multicolour with a hi-res overlay`,
                  ]
                    .filter(Boolean)
                    .join(', ')}
                </CheckLine>
              ) : (
                <div className="flex flex-col gap-1">
                  <CheckLine ok={false}>
                    {fit.failures.length} of {fit.sprites.length} sprites don't
                    fit exactly; they're imported as close as possible:
                  </CheckLine>
                  <ul className="ml-7 list-disc text-xs text-muted-foreground">
                    {fit.failures.slice(0, MAX_LISTED).map((f) => (
                      <li key={f.sprite}>
                        Sprite {f.sprite}: {f.problem}
                      </li>
                    ))}
                    {fit.failures.length > MAX_LISTED && (
                      <li>…and {fit.failures.length - MAX_LISTED} more</li>
                    )}
                  </ul>
                </div>
              )}
              <div
                role="img"
                aria-label="Preview of the imported sprites"
                className="flex flex-wrap gap-2 rounded-sm border border-c64-border bg-c64-screen p-2"
              >
                {preview.sprites
                  .filter((s) => !overlayBase(preview, s.id))
                  .slice(0, MAX_PREVIEW)
                  .map((s) => (
                    <IndexedCanvas
                      key={s.id}
                      image={{
                        width: SPRITE_RENDER_WIDTH,
                        height: SPRITE_HEIGHT,
                        pixels: renderSprite(preview, s),
                      }}
                      label={s.name}
                      className="w-12"
                    />
                  ))}
              </div>
            </PaletteScope>
          </ReportSection>

          <ReportSection title="Adds to the project">
            <CheckLine ok={!tooMany}>
              Sprite set “{setName}” ({plural(count, 'sprite')}
              {kinds[2] > 0 && `, ${kinds[2]} of them overlays`}
              {preview.animations.length > 0 &&
                ` · ${plural(preview.animations.length, 'animation')}: ${preview.animations.map((a) => a.name).join(', ')}`}
              )
            </CheckLine>
            <p className="text-xs text-muted-foreground">
              Existing sprite sets are not changed.
            </p>
          </ReportSection>
        </>
      )}

      <DialogFooter>
        <Button variant="outline" onClick={onCancel}>
          Cancel
        </Button>
        <Button disabled={!fit || blocked} onClick={runImport}>
          Import
        </Button>
      </DialogFooter>
    </>
  )
}
