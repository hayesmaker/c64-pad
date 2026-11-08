import { expect, test } from '@playwright/test'
import { asepriteFixture, createProject, waitForAutosave } from './helpers'
import type { Page } from '@playwright/test'

const undoButton = (page: Page) =>
  page.getByRole('button', { name: 'Undo', exact: true })
const redoButton = (page: Page) =>
  page.getByRole('button', { name: 'Redo', exact: true })

test('deleting a map can be undone and redone', async ({ page }) => {
  await createProject(page, 'Undo Delete')
  await expect(undoButton(page)).toBeDisabled()

  await page.getByRole('button', { name: 'Actions for Map 1' }).click()
  await page.getByRole('menuitem', { name: 'Delete' }).click()
  await expect(page.getByText('You can undo this.')).toBeVisible()
  await page.getByRole('button', { name: 'Delete' }).click()
  await expect(page.getByRole('link', { name: 'Map 1' })).toHaveCount(0)

  await undoButton(page).click()
  await expect(page.getByRole('link', { name: 'Map 1' })).toBeVisible()
  await redoButton(page).click()
  await expect(page.getByRole('link', { name: 'Map 1' })).toHaveCount(0)
})

test('typing a name undoes as one step, even across an autosave', async ({
  page,
}) => {
  await createProject(page, 'Old Name')
  const name = page.getByLabel('Project name')
  await name.fill('')
  await name.pressSequentially('New Name')
  await name.blur()
  // Saving stamps a new updatedAt; the history must survive it.
  await waitForAutosave(page)

  await undoButton(page).click()
  await expect(name).toHaveValue('Old Name')
  await expect(undoButton(page)).toBeDisabled()
})

test('Ctrl+Z undoes an Aseprite import in one step', async ({ page }) => {
  await createProject(page, 'Undo Import')
  await page
    .locator('input[type="file"]')
    .setInputFiles(asepriteFixture('island-8-2_test'))
  const dialog = page.getByRole('dialog', { name: 'Import Aseprite file' })
  await dialog.getByRole('button', { name: 'Import' }).click()
  await expect(page.getByRole('link', { name: 'island-8-2_test' })).toHaveCount(
    2,
  )

  await page.keyboard.press('Control+z')
  await expect(page.getByRole('link', { name: 'island-8-2_test' })).toHaveCount(
    0,
  )
  await expect(page.getByRole('link', { name: 'Charset 1' })).toBeVisible()
})
