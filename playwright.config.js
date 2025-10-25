import { defineConfig } from '@playwright/test'

export default defineConfig({
  testDir: 'tests/e2e',
  retries: process.env.CI ? 2 : 0,
  use: {
    baseURL: 'http://localhost:4173',
    headless: true,
    viewport: { width: 1280, height: 720 }
  },
  webServer: {
    command: 'npx http-server . -p 4173 --silent',
    url: 'http://localhost:4173',
    reuseExistingServer: !process.env.CI,
    stdout: 'pipe',
    stderr: 'pipe'
  }
})
