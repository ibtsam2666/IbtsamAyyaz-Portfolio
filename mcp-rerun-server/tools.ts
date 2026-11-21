/**
 * Tools for the MCP server (started by server.ts): find and rerun failed Playwright tests.
 *
 * An AI assistant (Claude Code, Claude Desktop, any MCP client) connects over stdio and can:
 *   - list_failed_tests  read the last JSON report and list failed or flaky tests (read-only)
 *   - rerun_failed       rerun only the failed tests, optionally filtered by title
 *   - rerun_by_id        rerun tests by test-case ID (@TC-101 tags), like a test-management ID
 *   - run_tests          run tests by title pattern, tag or spec file
 *
 * It recreates, on a public demo, a tool I built at work that reran failed specs by
 * test-management (Xray) ID and reported live status back to the ticket.
 *
 * Safety: spec paths must stay inside the project and end in .spec.ts/.spec.js; only one run
 * at a time (so results.json is never written twice at once); every run has a timeout.
 */
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { spawn } from 'node:child_process';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { byCaseIds, countRows, failedTests, grepFor, readReport, type Counts, type TestRow } from './report';

// Started from the project root (see README); PLAYWRIGHT_PROJECT_ROOT overrides it.
const ROOT = path.resolve(process.env.PLAYWRIGHT_PROJECT_ROOT ?? process.env.PORTFOLIO_ROOT ?? process.cwd());
const REPORT = path.join(ROOT, 'test-results', 'results.json');
const CLI = path.join(ROOT, 'node_modules', '@playwright', 'test', 'cli.js');
const TIMEOUT_MS = Number(process.env.RERUN_TIMEOUT_MS ?? 10 * 60_000);

let running = false;

/** Resolves a spec path and refuses anything outside ROOT or not a spec file. */
export function safeSpecPath(file: string, root = ROOT): string {
  const abs = path.resolve(root, file.replace(/\\/g, '/'));
  const rel = path.relative(root, abs);
  if (rel.startsWith('..') || path.isAbsolute(rel)) throw new Error(`Refusing a path outside the project: ${file}`);
  if (!/\.spec\.[jt]s$/.test(abs)) throw new Error(`Not a spec file: ${file}`);
  if (!existsSync(abs)) throw new Error(`No such spec: ${file}`);
  return rel.split(path.sep).join('/');
}

type RunResult = { exitCode: number | null; timedOut: boolean; counts: Counts | null; text: string };

