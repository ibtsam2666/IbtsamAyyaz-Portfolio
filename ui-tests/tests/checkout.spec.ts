import { test, expect } from '../fixtures/shop';
import { CheckoutPage } from '../pages/CheckoutPage';

const TAX_RATE = 0.08; // the demo shop applies 8% tax

test.describe('checkout', () => {
  test('order total equals subtotal plus 8% tax', { tag: ['@smoke', '@money'] }, async ({ signedIn, checkout }) => {
    await signedIn.add('Sauce Labs Backpack'); // $29.99
    await signedIn.add('Sauce Labs Onesie'); // $7.99
    await signedIn.openCart();
    await expect(checkout.cartItems).toHaveCount(2);

    await checkout.start();
    await checkout.fillDetails('Ibtsam', 'Ayyaz', '54000');

    const subtotal = CheckoutPage.money((await checkout.subtotal.textContent()) ?? '');
    const tax = CheckoutPage.money((await checkout.tax.textContent()) ?? '');
    const total = CheckoutPage.money((await checkout.total.textContent()) ?? '');

    // Check the numbers behind the screen, not just that the labels are visible.
    expect(subtotal).toBeCloseTo(29.99 + 7.99, 2);
    expect(tax).toBeCloseTo(Math.round(subtotal * TAX_RATE * 100) / 100, 2);
    expect(total).toBeCloseTo(subtotal + tax, 2);

    await checkout.finish();
  });

  test('checkout requires a postal code', { tag: '@regression' }, async ({ signedIn, checkout }) => {
    await signedIn.add('Sauce Labs Backpack');
    await signedIn.openCart();
    await checkout.start();
    await checkout.fillDetails('Ibtsam', 'Ayyaz', '');
    await expect(checkout.error).toHaveText('Error: Postal Code is required');
  });
});
