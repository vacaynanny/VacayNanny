import { test, expect } from '@playwright/test'

test('public discovery and specialist quote preserve the selected service', async ({
  page,
}, testInfo) => {
  const errors: string[] = []
  page.on('pageerror', (e) => errors.push(e.message))
  await page.goto('/')
  await expect(page.getByRole('heading', { level: 1 })).toContainText(
    'A holiday that feels',
  )
  await expect(
    page.getByRole('link', { name: /Request a specialist care quote/ }),
  ).toHaveCount(3)
  await expect(page.getByText(/Tier 0[123]/)).toHaveCount(0)
  await expect(page.getByText('New to our community')).toBeVisible()
  await page.screenshot({ path: testInfo.outputPath('public-desktop.png') })
  await page
    .getByRole('link', { name: /Request a specialist care quote/ })
    .nth(1)
    .click()
  await expect(page.getByRole('textbox', { name: 'Subject' })).toHaveValue(
    'Specialist care quote: Adult & Elderly Care',
  )
  expect(errors).toEqual([])
})

test('booking modal has labels, traps focus, and restores focus on Escape', async ({
  page,
}) => {
  await page.goto('/')
  const opener = page.getByRole('button', { name: 'Start a booking' }).first()
  await opener.click()
  const dialog = page.getByRole('dialog', { name: 'Request a nanny' })
  await expect(dialog).toBeVisible()
  await expect(dialog.getByLabel('Full Name')).toBeVisible()
  await dialog.getByRole('button', { name: 'Request My Nanny' }).focus()
  await page.keyboard.press('Tab')
  await expect(dialog.getByRole('button', { name: 'Close booking form' })).toBeFocused()
  await page.keyboard.press('Escape')
  await expect(dialog).toHaveCount(0)
  await expect(opener).toBeFocused()
})

test('successful guest request offers tracking and optional registration', async ({
  page,
}) => {
  await page.route('**/api/booking', (route) =>
    route.fulfill({
      json: {
        success: true,
        trackingPath: `/booking/11111111-1111-4111-8111-111111111111?token=${'a'.repeat(64)}`,
      },
    }),
  )
  await page.goto('/')
  await page.getByRole('button', { name: 'Start a booking' }).first().click()
  const dialog = page.getByRole('dialog')
  await dialog.getByLabel('Full Name').fill('Test Family')
  await dialog.getByLabel('Email', { exact: true }).fill('family@example.test')
  await dialog.getByLabel('Phone / WhatsApp').fill('+254700000000')
  await dialog.getByLabel('Destination', { exact: true }).selectOption('Diani')
  await dialog.getByLabel('Check-in Date').fill('2027-04-10')
  await dialog.getByLabel('Check-out Date').fill('2027-04-12')
  await dialog.getByLabel('Number of Children').selectOption('2')
  await dialog.getByRole('button', { name: 'Request My Nanny' }).click()
  await expect(dialog.getByRole('link', { name: 'Continue as a guest' })).toBeVisible()
  await expect(
    dialog.getByRole('link', {
      name: 'Create an account to track your booking',
    }),
  ).toBeVisible()
})

test('mobile navigation and key pages have no horizontal overflow', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 })
  await page.goto('/')
  await page.getByRole('button', { name: 'Menu', exact: true }).click()
  await expect(
    page.getByRole('navigation').getByRole('link', { name: 'For families', exact: true }),
  ).toBeVisible()
  await page.getByRole('button', { name: 'Menu', exact: true }).click()
  for (const route of ['/', '/nannies', '/contact', '/become-a-nanny', '/login']) {
    await page.goto(route)
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= window.innerWidth,
      ),
      route,
    ).toBe(true)
  }
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await page.goto('/')
  await expect(page.getByRole('heading', { level: 1 })).toBeVisible()
})

