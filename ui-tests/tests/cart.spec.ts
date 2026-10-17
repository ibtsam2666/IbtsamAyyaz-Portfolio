import { test, expect } from '../fixtures/shop';

test.describe('cart', () => {
  test('adding and removing items updates the badge', { tag: '@smoke' }, async ({ signedIn }) => {
    await signedIn.add('Sauce Labs Backpack');
    await signedIn.add('Sauce Labs Bike Light');
    await expect(signedIn.cartBadge).toHaveText('2');

    await signedIn.remove('Sauce Labs Backpack');
    await expect(signedIn.cartBadge).toHaveText('1');

    await signedIn.remove('Sauce Labs Bike Light');
    await expect(signedIn.cartBadge).toBeHidden();
  });

  test('sorting by price low to high orders the list', { tag: '@regression' }, async ({ signedIn }) => {
    await signedIn.sortBy('lohi');
    const prices = await signedIn.prices();
    expect(prices).toEqual([...prices].sort((a, b) => a - b));
  });

  test('sorting by price high to low orders the list', { tag: '@regression' }, async ({ signedIn }) => {
    await signedIn.sortBy('hilo');
    const prices = await signedIn.prices();
    expect(prices).toEqual([...prices].sort((a, b) => b - a));
  });
});
