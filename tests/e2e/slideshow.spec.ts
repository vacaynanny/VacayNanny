import { expect, test, type Page } from '@playwright/test'

async function openSlideshow(page: Page, route: string, label: string) {
  await page.goto(route)
  const show = page.getByRole('group', { name: label })
  await show.scrollIntoViewIfNeeded()
  await expect(show.locator('img')).toHaveCount(3)
  await show.locator('img').evaluateAll(images => Promise.all(images.map(image => (image as HTMLImageElement).decode())))
  await page.clock.runFor(150)
  return show
}

test('three page-specific photos crossfade, loop and support pausing without navigation controls', async ({ page }) => {
  test.setTimeout(60000)
  await page.emulateMedia({ reducedMotion: 'no-preference' })
  await page.clock.install()
  for (const [route, label] of [['/', 'Family holiday moments'], ['/become-a-nanny', 'Everyday childcare moments']]) {
    const show = await openSlideshow(page, route, label)
    await expect(show).toHaveAttribute('data-playing', 'true')
    const photos = show.locator('img')
    const layer = (index: number) => photos.nth(index).locator('..')
    await expect(layer(0)).toHaveCSS('opacity', '1')
    await expect(show.getByRole('button')).toHaveCount(1)
    await expect(show.getByRole('button', { name: /next|previous|skip/i })).toHaveCount(0)
    for (const index of [1, 2, 0]) {
      await page.clock.fastForward(7000)
      await expect(layer(index)).toHaveCSS('opacity', '1')
      for (let other = 0; other < 3; other++) {
        if (other !== index) await expect(layer(other)).toHaveCSS('opacity', '0')
      }
    }
    await show.getByRole('button', { name: 'Pause image slideshow' }).click()
    await expect(show.getByRole('button', { name: 'Resume image slideshow' })).toBeVisible()
    await page.clock.fastForward(21000)
    await expect(layer(0)).toHaveCSS('opacity', '1')
    await show.getByRole('button', { name: 'Resume image slideshow' }).click()
    await page.clock.fastForward(7000)
    await expect(layer(1)).toHaveCSS('opacity', '1')
  }
})

test('reduced motion stays still and off-screen slideshows wait until visible again', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await page.clock.install()
  const show = await openSlideshow(page, '/', 'Family holiday moments')
  const photos = show.locator('img')
  await expect(show.getByRole('button')).toHaveCount(0)
  await page.clock.fastForward(28000)
  await expect(photos.nth(0).locator('..')).toHaveCSS('opacity', '1')
  await expect(photos.nth(1).locator('..')).toHaveCSS('opacity', '0')
  await page.emulateMedia({ reducedMotion: 'no-preference' })
  await expect(show.getByRole('button', { name: 'Pause image slideshow' })).toBeVisible()
  await page.evaluate(() => window.scrollTo({ top: document.body.scrollHeight, behavior: 'instant' }))
  await page.clock.runFor(250)
  await expect(show).not.toBeInViewport()
  await expect(show).toHaveAttribute('data-playing', 'false')
  await page.clock.fastForward(21000)
  await expect(photos.nth(0).locator('..')).toHaveCSS('opacity', '1')
  await show.scrollIntoViewIfNeeded()
  await expect(show).toBeInViewport()
  await expect(show).toHaveAttribute('data-playing', 'true')
  await page.clock.runFor(250)
  await page.clock.fastForward(7000)
  await expect(photos.nth(1).locator('..')).toHaveCSS('opacity', '1')
})

test('an unavailable photo is skipped without fading to a blank frame', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'no-preference' })
  await page.clock.install()
  await page.route(url => url.pathname === '/_next/image' && url.searchParams.get('url') === '/images/slides/family-garden.webp', route => route.abort())
  await page.goto('/')
  const show = page.getByRole('group', { name: 'Family holiday moments' })
  const photos = show.locator('img')
  await photos.nth(0).evaluate(image => (image as HTMLImageElement).decode())
  await photos.nth(2).evaluate(image => (image as HTMLImageElement).decode())
  await page.clock.runFor(250)
  await page.clock.fastForward(7000)
  await expect(photos.nth(2).locator('..')).toHaveCSS('opacity', '1')
  await expect(photos.nth(1).locator('..')).toHaveCSS('opacity', '0')
})
