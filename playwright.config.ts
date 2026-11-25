import { defineConfig, devices } from '@playwright/test'

const baseURL = process.env.E2E_ADMIN_URL || 'http://127.0.0.1:9121'
const apiBaseURL = process.env.E2E_API_BASE_URL || 'http://127.0.0.1:9029/api/v1'

export default defineConfig({
  testDir: './e2e',
  fullyParallel: false,
  workers: 1,
  retries: process.env.CI ? 1 : 0,
  timeout: 30_000,
  expect: { timeout: 10_000 },
  reporter: [['list'], ['html', { open: 'never' }]],
  use: {
    baseURL,
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    locale: 'zh-CN',
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
  webServer: process.env.E2E_ADMIN_URL
    ? undefined
    : {
        command: 'npm run dev -- --host 127.0.0.1 --port 9121 --strictPort',
        url: baseURL,
        reuseExistingServer: false,
        timeout: 60_000,
        env: {
          ...process.env,
          VITE_API_BASE_URL: apiBaseURL,
        },
      },
})
