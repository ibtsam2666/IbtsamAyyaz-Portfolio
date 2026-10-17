#!/usr/bin/env node
import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const data = JSON.parse(readFileSync(path.join(root, 'ai-test-agent/lab-replay.json'), 'utf8'));
const args = process.argv.slice(2);
const value = (flag, fallback) => {
  const i = args.indexOf(flag);
  return i === -1 ? fallback : args[i + 1];
};
const scenario = value('--scenario', 'all');
const decision = value('--decision', 'pending');
const rationale = value('--rationale', 'No rationale supplied.');
const format = value('--format', 'json');
const outFile = value('--out', '');
const names = ['evaluation', 'triage', 'review', 'trace', 'recovery', 'economics'];

if (!names.includes(scenario) && scenario !== 'all') {
  console.error(`Unknown scenario: ${scenario}\nChoose: ${names.join(', ')}, all`);
  process.exit(2);
}
if (!['pending', 'approve', 'changes'].includes(decision)) {
  console.error('Decision must be pending, approve, or changes.');
  process.exit(2);
}
if (!['json', 'html'].includes(format)) {
  console.error('Format must be json or html.');
  process.exit(2);
}

function evaluation() {
  const stories = data.stories;
  const criteria = stories.reduce((n, s) => n + s.criteria, 0);
  const covered = stories.reduce((n, s) => n + s.covered, 0);
  const passing = stories.reduce((n, s) => n + s.validPassing, 0);
  const baselineCovered = stories.reduce((n, s) => n + s.baselineCovered, 0);
  const baselinePassing = stories.reduce((n, s) => n + s.baselinePassing, 0);
  const humanCovered = stories.reduce((n, s) => n + s.humanCovered, 0);
  const humanPassing = stories.reduce((n, s) => n + s.humanPassing, 0);
  const score = (coveredCriteria, validPassingChecks) => ({
    criteriaCoveragePercent: Math.round(coveredCriteria / criteria * 100),
    validPassingPercent: Math.round(validPassingChecks / criteria * 100)
  });
  return {
    scenario: 'evaluation', dataset: data.label,
    stories: stories.length, criteria, coveredCriteria: covered, validPassingChecks: passing,
    fullyMappedStories: stories.filter(s => s.covered === s.criteria).length,
    ratesPercent: {
      criteriaMapping: Math.round(covered / criteria * 100),
      validPassing: Math.round(passing / criteria * 100),
      repositoryConventions: 96,
      meaningfulAssertions: 84
    },
    comparison: {
      sharedRubric: ['criteria coverage', 'valid passing checks'],
      baseline: { coveredCriteria: baselineCovered, validPassingChecks: baselinePassing, ...score(baselineCovered, baselinePassing) },
      agent: { coveredCriteria: covered, validPassingChecks: passing, ...score(covered, passing) },
      human: { coveredCriteria: humanCovered, validPassingChecks: humanPassing, ...score(humanCovered, humanPassing) }
    },
    storyEvidence: stories.map(({ id, issue, evidence }) => ({ story: id, issue: issue ?? 'none recorded', evidence })),
    issues: stories.filter(s => s.issue).map(({ id, issue }) => ({ story: id, issue })),
    note: 'Fixed illustrative replay corpus; rubric dimensions are sample labels, not independently observed benchmark results.'
  };
}

