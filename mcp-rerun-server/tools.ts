/**
 * Tools for the MCP server (started by server.ts): find, explain and rerun failed Playwright tests.
 * The same code is published on its own as playwright-rerun-mcp (github.com/ibtsam2666/playwright-rerun-mcp).
 *
 * An AI assistant (Claude Code, Claude Desktop, any MCP client) connects over stdio and can:
 *   - list_failed_tests  read the last JSON report and list failed or flaky tests (read-only)
 *   - show_trace         explain one failed test: error, failing step, trace and screenshot paths (read-only)
 *   - list_tests         list tests with their case IDs without running them (read-only)
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
import { ANSI, byCaseIds, countRows, failedTests, findTest, grepFor, listingText, readReport, traceText, type Counts, type TestRow } from './report';
// Kept in step with the standalone playwright-rerun-mcp package.
const version = '1.1.0';

// Started from the Playwright project root; PLAYWRIGHT_PROJECT_ROOT overrides it.
const ROOT = path.resolve(process.env.PLAYWRIGHT_PROJECT_ROOT ?? process.cwd());
const REPORT = path.join(ROOT, 'test-results', 'results.json');
const LIST_REPORT = path.join(ROOT, 'test-results', 'list.json');
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

type Spawned = { code: number | null; timedOut: boolean; output: string };

/** Starts the project's own Playwright CLI and collects its output, with a timeout. */
function spawnPlaywright(args: string[], jsonOut: string, timeoutMs = TIMEOUT_MS): Promise<Spawned> {
  return new Promise((resolve) => {
    const child = spawn(process.execPath, [CLI, 'test', ...args], {
      cwd: ROOT,
      env: { ...process.env, NODE_OPTIONS: '', PLAYWRIGHT_JSON_OUTPUT_NAME: jsonOut },
    });
    let out = '';
    let timedOut = false;
    const timer = setTimeout(() => {
      timedOut = true;
      child.kill('SIGKILL');
    }, timeoutMs);
    child.stdout.on('data', (d) => (out += d));
    child.stderr.on('data', (d) => (out += d));
    child.on('close', (code) => {
      clearTimeout(timer);
      resolve({ code, timedOut, output: out.replace(ANSI, '') });
    });
  });
}

type RunResult = { exitCode: number | null; timedOut: boolean; counts: Counts | null; text: string };

/** Runs Playwright once (never two at a time) and summarises the new report. */
async function runPlaywright(args: string[]): Promise<RunResult> {
  if (running) return { exitCode: null, timedOut: false, counts: null, text: 'Busy: another test run is still in progress. Try again when it finishes.' };
  if (!existsSync(CLI)) return { exitCode: null, timedOut: false, counts: null, text: `Playwright not found at ${CLI}. Run npm ci in ${ROOT}.` };
  running = true;
  try {
    const { code, timedOut, output } = await spawnPlaywright(['--reporter=line,json', ...args], REPORT);
    const rows = readReport(REPORT);
    const counts = rows ? countRows(rows) : null;
    const head = timedOut ? `Timed out after ${Math.round(TIMEOUT_MS / 1000)} s and was stopped.` : `Exit code ${code}.`;
    const summary = counts ? `passed ${counts.passed}, failed ${counts.failed}, flaky ${counts.flaky}, skipped ${counts.skipped}` : '(no report)';
    return { exitCode: code, timedOut, counts, text: `${head} ${summary}\n\n--- last lines ---\n${output.split('\n').slice(-25).join('\n')}` };
  } finally {
    running = false;
  }
}

function listText(rows: TestRow[]): string {
  return rows.map((f, i) => `${i + 1}. [${f.status}] ${f.title}${f.ids.length ? ` (${f.ids.join(', ')})` : ''}\n   ${f.file}:${f.line} (${f.project})${f.error ? `\n   ${f.error}` : ''}`).join('\n');
}

const text = (t: string, isError?: boolean) => ({ content: [{ type: 'text' as const, text: t }], ...(isError ? { isError } : {}) });

const countsShape = { passed: z.number(), failed: z.number(), flaky: z.number(), skipped: z.number() };
const runOutput = { exitCode: z.number().nullable(), timedOut: z.boolean(), counts: z.object(countsShape).nullable() };

const done = (r: RunResult, prefix = '') => ({
  content: [{ type: 'text' as const, text: prefix + r.text }],
  structuredContent: { exitCode: r.exitCode, timedOut: r.timedOut, counts: r.counts },
  isError: r.exitCode === null && !r.timedOut ? true : undefined,
});

