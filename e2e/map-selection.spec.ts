import { expect, test } from '@playwright/test'
import { asepriteFixture, createProject } from './helpers'

// The tablet's size, less Android's bars: a full charset fills the side panel.
test.use({ viewport: { width: 1067, height: 620 } })

test('a selection floats its actions over the map', async ({ page }) => {
  await createProject(page, 'Selection')
  await page
    .locator('input[type="file"]')
    .setInputFiles(asepriteFixture('island-8-1_test'))
  const dialog = page.getByRole('dialog', { name: 'Import Aseprite file' })
  await dialog.getByRole('button', { name: 'Import' }).click()
  await expect(dialog).toBeHidden()
  await page
    .getByRole('link', { name: 'island-8-1_test', exact: true })
    .last()
    .click()

  const map = page.getByRole('img', { name: /^Map / })
  const select = async () => {
    await page.getByRole('button', { name: 'Select an area' }).click()
    const box = (await map.boundingBox())!
    const cell = box.width / 40
    await page.mouse.move(box.x + 2.5 * cell, box.y + 3.5 * cell)
    await page.mouse.down()
    await page.mouse.move(box.x + 5.5 * cell, box.y + 4.5 * cell, {
      steps: 4,
    })
    await page.mouse.up()
  }
  const bar = page.getByRole('toolbar', { name: 'Selection' })

  // In view, even with the side panel full.
  await select()
  await expect(bar).toBeInViewport()
  await expect(bar).toContainText('4×2 at 2,3')

  // ✕ deselects.
  await bar.getByRole('button', { name: 'Deselect' }).click()
  await expect(bar).toBeHidden()

  // Use as brush: a block brush, back to painting.
  await select()
  await bar.getByRole('button', { name: 'Use as brush' }).click()
  await expect(bar).toBeHidden()
  await expect(
    page.getByRole('img', { name: 'Brush: 4×2 block' }),
  ).toBeVisible()
  await expect(
    page.getByRole('button', { name: /^Paint with the brush/ }),
  ).toHaveAttribute('aria-pressed', 'true')
})
