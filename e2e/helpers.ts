import { expect } from '@playwright/test'
import type { Page } from '@playwright/test'

/** Create a project from My Projects and wait for its worksheet. */
export async function createProject(page: Page, name: string) {
  await page.goto('/')
  await page.getByRole('button', { name: 'New project' }).first().click()
  await page.getByLabel('Project name').fill(name)
  await page.getByRole('button', { name: 'Create' }).click()
  await expect(
    page.getByRole('heading', { name: 'Project Worksheet' }),
  ).toBeVisible()
}

/**
 * Let the autosave run (it saves half a second after the last change, and
 * shows nothing unless it fails), so a reload sees the change.
 */
export async function waitForAutosave(page: Page) {
  await page.waitForTimeout(800)
  await expect(page.getByText('Not saved')).toHaveCount(0)
}

/** Path to one of the Rainbow Islands Aseprite fixtures. */
export const asepriteFixture = (name: string) =>
  new URL(
    `../src/import/aseprite/__fixtures__/${name}.aseprite`,
    import.meta.url,
  ).pathname
