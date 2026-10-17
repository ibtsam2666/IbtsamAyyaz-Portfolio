import { expect, type Locator, type Page } from '@playwright/test';

export class CheckoutPage {
  readonly cartItems: Locator;
  readonly subtotal: Locator;
  readonly tax: Locator;
  readonly total: Locator;
  readonly complete: Locator;
  readonly error: Locator;

  constructor(private readonly page: Page) {
    this.cartItems = page.getByTestId('inventory-item');
    this.subtotal = page.getByTestId('subtotal-label');
    this.tax = page.getByTestId('tax-label');
    this.total = page.getByTestId('total-label');
    this.complete = page.getByTestId('complete-header');
    this.error = page.getByTestId('error');
  }

  async start() {
    await this.page.getByTestId('checkout').click();
  }

  async fillDetails(first: string, last: string, zip: string) {
    await this.page.getByTestId('firstName').fill(first);
    await this.page.getByTestId('lastName').fill(last);
    await this.page.getByTestId('postalCode').fill(zip);
    await this.page.getByTestId('continue').click();
  }

  async finish() {
    await this.page.getByTestId('finish').click();
    await expect(this.complete).toHaveText('Thank you for your order!');
  }

  /** Reads a "$12.34" style label into a number. */
  static money(label: string) {
    return Number(label.replace(/[^0-9.]/g, ''));
  }
}
