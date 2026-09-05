import { defineConfig, devices } from '@playwright/test';

/**
 * Root Playwright config -- drives two projects against the same live stack:
 *
 *   - "api":  black-box HTTP tests against the server  (port 4000)
 *   - "e2e":  browser tests against the SvelteKit client (port 3000)
 *
 * Both projects share a single in-memory server instance, so we run with a
 * single worker and serial tests to keep state deterministic. Each test cleans
 * up the resources it creates.
 *
 * `bun run test:e2e`         -> runs both projects
 * `bun run test:e2e:api`     -> api only
 * `bun run test:e2e:ui`      -> e2e only
 */
const CHROMIUM = process.env.PLAYWRIGHT_CHROMIUM ?? '/usr/bin/chromium';
const BUNDLED_CHROMIUM = process.env.PLAYWRIGHT_USE_BUNDLED_CHROMIUM === '1';
const API_BASE_URL = process.env.PLAYWRIGHT_API_BASE_URL ?? 'http://localhost:4000';
const E2E_BASE_URL = process.env.PLAYWRIGHT_E2E_BASE_URL ?? 'http://localhost:3000';
const NO_SERVER = process.env.PLAYWRIGHT_NO_SERVER === '1';

export default defineConfig({
    testDir: './tests',
    fullyParallel: false,
    workers: 1,
    forbidOnly: !!process.env.CI,
    retries: process.env.CI ? 1 : 0,
    timeout: 60_000,
    expect: { timeout: 15_000 },
    reporter: [['list']],
    use: {
        trace: 'on-first-retry',
        // System chromium avoids needing `playwright install` locally. In the
        // Docker test image (mcr.microsoft.com/playwright) the bundled
        // Chromium is used instead: PLAYWRIGHT_USE_BUNDLED_CHROMIUM=1.
        ...(BUNDLED_CHROMIUM ? {} : { launchOptions: { executablePath: CHROMIUM } }),
    },
    projects: [
        {
            name: 'api',
            testDir: './tests/api-tests',
            testMatch: /.*\.spec\.ts$/,
            use: {
                baseURL: API_BASE_URL,
                extraHTTPHeaders: { Accept: 'application/json' },
            },
        },
        {
            name: 'e2e',
            testDir: './tests/e2e',
            testMatch: /.*\.spec\.ts$/,
            use: {
                baseURL: E2E_BASE_URL,
                ...devices['Desktop Chrome'],
            },
        },
    ],
    // PLAYWRIGHT_NO_SERVER=1 (docker: servers are separate compose services)
    // skips spawning web servers entirely. The env-driven URLs above let the
    // same config drive both local runs and the dockerized test stack.
    ...(NO_SERVER
        ? {}
        : {
              webServer: [
                  {
                      command: 'bun run --cwd packages/server dev',
                      port: 4000,
                      // Never reuse a server already on the port: a dev server runs with
                      // the persistent sqlite adapter by default, which would leak state
                      // across runs. The pretest:e2e* scripts free the port first.
                      reuseExistingServer: false,
                      timeout: 120_000,
                      // Ephemeral storage keeps test runs deterministic -- no state
                      // leaks between runs from the persistent SQLite file.
                      // The whole suite is one trusted client; the default
                      // 600 rpm limiter would 429 the habits cleanup bursts
                      // (each test deletes ~90 generated instances) and
                      // fail later tests with phantom "missing" entities.
                      // The job runner polls every JOB_POLL_INTERVAL_MS; the
                      // huge interval keeps the boot-time rollover catch-up
                      // from firing mid-suite and moving the past-date tasks
                      // the specs seed (v0.8.0 automation).
                      env: {
                          STORAGE_ADAPTER: 'memory',
                          RATE_LIMIT_RPM: '10000',
                          JOB_POLL_INTERVAL_MS: '3600000',
                      },
                  },
                  {
                      command: 'bun run --cwd packages/client dev',
                      port: 3000,
                      reuseExistingServer: !process.env.CI,
                      timeout: 120_000,
                  },
              ],
          }),
});