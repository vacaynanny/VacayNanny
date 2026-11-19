import { defineConfig } from '@playwright/test'
import { existsSync } from 'node:fs'

const executablePath =
  process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE ||
  (!process.env.CI && existsSync('/usr/bin/google-chrome')
    ? '/usr/bin/google-chrome'
    : undefined)

export default defineConfig({
  testDir: './tests/e2e',
  reporter: process.env.CI ? [['list'], ['html', { open: 'never' }]] : 'list',
  workers: 1,
  fullyParallel: false,
  use: {
    viewport: { width: 1440, height: 1000 },
    baseURL: 'http://localhost:3101',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    launchOptions: {
      executablePath,
      args: ['--no-sandbox'],
    },
  },
  webServer: {
    command: 'node --import tsx tests/preview-server.ts',
    url: 'http://localhost:3101',
    reuseExistingServer: false,
    timeout: 120000,
  },
})
