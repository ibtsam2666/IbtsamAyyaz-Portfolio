import { test, expect } from '../../ui-tests/fixtures/shop';

test.describe('cart badge', () => {
  test('[AC1] adding a product increases the badge by one', async ({ signedIn }) => {
    await signedIn.add('Sauce Labs Backpack');
    await expect(signedIn.cartBadge).toHaveText('1');
    await signedIn.add('Sauce Labs Bolt T-Shirt');
    await expect(signedIn.cartBadge).toHaveText('2');
  });

  test('[AC2] removing a product decreases the badge by one', async ({ signedIn }) => {
    await signedIn.add('Sauce Labs Backpack');
    await signedIn.add('Sauce Labs Bike Light');
    await expect(signedIn.cartBadge).toHaveText('2');
    await signedIn.remove('Sauce Labs Bike Light');
    await expect(signedIn.cartBadge).toHaveText('1');
  });

  test('[AC3] no badge when the cart is empty', async ({ signedIn }) => {
    await expect(signedIn.cartBadge).toHaveCount(0);
    await signedIn.add('Sauce Labs Onesie');
    await signedIn.remove('Sauce Labs Onesie');
    await expect(signedIn.cartBadge).toHaveCount(0);
  });

  test('[AC4] badge count matches the cart page', async ({ signedIn, page }) => {
    await signedIn.add('Sauce Labs Backpack');
    await signedIn.add('Sauce Labs Fleece Jacket');
    await signedIn.add('Sauce Labs Onesie');
    await expect(signedIn.cartBadge).toHaveText('3');
    await signedIn.openCart();
    await expect(page.getByTestId('inventory-item')).toHaveCount(3);
  });

  test('[AC5] count survives a reload', async ({ signedIn, page }) => {
    await signedIn.add('Sauce Labs Backpack');
    await signedIn.add('Sauce Labs Bike Light');
    await page.reload();
    await expect(signedIn.cartBadge).toHaveText('2');
  });
});
