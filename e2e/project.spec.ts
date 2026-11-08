import { expect, test } from '@playwright/test'
import { createProject, waitForAutosave } from './helpers'

test('a new project starts with a sprite set, a charset and a map', async ({
  page,
}) => {
  await createProject(page, 'Star Patrol')
  await expect(page.getByRole('link', { name: 'Sprites 1' })).toBeVisible()
  await expect(page.getByRole('link', { name: 'Charset 1' })).toBeVisible()
  await expect(page.getByRole('link', { name: 'Map 1' })).toBeVisible()
  await expect(page.getByLabel('Project name')).toHaveValue('Star Patrol')
})

test('switching the palette recolours the project, and is saved', async ({
  page,
}) => {
  await createProject(page, 'Palettes')
  const screenColour = () =>
    page.evaluate(() =>
      document.documentElement.style.getPropertyValue('--c64-screen'),
    )
  expect(await screenColour()).toBe('#2e2c9b') // Colodore blue

  await page.getByLabel('Colour palette').click()
  await page.getByRole('option', { name: /VICE/ }).click()
  await expect.poll(screenColour).toBe('#211bae') // VICE blue

  await waitForAutosave(page)
  await page.reload()
  await expect(page.getByLabel('Colour palette')).toContainText('VICE')
  expect(await screenColour()).toBe('#211bae')
})

test('a project exports to .c64pad and imports back', async ({ page }) => {
  await createProject(page, 'Round Trip')
  await page.getByLabel('Program').fill('Test game')

  const downloading = page.waitForEvent('download')
  await page.getByRole('button', { name: 'Export' }).click()
  const download = await downloading
  expect(download.suggestedFilename()).toBe('Round-Trip.c64pad')
  const file = await download.path()

  // Importing a project that's already on the device makes a copy.
  await page.goto('/')
  await page.locator('input[type="file"]').setInputFiles(file)
  await expect(
    page.getByRole('heading', { name: 'Project Worksheet' }),
  ).toBeVisible()
  await expect(page.getByLabel('Project name')).toHaveValue(
    'Round Trip (imported)',
  )
  await expect(page.getByLabel('Program')).toHaveValue('Test game')
})
