import { expect, test } from '@playwright/test'
import { createProject } from './helpers'

const SHOTS = process.env.SHOTS

// The tablet's size, less Android's bars.
test.use({ viewport: { width: 1067, height: 620 } })

test('multicolour bitmap: tiles with their own colours, recoloured per cell', async ({
  page,
}) => {
  await createProject(page, 'Bitmap')
  await page.getByRole('link', { name: 'Charset 1' }).click()

  // Bitmap mode: four pens, two of them the tile's screen colours.
  await page
    .getByRole('group', { name: 'Charset mode' })
    .getByRole('button', { name: 'Bitmap' })
    .click()
  await page.getByLabel('Character number').fill('1')
  await page.getByRole('button', { name: /^Screen colour 1/ }).click()
  await page.getByRole('button', { name: 'Set screen colour 1 to Red' }).click()
  await expect(
    page.getByRole('button', { name: /^Screen colour 1 · Red/ }),
  ).toBeVisible()
  // Draw a row of 01 pixels.
  const grid = page.getByRole('img', { name: /^Character 1 pixel grid/ })
  const g = (await grid.boundingBox())!
  for (let x = 0; x < 4; x++)
    await page.mouse.click(g.x + ((x + 0.5) * g.width) / 4, g.y + 2)
  if (SHOTS) await page.screenshot({ path: `${SHOTS}/bitmap-chars.png` })

  // On the screen: paint tile 1, then give one cell its own colour 1.
  await page.getByRole('link', { name: 'SCREEN', exact: true }).click()
  const map = page.getByRole('img', { name: /^Map / })
  const box = (await map.boundingBox())!
  const cw = box.width / 40
  const ch = box.height / 25
  const at = (x: number, y: number) =>
    page.mouse.click(box.x + (x + 0.5) * cw, box.y + (y + 0.5) * ch)
  await at(2, 1)
  await at(3, 1)
  await page.getByRole('button', { name: /^Colour cells/ }).click()
  const panel = page.getByRole('region', { name: 'Cell colours' })
  await panel.getByRole('button', { name: '01 Scr 1' }).click()
  await panel
    .getByRole('button', { name: 'Set screen colour 1 to Green' })
    .click()
  await at(3, 1)
  if (SHOTS) await page.screenshot({ path: `${SHOTS}/bitmap-screen.png` })
  await page.mouse.move(box.x + 2.5 * cw, box.y + 1.5 * ch)
  await expect(page.getByText('$01 · Red / Grey / Light Blue')).toBeVisible()
  await page.mouse.move(box.x + 3.5 * cw, box.y + 1.5 * ch)
  await expect(
    page.getByText('$01 · Green / Grey / Light Blue (cell)'),
  ).toBeVisible()

  // Char's own takes it back.
  await panel.getByRole('button', { name: 'Char’s own colour' }).click()
  await at(3, 1)
  await page.mouse.move(box.x + 3.5 * cw, box.y + 1.5 * ch)
  await expect(page.getByText('$01 · Red / Grey / Light Blue')).toBeVisible()

  // Export offers screen RAM and a Koala picture.
  await page.getByRole('button', { name: 'Run & export' }).click()
  const dialog = page.getByRole('dialog')
  await dialog.getByRole('button', { name: 'Export files' }).click()
  await dialog.getByRole('button', { name: 'Koala' }).click()
  await expect(dialog).toContainText('.kla · 10003 bytes')
  if (SHOTS) {
    await page.screenshot({ path: `${SHOTS}/bitmap-export.png` })
    await dialog.getByRole('button', { name: 'Run on C64' }).click()
    await dialog.getByRole('button', { name: 'Run', exact: true }).click()
    await page.waitForTimeout(6000)
    await page.screenshot({ path: `${SHOTS}/bitmap-run.png` })
  }
})
