import { expect, test } from '@playwright/test'
import { createProject } from './helpers'
import type { Locator, Page } from '@playwright/test'

test.use({ hasTouch: true })

/** Two fingers spread apart over `target`, as real touch input. */
async function pinch(page: Page, target: Locator) {
  const box = (await target.boundingBox())!
  const cx = box.x + box.width / 2
  const cy = box.y + box.height / 2
  const cdp = await page.context().newCDPSession(page)
  const touch = (
    type: 'touchStart' | 'touchMove' | 'touchEnd',
    spread: number,
  ) =>
    cdp.send('Input.dispatchTouchEvent', {
      type,
      touchPoints:
        type === 'touchEnd'
          ? []
          : [
              { x: cx - spread, y: cy, id: 1 },
              { x: cx + spread, y: cy, id: 2 },
            ],
    })
  await touch('touchStart', 20)
  for (const spread of [30, 40, 50]) await touch('touchMove', spread)
  await touch('touchEnd', 50)
}

test('pinching the sprite grid picks the Hand tool, so it paints nothing', async ({
  page,
}) => {
  await createProject(page, 'Sprites')
  await page.getByRole('link', { name: 'Sprites 1' }).click()
  const hand = page.getByRole('button', { name: /^Hand/ })
  await expect(hand).toHaveAttribute('aria-pressed', 'false')

  await pinch(page, page.getByRole('img', { name: /pixel grid/ }))
  await expect(hand).toHaveAttribute('aria-pressed', 'true')
  await expect(
    page.getByRole('button', { name: 'Undo', exact: true }),
  ).toBeDisabled()
})

test('pinching the map picks the Hand tool', async ({ page }) => {
  await createProject(page, 'Maps')
  await page.getByRole('link', { name: 'Map 1' }).click()
  const hand = page.getByRole('button', { name: /^Hand/ })
  await expect(hand).toHaveAttribute('aria-pressed', 'false')

  await pinch(page, page.getByRole('img', { name: /^Map Map 1/ }))
  await expect(hand).toHaveAttribute('aria-pressed', 'true')
  await expect(
    page.getByRole('button', { name: 'Undo', exact: true }),
  ).toBeDisabled()
})
