import { test, expect } from '@playwright/test'
const URL = 'http://localhost:8765/index.html'
test('refresher card visible, links to /refresher/', async ({ page }) => {
  await page.goto(URL)
  await expect(page.locator('#refresherCard')).toBeVisible()
  await expect(page.locator('#refresherCard')).toHaveAttribute('href', '/refresher/')
  await expect(page.locator('#refresherCard')).toContainText('Parts 1–3 Refresher')
})
test('card is outside #moduleGrid, between grid and tools', async ({ page }) => {
  await page.goto(URL)
  await expect(page.locator('#moduleGrid #refresherCard')).toHaveCount(0)
  expect(await page.evaluate(() => [...document.querySelectorAll('#moduleGrid, #refresherSection, #toolsSection')].map((e) => e.id)))
    .toEqual(['moduleGrid', 'refresherSection', 'toolsSection'])
})
test('module card count is still 5', async ({ page }) => {
  await page.goto(URL); await expect(page.locator('.module-card')).toHaveCount(5)
})
test('unlock behaviour unchanged with {part1:true}; part5 Admin Locked', async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem('llm_course_progress', JSON.stringify({ part1: true })))
  await page.route('**/api/analytics/locks', (r) => r.fulfill({ json: { part5: true } }))
  await page.goto(URL)
  const c = page.locator('.module-card')
  await expect(c.nth(1)).toHaveClass(/(^|\s)unlocked(\s|$)/)
  await expect(c.nth(2)).toHaveClass(/(^|\s)locked(\s|$)/)
  await expect(c.nth(4).locator('.module-badge')).toHaveText('Admin Locked')
})
