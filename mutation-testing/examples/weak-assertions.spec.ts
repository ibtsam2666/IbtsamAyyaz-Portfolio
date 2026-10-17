import { test, expect } from '../../ui-tests/fixtures/shop';

// A deliberately flawed spec for the mutation demo.
// The total check sits inside a branch that never runs with one item in the cart, so the
// test is green even if that assertion is wrong: its mutant SURVIVES and exposes a dead
// assertion. The item-count check always runs, so its mutant is KILLED.
test('order summary for a single item', async ({ signedIn, checkout }) => {
  await signedIn.add('Sauce Labs Backpack');
  await signedIn.openCart();
  await checkout.start();
  await checkout.fillDetails('Ibtsam', 'Ayyaz', '54000');

  await expect(checkout.cartItems).toHaveCount(1);
  if ((await checkout.cartItems.count()) > 1) {
    await expect(checkout.total).toHaveText('Total: $32.39');
  }
});
