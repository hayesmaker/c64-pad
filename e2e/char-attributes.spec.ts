import { expect, test } from '@playwright/test'
import { createProject } from './helpers'

test('chars get attributes, named per charset, shown on request', async ({
  page,
}) => {
  await createProject(page, 'Attributes')
  await page.getByRole('link', { name: 'Charset 1' }).click()

  const select = page.getByRole('combobox', {
    name: 'Attribute of character 0',
  })
  // Nothing to name while the char has no attribute.
  await expect(
    page.getByRole('button', { name: 'Name this attribute (pick one first)' }),
  ).toBeDisabled()

  // Give char 0 attribute 1, then name it.
  await select.click()
  await page.getByRole('option', { name: 'Unnamed' }).first().click()
  await expect(select).toContainText('Unnamed')
  await page.getByRole('button', { name: 'Name attribute 1' }).click()
  await page
    .getByRole('textbox', { name: 'Name (empty to clear)' })
    .fill('Solid')
  await page.getByRole('button', { name: 'Save' }).click()
  await expect(select).toContainText('Solid')

  // The overlay toggle.
  const show = page.getByRole('button', {
    name: 'Show attributes on the characters',
  })
  await expect(show).toHaveAttribute('aria-pressed', 'false')
  await show.click()
  await expect(show).toHaveAttribute('aria-pressed', 'true')

  // Undo takes the name off, then the attribute; redo puts both back.
  await page.getByRole('button', { name: 'Undo' }).click()
  await expect(select).toContainText('Unnamed')
  await page.getByRole('button', { name: 'Undo' }).click()
  await expect(select).toContainText('None')
  await page.getByRole('button', { name: 'Redo' }).click()
  await page.getByRole('button', { name: 'Redo' }).click()
  await expect(select).toContainText('Solid')

  // Still there after a reload (saved with the project).
  await page.waitForTimeout(1200)
  await page.reload()
  await expect(
    page.getByRole('combobox', { name: 'Attribute of character 0' }),
  ).toContainText('Solid')
  await expect(
    page.getByRole('button', { name: 'Show attributes on the characters' }),
  ).toHaveAttribute('aria-pressed', 'true')

  // The Screen worksheet has its own toggle.
  await page.getByRole('link', { name: 'SCREEN' }).click()
  await expect(
    page.getByRole('button', { name: 'Char attributes (shown over the map)' }),
  ).toHaveAttribute('aria-pressed', 'false')
})
