import { readFile } from 'node:fs/promises'
import { expect, test } from '@playwright/test'
import { createProject } from './helpers'

/** The viewer's start column and row, from a saved .prg's config block. */
const startOf = (prg: Uint8Array) => {
  const cfg = (o: number) => prg[2 + 0x0c00 + o - 0x0801]
  return { x: cfg(20) | (cfg(21) << 8), y: cfg(22) | (cfg(23) << 8) }
}

test('Run starts on the screen in view on the worksheet', async ({ page }) => {
  await createProject(page, 'Run view')
  await page.getByRole('link', { name: 'Map 1' }).click()
  // 80 × 75: four more screens.
  await page.getByRole('button', { name: /Right/ }).click()
  await page.getByRole('button', { name: /Below/ }).click()
  await page.getByRole('button', { name: /Below/ }).click()
  await expect(
    page.getByRole('button', { name: /Resize map, now 80 by 75/ }),
  ).toBeVisible()

  // Scroll all the way down (Alt + wheel) and right (Shift + wheel).
  const map = page.getByRole('img', { name: /^Map / })
  const box = (await map.boundingBox())!
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2)
  await page.keyboard.down('Alt')
  for (let i = 0; i < 10; i++) await page.mouse.wheel(0, 2000)
  await page.keyboard.up('Alt')
  await page.keyboard.down('Shift')
  for (let i = 0; i < 10; i++) await page.mouse.wheel(0, 2000)
  await page.keyboard.up('Shift')

  await page.getByRole('button', { name: 'Run & export' }).click()
  await page.getByRole('button', { name: 'Run', exact: true }).click()
  const download = page.waitForEvent('download')
  await page.getByRole('button', { name: /Save \.prg/ }).click()
  const prg = new Uint8Array(await readFile(await (await download).path()))
  expect(startOf(prg)).toEqual({ x: 40, y: 50 }) // the bottom-right screen
})
