import { test as base } from '@playwright/test';
import { LoginPage } from '../pages/LoginPage';
import { InventoryPage } from '../pages/InventoryPage';
import { CheckoutPage } from '../pages/CheckoutPage';

type Shop = {
  login: LoginPage;
  inventory: InventoryPage;
  checkout: CheckoutPage;
  /** Already signed in as the standard user, on the inventory page. */
  signedIn: InventoryPage;
};

export const STANDARD_USER = { username: 'standard_user', password: 'secret_sauce' };

export const test = base.extend<Shop>({
  login: async ({ page }, use) => use(new LoginPage(page)),
  inventory: async ({ page }, use) => use(new InventoryPage(page)),
  checkout: async ({ page }, use) => use(new CheckoutPage(page)),
  signedIn: async ({ login, inventory }, use) => {
    await login.open();
    await login.login(STANDARD_USER.username, STANDARD_USER.password);
    await inventory.expectLoaded();
    await use(inventory);
  },
});

export { expect } from '@playwright/test';
