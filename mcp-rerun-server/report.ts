/**
 * Pure helpers for reading Playwright's JSON report. No I/O besides the optional file read,
 * so they can be unit-tested with a fixture report.
 */
import { existsSync, readFileSync } from 'node:fs';

export type Status = 'passed' | 'failed' | 'flaky' | 'skipped';

export type TestRow = {
  /** Describe titles plus the test title, joined with " › ". File-level suites are left out. */
  title: string;
  file: string;
  line: number;
  project: string;
  status: Status;
  /** First line of the last error, ANSI colours removed, at most 200 characters. */
  error: string;
  tags: string[];
  /** Test-case IDs such as TC-101, from @TC-101 tags or from the title. */
  ids: string[];
};

export type Counts = { passed: number; failed: number; flaky: number; skipped: number };

const ANSI = /\u001b\[[0-9;]*[A-Za-z]/g;
const CASE_ID = /\bTC-\d+\b/g;

function statusOf(raw: string | undefined): Status {
  switch (raw) {
    case 'unexpected':
      return 'failed';
    case 'flaky':
      return 'flaky';
    case 'skipped':
      return 'skipped';
    default:
      return 'passed';
  }
}

/** A suite whose title is just its file name (Playwright adds one per spec file). */
function isFileSuite(suite: { title?: string; file?: string }): boolean {
  return !suite.title || suite.title === suite.file || /\.spec\.[jt]s$/.test(suite.title);
}

/** Every test in the report, with its final status. */
export function parseReport(report: any): TestRow[] {
  const rows: TestRow[] = [];
  const walk = (suite: any, titles: string[]) => {
    const here = isFileSuite(suite) ? titles : [...titles, suite.title];
    for (const spec of suite.specs ?? []) {
      for (const t of spec.tests ?? []) {
        const last = t.results?.[t.results.length - 1];
        const tags: string[] = [...(spec.tags ?? []), ...(t.tags ?? [])].map((x: string) => (x.startsWith('@') ? x : `@${x}`));
        const title = [...here, spec.title].join(' › ');
        rows.push({
          title,
          file: spec.file ?? suite.file,
          line: spec.line ?? 0,
          project: t.projectName ?? '',
          status: statusOf(t.status),
          error: String(last?.error?.message ?? '').replace(ANSI, '').split('\n')[0].slice(0, 200),
          tags: [...new Set(tags)],
          ids: [...new Set([...tags.join(' ').matchAll(CASE_ID), ...title.matchAll(CASE_ID)].map((m) => m[0]))],
        });
      }
    }
    for (const child of suite.suites ?? []) walk(child, here);
  };
  for (const suite of report?.suites ?? []) walk(suite, []);
  return rows;
}

export function readReport(reportPath: string): TestRow[] | null {
  if (!existsSync(reportPath)) return null;
  return parseReport(JSON.parse(readFileSync(reportPath, 'utf8')));
}

export function countRows(rows: TestRow[]): Counts {
  const c: Counts = { passed: 0, failed: 0, flaky: 0, skipped: 0 };
  for (const r of rows) c[r.status]++;
  return c;
}

/** Tests whose final result was a failure or a pass only on retry. */
export function failedTests(rows: TestRow[]): TestRow[] {
  return rows.filter((r) => r.status === 'failed' || r.status === 'flaky');
}

/** Rows matching any of the given case IDs (TC-101 or @TC-101, case-insensitive). */
export function byCaseIds(rows: TestRow[], ids: string[]): { found: TestRow[]; missing: string[] } {
  const wanted = ids.map((i) => i.replace(/^@/, '').toUpperCase());
  const found = rows.filter((r) => r.ids.some((id) => wanted.includes(id.toUpperCase())));
  const missing = wanted.filter((w) => !found.some((r) => r.ids.map((i) => i.toUpperCase()).includes(w)));
  return { found, missing };
}

export function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/** A --grep pattern that matches exactly these tests by their own (last) title segment. */
export function grepFor(rows: TestRow[]): string {
  return [...new Set(rows.map((r) => escapeRegex(r.title.split(' › ').pop() ?? r.title)))].join('|');
}
