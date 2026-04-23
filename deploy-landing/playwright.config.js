import { defineConfig } from '@playwright/test'

export default defineConfig({
  testDir: './tests/e2e',
  use: { browserName: 'chromium', headless: true },
  webServer: {
    command: 'python3 -m http.server 8765 --directory .',
    port: 8765,
    reuseExistingServer: true,
  },
})
