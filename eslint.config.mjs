import js from '@eslint/js';
import tseslint from 'typescript-eslint';
import playwright from 'eslint-plugin-playwright';
import globals from 'globals';

export default tseslint.config(
  {
    ignores: [
      'node_modules/',
      'test-results/',
      'playwright-report/',
      'blob-report/',
      'lighthouse-report/',
      '.lighthouseci/',
      // The Cypress "before" spec is kept for reading only; Cypress isn't installed.
      'cypress-migration/cypress/',
      // Written by the AI test agent at run time.
      'ai-test-agent/generated/',
    ],
  },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    languageOptions: { globals: { ...globals.node } },
    rules: {
      // Playwright's JSON report and the agent's API replies are untyped at the boundary.
      '@typescript-eslint/no-explicit-any': 'off',
    },
  },
  {
    files: ['ui-tests/**/*.ts', 'api-tests/**/*.ts', 'site-tests/**/*.ts', 'cypress-migration/playwright/**/*.ts', 'mcp-rerun-server/tests/**/*.ts', 'mutation-testing/examples/**/*.ts'],
    ...playwright.configs['flat/recommended'],
    rules: {
      ...playwright.configs['flat/recommended'].rules,
      // Helpers that assert inside: the shared audit() and page-object expect* methods.
      'playwright/expect-expect': ['warn', { assertFunctionNames: ['audit', 'expectLoaded'] }],
      // Conditional skips (e.g. "only on Linux") are fine; unconditional ones are not.
      'playwright/no-skipped-test': ['warn', { allowConditional: true }],
    },
  },
);
