/**
 * Writes a pass/fail/flaky/skipped summary of a Playwright JSON report. In GitHub Actions it is
 * appended to the job summary ($GITHUB_STEP_SUMMARY); elsewhere it prints to stdout.
 *   npx tsx mcp-rerun-server/summary.ts [test-results/results.json] [--title "UI tests"]
 */
import { appendFileSync } from 'node:fs';
import { readReport, summaryMarkdown } from './report';

const args = process.argv.slice(2);
const t = args.indexOf('--title');
const title = t >= 0 ? args.splice(t, 2)[1] : 'Playwright results';
const file = args[0] ?? 'test-results/results.json';
const rows = readReport(file);
const md = rows ? summaryMarkdown(rows, title) : `### ${title}\n\nNo report found at \`${file}\`.\n`;
if (process.env.GITHUB_STEP_SUMMARY) appendFileSync(process.env.GITHUB_STEP_SUMMARY, md);
else process.stdout.write(md);
