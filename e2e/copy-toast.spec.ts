import { expect, test } from '@playwright/test'
import { createProject } from './helpers'

test('copying a char or sprite pixels says so in a toast', async ({ page }) => {
  await createProject(page, 'Copy toast')

  await page.getByRole('link', { name: 'Charset 1' }).click()
  await page.getByLabel('Character number').fill('5')
  await page.getByRole('button', { name: 'Copy', exact: true }).click()
  const charToast = page.getByText('Char $05 copied')
  await expect(charToast).toBeVisible()
  await expect(charToast).toBeHidden({ timeout: 5000 })

  await page.getByRole('link', { name: 'SPRITES' }).click()
  await page.getByRole('button', { name: /sprite actions/i }).click()
  await page.getByRole('menuitem', { name: 'Copy pixels' }).click()
  await expect(page.getByText('Sprite pixels copied')).toBeVisible()
})
