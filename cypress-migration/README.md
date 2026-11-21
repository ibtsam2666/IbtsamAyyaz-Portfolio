# Cypress to Playwright: a small worked example

At work I moved a Cypress suite to Playwright in six days, using a migration agent with assertion-level mutation testing as the safety check. That code is under NDA, so this folder shows the same method on one public spec instead.

| File | What it is |
|---|---|
| [`cypress/cart.cy.ts`](cypress/cart.cy.ts) | The "before" spec, written the way many legacy Cypress suites are: login in `beforeEach`, raw selectors, an alias, a `.then()` chain. For reading only: Cypress isn't installed here |
| [`playwright/cart.spec.ts`](playwright/cart.spec.ts) | The "after" spec. It runs in CI with the `ui` project (tags `@migrated`, `@TC-501` to `@TC-503`) |
| [`mutation-output.txt`](mutation-output.txt) | The mutation check on the migrated spec: 5 of 5 mutants killed |

## How the pieces map

| Cypress | Playwright | Why |
|---|---|---|
| Login steps in `beforeEach` | The `signedIn` fixture in [`ui-tests/fixtures/shop.ts`](../ui-tests/fixtures/shop.ts) | One login path shared by every spec; a test asks for a signed-in page instead of repeating the steps |
| `cy.get('[data-test="add-to-cart-…"]').click()` | `signedIn.add('Sauce Labs Backpack')` on the page object | Selectors live in one place; tests read as user actions |
| `.as('badge')` then `cy.get('@badge')` | A plain variable or page-object property (`signedIn.cartBadge`) | Locators are lazy and re-query on every use, so aliases aren't needed |
| `.should('have.text', '2')` | `await expect(locator).toHaveText('2')` | Both retry until a timeout; the Playwright form is awaited explicitly |
| `.should('have.length', 2)` | `toHaveCount(2)` | Same retrying check |
| `.then(($els) => …)` to read prices | `await signedIn.prices()` with `allTextContents()` | Async/await replaces the chain; the parsing lives in the page object |
| `cy.reload()` | `await page.reload()` | Direct equivalent |

Each test keeps its title and checks the same things as the Cypress version, so a reviewer can compare them line by line.

## Why the mutation check

A migration can quietly lose an assertion, for example a `.should()` that became a call nobody awaits, and the test still goes green. So after migrating, each assertion is broken on purpose, one at a time, and the test has to fail:

```bash
npm run mutate -- cypress-migration/playwright/cart.spec.ts
```

Five mutants, five killed ([output](mutation-output.txt)), so every assertion in the migrated spec does real work. A survivor would point at an assertion to fix before the Cypress spec is deleted.
