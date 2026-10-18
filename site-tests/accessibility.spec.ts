import { test, expect, type Page } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

// The portfolio tests itself: every page must have no serious or critical WCAG 2.1 A/AA
// violations, in both themes where the page has a theme switch.
const PAGES = [
  { path: '/', name: 'home' },
  { path: '/agent-lab.html', name: 'agent lab' },
  { path: '/how-to-run.html', name: 'how to run' },
  { path: '/how-ai-agents-work.html', name: 'how AI agents work' },
  { path: '/case-studies/cart-badge-agent.html', name: 'cart badge case study' },
  { path: '/404.html', name: '404' },
];

async function audit(page: Page) {
  const results = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa']).analyze();
  const blocking = results.violations.filter((v) => v.impact === 'serious' || v.impact === 'critical');
  const summary = blocking.map((v) => `${v.id} (${v.impact}): ${v.help}\n    ${v.nodes.slice(0, 3).map((n) => n.target.join(' ')).join('\n    ')}`);
  expect(summary, `Accessibility violations:\n  ${summary.join('\n  ')}`).toEqual([]);
}

for (const p of PAGES) {
  test(`${p.name} page has no serious accessibility violations`, { tag: '@a11y' }, async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.goto(p.path);
    await audit(page);
  });
}

test('home page in light theme has no serious accessibility violations', { tag: '@a11y' }, async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('/');
  await page.evaluate(() => (document.documentElement.dataset.theme = 'light'));
  await audit(page);
});

test('every page has a title, description, favicon and one h1', { tag: '@seo' }, async ({ page }) => {
  for (const p of PAGES) {
    await page.goto(p.path);
    await expect(page, p.name).toHaveTitle(/\S/);
    await expect(page.locator('meta[name="description"]'), p.name).toHaveAttribute('content', /\S{10,}/);
    await expect(page.locator('link[rel="icon"]'), p.name).toHaveCount(1);
    await expect(page.locator('h1'), p.name).toHaveCount(1);
  }
});

test('unknown URLs show the custom 404 page', { tag: '@seo' }, async ({ page }) => {
  const res = await page.goto('/does-not-exist');
  expect(res?.status()).toBe(404);
  await expect(page.locator('h1')).toHaveText("This page isn't here");
});
