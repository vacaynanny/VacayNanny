import { expect, test, type Page } from '@playwright/test'

const screens = [
  { width: 320, height: 844 },
  { width: 390, height: 844 },
  { width: 768, height: 1024 },
  { width: 1024, height: 768 },
  { width: 1440, height: 1000 },
  { width: 2560, height: 1440 },
]
const publicRoutes = [
  '/',
  '/nannies',
  '/nannies/test-nanny',
  '/about',
  '/contact',
  '/become-a-nanny',
  '/login',
  '/signup',
  '/forgot-password',
  '/reset-password',
  '/waitlist',
  '/privacy',
  '/terms',
  '/cookies',
  '/payments/return',
  '/not-a-real-page',
  `/booking/11111111-1111-4111-8111-111111111111?token=${'a'.repeat(64)}`,
]

/** Inspect descendants too: body overflow:hidden can conceal a broken layout. */
async function expectLayoutToFit(page: Page, label: string) {
  const issues = await page.evaluate(() => {
    const problems: string[] = []
    if (document.documentElement.scrollWidth > innerWidth + 1)
      problems.push('Document has horizontal overflow')
    for (const element of document.querySelectorAll('body *')) {
      if (
        !(element instanceof HTMLElement) ||
        element.closest('nextjs-portal, .skip-link')
      )
        continue
      const box = element.getBoundingClientRect()
      if (!box.width || !box.height || getComputedStyle(element).visibility === 'hidden')
        continue
      if (
        element.matches('h1, h2, h3, h4, h5, h6') &&
        element.scrollWidth > element.clientWidth + 3
      ) {
        problems.push(`Clipped heading: ${element.textContent?.trim()}`)
      }
      let inScrollableRegion = false
      for (
        let parent = element.parentElement;
        parent && parent !== document.body;
        parent = parent.parentElement
      ) {
        if (
          /auto|scroll/.test(getComputedStyle(parent).overflowX) &&
          parent.scrollWidth > parent.clientWidth
        ) {
          inScrollableRegion = true
          break
        }
      }
      if (!inScrollableRegion && (box.left < -2 || box.right > innerWidth + 2)) {
        problems.push(
          `${element.tagName}.${element.className}: ${Math.round(box.left)}…${Math.round(box.right)}`,
        )
      }
    }
    return problems.slice(0, 12)
  })
  expect(issues, label).toEqual([])
}

async function signIn(page: Page, account: 'operator' | 'family' | 'nanny') {
  await page.goto('/login')
  await page.getByLabel('Email', { exact: true }).fill(`${account}@example.test`)
  await page.getByLabel('Password', { exact: true }).fill('local-review')
  await page.getByRole('button', { name: 'Sign in', exact: true }).click()
  await expect(page).toHaveURL(
    account === 'operator' ? '/admin' : account === 'nanny' ? '/nanny' : '/account',
  )
}

test.beforeEach(async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' })
})

for (const screen of screens) {
  test(`public pages fit ${screen.width}px screens`, async ({ page }) => {
    test.setTimeout(60000)
    await page.setViewportSize(screen)
    for (const route of publicRoutes) {
      await page.goto(route)
      await expect(page.getByRole('heading', { level: 1 }).first()).toBeVisible()
      await expectLayoutToFit(page, `${route} at ${screen.width}px`)
    }
  })

  test(`all operations panels and application review fit ${screen.width}px screens`, async ({
    page,
  }) => {
    test.setTimeout(60000)
    await page.setViewportSize(screen)
    await signIn(page, 'operator')
    const navigation = page.getByRole('navigation', { name: 'Operations' })
    for (const panel of [
      'Overview',
      'Follow-ups',
      'Applications',
      'Bookings',
      'Nannies',
      'Payments',
      'Reviews',
      'Inbox',
      'Destinations',
      'Pricing',
      'Content',
      'Accounts',
    ]) {
      await navigation.getByRole('button', { name: new RegExp(`^${panel}`) }).click()
      await expectLayoutToFit(page, `${panel} at ${screen.width}px`)
    }
    await page.goto('/admin/applications/66666666-6666-4666-8666-666666666666')
    await expect(
      page.getByRole('heading', { name: 'Test Applicant', exact: true }),
    ).toBeVisible()
    await expectLayoutToFit(page, `Application review at ${screen.width}px`)
  })
}

for (const screen of [screens[0], screens[2], screens[4]]) {
  test(`family bookings and nanny workspace fit ${screen.width}px screens`, async ({
    browser,
  }) => {
    test.setTimeout(60000)
    for (const account of ['family', 'nanny'] as const) {
      const context = await browser.newContext({
        viewport: screen,
        reducedMotion: 'reduce',
        baseURL: 'http://localhost:3101',
      })
      const page = await context.newPage()
      await signIn(page, account)
      await expectLayoutToFit(page, `${account} dashboard at ${screen.width}px`)
      if (account === 'family') {
        await expect(page.getByRole('heading', { name: 'Your trips' })).toBeVisible()
        await expect(
          page.getByText('Secure checkout by Paystack', { exact: true }),
        ).toBeVisible()
      } else {
        await expect(
          page.getByRole('heading', { name: 'Public profile', exact: true }),
        ).toBeVisible()
        await page.goto('/nanny/safeguarding')
        for (let lesson = 0; lesson < 4; lesson++) {
          await page
            .getByRole('button', {
              name: lesson === 3 ? 'Start quiz' : 'Next',
              exact: true,
            })
            .click()
        }
        await expect(page.getByRole('button', { name: 'Submit quiz' })).toBeVisible()
        await expectLayoutToFit(page, `Safeguarding quiz at ${screen.width}px`)
      }
      await context.close()
    }
  })
}

