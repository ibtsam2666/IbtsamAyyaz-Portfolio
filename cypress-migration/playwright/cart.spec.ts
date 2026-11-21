import { test, expect } from '../../ui-tests/fixtures/shop';

// The "after" spec: ../cypress/cart.cy.ts migrated to Playwright. Each test keeps its title and
// checks the same things; the login moves into the signedIn fixture and selectors into the page
// object. See ../README.md for the mapping and the mutation result.
test.describe('cart (migrated from Cypress)', () => {
  test('adds two items and shows them in the cart', { tag: ['@migrated', '@TC-501'] }, async ({ signedIn, page }) => {
    await signedIn.add('Sauce Labs Backpack');
    await signedIn.add('Sauce Labs Bike Light');
    await expect(signedIn.cartBadge).toHaveText('2');
    await signedIn.openCart();
    await expect(page.getByTestId('inventory-item')).toHaveCount(2);
    await expect(page.getByTestId('inventory-item-name').first()).toHaveText('Sauce Labs Backpack');
  });

  test('sorts prices from high to low', { tag: ['@migrated', '@TC-502'] }, async ({ signedIn }) => {
    await signedIn.sortBy('hilo');
    const prices = await signedIn.prices();
    expect(prices).toEqual([...prices].sort((a, b) => b - a));
  });

  test('keeps the cart after a reload', { tag: ['@migrated', '@TC-503'] }, async ({ signedIn, page }) => {
    await signedIn.add('Sauce Labs Onesie');
    await page.reload();
    await expect(signedIn.cartBadge).toHaveText('1');
  });
});
