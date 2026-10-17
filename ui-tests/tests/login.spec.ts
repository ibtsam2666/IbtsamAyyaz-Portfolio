import { test, expect } from '../fixtures/shop';
import logins from '../data/logins.json';

// Data-driven: every row in logins.json becomes its own test.
for (const row of logins) {
  test(`login: ${row.case}`, { tag: row.expect === 'inventory' ? ['@smoke'] : ['@regression'] }, async ({ login, inventory }) => {
    await login.open();
    await login.login(row.username, row.password);

    if (row.expect === 'inventory') {
      await inventory.expectLoaded();
    } else {
      await expect(login.error).toHaveText(row.expect);
    }
  });
}