test('operations stays protected and works through the normal authenticated route', async ({
  page,
}, testInfo) => {
  await page.goto('/admin')
  await expect(page).toHaveURL(/\/login/)
  await page.getByLabel('Email', { exact: true }).fill('operator@example.test')
  await page.getByLabel('Password', { exact: true }).fill('local-review')
  await page.getByRole('button', { name: 'Sign in', exact: true }).click()
  await expect(page).toHaveURL('/admin')
  await expect(page.getByRole('heading', { name: 'Overview', exact: true })).toBeVisible()
  await page
    .locator('.ops-content')
    .evaluate((element) =>
      Promise.all(element.getAnimations().map((animation) => animation.finished)),
    )
  await page.screenshot({ path: testInfo.outputPath('admin-desktop.png') })
  const nav = page.getByRole('navigation', { name: 'Operations' })
  await nav.getByRole('button', { name: /Bookings/ }).click()
  await expect(page.getByRole('heading', { name: 'Bookings', exact: true })).toBeVisible()
  await expect(
    page.getByRole('heading', { name: 'Test Family', exact: true }),
  ).toBeVisible()
  await nav.getByRole('button', { name: /Payments/ }).click()
  await expect(
    page.getByRole('heading', { name: 'Payments through Paystack' }),
  ).toBeVisible()
  await page.setViewportSize({ width: 390, height: 844 })
  expect(
    await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth),
  ).toBe(true)
  await page.screenshot({
    path: 'test-results/admin-mobile.png',
    fullPage: true,
  })
  await page.setViewportSize({ width: 1440, height: 1000 })
  await nav.getByRole('button', { name: /Overview/ }).click()
  await page
    .locator('.ops-content')
    .evaluate((element) =>
      Promise.all(element.getAnimations().map((animation) => animation.finished)),
    )
  await page.screenshot({
    path: 'test-results/admin-desktop.png',
    fullPage: true,
  })
})

test('guest booking requires its secure token and exposes payment only after acceptance', async ({
  page,
}) => {
  const id = '11111111-1111-4111-8111-111111111111'
  await page.goto(`/booking/${id}?token=${'b'.repeat(64)}`)
  // Streaming responses may already have sent 200 before Next renders notFound.
  await expect(
    page.getByRole('heading', { name: "We couldn't find that page." }),
  ).toBeVisible()
  await expect(page.getByText('Test Family')).toHaveCount(0)
  const response = await page.goto(`/booking/${id}?token=${'a'.repeat(64)}`)
  expect(response?.headers()['referrer-policy']).toBe('no-referrer')
  await expect(page.getByRole('button', { name: 'Pay KES 4,400' })).toBeVisible()
  await page.getByRole('button', { name: 'Pay KES 4,400' }).click()
  await expect(
    page.getByRole('region', { name: 'Booking payment' }).getByRole('alert'),
  ).toContainText('payments are being set up')
})

test('operational endpoints stay private and local review stays outside search indexing', async ({
  request,
  page,
}) => {
  const health = await request.get('/api/health')
  expect(health.status()).toBe(200)
  expect(await health.json()).toEqual({ service: 'vacaynanny', status: 'ok' })
  expect(health.headers()['cache-control']).toBe('no-store')
  const cron = await request.get('/api/cron/bookings?secret=fixture-secret')
  expect(cron.status()).toBe(401)
  const webhook = await request.post('/api/payments/webhook', {
    data: { event: 'charge.success' },
  })
  expect(webhook.status()).toBe(503)
  expect(await (await request.get('/robots.txt')).text()).toContain('Disallow: /')
  const sitemap = await (await request.get('/sitemap.xml')).text()
  expect(sitemap).toContain('/contact')
  expect(sitemap).not.toMatch(/\/admin|\/booking\/|\/payments\//)
  await page.goto('/this-page-does-not-exist')
  await expect(
    page.getByRole('heading', { name: "We couldn't find that page." }),
  ).toBeVisible()
  await page.getByRole('link', { name: 'Back to VacayNanny' }).click()
  await expect(page).toHaveURL('/')
})
