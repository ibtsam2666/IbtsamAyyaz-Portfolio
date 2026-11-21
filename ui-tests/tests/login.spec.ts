import { test, expect } from '../fixtures/shop';
import logins from '../data/logins.json';

// Data-driven: every row in logins.json becomes its own test.
logins.forEach((row, i) => {
  const id = `@TC-${101 + i}`;
  test(`login: ${row.case}`, { tag: [row.expect === 'inventory' ? '@smoke' : '@regression', id] }, async ({ login, inventory }) => {
    await login.open();
    await login.login(row.username, row.password);

    if (row.expect === 'inventory') {
      await inventory.expectLoaded();
    } else {
      await expect(login.error).toHaveText(row.expect);
    }
  });
});
