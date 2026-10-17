/**
 * MCP server: list and rerun failed Playwright tests.
 *
 * An AI assistant (Claude Code, Claude Desktop, any MCP client) connects over stdio and can:
 *   - list_failed_tests  read the last JSON report and list failed or flaky tests
 *   - rerun_failed       rerun only the failed tests, optionally filtered by title
 *   - run_tests          run tests matching a title pattern, a tag or a file
 *
 * It recreates, on a public demo, a tool I built at work that reran failed specs by
 * test-management ID and reported live status back to the ticket.
 */
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { z } from 'zod';
import { spawn } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';

// The server is started from the repo root (see README), which is where the tests live.
const ROOT = process.env.PORTFOLIO_ROOT ?? process.cwd();
const REPORT = path.join(ROOT, 'test-results', 'results.json');
const CLI = path.join(ROOT, 'node_modules', '@playwright', 'test', 'cli.js');

type Failed = { title: string; file: string; line: number; project: string; status: string; error: string };

/** Walks Playwright's JSON report and returns every test whose final result was not a pass. */
export function failedTests(reportPath = REPORT): Failed[] {
  if (!existsSync(reportPath)) return [];
  const report = JSON.parse(readFileSync(reportPath, 'utf8'));
  const out: Failed[] = [];
  const walk = (suite: any, titles: string[]) => {
    for (const spec of suite.specs ?? []) {
      for (const t of spec.tests ?? []) {
        const last = t.results?.[t.results.length - 1];
        const status: string = t.status; // expected | unexpected | flaky | skipped
        if (status === 'unexpected' || status === 'flaky') {
          out.push({
            title: [...titles, spec.title].filter(Boolean).join(' › '),
            file: spec.file,
            line: spec.line,
            project: t.projectName,
            status: status === 'flaky' ? 'flaky (passed on retry)' : 'failed',
            error: String(last?.error?.message ?? '').split('\n')[0].replace(/\u001b\[[0-9;]*m/g, '').slice(0, 200),
          });
        }
      }
    }
    for (const child of suite.suites ?? []) walk(child, child.file === suite.file || !suite.title ? [...titles, child.title !== child.file ? child.title : ''] : [...titles, child.title]);
  };
  for (const s of report.suites ?? []) walk(s, []);
  return out;
}

function escapeRegex(s: string) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/** Runs Playwright and resolves with a short summary plus the tail of the output. */
function runPlaywright(args: string[]): Promise<string> {
  return new Promise((resolve) => {
    const child = spawn(process.execPath, [CLI, 'test', '--reporter=line,json', ...args], {
      cwd: ROOT,
      env: { ...process.env, NODE_OPTIONS: '', PLAYWRIGHT_JSON_OUTPUT_NAME: REPORT },
    });
    let out = '';
    child.stdout.on('data', (d) => (out += d));
    child.stderr.on('data', (d) => (out += d));
    child.on('close', (code) => {
      const clean = out.replace(/\u001b\[[0-9;]*[A-Za-z]/g, '');
      const summary = clean.split('\n').filter((l) => /\d+ (passed|failed|flaky|skipped)/.test(l)).join('\n').trim();
      resolve(`exit code ${code}\n${summary || '(no summary)'}\n\n--- last lines ---\n${clean.split('\n').slice(-25).join('\n')}`);
    });
  });
}

const server = new McpServer({ name: 'playwright-rerun', version: '1.0.0' });

server.tool('list_failed_tests', 'List failed and flaky tests from the last Playwright run.', {}, async () => {
  const failed = failedTests();
  const text = failed.length
    ? failed.map((f, i) => `${i + 1}. [${f.status}] ${f.title}\n   ${f.file}:${f.line} (${f.project})${f.error ? `\n   ${f.error}` : ''}`).join('\n')
    : existsSync(REPORT) ? 'No failed or flaky tests in the last run.' : 'No report yet. Run the tests first (run_tests).';
  return { content: [{ type: 'text', text }] };
});

server.tool(
  'rerun_failed',
  'Rerun only the tests that failed in the last run. Optionally filter by a title substring.',
  { titleContains: z.string().optional().describe('Only rerun failed tests whose title contains this text'), workers: z.number().int().min(1).max(8).default(4) },
  async ({ titleContains, workers }) => {
    let failed = failedTests().filter((f) => f.status === 'failed');
    if (titleContains) failed = failed.filter((f) => f.title.toLowerCase().includes(titleContains.toLowerCase()));
    if (!failed.length) return { content: [{ type: 'text', text: 'Nothing to rerun: no matching failed tests in the last report.' }] };
    const files = [...new Set(failed.map((f) => f.file))];
    const grep = failed.map((f) => escapeRegex(f.title.split(' › ').pop() ?? f.title)).join('|');
    const result = await runPlaywright([...files, `--grep=${grep}`, `--workers=${workers}`, '--retries=0']);
    return { content: [{ type: 'text', text: `Reran ${failed.length} failed test(s) in ${files.length} file(s).\n${result}` }] };
  },
);

server.tool(
  'run_tests',
  'Run Playwright tests by title pattern, tag (e.g. @smoke) or file path.',
  {
    grep: z.string().optional().describe('Title or tag pattern, e.g. "@smoke" or "checkout"'),
    file: z.string().optional().describe('Spec path relative to the repo root'),
    project: z.enum(['ui', 'api']).optional(),
  },
  async ({ grep, file, project }) => {
    const args: string[] = [];
    if (file) args.push(file.replace(/\\/g, '/'));
    if (grep) args.push(`--grep=${grep}`);
    if (project) args.push(`--project=${project}`);
    return { content: [{ type: 'text', text: await runPlaywright(args) }] };
  },
);

server.connect(new StdioServerTransport()).catch((err) => {
  console.error(err);
  process.exit(1);
});
