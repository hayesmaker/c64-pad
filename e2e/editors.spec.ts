import { expect, test } from '@playwright/test'
import { createProject } from './helpers'

test('drawing a sprite pixel shows in its data, and undo removes it', async ({
  page,
}) => {
  await createProject(page, 'Sprites')
  await page.getByRole('link', { name: 'Sprites 1' }).click()
  await expect(
    page.getByRole('heading', { name: 'Sprite Worksheet' }),
  ).toBeVisible()

  const data = page.getByRole('button', { name: /Sprite data bytes/ })
  await expect(data).not.toContainText('128')

  // Top-left pixel: the first byte's top bits (pen 10 in multicolour).
  const grid = page.getByRole('img', { name: /pixel grid/ })
  const box = (await grid.boundingBox())!
  await page.mouse.click(box.x + 6, box.y + 6)
  await expect(data).toContainText('128')

  await page.getByRole('button', { name: 'Undo', exact: true }).click()
  await expect(data).not.toContainText('128')
  await page.getByRole('button', { name: 'Redo', exact: true }).click()
  await expect(data).toContainText('128')
})

test('painting a map cell, then undoing it', async ({ page }) => {
  await createProject(page, 'Maps')
  await page.getByRole('link', { name: 'Map 1' }).click()
  await expect(
    page.getByRole('heading', { name: 'Screen Worksheet' }),
  ).toBeVisible()
  const undo = page.getByRole('button', { name: 'Undo', exact: true })
  await expect(undo).toBeDisabled()

  const map = page.getByRole('img', { name: 'Map Map 1, 40 by 25 characters' })
  const box = (await map.boundingBox())!
  await page.mouse.click(box.x + 40, box.y + 40)
  await expect(undo).toBeEnabled()
  // The readout shows the painted cell's screen code (the brush, $01).
  await expect(page.getByText(/\$01 ·/)).toBeVisible()

  await undo.click()
  await expect(undo).toBeDisabled()
})
