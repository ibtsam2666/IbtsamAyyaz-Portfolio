/**
 * Pure helpers for reading Playwright's JSON report. No I/O besides the optional file read,
 * so they can be unit-tested with a fixture report.
 */
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';

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
  /** Full error text of the last attempt (ANSI removed), at most 40 lines. */
  errorDetail: string;
  /** Where the error was thrown, e.g. "tests/checkout.spec.ts:21:5". */
  errorAt: string;
  /** Title of the innermost test.step that failed, if any. */
  failedStep: string;
  /** Files Playwright saved for the last attempt (trace, screenshot, video). */
  attachments: { name: string; path: string }[];
};

export type Counts = { passed: number; failed: number; flaky: number; skipped: number };

// eslint-disable-next-line no-control-regex -- matches terminal colour codes
export const ANSI = /\u001b\[[0-9;]*[A-Za-z]/g;
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

type RawStep = { title?: string; error?: unknown; steps?: RawStep[] };

/** The innermost step that has an error, e.g. "Click Checkout" inside "fill the form". */
function failedStepOf(steps: RawStep[] | undefined): string {
  for (const s of steps ?? []) {
    if (!s.error) continue;
    return failedStepOf(s.steps) || String(s.title ?? '');
  }
  return '';
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
          error: String(last?.error?.message ?? '')
            .replace(ANSI, '')
            .split('\n')[0]
            .slice(0, 200),
          tags: [...new Set(tags)],
          ids: [...new Set([...tags.join(' ').matchAll(CASE_ID), ...title.matchAll(CASE_ID)].map((m) => m[0]))],
          errorDetail: String(last?.error?.message ?? '')
            .replace(ANSI, '')
            .split('\n')
            .slice(0, 40)
            .join('\n')
            .trim(),
          errorAt: last?.error?.location ? `${last.error.location.file}:${last.error.location.line}:${last.error.location.column}` : '',
          failedStep: failedStepOf(last?.steps),
          attachments: (last?.attachments ?? []).filter((a: { path?: string }) => a.path).map((a: { name: string; path: string }) => ({ name: a.name, path: a.path })),
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

/**
 * Finds one test by case ID (TC-301) or by part of its title. Failed and flaky tests win over
 * passing ones, so "checkout" picks the checkout test that broke. Returns the matches it considered.
 */
export function findTest(rows: TestRow[], query: string): { match: TestRow | null; candidates: TestRow[] } {
  const q = query.trim().replace(/^@/, '');
  const byId = /^TC-\d+$/i.test(q) ? byCaseIds(rows, [q]).found : [];
  const byTitle = byId.length ? [] : rows.filter((r) => r.title.toLowerCase().includes(q.toLowerCase()));
  const candidates = byId.length ? byId : byTitle;
  const failing = failedTests(candidates);
  const pool = failing.length ? failing : candidates;
  return { match: pool.length === 1 ? pool[0] : null, candidates: pool };
}

/** A readable failure report for one test: where it broke, the step, the error and its files. */
export function traceText(row: TestRow, root = ''): string {
  // Reports store absolute paths; show them relative to the project when they are inside it.
  const rel = (p: string) => {
    if (!root || !path.isAbsolute(p)) return p;
    const r = path.relative(root, p);
    return r.startsWith('..') ? p : r.split(path.sep).join('/');
  };
  const lines = [`[${row.status}] ${row.title}${row.ids.length ? ` (${row.ids.join(', ')})` : ''}`, `${row.file}:${row.line} (${row.project})`];
  if (row.errorAt) lines.push(`Error at: ${rel(row.errorAt)}`);
  if (row.failedStep) lines.push(`Failed step: ${row.failedStep}`);
  if (row.errorDetail) lines.push('', row.errorDetail);
  else if (row.status === 'passed') lines.push('', 'This test passed in the last run.');
  const trace = row.attachments.find((a) => a.name === 'trace');
  if (row.attachments.length) {
    lines.push('', 'Saved files:', ...row.attachments.map((a) => `  ${a.name}: ${rel(a.path)}`));
  }
  if (trace) lines.push('', `Open the trace: npx playwright show-trace "${rel(trace.path)}"`);
  else if (row.status !== 'passed') lines.push('', `No trace saved. Set trace: 'retain-on-failure' in playwright.config to get one.`);
  return lines.join('\n');
}

/** One line per test for list_tests: case IDs first, then title, file and project. */
export function listingText(rows: TestRow[], limit = 200): string {
  const shown = rows.slice(0, limit).map((r) => `${r.ids.length ? r.ids.join(', ') : '-'}  ${r.title}  (${r.file}:${r.line}, ${r.project})`);
  if (rows.length > limit) shown.push(`... and ${rows.length - limit} more. Narrow it with grep or project.`);
  return shown.join('\n');
}

/** Markdown for a GitHub Actions job summary: a counts table, then the failed and flaky tests. */
export function summaryMarkdown(rows: TestRow[], heading = 'Playwright results'): string {
  const c = countRows(rows);
  const icon = c.failed ? '❌' : c.flaky ? '⚠️' : '✅';
  const out = [
    `### ${icon} ${heading}`,
    '',
    '| Total | Passed | Failed | Flaky | Skipped |',
    '|---:|---:|---:|---:|---:|',
    `| ${rows.length} | ${c.passed} | ${c.failed} | ${c.flaky} | ${c.skipped} |`,
  ];
  const bad = failedTests(rows);
  if (bad.length) {
    out.push('', '| Status | Test | Case IDs | Where | Error |', '|---|---|---|---|---|');
    const cell = (s: string) => s.replace(/\|/g, '\\|').replace(/\n/g, ' ');
    for (const r of bad.slice(0, 50)) {
      out.push(`| ${r.status} | ${cell(r.title)} | ${r.ids.join(', ') || '-'} | \`${r.file}:${r.line}\` (${r.project}) | ${cell(r.error) || '-'} |`);
    }
    if (bad.length > 50) out.push('', `...and ${bad.length - 50} more.`);
  }
  return out.join('\n') + '\n';
}
