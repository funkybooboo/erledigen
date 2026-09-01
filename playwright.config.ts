import { defineConfig, devices } from '@playwright/test';

/**
 * Root Playwright config — drives two projects against the same live stack:
 *
 *   - "api":  black-box HTTP tests against the server  (port 4000)
 *   - "e2e":  browser tests against the SvelteKit client (port 3000)
 *
 * Both projects share a single in-memory server instance, so we run with a
 * single worker and serial tests to keep state deterministic. Each test cleans
 * up the resources it creates.
 *
 * `bun run test:e2e`         → runs both projects
 * `bun run test:e2e:api`     → api only
 * `bun run test:e2e:ui`      → e2e only
 */
const CHROMIUM = process.env.PLAYWRIGHT_CHROMIUM ?? '/usr/bin/chromium';

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
        // System chromium avoids needing `playwright install`.
        launchOptions: { executablePath: CHROMIUM },
    },
    projects: [
        {
            name: 'api',
            testDir: './tests/api-tests',
            testMatch: /.*\.spec\.ts$/,
            use: {
                baseURL: 'http://localhost:4000',
                extraHTTPHeaders: { Accept: 'application/json' },
            },
        },
        {
            name: 'e2e',
            testDir: './tests/e2e',
            testMatch: /.*\.spec\.ts$/,
            use: {
                baseURL: 'http://localhost:3000',
                ...devices['Desktop Chrome'],
            },
        },
    ],
    webServer: [
        {
            command: 'bun run --cwd packages/server dev',
            port: 4000,
            // Never reuse a server already on the port: a dev server runs with
            // the persistent sqlite adapter by default, which would leak state
            // across runs. The pretest:e2e* scripts free the port first.
            reuseExistingServer: false,
            timeout: 120_000,
            // Ephemeral storage keeps test runs deterministic — no state
            // leaks between runs from the persistent SQLite file.
            env: { STORAGE_ADAPTER: 'memory' },
        },
        {
            command: 'bun run --cwd packages/client dev',
            port: 3000,
            reuseExistingServer: !process.env.CI,
            timeout: 120_000,
        },
    ],
});