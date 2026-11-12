import { expect, test } from '@playwright/test'
import { createProject, waitForAutosave } from './helpers'

test('the Character Worksheet traces chars from the screen tracing', async ({
  page,
}) => {
  await createProject(page, 'Char tracing')
  await page.getByRole('link', { name: 'Map 1' }).click()

  // A screen-sized reference: stripes, so any cell has something to show.
  const png = await page.evaluate(async () => {
    const canvas = new OffscreenCanvas(320, 200)
    const ctx = canvas.getContext('2d')!
    for (let x = 0; x < 320; x += 2) {
      ctx.fillStyle = x % 4 ? '#ff0000' : '#00ff00'
      ctx.fillRect(x, 0, 2, 200)
    }
    const blob = await canvas.convertToBlob({ type: 'image/png' })
    const bytes = new Uint8Array(await blob.arrayBuffer())
    return Array.from(bytes)
  })
  await page.getByRole('button', { name: 'Tracing paper' }).click()
  await page.locator('input[type="file"][accept^="image/"]').setInputFiles({
    name: 'ref.png',
    mimeType: 'image/png',
    buffer: Buffer.from(png),
  })
  await expect(page.getByText('ref.png')).toBeVisible()
  await page.getByRole('button', { name: 'Done' }).click()

  // Paint the brush char ($01) at column 2, row 1.
  const map = page.getByRole('img', { name: /^Map / })
  const box = (await map.boundingBox())!
  const cw = box.width / 40
  const ch = box.height / 25
  const at = (x: number, y: number) =>
    page.mouse.click(box.x + (x + 0.5) * cw, box.y + (y + 0.5) * ch)
  await at(2, 1)

  // Pin it to column 10, row 3 as well.
  await page.getByRole('button', { name: /^Pin for char tracing/ }).click()
  await at(10, 3)
  // A toast confirms it, then goes.
  const toast = page.getByText('Pinned $01 at column 10, row 3')
  await expect(toast).toBeVisible()
  await expect(toast).toBeHidden({ timeout: 5000 })

  await page.getByRole('link', { name: 'CHARS' }).click()
  await page.getByLabel('Character number').fill('1')
  const panel = page.getByRole('region', { name: 'Tracing from screens' })
  const where = panel.getByLabel(/^Column/)
  // The pin first, then where the char is placed.
  await expect(where).toHaveAttribute('aria-label', 'Column 10, row 3, 1 of 2')
  await expect(
    panel.getByRole('button', { name: 'Pinned to this place' }),
  ).toHaveAttribute('aria-pressed', 'true')
  await expect(panel).toContainText('Pinned to Map 1 · 10,3')
  const removePin = panel.getByRole('button', { name: 'Remove pin' })
  await panel.getByRole('button', { name: 'Next place' }).click()
  await expect(where).toHaveAttribute('aria-label', 'Column 2, row 1, 2 of 2')

  // The image is drawn on the grid: hiding it changes the grid.
  const grid = page.getByRole('img', { name: /^Character 1 pixel grid/ })
  await page.mouse.move(0, 0)
  const shown = await grid.screenshot()
  await panel.getByRole('button', { name: 'Hide char tracing' }).click()
  expect(await grid.screenshot()).not.toEqual(shown)
  await panel.getByRole('button', { name: 'Show char tracing' }).click()

  // Unpinning leaves the placement; the pin survives a reload until then.
  await waitForAutosave(page)
  await page.reload()
  await page.getByLabel('Character number').fill('1')
  await expect(where).toHaveAttribute('aria-label', 'Column 10, row 3, 1 of 2')
  await removePin.click()
  await expect(removePin).toBeHidden()
  await expect(where).toHaveAttribute('aria-label', 'Column 2, row 1, 1 of 1')

  // A char that isn't on the screen says how to get it there.
  await page.getByLabel('Character number').fill('9')
  await expect(panel).toContainText('isn’t on a traced screen yet')
})
