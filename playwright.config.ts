import { defineConfig, devices } from '@playwright/test';

const isCI = !!process.env.CI;
const SITE_PORT = 4179;

export default defineConfig({
  fullyParallel: true,
  forbidOnly: isCI,
  // Retries surface flaky tests in the report instead of hiding them: a test that
  // passes only on retry is marked "flaky" so it can be fixed.
  retries: isCI ? 1 : 0,
  workers: isCI ? 4 : undefined,
  reporter: [['list'], ['html', { open: 'never' }], ['json', { outputFile: 'test-results/results.json' }]],
  use: {
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
  projects: [
    {
      name: 'ui',
      testDir: '.',
      testMatch: [
        'ui-tests/tests/**/*.spec.ts',
        'cypress-migration/playwright/**/*.spec.ts',
        'mutation-testing/examples/**/*.spec.ts',
        '**/__mutant__.*.spec.ts',
        'ai-test-agent/generated/**/*.spec.ts',
      ],
      use: { ...devices['Desktop Chrome'], baseURL: 'https://www.saucedemo.com', testIdAttribute: 'data-test' },
    },
    {
      // Cross-browser smoke: the @smoke UI tests again in Firefox and WebKit (Safari's engine).
      name: 'firefox',
      testDir: './ui-tests/tests',
      grep: /@smoke/,
      use: { ...devices['Desktop Firefox'], baseURL: 'https://www.saucedemo.com', testIdAttribute: 'data-test' },
    },
    {
      name: 'webkit',
      testDir: './ui-tests/tests',
      grep: /@smoke/,
      use: { ...devices['Desktop Safari'], baseURL: 'https://www.saucedemo.com', testIdAttribute: 'data-test' },
    },
    {
      name: 'api',
      testDir: './api-tests/tests',
      use: { baseURL: 'https://restful-booker.herokuapp.com', extraHTTPHeaders: { Accept: 'application/json' } },
    },
    {
      // Unit tests for the MCP server's report parser and path guard (no browser).
      name: 'unit',
      testDir: './mcp-rerun-server/tests',
    },
    {
      // The portfolio site itself, served locally: accessibility and page basics.
      name: 'site',
      testDir: './site-tests',
      use: { ...devices['Desktop Chrome'], baseURL: `http://127.0.0.1:${SITE_PORT}` },
    },
  ],
  webServer: {
    command: `node scripts/serve.mjs ${SITE_PORT}`,
    url: `http://127.0.0.1:${SITE_PORT}/`,
    reuseExistingServer: !isCI,
    stdout: 'ignore',
  },
});
