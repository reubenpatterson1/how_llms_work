import { test, expect } from '@playwright/test'

const URL = 'http://localhost:8765/index.html'

test('renders 5 module cards with correct titles', async ({ page }) => {
  await page.goto(URL)
  await expect(page.locator('.module-card')).toHaveCount(5)
  await expect(page.locator('.module-card').nth(0)).toContainText('How LLMs Actually Work')
  await expect(page.locator('.module-card').nth(1)).toContainText('Working WITH LLMs')
  await expect(page.locator('.module-card').nth(2)).toContainText('Context & Sessions')
  await expect(page.locator('.module-card').nth(3)).toContainText('How to Build/Deploy with LLMs')
  await expect(page.locator('.module-card').nth(4)).toContainText('Testing & CI/CD with LLMs')
})

test('unlocks next module when previous is marked complete', async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.setItem('llm_course_progress', JSON.stringify({
      part1: true,
    }))
  })
  await page.goto(URL)
  const part2 = page.locator('.module-card').nth(1)
  // part2 should be unlocked (clickable) since part1 is marked as complete
  await expect(part2).toHaveClass(/unlocked/)
  await expect(part2).toHaveAttribute('href', '/part2/')
})

test('progress label reads X / 5', async ({ page }) => {
  await page.goto(URL)
  await expect(page.locator('#progressLabel')).toContainText('/ 5 modules completed')
})