test('sign-in background covers the page and keeps the form usable on desktop and touch screens', async ({
  page,
  browser,
}, testInfo) => {
  await page.goto('/login')
  await expect(page.getByText('AI-generated coastal scene', { exact: true })).toHaveCount(
    0,
  )
  const image = page.locator('.auth-background-image')
  await image.evaluate((element) => (element as HTMLImageElement).decode())
  const visual = await page.locator('.auth-backdrop').boundingBox()
  const email = await page.getByLabel('Email', { exact: true }).boundingBox()
  expect(visual!.width).toBe(page.viewportSize()!.width)
  expect(email!.x).toBeGreaterThan(page.viewportSize()!.width / 2)
  expect(visual!.y + visual!.height).toBeGreaterThan(email!.y)
  await page.getByRole('button', { name: 'Show password' }).click()
  await expect(page.getByLabel('Password', { exact: true })).toHaveAttribute(
    'type',
    'text',
  )
  await page.screenshot({
    path: testInfo.outputPath('login-desktop.png'),
    caret: 'initial',
  })
  const context = await browser.newContext({
    viewport: { width: 390, height: 844 },
    isMobile: true,
    hasTouch: true,
    baseURL: 'http://localhost:3101',
  })
  const mobile = await context.newPage()
  await mobile.goto('/login')
  const mobileImage = await mobile.locator('.auth-backdrop').boundingBox()
  const mobileEmail = await mobile.getByLabel('Email', { exact: true }).boundingBox()
  expect(mobileImage!.width).toBe(390)
  expect(mobileImage!.y).toBeLessThan(mobileEmail!.y)
  expect(mobileImage!.y + mobileImage!.height).toBeGreaterThan(mobileEmail!.y)
  await expectLayoutToFit(mobile, 'Touch sign-in')
  await mobile.setViewportSize({ width: 390, height: 400 })
  await mobile.getByLabel('Password', { exact: true }).focus()
  await mobile
    .getByRole('button', { name: 'Sign in', exact: true })
    .scrollIntoViewIfNeeded()
  await expect(
    mobile.getByRole('button', { name: 'Sign in', exact: true }),
  ).toBeInViewport()
  await context.close()
})

test('menus, booking dialog and support stay reachable on a small landscape screen', async ({
  page,
}) => {
  await page.setViewportSize({ width: 844, height: 390 })
  await page.goto('/')
  await page.getByRole('button', { name: 'Menu', exact: true }).click()
  await page
    .getByRole('navigation')
    .getByRole('link', { name: 'Sign in', exact: true })
    .scrollIntoViewIfNeeded()
  await expect(
    page.getByRole('navigation').getByRole('link', { name: 'Sign in', exact: true }),
  ).toBeInViewport()
  await page.getByRole('button', { name: 'Menu', exact: true }).click()
  await page.getByRole('button', { name: 'Start a booking' }).first().click()
  const dialog = page.getByRole('dialog', { name: 'Request a nanny' })
  await expectLayoutToFit(page, 'Landscape booking dialog')
  await dialog.getByRole('button', { name: 'Request My Nanny' }).scrollIntoViewIfNeeded()
  await expect(dialog.getByRole('button', { name: 'Request My Nanny' })).toBeInViewport()
  await page.keyboard.press('Escape')
  await page.getByRole('button', { name: 'WhatsApp support' }).click()
  await expectLayoutToFit(page, 'Open support panel')
})

for (const screen of [screens[0], screens[2], screens[3], screens[4]]) {
  test(`all application steps reflow at ${screen.width}px`, async ({ page }) => {
    test.setTimeout(60000)
    await page.setViewportSize(screen)
    await page.goto('/become-a-nanny')
    for (let step = 0; step < 8; step++) {
      await page.evaluate((current) => {
        sessionStorage.setItem(
          'vn_nanny_form',
          JSON.stringify({
            firstName: 'Test',
            lastName: 'Applicant',
            dob: '1990-01-01',
            gender: 'Female',
            phone: '712345678',
            email: 'applicant.with.a.long.address.for.layout.review@example.test',
            county: 'Kwale',
            town: 'Diani',
            step: current,
          }),
        )
      }, step)
      await page.reload()
      await expect(page.locator('.step-header .step-num')).toHaveText(
        `Step ${step + 1} of 8`,
      )
      await expectLayoutToFit(page, `Application step ${step + 1} at ${screen.width}px`)
    }
  })
}
