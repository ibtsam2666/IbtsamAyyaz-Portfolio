/**
 * The demos run against free public practice apps (Sauce Demo, Restful Booker) that are sometimes down.
 * An outage there says nothing about the tests, so a worker checks the app once and, if it answers with
 * a 5xx or not at all, skips its tests with an annotation instead of failing the build.
 */
import { request, type TestInfo, type TestType } from '@playwright/test';

const cache = new Map<string, Promise<string | null>>();

/** Returns null when the app is reachable, otherwise a short reason. Checked once per worker and URL. */
export function unavailableReason(url: string, timeoutMs = 15_000): Promise<string | null> {
  if (!cache.has(url)) {
    cache.set(
      url,
      (async () => {
        const ctx = await request.newContext();
        try {
          const res = await ctx.get(url, { timeout: timeoutMs, failOnStatusCode: false });
          return res.status() >= 500 ? `demo app returned HTTP ${res.status()}` : null;
        } catch (e) {
          return `demo app unreachable (${(e as Error).message.split('\n')[0].slice(0, 80)})`;
        } finally {
          await ctx.dispose();
        }
      })(),
    );
  }
  return cache.get(url)!;
}

/** Adds an auto fixture that skips every test of `test` when `url` is down. */
export function skipWhenDemoDown<T extends TestType<any, any>>(test: T, url: string): T {
  return test.extend<{ demoAvailable: void }>({
    demoAvailable: [
      async ({}, use: () => Promise<void>, testInfo: TestInfo) => {
        const reason = await unavailableReason(url);
        if (reason) {
          testInfo.annotations.push({ type: 'demo-unavailable', description: `${url}: ${reason}` });
          testInfo.skip(true, `Skipped: ${url} ${reason}`);
        }
        await use();
      },
      { auto: true },
    ],
  }) as unknown as T;
}
