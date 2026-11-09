import { expect, test } from '@playwright/test'
import { createProject } from './helpers'

test('the Character Worksheet keeps its pen across the side tabs', async ({
  page,
}) => {
  await createProject(page, 'Pens')
  await page.getByRole('link', { name: 'Charset 1' }).click()
  const pen = page.getByText('Pens').locator('..').getByRole('button')
  await expect(pen.first()).toHaveAttribute('aria-pressed', 'false')
  await pen.first().click()
  await expect(pen.first()).toHaveAttribute('aria-pressed', 'true')

  await page.getByRole('link', { name: 'SCREEN' }).click()
  await expect(
    page.getByRole('heading', { name: 'Screen Worksheet' }),
  ).toBeVisible()
  await page.getByRole('link', { name: 'CHARS' }).click()
  await expect(
    page.getByRole('heading', { name: 'Character Worksheet' }),
  ).toBeVisible()
  await expect(pen.first()).toHaveAttribute('aria-pressed', 'true')
})
