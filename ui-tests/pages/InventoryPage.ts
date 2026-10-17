import { expect, type Locator, type Page } from '@playwright/test';

export class InventoryPage {
  readonly title: Locator;
  readonly items: Locator;
  readonly cartBadge: Locator;
  readonly cartLink: Locator;
  readonly sort: Locator;

  constructor(private readonly page: Page) {
    this.title = page.getByTestId('title');
    this.items = page.getByTestId('inventory-item');
    this.cartBadge = page.getByTestId('shopping-cart-badge');
    this.cartLink = page.getByTestId('shopping-cart-link');
    this.sort = page.getByTestId('product-sort-container');
  }

  async expectLoaded() {
    await expect(this.page).toHaveURL(/inventory\.html/);
    await expect(this.title).toHaveText('Products');
  }

  /** Product ids follow the site's convention, e.g. "Sauce Labs Backpack" -> "sauce-labs-backpack". */
  private slug(name: string) {
    return name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
  }

  async add(name: string) {
    await this.page.getByTestId(`add-to-cart-${this.slug(name)}`).click();
  }

  async remove(name: string) {
    await this.page.getByTestId(`remove-${this.slug(name)}`).click();
  }

  async prices(): Promise<number[]> {
    const texts = await this.page.getByTestId('inventory-item-price').allTextContents();
    return texts.map((t) => Number(t.replace('$', '')));
  }

  async sortBy(value: 'az' | 'za' | 'lohi' | 'hilo') {
    await this.sort.selectOption(value);
  }

  async openCart() {
    await this.cartLink.click();
  }
}
