/// <reference types="cypress" />
// The "before" spec: Cypress written the way many legacy suites are (login in beforeEach,
// raw selectors, an alias, a .then() chain to read prices). Kept for comparison only:
// Cypress is not installed here, and this file is excluded from tsc and ESLint.
describe('cart (Cypress)', () => {
  beforeEach(() => {
    cy.visit('https://www.saucedemo.com/');
    cy.get('[data-test="username"]').type('standard_user');
    cy.get('[data-test="password"]').type('secret_sauce');
    cy.get('[data-test="login-button"]').click();
    cy.url().should('include', '/inventory.html');
  });

  it('adds two items and shows them in the cart', () => {
    cy.get('[data-test="add-to-cart-sauce-labs-backpack"]').click();
    cy.get('[data-test="add-to-cart-sauce-labs-bike-light"]').click();
    cy.get('[data-test="shopping-cart-badge"]').as('badge');
    cy.get('@badge').should('have.text', '2');
    cy.get('[data-test="shopping-cart-link"]').click();
    cy.get('[data-test="inventory-item"]').should('have.length', 2);
    cy.get('[data-test="inventory-item-name"]').first().should('have.text', 'Sauce Labs Backpack');
  });

  it('sorts prices from high to low', () => {
    cy.get('[data-test="product-sort-container"]').select('hilo');
    cy.get('[data-test="inventory-item-price"]').then(($prices) => {
      const prices = [...$prices].map((el) => Number(el.innerText.replace('$', '')));
      expect(prices).to.deep.equal([...prices].sort((a, b) => b - a));
    });
  });

  it('keeps the cart after a reload', () => {
    cy.get('[data-test="add-to-cart-sauce-labs-onesie"]').click();
    cy.reload();
    cy.get('[data-test="shopping-cart-badge"]').should('have.text', '1');
  });
});
