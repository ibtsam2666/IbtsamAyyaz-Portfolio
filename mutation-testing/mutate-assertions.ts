/**
 * Assertion mutation testing for Playwright specs.
 *
 * For every `expect(...)` assertion in a spec, write a temporary copy of the spec with
 * that one assertion mutated, run only that copy, and check that it fails.
 *   - KILLED   the mutated test failed: the assertion really protects the behaviour.
 *   - SURVIVED the mutated test still passed: the assertion is weak or never runs.
 *
 * Usage:
 *   npm run mutate -- ui-tests/tests/checkout.spec.ts [--project=ui] [--limit=10]
 */
import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import path from 'node:path';

type Mutant = { line: number; original: string; mutated: string; rule: string };

// Each rule rewrites one assertion so the expectation becomes wrong.
const RULES: { name: string; match: RegExp; apply: (line: string) => string }[] = [
  { name: 'negate matcher', match: /expect\((.*)\)\.(?!not\.)(to\w+)\(/, apply: (l) => l.replace(/expect\((.*?)\)\.(to\w+)\(/, 'expect($1).not.$2(') },
  { name: 'remove negation', match: /\.not\.to\w+\(/, apply: (l) => l.replace('.not.', '.') },
  { name: 'change number', match: /\b(toBe|toEqual|toBeCloseTo|toHaveCount|toBeGreaterThan|toBeLessThan)\(\s*-?\d/, apply: (l) => l.replace(/(\(\s*)(-?\d+(?:\.\d+)?)/, (_m, p, n) => `${p}${Number(n) + 1}`) },
  { name: 'change text', match: /\b(toHaveText|toContainText|toHaveURL|toBe)\(\s*['"`]/, apply: (l) => l.replace(/(\(\s*['"`])/, '$1MUTATED ') },
];

function mutantsFor(source: string): Mutant[] {
  const out: Mutant[] = [];
  source.split('\n').forEach((text, i) => {
    if (!text.includes('expect(') || text.trim().startsWith('//')) return;
    // Prefer the most specific rule that applies; one mutant per assertion line.
    const rule = [...RULES].reverse().find((r) => r.match.test(text)) ?? RULES[0];
    const mutated = rule.apply(text);
    if (mutated !== text) out.push({ line: i, original: text, mutated, rule: rule.name });
  });
  return out;
}

function runSpec(file: string, project?: string): boolean {
  const args = ['playwright', 'test', file, '--reporter=dot', '--retries=0', '--workers=1'];
  if (project) args.push(`--project=${project}`);
  try {
    // Run Playwright's CLI through node directly so no shell is needed on any OS.
    // Drop the tsx loader from NODE_OPTIONS so Playwright compiles the spec itself.
    const env = { ...process.env, NODE_OPTIONS: '' };
    const cli = path.resolve('node_modules/@playwright/test/cli.js');
    execFileSync(process.execPath, [cli, ...args.slice(1)], { stdio: 'pipe', env });
    return true; // passed
  } catch (e) {
    const out = String((e as { stdout?: Buffer }).stdout ?? '') + String((e as { stderr?: Buffer }).stderr ?? '');
    if (process.env.MUTATE_DEBUG) console.error(out.slice(-1500));
    // "No tests found" means the run never happened; never count it as a killed mutant.
    if (/No tests found/.test(out)) throw new Error(`Playwright found no tests in ${file}. Check the path and the project's testMatch.`);
    return false; // failed
  }
}

function main() {
  const file = process.argv[2];
  if (!file || !existsSync(file)) {
    console.error('Usage: npm run mutate -- <path/to/spec.ts> [--project=ui|api] [--limit=N]');
    process.exit(2);
  }
  const project = process.argv.find((a) => a.startsWith('--project='))?.split('=')[1] ?? (file.startsWith('api-tests') ? 'api' : 'ui');
  const limit = Number(process.argv.find((a) => a.startsWith('--limit='))?.split('=')[1] ?? Infinity);

  const source = readFileSync(file, 'utf8');
  const mutants = mutantsFor(source).slice(0, limit);
  console.log(`\nMutation run: ${file} (${mutants.length} mutants, project ${project})\n`);

  console.log('Baseline: running the original spec...');
  if (!runSpec(file, project)) {
    console.error('The original spec fails. Fix it before mutation testing.');
    process.exit(1);
  }

  // Forward slashes: Playwright treats the path as a pattern, and Windows backslashes break it.
  const tmp = path.posix.join(path.dirname(file).replace(/\\/g, '/'), `__mutant__.${path.basename(file)}`);
  let killed = 0;
  const survivors: Mutant[] = [];
  try {
    for (const [n, m] of mutants.entries()) {
      const lines = source.split('\n');
      lines[m.line] = m.mutated;
      writeFileSync(tmp, lines.join('\n'));
      const passed = runSpec(tmp, project);
      const verdict = passed ? 'SURVIVED' : 'KILLED  ';
      console.log(`${String(n + 1).padStart(2)}. ${verdict} line ${m.line + 1} (${m.rule}): ${m.mutated.trim()}`);
      if (passed) survivors.push(m);
      else killed++;
    }
  } finally {
    rmSync(tmp, { force: true });
  }

  const score = mutants.length ? Math.round((killed / mutants.length) * 100) : 100;
  console.log(`\nMutation score: ${score}% (${killed}/${mutants.length} killed)`);
  if (survivors.length) {
    console.log('Survivors point at assertions to strengthen:');
    for (const s of survivors) console.log(`  line ${s.line + 1}: ${s.original.trim()}`);
    process.exitCode = 1;
  }
}

main();