function triage() {
  const f = data.triage;
  const delta = Math.round((f.actualTotal - f.expectedTotal) * 100) / 100;
  const likelyProductDefect = f.browserHealthy && f.httpStatus >= 200 && f.httpStatus < 300 && f.retries === 0 && f.reproductions >= 3 && delta !== 0;
  const classify = c => {
    if (!c.browserHealthy || c.httpStatus >= 500) return 'environment';
    if (c.dataFixtureInvalid) return 'test data';
    if (c.retries > 0 || c.reproductions < 2) return 'test instability';
    if (c.valueMismatch && c.httpStatus >= 200 && c.httpStatus < 300) return 'product defect';
    return 'needs investigation';
  };
  return {
    scenario: 'triage', baseline: f.failureOnlyBaseline,
    evidence: { totalDelta: delta, httpStatus: f.httpStatus, reproductions: f.reproductions, retries: f.retries, browserHealthy: f.browserHealthy },
    evidenceBasedClassification: likelyProductDefect ? 'likely product defect' : 'needs investigation',
    rationale: likelyProductDefect ? 'Repeatable value mismatch with healthy browser, successful response, and no retries.' : 'Evidence is insufficient to distinguish product defect from test or environment noise.',
    method: 'Deterministic evidence rules, not a model call.',
    cases: data.triageCases.map(c => ({ id: c.id, label: c.label, expected: c.expected, classifiedAs: classify(c), correct: classify(c) === c.expected, signals: c.signals }))
  };
}

function review() {
  return {
    scenario: 'review', change: data.review.change, policyChecks: data.review.policyChecks,
    decision, executionEnabled: false,
    auditEntry: { at: new Date().toISOString(), reviewer: 'local operator (demo)', decision, rationale },
    disposition: decision === 'approve' ? 'approved in demo only; execution remains disabled' : decision === 'changes' ? 'changes requested; execution remains disabled' : 'waiting for human review; execution blocked',
    note: 'This replay never runs, writes, commits, or publishes the proposed change.'
  };
}

function trace() {
  return { scenario: 'trace', dataset: data.label, events: data.trace, totalRecordedMs: data.trace.reduce((n, e) => n + e.durationMs, 0), note: 'Recorded illustrative trace, not a live model execution.' };
}

function recovery() {
  const attempts = data.recovery.attempts.slice(0, data.recovery.maxAttempts);
  const success = attempts.find(a => a.ok);
  return {
    scenario: 'recovery', maxAttempts: data.recovery.maxAttempts, attempts,
    recovered: Boolean(success), disposition: success ? 'recovered; request human review' : 'stopped at retry limit; return evidence for human review',
    changedFiles: data.recovery.changedFiles,
    assertionPolicy: 'Never weaken an assertion to force a pass.'
  };
}

function economics() {
  const e = data.economics;
  const estimate = (e.assumedInputTokens * e.assumedInputUsdPerMillion + e.assumedOutputTokens * e.assumedOutputUsdPerMillion) / 1_000_000;
  return {
    scenario: 'economics', estimates: {
      manualMinutes: e.manualMinutes,
      replaySeconds: e.replaySeconds,
      replayApiCostUsd: 0,
      liveSeconds: e.liveSeconds,
      assumedLiveApiCostUsd: Number(estimate.toFixed(4))
    },
    assumptions: { inputTokens: e.assumedInputTokens, outputTokens: e.assumedOutputTokens, inputUsdPerMillion: e.assumedInputUsdPerMillion, outputUsdPerMillion: e.assumedOutputUsdPerMillion },
    note: e.currencyNote
  };
}

const handlers = { evaluation, triage, review, trace, recovery, economics };
const result = scenario === 'all'
  ? { dataset: data.label, scenarios: Object.fromEntries(names.map(name => [name, handlers[name]()])) }
  : handlers[scenario]();
const json = JSON.stringify(result, null, 2);
const html = `<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width"><title>AI QA Lab Run Report</title><style>body{font:16px/1.6 system-ui;max-width:900px;margin:40px auto;padding:0 18px;background:#071014;color:#e9f2f2}h1{color:#3ee6ff}pre{white-space:pre-wrap;overflow-wrap:anywhere;background:#101c22;border:1px solid #25414a;border-radius:10px;padding:18px}small{color:#a4b9bc}</style><h1>AI QA Lab Run Report</h1><small>Illustrative replay data · ${new Date().toISOString()}</small><pre>${json.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;')}</pre></html>`;
const output = format === 'html' ? html : `${json}\n`;
if (outFile) writeFileSync(path.resolve(outFile), output, 'utf8');
else process.stdout.write(output);
