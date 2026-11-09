import { expect, test } from '@playwright/test'
import { asepriteFixture, createProject } from './helpers'

test('the Screen page reopens at the zoom and scroll it was left at', async ({
  page,
}) => {
  await createProject(page, 'View')
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

  const map = page.getByRole('img', { name: /^Map island-8-1_test/ })
  const zoom = page.getByRole('button', { name: /^(Zoom in|Reset zoom)/ })
  await expect(zoom).toHaveText('1×')
  // Zoom in round a point low on the map: zooms and scrolls.
  const box = (await map.boundingBox())!
  await page.mouse.move(box.x + box.width * 0.7, box.y + box.height * 0.8)
  for (let i = 0; i < 6; i++) await page.mouse.wheel(0, -200)
  const zoomed = await zoom.textContent()
  expect(zoomed).not.toBe('1×')
  await page.mouse.move(0, 0) // no brush preview in the shots
  const before = await map.screenshot()

  await page.getByRole('link', { name: 'CHARS' }).click()
  await expect(
    page.getByRole('heading', { name: 'Character Worksheet' }),
  ).toBeVisible()
  await page.getByRole('link', { name: 'SCREEN' }).click()
  await expect(zoom).toHaveText(zoomed!)
  expect(await map.screenshot()).toEqual(before)

  // And after a restart.
  await page.reload()
  await expect(zoom).toHaveText(zoomed!)
  expect(await map.screenshot()).toEqual(before)
})
