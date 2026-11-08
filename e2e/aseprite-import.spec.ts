import { expect, test } from '@playwright/test'
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
