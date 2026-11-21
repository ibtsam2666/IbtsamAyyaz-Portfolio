import { test, expect } from '@playwright/test';

// One visual check: the custom 404 page must look the same as its approved screenshot.
// Baselines are recorded on Linux in CI, because fonts render differently on each OS. To
// re-record them, push the branch to update-snapshots/<name> (see .github/workflows/update-snapshots.yml).
test('404 page matches its approved screenshot', { tag: ['@visual', '@TC-601'] }, async ({ page }) => {
  test.skip(process.platform !== 'linux', 'Visual baselines are recorded on Linux (CI)');
  await page.setViewportSize({ width: 1280, height: 720 });
  await page.emulateMedia({ reducedMotion: 'reduce', colorScheme: 'dark' });
  await page.goto('/404.html');
  await expect(page).toHaveScreenshot('404-page.png', { fullPage: true, animations: 'disabled', maxDiffPixelRatio: 0.01 });
});
