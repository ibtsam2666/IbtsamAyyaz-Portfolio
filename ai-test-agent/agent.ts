/**
 * AI test agent: user story -> test plan -> Playwright spec -> run -> gap report.
 *
 *   npm run agent -- ai-test-agent/stories/cart-badge.md            # live, needs ANTHROPIC_API_KEY
 *   npm run agent -- ai-test-agent/stories/cart-badge.md --replay   # uses the recorded response
 *
 * The agent is given the repo's own page objects and fixtures so the spec it writes follows
 * the team style instead of raw selectors. After the run it maps each acceptance criterion to
 * the tests that cover it and reports criteria with no passing test.
 */
import Anthropic from '@anthropic-ai/sdk';
import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';

const MODEL = process.env.AGENT_MODEL ?? 'claude-sonnet-5-5';
const ROOT = process.cwd();
const OUT_DIR = path.join(ROOT, 'ai-test-agent', 'generated');
const RECORDED = path.join(ROOT, 'ai-test-agent', 'recorded', 'cart-badge.response.json');

type AgentOutput = {
  plan: { id: string; criterion: number; title: string; priority: 'P1' | 'P2' | 'P3' }[];
  spec: string;
};

const CONTEXT_FILES = ['ui-tests/fixtures/shop.ts', 'ui-tests/pages/InventoryPage.ts', 'ui-tests/pages/CheckoutPage.ts'];

function prompt(story: string) {
  const context = CONTEXT_FILES.map((f) => `// ${f}\n${readFileSync(path.join(ROOT, f), 'utf8')}`).join('\n\n');
  return `You are a senior SDET. Write Playwright tests for the user story below against https://www.saucedemo.com.

Rules:
- Import { test, expect } from '../../ui-tests/fixtures/shop' and use its fixtures (signedIn, checkout, page). Do not log in by hand.
- Use the page objects' methods and locators. Use page.getByTestId only for elements they do not cover (cart items: 'inventory-item').
- One test per acceptance criterion where possible. Put the criterion number in the title like "[AC2] ...".
- Assert real values (counts, text), never only visibility.

Return ONLY JSON: {"plan":[{"id":"T1","criterion":1,"title":"...","priority":"P1"}],"spec":"<full TypeScript file>"}

Existing code you must reuse:
${context}

User story:
${story}`;
}

async function askModel(story: string): Promise<AgentOutput> {
  if (!process.env.ANTHROPIC_API_KEY) throw new Error('ANTHROPIC_API_KEY is not set. Run with --replay to use the recorded response.');
  const client = new Anthropic();
  const msg = await client.messages.create({ model: MODEL, max_tokens: 4000, messages: [{ role: 'user', content: prompt(story) }] });
  const text = msg.content.map((b) => (b.type === 'text' ? b.text : '')).join('');
  const json = text.slice(text.indexOf('{'), text.lastIndexOf('}') + 1);
  return JSON.parse(json) as AgentOutput;
}

function criteriaOf(story: string): { n: number; text: string }[] {
  return [...story.matchAll(/^\s*(\d+)\.\s+(.+)$/gm)].map((m) => ({ n: Number(m[1]), text: m[2].trim() }));
}

function runSpec(file: string): { title: string; ok: boolean }[] {
  const report = path.join(OUT_DIR, 'last-run.json');
  try {
    execFileSync(process.execPath, [path.join(ROOT, 'node_modules/@playwright/test/cli.js'), 'test', file.replace(/\\/g, '/'), '--project=ui', '--reporter=json', '--retries=0'], {
      stdio: ['ignore', 'pipe', 'pipe'],
      env: { ...process.env, NODE_OPTIONS: '', PLAYWRIGHT_JSON_OUTPUT_NAME: report },
    });
  } catch {
    /* failures are reported below */
  }
  if (!existsSync(report)) return [];
  const json = JSON.parse(readFileSync(report, 'utf8'));
  const results: { title: string; ok: boolean }[] = [];
  const walk = (s: any) => {
    for (const sp of s.specs ?? []) results.push({ title: sp.title, ok: sp.ok });
    for (const c of s.suites ?? []) walk(c);
  };
  (json.suites ?? []).forEach(walk);
  return results;
}

async function main() {
  const storyPath = process.argv[2];
  const replay = process.argv.includes('--replay');
  if (!storyPath || !existsSync(storyPath)) {
    console.error('Usage: npm run agent -- <story.md> [--replay]');
    process.exit(2);
  }
  const story = readFileSync(storyPath, 'utf8');
  const name = path.basename(storyPath, '.md');

  console.log(`\n▶ Story: ${story.split('\n')[0].replace(/^#\s*(Story:\s*)?/i, '')}`);
  console.log(replay ? '▶ Mode: replay (recorded model response)' : `▶ Mode: live (${MODEL})`);

  const out: AgentOutput = replay ? JSON.parse(readFileSync(RECORDED, 'utf8')) : await askModel(story);

  console.log('\n▶ Test plan');
  for (const t of out.plan) console.log(`  ${t.id} [${t.priority}] AC${t.criterion}: ${t.title}`);

  mkdirSync(OUT_DIR, { recursive: true });
  const specFile = path.join(OUT_DIR, `${name}.spec.ts`);
  writeFileSync(specFile, out.spec);
  if (!replay) writeFileSync(path.join(ROOT, 'ai-test-agent', 'recorded', `${name}.response.json`), JSON.stringify(out, null, 2));
  console.log(`\n▶ Wrote ${path.relative(ROOT, specFile)}\n▶ Running it...`);

  const results = runSpec(path.relative(ROOT, specFile));
  for (const r of results) console.log(`  ${r.ok ? '✓' : '✗'} ${r.title}`);

  console.log('\n▶ Coverage by acceptance criterion');
  const gaps: string[] = [];
  for (const c of criteriaOf(story)) {
    const covering = results.filter((r) => r.title.includes(`[AC${c.n}]`));
    const passing = covering.filter((r) => r.ok);
    const mark = passing.length ? '✓ covered' : covering.length ? '✗ failing' : '○ no test';
    console.log(`  AC${c.n} ${mark.padEnd(10)} ${c.text}`);
    if (!passing.length) gaps.push(`AC${c.n}: ${c.text}`);
  }
  console.log(gaps.length ? `\n▶ Gaps to review (${gaps.length}):\n  - ${gaps.join('\n  - ')}` : '\n▶ Every acceptance criterion has a passing test.');
  if (results.some((r) => !r.ok)) process.exitCode = 1;
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
});
