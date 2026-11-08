import { expect, test } from '@playwright/test'
import { asepriteFixture, createProject } from './helpers'
import type { Page } from '@playwright/test'

async function importIsland(page: Page, name: string) {
  await page.locator('input[type="file"]').setInputFiles(asepriteFixture(name))
  const dialog = page.getByRole('dialog', { name: 'Import Aseprite file' })
  await dialog.getByRole('button', { name: 'Import' }).click()
  await expect(dialog).toBeHidden()
}

test('merging two island charsets makes a new one and changes nothing else', async ({
  page,
}) => {
  await createProject(page, 'Merge')
  await importIsland(page, 'island-8-1_test')
  await importIsland(page, 'island-8-2_test')

  await page
    .getByRole('button', { name: 'Actions for island-8-2_test' })
    .first()
    .click()
  await page
    .getByRole('menuitem', { name: 'Merge chars into new charset…' })
    .click()
  const dialog = page.getByRole('dialog', { name: /Merge chars from/ })
  await dialog.getByRole('combobox').click()
  await page.getByRole('option', { name: 'island-8-1_test' }).click()

  // The rounds share tiles: some are reused rather than added.
  await expect(dialog).toContainText(/already in “island-8-1_test”/)
  await expect(dialog.getByLabel('New charset name')).toHaveValue(
    'island-8-1_test + island-8-2_test',
  )
  await dialog.getByRole('button', { name: 'Create charset' }).click()
  await expect(dialog).toBeHidden()

  const merged = page.getByRole('link', {
    name: 'island-8-1_test + island-8-2_test',
  })
  await expect(merged).toBeVisible()
  // The originals stay, and each map still uses its own charset.
  await expect(page.getByText('40×256 · island-8-1_test')).toBeVisible()
  await expect(page.getByText('40×256 · island-8-2_test')).toBeVisible()

  await page.getByRole('button', { name: 'Undo', exact: true }).click()
  await expect(merged).toHaveCount(0)
})
