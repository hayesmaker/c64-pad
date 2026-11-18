import { expect, test } from '@playwright/test'
import { createProject } from './helpers'
import type { BrowserContext, Page } from '@playwright/test'

/** An in-memory stand-in for a DigitalOcean Space, shared by two devices. */
function fakeSpace() {
  const objects = new Map<string, string>()
  const cors = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, PUT, DELETE, HEAD',
    'Access-Control-Allow-Headers': '*',
  }
  return async (context: BrowserContext) => {
    await context.route(/digitaloceanspaces\.com/, async (route) => {
      const req = route.request()
      const url = new URL(req.url())
      const key = decodeURIComponent(url.pathname.slice(1))
      const ok = (body = '', contentType = 'application/json') =>
        route.fulfill({ status: 200, headers: cors, contentType, body })
      if (!req.headers()['authorization'] && req.method() !== 'OPTIONS')
        return route.fulfill({ status: 403, headers: cors })
      switch (req.method()) {
        case 'OPTIONS':
          return ok()
        case 'PUT':
          objects.set(key, req.postData() ?? '')
          return ok()
        case 'DELETE':
          objects.delete(key)
          return ok()
        case 'GET': {
          if (url.searchParams.get('list-type') === '2') {
            const prefix = url.searchParams.get('prefix') ?? ''
            const keys = [...objects.keys()].filter((k) => k.startsWith(prefix))
            return ok(
              `<ListBucketResult><IsTruncated>false</IsTruncated>${keys
                .map((k) => `<Contents><Key>${k}</Key></Contents>`)
                .join('')}</ListBucketResult>`,
              'application/xml',
            )
          }
          const body = objects.get(key)
          if (body === undefined)
            return route.fulfill({
              status: 404,
              headers: cors,
              body: '<Error><Code>NoSuchKey</Code></Error>',
            })
          return ok(body)
        }
      }
      return route.fulfill({ status: 405, headers: cors })
    })
  }
}

async function setUpCloud(page: Page) {
  await page.goto('/')
  await page.getByRole('button', { name: 'Transfer' }).click()
  await page.getByRole('button', { name: /^Cloud/ }).click()
  await page.getByRole('radio', { name: 'DigitalOcean Space' }).click()
  await page.getByLabel('Region').fill('lon1')
  await page.getByLabel('Space name').fill('pad-test')
  await page.getByLabel('Access key').fill('KEY')
  await page.getByLabel('Secret key').fill('SECRET')
  await page.getByRole('button', { name: 'Save' }).click()
  await expect(page.getByText('Projects in pad-test/c64-pad')).toBeVisible()
}

const card = (page: Page, name: string) =>
  page.getByRole('listitem').filter({ hasText: name })

async function menu(page: Page, name: string, item: string) {
  await page.getByRole('button', { name: `Actions for ${name}` }).click()
  await page.getByRole('menuitem', { name: item }).click()
}

async function rename(page: Page, from: string, to: string) {
  await menu(page, from, 'Rename')
  await page.getByLabel('Project name').fill(to)
  await page.getByRole('button', { name: 'Save' }).click()
  await expect(card(page, to)).toBeVisible()
}

test('projects move between devices through the cloud', async ({ browser }) => {
  const attach = fakeSpace()
  const contextA = await browser.newContext()
  const contextB = await browser.newContext()
  await attach(contextA)
  await attach(contextB)
  const a = await contextA.newPage()
  const b = await contextB.newPage()

  // Device A saves a project to the cloud.
  await createProject(a, 'Cloudy')
  await setUpCloud(a)
  await expect(a.getByText('Nothing in the cloud yet')).toBeVisible()
  await a.keyboard.press('Escape')
  await expect(card(a, 'Cloudy')).toContainText('Not in the cloud')
  await menu(a, 'Cloudy', 'Save to cloud')
  await expect(card(a, 'Cloudy')).toContainText('Up to date')

  // Device B downloads it.
  await setUpCloud(b)
  await b.getByRole('button', { name: 'Download' }).click()
  await expect(
    b.getByRole('heading', { name: 'Project Worksheet' }),
  ).toBeVisible()
  await b.goto('/')
  await expect(card(b, 'Cloudy')).toContainText('Up to date')

  // B changes it and saves without being asked: A hasn't changed it.
  await rename(b, 'Cloudy', 'Cloudy B')
  await expect(card(b, 'Cloudy B')).toContainText('Newer on this device')
  await menu(b, 'Cloudy B', 'Save to cloud')
  await expect(card(b, 'Cloudy B')).toContainText('Up to date')

  // A changed it too: both saving and opening ask first.
  await a.reload()
  await expect(card(a, 'Cloudy')).toContainText('Newer in the cloud')
  await rename(a, 'Cloudy', 'Cloudy A')
  await expect(card(a, 'Cloudy A')).toContainText('Changed on both')
  await menu(a, 'Cloudy A', 'Save to cloud')
  await expect(
    a.getByRole('alertdialog', { name: 'Replace the cloud copy?' }),
  ).toBeVisible()
  await a.getByRole('button', { name: 'Cancel' }).click()

  await a.getByRole('button', { name: 'Transfer' }).click()
  await a.getByRole('button', { name: /^Cloud/ }).click()
  await a.getByRole('button', { name: 'Open' }).click()
  await expect(
    a.getByRole('alertdialog', { name: "Replace this device's copy?" }),
  ).toBeVisible()
  await a.getByRole('button', { name: 'Keep both' }).click()
  await expect(
    a.getByRole('heading', { name: 'Project Worksheet' }),
  ).toBeVisible()
  await a.goto('/')
  await expect(card(a, 'Cloudy A')).toBeVisible()
  await expect(card(a, 'Cloudy B (cloud)')).toBeVisible()

  // B gets ahead of the cloud, then thinks better of it.
  await b.reload()
  await expect(card(b, 'Cloudy B')).toContainText('Up to date')
  await rename(b, 'Cloudy B', 'Cloudy oops')
  await expect(card(b, 'Cloudy oops')).toContainText('Newer on this device')
  await menu(b, 'Cloudy oops', 'Discard changes…')
  await b.getByRole('button', { name: 'Discard changes' }).click()
  await expect(card(b, 'Cloudy B')).toContainText('Up to date')
  await expect(card(b, 'Cloudy oops')).toHaveCount(0)

  await contextA.close()
  await contextB.close()
})
