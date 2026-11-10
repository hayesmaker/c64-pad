import { expect, test } from '@playwright/test'
import { createProject } from './helpers'

test('chars get attributes, named per charset, shown on request', async ({
  page,
}) => {
  await createProject(page, 'Attributes')
  await page.getByRole('link', { name: 'Charset 1' }).click()

  // Name attribute 1.
  await page.getByRole('button', { name: 'Name the attributes' }).click()
  await page
    .getByRole('textbox', { name: 'Name of attribute 1', exact: true })
    .fill('Solid')
  await page.getByRole('button', { name: 'Save' }).click()

  // Give char 0 attribute 1.
  const select = page.getByRole('combobox', {
    name: 'Attribute of character 0',
  })
  await select.click()
  await page.getByRole('option', { name: /Solid/ }).click()
  await expect(select).toContainText('Solid')

  // The overlay toggle.
  const show = page.getByRole('button', {
    name: 'Show attributes on the characters',
  })
  await expect(show).toHaveAttribute('aria-pressed', 'false')
  await show.click()
  await expect(show).toHaveAttribute('aria-pressed', 'true')

  // Undo takes the attribute back off, redo puts it back.
  await page.getByRole('button', { name: 'Undo' }).click()
  await expect(select).toContainText('None')
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
