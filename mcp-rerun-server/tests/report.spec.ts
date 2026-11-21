import { test, expect } from '@playwright/test';
import path from 'node:path';
import { readFileSync } from 'node:fs';
import { byCaseIds, countRows, failedTests, findTest, grepFor, listingText, parseReport, summaryMarkdown, traceText } from '../report';
import { safeSpecPath } from '../tools';

const report = JSON.parse(readFileSync(path.join(__dirname, 'fixtures', 'results.json'), 'utf8'));
const rows = parseReport(report);

test.describe('report parser', () => {
  test('titles keep describe blocks and drop file-level suites', () => {
    expect(rows.map((r) => r.title)).toEqual([
      'checkout › order total equals subtotal plus 8% tax',
      'checkout › checkout requires a postal code',
      'checkout › guest › guest cannot open checkout [TC-303]',
      'health check responds',
    ]);
  });

  test('statuses, counts and the failed/flaky list', () => {
    expect(countRows(rows)).toEqual({ passed: 1, failed: 1, flaky: 1, skipped: 1 });
    expect(failedTests(rows).map((r) => r.status)).toEqual(['failed', 'flaky']);
  });

  test('errors are one clean line without ANSI colours', () => {
    expect(rows[0].error).toBe('Error: expect(received).toBeCloseTo(expected)');
  });

  test('case IDs come from @TC tags and from titles', () => {
    expect(rows.map((r) => r.ids)).toEqual([['TC-301'], ['TC-302'], ['TC-303'], ['TC-401']]);
    expect(rows[0].tags).toContain('@smoke');
  });

  test('byCaseIds finds tests and reports unknown IDs', () => {
    const { found, missing } = byCaseIds(rows, ['tc-301', '@TC-401', 'TC-999']);
    expect(found.map((r) => r.ids[0])).toEqual(['TC-301', 'TC-401']);
    expect(missing).toEqual(['TC-999']);
  });

  test('grep pattern escapes regex characters in titles', () => {
    expect(grepFor([rows[2]])).toBe('guest cannot open checkout \\[TC-303\\]');
  });

  test('an empty or missing report has no rows', () => {
    expect(parseReport({})).toEqual([]);
  });
});

test.describe('spec path guard', () => {
  const root = path.resolve(__dirname, '..', '..');

  test('accepts a spec inside the project', () => {
    expect(safeSpecPath('ui-tests/tests/checkout.spec.ts', root)).toBe('ui-tests/tests/checkout.spec.ts');
    expect(safeSpecPath('ui-tests\\tests\\cart.spec.ts', root)).toBe('ui-tests/tests/cart.spec.ts');
  });

  test('refuses paths outside the project, non-spec files and missing specs', () => {
    expect(() => safeSpecPath('../outside.spec.ts', root)).toThrow(/outside the project/);
    expect(() => safeSpecPath('package.json', root)).toThrow(/Not a spec file/);
    expect(() => safeSpecPath('ui-tests/tests/nope.spec.ts', root)).toThrow(/No such spec/);
  });
});

test.describe('show_trace helpers', () => {
  test('a failed test keeps its full error, location, failing step and saved files', () => {
    const r = rows[0];
    expect(r.errorDetail).toBe('Error: expect(received).toBeCloseTo(expected)\n\nExpected: 41.02');
    expect(r.errorAt).toBe('ui-tests/tests/checkout.spec.ts:21:5');
    expect(r.failedStep).toBe('expect.toBeCloseTo');
    // stdout is inline (no path), so it is not listed as a file
    expect(r.attachments.map((a) => a.name)).toEqual(['screenshot', 'trace']);
  });

  test('findTest by case ID, by title, and prefers failing tests', () => {
    expect(findTest(rows, 'tc-302').match?.title).toBe('checkout › checkout requires a postal code');
    expect(findTest(rows, 'guest').match?.ids).toEqual(['TC-303']);
    // "checkout" matches all three checkout tests; only two failed or were flaky, so no single match
    const many = findTest(rows, 'checkout');
    expect(many.match).toBeNull();
    expect(many.candidates.map((c) => c.status)).toEqual(['failed', 'flaky']);
    expect(findTest(rows, 'TC-999')).toEqual({ match: null, candidates: [] });
  });

  test('traceText shows the step, error and the show-trace command', () => {
    const t = traceText(rows[0]);
    expect(t).toContain('[failed] checkout › order total equals subtotal plus 8% tax (TC-301)');
    expect(t).toContain('Failed step: expect.toBeCloseTo');
    expect(t).toContain('Open the trace: npx playwright show-trace "test-results/checkout-order-total/trace.zip"');
  });

  test('traceText suggests turning traces on when none was saved', () => {
    expect(traceText(rows[1])).toContain("trace: 'retain-on-failure'");
    expect(traceText(rows[2])).toContain('This test passed in the last run.');
  });
});

test.describe('list_tests helper', () => {
  test('one line per test with case IDs first, and a cap', () => {
    const lines = listingText(rows).split('\n');
    expect(lines[0]).toBe('TC-301  checkout › order total equals subtotal plus 8% tax  (ui-tests/tests/checkout.spec.ts:7, ui)');
    expect(listingText(rows, 2).split('\n').pop()).toBe('... and 2 more. Narrow it with grep or project.');
  });
});

test('traceText shows saved files relative to the project root', () => {
  const root = path.resolve('/work/shop');
  const row = { ...rows[0], attachments: [{ name: 'trace', path: path.join(root, 'test-results', 'a', 'trace.zip') }] };
  expect(traceText(row, root)).toContain('show-trace "test-results/a/trace.zip"');
});

test('job summary has the counts table and one row per failed or flaky test', () => {
  const md = summaryMarkdown(rows, 'Fixture run');
  expect(md).toContain('### ❌ Fixture run');
  expect(md).toContain('| 4 | 1 | 1 | 1 | 1 |');
  expect(md).toContain('| failed | checkout › order total equals subtotal plus 8% tax | TC-301 |');
  expect(md).toContain('| flaky | checkout › checkout requires a postal code | TC-302 |');
  expect(md).not.toContain('health check responds');
});
