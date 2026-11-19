import { test, expect } from '@playwright/test'
const enquiryId = '88888888-8888-4888-8888-888888888888'
test('private specialist quote hides team notes and reports a changed quote without accepting it', async ({
  page,
}, testInfo) => {
  await page.goto(`/care-enquiries/${enquiryId}?token=${'a'.repeat(64)}`)
  await expect(
    page.getByRole('heading', { name: "We couldn't find that page." }),
  ).toBeVisible()
  const response = await page.goto(`/care-enquiries/${enquiryId}?token=${'d'.repeat(64)}`)
  expect(response?.headers()['referrer-policy']).toBe('no-referrer')
  expect(
    await page
      .locator('.care-enquiry-page h1')
      .evaluate((heading) => heading.getBoundingClientRect().top >= 100),
  ).toBe(true)
  await expect(
    page.getByRole('heading', { name: 'Professional Nursing Care' }),
  ).toBeVisible()
  await expect(page.getByText(/PRIVATE ASSESSMENT|PRIVATE PROVIDER/)).toHaveCount(0)
  await page.route(`**/api/care-enquiries/${enquiryId}`, async (route) => {
    expect(route.request().postDataJSON()).toEqual({ action: 'accept', version: 1 })
    expect(route.request().headers().authorization).toBe(`Bearer ${'d'.repeat(64)}`)
    await route.fulfill({
      status: 409,
      json: { error: 'This quote changed. Please review the latest quote.' },
    })
  })
  await page.getByRole('button', { name: 'Accept this care quote' }).click()
  await expect(
    page.getByRole('alert').filter({ hasText: 'This quote changed' }),
  ).toContainText('This quote changed')
  await page.setViewportSize({ width: 320, height: 740 })
  expect(
    await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth),
  ).toBe(true)
  await page.evaluate(() => scrollTo(0, 0))
  await page.screenshot({
    path: testInfo.outputPath('care-quote-mobile.png'),
    fullPage: true,
  })
})
test('operations exposes follow-ups and sends complete specialist assessment with the current version', async ({
  page,
}, testInfo) => {
  await page.goto('/login')
  await page.getByLabel('Email', { exact: true }).fill('operator@example.test')
  await page.getByLabel('Password', { exact: true }).fill('local-review')
  await page.getByRole('button', { name: 'Sign in', exact: true }).click()
  await expect(page).toHaveURL('/admin')
  const nav = page.getByRole('navigation', { name: 'Operations' })
  await nav.getByRole('button', { name: /Follow-ups/ }).click()
  await expect(page.getByRole('heading', { name: 'Operations follow-ups' })).toBeVisible()
  await expect(page.getByText('Synthetic replacement deadline follow-up.')).toBeVisible()
  await page.getByRole('button', { name: 'Open booking', exact: true }).click()
  await expect(page.getByRole('heading', { name: 'Bookings', exact: true })).toBeVisible()
  await expect(
    page.getByRole('heading', { name: 'Test Family', exact: true }),
  ).toBeVisible()
  await nav.getByRole('button', { name: /Inbox/ }).click()
  await expect(
    page.getByRole('heading', { name: 'Specialist Test Family' }),
  ).toBeVisible()
  const card = page
    .locator('form')
    .filter({ has: page.getByRole('heading', { name: 'Specialist Test Family' }) })
  await card
    .getByLabel('Private assessment notes')
    .fill('Private assessment completed and recorded by the operator.')
  await card
    .getByLabel('Care plan and quote scope shown to the family')
    .fill('Qualified nursing support with agreed care duties and daily hours.')
  const request = page.waitForRequest(`**/api/admin/care-enquiries/${enquiryId}`)
  await page.route(`**/api/admin/care-enquiries/${enquiryId}`, (route) =>
    route.fulfill({
      status: 409,
      json: { error: 'The enquiry changed. Refresh before publishing.' },
    }),
  )
  await card.getByRole('button', { name: 'Publish and send quote' }).click()
  const payload = (await request).postDataJSON()
  expect(payload.version).toBe(1)
  expect(payload.care_status).toBe('quoted')
  expect(payload.assigned_to).toBeTruthy()
  expect(payload.quote_summary).toContain('agreed care duties')
  await expect(card.getByRole('alert')).toContainText('enquiry changed')
  await page.setViewportSize({ width: 320, height: 740 })
  expect(
    await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth),
  ).toBe(true)
  await page.screenshot({
    path: testInfo.outputPath('specialist-ops-mobile.png'),
    fullPage: true,
  })
})
test('a specialist enquiry confirmation provides the private tracking link', async ({
  page,
}) => {
  await page.route('**/api/contact', (route) => {
    expect(route.request().postDataJSON().careService).toBe('Adult & Elderly Care')
    return route.fulfill({
      json: {
        success: true,
        trackingPath: `/care-enquiries/${enquiryId}?token=${'d'.repeat(64)}`,
      },
    })
  })
  await page.goto('/contact?service=Adult%20%26%20Elderly%20Care')
  await page.getByRole('textbox', { name: 'Name', exact: true }).fill('Test Family')
  await page
    .getByRole('textbox', { name: 'Email', exact: true })
    .fill('family@example.test')
  await page
    .getByRole('textbox', { name: 'Message', exact: true })
    .fill('Please assess daytime care support.')
  await page.getByRole('button', { name: 'Send message' }).click()
  await expect(
    page.getByRole('link', { name: 'Track my specialist care enquiry' }),
  ).toHaveAttribute('href', `/care-enquiries/${enquiryId}?token=${'d'.repeat(64)}`)
})

test('verified Auth identity prevents access through a tampered profile email', async ({
  page,
}) => {
  await page.goto('/login')
  await page.getByLabel('Email', { exact: true }).fill('family@example.test')
  await page.getByLabel('Password', { exact: true }).fill('local-review')
  await page.getByRole('button', { name: 'Sign in', exact: true }).click()
  await expect(page).toHaveURL('/account')
  await expect(
    page.getByRole('heading', { name: 'Professional Nursing Care' }),
  ).toBeVisible()
  await expect(page.getByText('OTHER FAMILY PRIVATE CARE PLAN')).toHaveCount(0)
  await page.goto('/care-enquiries/77777777-7777-4777-8777-777777777777')
  await expect(
    page.getByRole('heading', { name: "We couldn't find that page." }),
  ).toBeVisible()
  await expect(page.getByText('OTHER FAMILY PRIVATE CARE PLAN')).toHaveCount(0)
})