export function createServer(): McpServer {
  const server = new McpServer({ name: 'playwright-rerun', version });

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
      if (!rows) return { ...text('No report yet. Run the tests first (run_tests).'), structuredContent: { reportFound: false, failed: 0, flaky: 0 } };
      const failed = failedTests(rows);
      const c = countRows(rows);
      return {
        ...text(failed.length ? listText(failed) : 'No failed or flaky tests in the last run.'),
        structuredContent: { reportFound: true, failed: c.failed, flaky: c.flaky },
      };
    },
  );

  server.registerTool(
    'show_trace',
    {
      title: 'Explain a failed test',
      description:
        'Show why one test failed in the last run: the full error, where it was thrown, the failing test.step, and the trace, screenshot and video paths. Find the test by case ID (TC-301) or part of its title.',
      inputSchema: { test: z.string().min(1).max(200).describe('Case ID such as "TC-301", or part of the test title') },
      outputSchema: {
        found: z.boolean(),
        title: z.string().nullable(),
        status: z.string().nullable(),
        trace: z.string().nullable(),
        candidates: z.array(z.string()),
      },
      annotations: { readOnlyHint: true, openWorldHint: false },
    },
    async ({ test }) => {
      const rows = readReport(REPORT);
      const none = { found: false, title: null, status: null, trace: null, candidates: [] as string[] };
      if (!rows) return { ...text('No report yet. Run the tests first (run_tests).'), structuredContent: none };
      const { match, candidates } = findTest(rows, test);
      if (!match) {
        const names = candidates.slice(0, 20).map((r) => r.title);
        const msg = candidates.length ? `"${test}" matches ${candidates.length} tests. Be more specific:\n${names.map((n) => `- ${n}`).join('\n')}` : `No test in the last report matches "${test}".`;
        return { ...text(msg), structuredContent: { ...none, candidates: names } };
      }
      const trace = match.attachments.find((a) => a.name === 'trace')?.path ?? null;
      return {
        ...text(traceText(match, ROOT)),
        structuredContent: { found: true, title: match.title, status: match.status, trace, candidates: [match.title] },
      };
    },
  );

  server.registerTool(
    'list_tests',
    {
      title: 'List tests',
      description: 'List the tests in the project with their case IDs, file and project, without running them. Use it to find a test before rerunning it.',
      inputSchema: {
        grep: z.string().max(200).optional().describe('Only tests whose title or tag matches, e.g. "@smoke" or "TC-3"'),
        project: z
          .string()
          .regex(/^[\w-]+$/)
          .optional()
          .describe('Playwright project name, e.g. "ui" or "api"'),
      },
      outputSchema: { total: z.number(), withIds: z.number() },
      annotations: { readOnlyHint: true, openWorldHint: false },
    },
    async ({ grep, project }) => {
      if (!existsSync(CLI)) return { ...text(`Playwright not found at ${CLI}. Run npm ci in ${ROOT}.`, true), structuredContent: { total: 0, withIds: 0 } };
      const args = ['--list', '--reporter=json'];
      if (grep) args.push(`--grep=${grep}`);
      if (project) args.push(`--project=${project}`);
      const { code, output } = await spawnPlaywright(args, LIST_REPORT, 120_000);
      const rows = readReport(LIST_REPORT);
      if (!rows) return { ...text(`Could not list tests (exit code ${code}).\n${output.split('\n').slice(-15).join('\n')}`, true), structuredContent: { total: 0, withIds: 0 } };
      const withIds = rows.filter((r) => r.ids.length).length;
      return {
        ...text(rows.length ? `${rows.length} test(s), ${withIds} with case IDs:\n${listingText(rows)}` : 'No tests match.'),
        structuredContent: { total: rows.length, withIds },
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
      if (!failed.length) return { ...text('Nothing to rerun: no matching failed tests in the last report.'), structuredContent: { exitCode: null, timedOut: false, counts: null } };
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
      inputSchema: {
        ids: z
          .array(z.string().regex(/^@?TC-\d+$/i))
          .min(1)
          .max(50)
          .describe('Case IDs such as ["TC-301", "TC-405"]'),
      },
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
        project: z
          .string()
          .regex(/^[\w-]+$/)
          .optional()
          .describe('Playwright project name, e.g. "ui" or "api"'),
      },
      outputSchema: runOutput,
    },
    async ({ grep, file, project }) => {
      const args: string[] = [];
      try {
        if (file) args.push(safeSpecPath(file));
      } catch (e) {
        return { ...text((e as Error).message, true), structuredContent: { exitCode: null, timedOut: false, counts: null } };
      }
      if (grep) args.push(`--grep=${grep}`);
      if (project) args.push(`--project=${project}`);
      return done(await runPlaywright(args));
    },
  );

  return server;
}
