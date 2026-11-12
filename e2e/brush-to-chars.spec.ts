import { expect, test } from '@playwright/test'
import { createProject } from './helpers'

test('CHARS opens on the char the screen is painting with', async ({
  page,
}) => {
  await createProject(page, 'Brush to chars')
  await page.getByRole('link', { name: 'Map 1' }).click()
  await expect(
    page.getByRole('heading', { name: 'Screen Worksheet' }),
  ).toBeVisible()
  const number = page.getByLabel('Character number')

  // The starting brush is $01.
  await page.getByRole('link', { name: 'CHARS', exact: true }).click()
  await expect(number).toHaveValue('1')

  // Pick another char on CHARS, then a new brush on the screen:
  await number.fill('9')
  await page.getByRole('link', { name: 'SCREEN', exact: true }).click()
  const sheet = page.getByRole('img', { name: /^Characters in/ })
  const box = (await sheet.boundingBox())!
  await sheet.click({
    position: {
      x: (4 + 0.5) * (box.width / 16),
      y: (2 + 0.5) * (box.height / 16),
    },
  })
  await expect(page.getByRole('img', { name: 'Brush: char $24' })).toBeVisible()
  await page.getByRole('link', { name: 'CHARS', exact: true }).click()
  await expect(number).toHaveValue('36')
})
