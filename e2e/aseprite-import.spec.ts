import { expect, test } from '@playwright/test'
import { art, writeAseprite } from '../src/import/aseprite/test-writer'
import { asepriteFixture, createProject } from './helpers'

test('importing an Aseprite file adds a charset and a map', async ({
  page,
}) => {
  await createProject(page, 'Islands')
  await page
    .locator('input[type="file"]')
    .setInputFiles(asepriteFixture('island1_round4'))

  const dialog = page.getByRole('dialog', { name: 'Import Aseprite file' })
  await expect(dialog).toContainText('Tileset of 69 tiles, 8×8')
  await expect(dialog).toContainText('All 68 tiles fit exactly')
  await expect(dialog).toContainText('uses the Pepto palette')

  await dialog.getByRole('button', { name: 'Switch project to Pepto' }).click()
  await dialog.getByRole('button', { name: 'Import' }).click()
  await expect(dialog).toBeHidden()

  // Added next to the starting assets; nothing replaced.
  await expect(page.getByRole('link', { name: 'island1_round4' })).toHaveCount(
    2,
  )
  await expect(page.getByRole('link', { name: 'Charset 1' })).toBeVisible()
  await expect(page.getByRole('link', { name: 'Map 1' })).toBeVisible()
  await expect(page.getByText('40×159 · island1_round4')).toBeVisible()
  await expect(page.getByLabel('Colour palette')).toContainText('Pepto')
})

test('a file without a tilemap is refused with a reason', async ({ page }) => {
  await createProject(page, 'Not Aseprite')
  await page.locator('input[type="file"]').setInputFiles({
    name: 'nope.aseprite',
    mimeType: 'application/octet-stream',
    buffer: Buffer.alloc(200),
  })
  const dialog = page.getByRole('dialog', { name: 'Import Aseprite file' })
  await expect(dialog).toContainText('Not an Aseprite file')
  await expect(dialog.getByRole('button', { name: 'Import' })).toHaveCount(0)
})

test('importing Aseprite frames adds a sprite set with its animation', async ({
  page,
}) => {
  // Two 24×21 frames of multicolour art (wide pixels in 0 / 1 / 2), the
  // second with one thin blue pixel, which needs a hi-res overlay.
  const rows = (detail: boolean) =>
    Array.from({ length: 21 }, (_, y) =>
      Array.from({ length: 24 }, (__, x) =>
        detail && x === 5 && y === 10
          ? '6'
          : y < 2
            ? '.'
            : String(Math.floor(x / 8)),
      ).join(''),
    )
  const file = writeAseprite({
    width: 24,
    height: 21,
    frames: 2,
    durations: [160, 160],
    layers: [{ name: 'Hero' }],
    cels: [
      { frame: 0, layer: 0, pixels: art(rows(false)) },
      { frame: 1, layer: 0, pixels: art(rows(true)) },
    ],
    tags: [{ name: 'walk', from: 0, to: 1 }],
  })
  await createProject(page, 'Sprites')
  await page.locator('input[type="file"]').setInputFiles({
    name: 'hero.aseprite',
    mimeType: 'application/octet-stream',
    buffer: Buffer.from(file),
  })

  const dialog = page.getByRole('dialog', { name: 'Import Aseprite file' })
  await expect(dialog).toContainText('A 24×21 canvas: one sprite per frame')
  await expect(dialog).toContainText('2 frames → 2 sprites')
  await expect(dialog).toContainText(
    'All 2 sprites fit exactly: 1 multicolour, 1 multicolour with a hi-res overlay',
  )
  await expect(dialog).toContainText(
    'Sprite set “hero” (3 sprites, 1 of them overlays · 1 animation: walk)',
  )
  await dialog.getByRole('button', { name: 'Import' }).click()
  await expect(dialog).toBeHidden()

  await expect(page.getByRole('link', { name: 'hero' })).toBeVisible()
  await expect(page.getByText('3 sprites · MC White / Red')).toBeVisible()
  await expect(page.getByRole('link', { name: 'Sprites 1' })).toBeVisible()
})
