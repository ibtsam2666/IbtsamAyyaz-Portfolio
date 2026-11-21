import { test, expect } from '../fixtures/shop';
import logins from '../data/logins.json';

// Data-driven: every row in logins.json becomes its own test. Rows that should sign in and rows
// that should show an error get separate test bodies, so no test branches on its data.
logins.forEach((row, i) => {
  const id = `@TC-${101 + i}`;
  if (row.expect === 'inventory') {
    test(`login: ${row.case}`, { tag: ['@smoke', id] }, async ({ login, inventory }) => {
      await login.open();
      await login.login(row.username, row.password);
      await inventory.expectLoaded();
    });
  } else {
    test(`login: ${row.case}`, { tag: ['@regression', id] }, async ({ login }) => {
      await login.open();
      await login.login(row.username, row.password);
      await expect(login.error).toHaveText(row.expect);
    });
  }
});
