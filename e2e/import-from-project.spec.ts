import { expect, test } from '@playwright/test'
import { createProject, waitForAutosave } from './helpers'

test('assets come over from another project, as one undo step', async ({
  page,
}) => {
  // "Cloudy copy" is a copy of "Cloudy" (same asset ids) that gained a
  // sprite set, a charset and a screen.
  await createProject(page, 'Cloudy')
  await page.goto('/')
  await page.getByRole('button', { name: 'Actions for Cloudy' }).click()
  await page.getByRole('menuitem', { name: 'Duplicate' }).click()
  await page.getByRole('link', { name: 'Cloudy copy' }).click()
  await page.getByRole('button', { name: 'New sprite set' }).click()
  await page.getByRole('button', { name: 'New charset' }).click()
  await page.getByRole('dialog').getByLabel('Name').fill('Level 2 chars')
  await page.getByRole('button', { name: 'Create' }).click()
  await page.getByRole('button', { name: 'New map' }).click()
  await page.getByRole('dialog').getByLabel('Name').fill('Level 2')
  await page.getByRole('button', { name: 'Create' }).click()
  await expect(
    page.getByRole('link', { name: 'Level 2', exact: true }),
  ).toBeVisible()
  await waitForAutosave(page)

  await page.goto('/')
  await page.getByRole('link', { name: 'Cloudy', exact: true }).click()
  await page.getByRole('button', { name: 'Transfer' }).click()
  await page.getByRole('button', { name: /^From project/ }).click()
  await page.getByRole('button', { name: /Cloudy copy/ }).click()

  const dialog = page.getByRole('dialog')
  await expect(dialog.getByLabel('Sprites 1')).toBeDisabled()
  await expect(dialog.getByLabel('Sprites 2')).toBeChecked()
  await expect(dialog.getByLabel('Level 2 chars')).toBeChecked()
  await expect(dialog.getByLabel('Level 2', { exact: true })).toBeChecked()
  await dialog.getByLabel('Level 2 chars').uncheck()
  await dialog.getByRole('button', { name: 'Import 2' }).click()
  await expect(page.getByText('Imported 2 items')).toBeVisible()
  await expect(page.getByRole('link', { name: 'Sprites 2' })).toBeVisible()
  await expect(
    page.getByRole('link', { name: 'Level 2', exact: true }),
  ).toBeVisible()
  await expect(page.getByRole('link', { name: 'Level 2 chars' })).toHaveCount(0)

  await page.getByRole('button', { name: 'Undo' }).click()
  await expect(page.getByRole('link', { name: 'Sprites 2' })).toHaveCount(0)
  await expect(
    page.getByRole('link', { name: 'Level 2', exact: true }),
  ).toHaveCount(0)
})
