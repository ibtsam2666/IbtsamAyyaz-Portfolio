import { test, expect } from '@playwright/test';
import path from 'node:path';
import { readFileSync } from 'node:fs';
import { byCaseIds, countRows, failedTests, grepFor, parseReport } from '../report';
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
