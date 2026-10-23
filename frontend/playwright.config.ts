import { defineConfig, devices } from '@playwright/test';

/**
 * Default: starts Vite in explicit fixture mode on port 5174 (isolated from a
 * developer's own dev server) and resets the in-memory data before each test.
 *
 * Against the real stack (Java + Oracle), build the frontend, start Java, then:
 *   TRACE_E2E_BASE_URL=http://127.0.0.1:7000 npx playwright test
 * Tests create their own uniquely named incidents and delete them; they rely
 * only on the seeded employee "Aditi Rao" from database/002_core_seed.sql.
 *
 * Uses an installed browser (Chrome by default; TRACE_E2E_CHANNEL=msedge for Edge),
 * so no separate browser download is needed.
 */
const externalBaseURL = process.env.TRACE_E2E_BASE_URL;
const channel = process.env.TRACE_E2E_CHANNEL ?? 'chrome';

export default defineConfig({
  testDir: './tests',
  fullyParallel: false,
  workers: 1,
  retries: 0,
  reporter: [['list']],
  timeout: 30_000,
  expect: { timeout: 5_000 },
  use: {
    baseURL: externalBaseURL ?? 'http://localhost:5174',
    channel,
    viewport: { width: 1280, height: 860 },
    trace: 'retain-on-failure',
  },
  projects: [{ name: 'desktop', use: { ...devices['Desktop Chrome'], channel, viewport: { width: 1280, height: 860 } } }],
  webServer: externalBaseURL
    ? undefined
    : {
        command: 'npx vite --mode fixtures --port 5174 --strictPort',
        url: 'http://localhost:5174/api/health',
        reuseExistingServer: false,
        timeout: 60_000,
      },
});
