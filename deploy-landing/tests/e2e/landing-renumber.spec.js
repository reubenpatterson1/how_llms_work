import { test, expect } from '@playwright/test'

const URL = 'http://localhost:8765/index.html'

test('renders 7 module cards with correct titles', async ({ page }) => {
  await page.goto(URL)
  await expect(page.locator('.module-card')).toHaveCount(7)
  await expect(page.locator('.module-card').nth(0)).toContainText('How LLMs Actually Work')
  await expect(page.locator('.module-card').nth(1)).toContainText('Working WITH LLMs')
  await expect(page.locator('.module-card').nth(2)).toContainText('Context & Sessions')
  await expect(page.locator('.module-card').nth(3)).toContainText('Building with LLMs')
  await expect(page.locator('.module-card').nth(6)).toContainText('CI/CD with LLMs')
})

test('migrates old progress keys on load', async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.setItem('llm_course_progress', JSON.stringify({
      part1: true, part2: true, part3: true,
    }))
  })
  await page.goto(URL)
  const raw = await page.evaluate(() => localStorage.getItem('llm_course_progress'))
  const after = JSON.parse(raw)
  expect(after.__v).toBe(2)
  expect(after.part4).toBe(true)
  expect(after.part3).toBeUndefined()
})

test('progress label reads X / 7', async ({ page }) => {
  await page.goto(URL)
  await expect(page.locator('#progressLabel')).toContainText('/ 7 modules completed')
})