/** Runs Playwright once (never two at a time) and summarises the new report. */
async function runPlaywright(args: string[]): Promise<RunResult> {
  if (running) return { exitCode: null, timedOut: false, counts: null, text: 'Busy: another test run is still in progress. Try again when it finishes.' };
  if (!existsSync(CLI)) return { exitCode: null, timedOut: false, counts: null, text: `Playwright not found at ${CLI}. Run npm ci in ${ROOT}.` };
  running = true;
  try {
    return await new Promise<RunResult>((resolve) => {
      const child = spawn(process.execPath, [CLI, 'test', '--reporter=line,json', ...args], {
        cwd: ROOT,
        env: { ...process.env, NODE_OPTIONS: '', PLAYWRIGHT_JSON_OUTPUT_NAME: REPORT },
      });
      let out = '';
      let timedOut = false;
      const timer = setTimeout(() => {
        timedOut = true;
        child.kill('SIGKILL');
      }, TIMEOUT_MS);
      child.stdout.on('data', (d) => (out += d));
      child.stderr.on('data', (d) => (out += d));
      child.on('close', (code) => {
        clearTimeout(timer);
        const clean = out.replace(/\u001b\[[0-9;]*[A-Za-z]/g, '');
        const rows = readReport(REPORT);
        const counts = rows ? countRows(rows) : null;
        const head = timedOut ? `Timed out after ${Math.round(TIMEOUT_MS / 1000)} s and was stopped.` : `Exit code ${code}.`;
        const summary = counts ? `passed ${counts.passed}, failed ${counts.failed}, flaky ${counts.flaky}, skipped ${counts.skipped}` : '(no report)';
        resolve({ exitCode: code, timedOut, counts, text: `${head} ${summary}\n\n--- last lines ---\n${clean.split('\n').slice(-25).join('\n')}` });
      });
    });
  } finally {
    running = false;
  }
}

function listText(rows: TestRow[]): string {
  return rows
    .map((f, i) => `${i + 1}. [${f.status}] ${f.title}${f.ids.length ? ` (${f.ids.join(', ')})` : ''}\n   ${f.file}:${f.line} (${f.project})${f.error ? `\n   ${f.error}` : ''}`)
    .join('\n');
}

const countsShape = { passed: z.number(), failed: z.number(), flaky: z.number(), skipped: z.number() };
const runOutput = { exitCode: z.number().nullable(), timedOut: z.boolean(), counts: z.object(countsShape).nullable() };

const done = (r: RunResult, prefix = '') => ({
  content: [{ type: 'text' as const, text: prefix + r.text }],
  structuredContent: { exitCode: r.exitCode, timedOut: r.timedOut, counts: r.counts },
  isError: r.exitCode === null && !r.timedOut ? true : undefined,
});

export function createServer(): McpServer {
const server = new McpServer({ name: 'playwright-rerun', version: '2.0.0' });

server.registerTool(
  'list_failed_tests',
  {
    title: 'List failed tests',
    description: 'List failed and flaky tests from the last Playwright run, with their test-case IDs.',
    inputSchema: {},
    outputSchema: { reportFound: z.boolean(), failed: z.number(), flaky: z.number() },
    annotations: { readOnlyHint: true, openWorldHint: false },
  },
  async () => {
    const rows = readReport(REPORT);
    if (!rows) return { content: [{ type: 'text', text: 'No report yet. Run the tests first (run_tests).' }], structuredContent: { reportFound: false, failed: 0, flaky: 0 } };
    const failed = failedTests(rows);
    const c = countRows(rows);
    return {
      content: [{ type: 'text', text: failed.length ? listText(failed) : 'No failed or flaky tests in the last run.' }],
      structuredContent: { reportFound: true, failed: c.failed, flaky: c.flaky },
    };
  },
);

server.registerTool(
  'rerun_failed',
  {
    title: 'Rerun failed tests',
    description: 'Rerun only the tests that failed in the last run. Optionally filter by a title substring.',
    inputSchema: {
      titleContains: z.string().optional().describe('Only rerun failed tests whose title contains this text'),
      workers: z.number().int().min(1).max(8).default(4),
    },
    outputSchema: runOutput,
  },
  async ({ titleContains, workers }) => {
    let failed = (readReport(REPORT) ?? []).filter((r) => r.status === 'failed');
    if (titleContains) failed = failed.filter((f) => f.title.toLowerCase().includes(titleContains.toLowerCase()));
    if (!failed.length) return { content: [{ type: 'text', text: 'Nothing to rerun: no matching failed tests in the last report.' }], structuredContent: { exitCode: null, timedOut: false, counts: null } };
    const files = [...new Set(failed.map((f) => f.file))];
    const r = await runPlaywright([...files, `--grep=${grepFor(failed)}`, `--workers=${workers}`, '--retries=0']);
    return done(r, `Reran ${failed.length} failed test(s) in ${files.length} file(s).\n`);
  },
);

server.registerTool(
  'rerun_by_id',
  {
    title: 'Rerun tests by case ID',
    description: 'Rerun tests by test-case ID (tests tagged @TC-101 etc.), the way a test-management tool references them.',
    inputSchema: { ids: z.array(z.string().regex(/^@?TC-\d+$/i)).min(1).max(50).describe('Case IDs such as ["TC-301", "TC-405"]') },
    outputSchema: runOutput,
  },
  async ({ ids }) => {
    const tags = ids.map((i) => `@${i.replace(/^@/, '').toUpperCase()}`);
    const known = readReport(REPORT);
    const missing = known ? byCaseIds(known, ids).missing : [];
    const r = await runPlaywright([`--grep=${tags.map((t) => `${t}\\b`).join('|')}`, '--retries=0']);
    const note = missing.length ? `Not in the last report (ran anyway): ${missing.join(', ')}\n` : '';
    return done(r, `Ran ${tags.join(', ')}.\n${note}`);
  },
);

server.registerTool(
  'run_tests',
  {
    title: 'Run tests',
    description: 'Run Playwright tests by title pattern, tag (e.g. @smoke) or spec file.',
    inputSchema: {
      grep: z.string().max(200).optional().describe('Title or tag pattern, e.g. "@smoke" or "checkout"'),
      file: z.string().optional().describe('Spec path relative to the project root'),
      project: z.string().regex(/^[\w-]+$/).optional().describe('Playwright project name, e.g. "ui" or "api"'),
    },
    outputSchema: runOutput,
  },
  async ({ grep, file, project }) => {
    const args: string[] = [];
    try {
      if (file) args.push(safeSpecPath(file));
    } catch (e) {
      return { content: [{ type: 'text', text: (e as Error).message }], structuredContent: { exitCode: null, timedOut: false, counts: null }, isError: true };
    }
    if (grep) args.push(`--grep=${grep}`);
    if (project) args.push(`--project=${project}`);
    return done(await runPlaywright(args));
  },
);

return server;
}
