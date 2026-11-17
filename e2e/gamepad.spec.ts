import { expect, test } from '@playwright/test'
import { createProject } from './helpers'
import type { Page } from '@playwright/test'

/** Standard-layout buttons (see src/lib/gamepad.ts). */
const A = 0
const B = 1
const L2 = 6
const START = 9
const UP = 12
const LEFT = 14

/** A fake gamepad the test presses buttons on. */
async function fakeGamepad(page: Page) {
  await page.addInitScript(() => {
    const pad = { pressed: Array<boolean>(17).fill(false) }
    Object.assign(window, { __pad: pad })
    navigator.getGamepads = () => [
      {
        connected: true,
        buttons: pad.pressed.map((pressed) => ({ pressed })),
        axes: [0, 0, 0, 0],
      } as unknown as Gamepad,
    ]
  })
}

/** Press and release a button, a few frames each. */
async function tap(page: Page, button: number) {
  const set = (down: boolean) =>
    page.evaluate(
      ([b, d]) => {
        ;(
          window as unknown as { __pad: { pressed: Array<boolean> } }
        ).__pad.pressed[b] = d
      },
      [button, down] as [number, boolean],
    )
  await set(true)
  await page.waitForTimeout(50)
  await set(false)
  await page.waitForTimeout(50)
}

test('a gamepad moves a cursor and paints, erases and undoes', async ({
  page,
}) => {
  await fakeGamepad(page)
  await createProject(page, 'Pad')
  await page.getByRole('link', { name: 'Sprites 1' }).click()
  const data = page.getByRole('button', { name: /Sprite data bytes/ })
  await expect(data).not.toContainText('128')

  // The first press shows the cursor mid-grid (6, 10 of a 12 × 21
  // multicolour sprite); walk it to the top-left pixel and paint.
  await tap(page, A)
  await expect(page.getByText('Gamepad: press Start')).toBeVisible()
  for (let i = 0; i < 6; i++) await tap(page, LEFT)
  for (let i = 0; i < 10; i++) await tap(page, UP)
  await tap(page, A)
  await expect(data).toContainText('128')

  // B switches to Erase.
  await tap(page, B)
  await expect(page.getByRole('button', { name: 'Erase' })).toHaveAttribute(
    'aria-pressed',
    'true',
  )
  await tap(page, A)
  await expect(data).not.toContainText('128')

  // L2 undoes the erase.
  await tap(page, L2)
  await expect(data).toContainText('128')

  await tap(page, START)
  await expect(
    page.getByRole('dialog', { name: 'Gamepad controls' }),
  ).toBeVisible()
  await tap(page, START)
  await expect(
    page.getByRole('dialog', { name: 'Gamepad controls' }),
  ).toHaveCount(0)
})
