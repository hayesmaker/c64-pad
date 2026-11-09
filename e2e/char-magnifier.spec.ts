import { expect, test } from '@playwright/test'
import { createProject } from './helpers'
import type { Locator } from '@playwright/test'

/** A pen event at a char (col, row) of a 13 px sheet. */
async function pen(sheet: Locator, type: string, col: number, row: number) {
  const box = (await sheet.boundingBox())!
  await sheet.dispatchEvent(type, {
    pointerType: 'pen',
    pointerId: 2,
    isPrimary: true,
    clientX: box.x + col * 13 + 6,
    clientY: box.y + row * 13 + 6,
  })
}

test('the pen magnifies the char sheet and picks where it lifts', async ({
  page,
}) => {
  await createProject(page, 'Magnifier')
  await page.getByRole('link', { name: 'Map 1' }).click()
  const sheet = page.getByRole('img', { name: /^Characters in/ })
  const magnifier = page.getByRole('status').filter({ hasText: /\$|cancel/ })

  await pen(sheet, 'pointerdown', 1, 0)
  await expect(magnifier).toContainText('$01 · 1')
  await pen(sheet, 'pointermove', 4, 2) // slide to $24
  await expect(magnifier).toContainText('$24 · 36')
  await pen(sheet, 'pointerup', 4, 2)
  await expect(magnifier).toHaveCount(0)
  await expect(page.getByRole('img', { name: 'Brush: char $24' })).toBeVisible()

  // Lifting off the grid cancels.
  await pen(sheet, 'pointerdown', 2, 0)
  await pen(sheet, 'pointermove', 20, 0)
  await expect(magnifier).toContainText('Lift here to cancel')
  await pen(sheet, 'pointerup', 20, 0)
  await expect(page.getByRole('img', { name: 'Brush: char $24' })).toBeVisible()
})
