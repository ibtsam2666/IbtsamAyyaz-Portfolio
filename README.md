# Ibtsam Ayyaz · QA Automation Engineer / SDET

[![CI](https://github.com/ibtsam2666/IbtsamAyyaz-Portfolio/actions/workflows/ci.yml/badge.svg)](https://github.com/ibtsam2666/IbtsamAyyaz-Portfolio/actions/workflows/ci.yml)

I build test automation that engineers trust: Playwright and Cypress in TypeScript, fast CI pipelines, and AI-driven QA agents that plan, write, triage and migrate tests.

- **Portfolio site:** https://ibtsam2666.github.io/IbtsamAyyaz-Portfolio/
- **Latest test report (from CI):** https://ibtsam2666.github.io/IbtsamAyyaz-Portfolio/report/
- **LinkedIn:** https://www.linkedin.com/in/ibtsamayyaz/
- **Email:** ibtsamayyaz01@gmail.com

Based in Lahore, Pakistan. Open to remote roles (including U.S. hours) and to relocation with visa sponsorship.

## Start here (2 minutes)

- **Framework:** [`ui-tests/`](ui-tests) (Page Object Model, fixtures, data-driven logins) and [`api-tests/`](api-tests) (zod contracts, self-cleaning data). Every test carries a case ID tag such as `@TC-301`.
- **Cypress to Playwright:** [`cypress-migration/`](cypress-migration) puts one Cypress spec next to its Playwright migration, with a mutation check showing every migrated assertion still catches a bug.
- **MCP server:** [`mcp-rerun-server/`](mcp-rerun-server) lets an AI assistant list failed tests, explain one from its trace, and rerun only those or rerun by case ID. Also published on its own as [playwright-rerun-mcp](https://github.com/ibtsam2666/playwright-rerun-mcp).
- **Proof it runs:** the [CI badge](https://github.com/ibtsam2666/IbtsamAyyaz-Portfolio/actions/workflows/ci.yml) (runs on every push and weekly) and the [latest HTML report](https://ibtsam2666.github.io/IbtsamAyyaz-Portfolio/report/).
- **Résumé:** [`resume.pdf`](resume.pdf), one page, 5+ years in QA automation.

The demos hit free public practice apps. When one of them is down, its tests are skipped with a `demo-unavailable` note instead of failing the build.

## Highlights from my work

| Result | How |
|---|---|
| Regression suite grew from 3,000 to ~7,000 tests | Page Object Model, reusable utilities and JSON-driven execution, with coverage added as features shipped |
| Automated failures cut from 400+ to ~80 in the first year | Failure-by-failure investigation of flaky tests and test data |
| Full-suite CI runtime cut from 3–4 hours to ~30 minutes | Jenkins runs split into independent parallel groups |
| Regression recovery cut from 1–1.5 days to ~4–5 hours | Retry workflows that read Xray failures, restore test databases and rerun only failed tests |
| Cypress suite migrated to Playwright in six days | A guarded migration agent (~500 tests/day) with assertion-level mutation testing |
| QA capacity raised from 1–2 to 3–6 tickets per person | A 14-agent AI QA suite for planning, generation, PR review, triage and release impact |

Employer and client code is under NDA, so it is not here. The demos below recreate the same techniques against public practice apps ([Sauce Demo](https://www.saucedemo.com) and [Restful Booker](https://restful-booker.herokuapp.com)).

## What's in this repository

| Folder | What it shows | Status |
|---|---|---|
| [`index.html`](index.html) | The portfolio site: recruiter snapshot, impact metrics, recorded walkthrough, interactive agent pipeline, mutation lab and command palette (Ctrl K) | Live |
| [`agent-lab.html`](agent-lab.html) | Six interactive QA scenarios: evaluation, failure triage, review gates, tool traces, bounded recovery, and cost/speed estimates | Replay, no API key |
| [`ai-test-agent/lab-replay.json`](ai-test-agent/lab-replay.json) + [`scripts/agent-lab-replay.mjs`](scripts/agent-lab-replay.mjs) | Versioned corpus and CLI with shared baseline/agent/human scoring, four triage patterns, audit decisions, evidence traces, and report export | `npm run agent:lab -- --scenario all` |
| [`how-ai-agents-work.html`](how-ai-agents-work.html) | Architecture, evidence rubric, live/replay distinction, and safety boundaries for the demos | Read online |
| [`resume.pdf`](resume.pdf) | One-page QA automation résumé (PDF) | Live |
| [`social-preview.png`](social-preview.png) | Open Graph / social-sharing image | Live |
| [`media/qa-agent-walkthrough.webm`](media/qa-agent-walkthrough.webm) | Screen recording of the illustrative pipeline demo | Live |
| [`case-studies/cart-badge-agent.html`](case-studies/cart-badge-agent.html) | Public end-to-end case study: story → generated tests → acceptance-criteria report | Live |
| [`how-to-run.html`](how-to-run.html) | Short setup guide for tests, the AI agent replay, mutation testing and MCP demo | Live |
| [`ui-tests/`](ui-tests) | Playwright + TypeScript UI framework: Page Object Model, custom fixtures, data-driven logins from JSON, `@smoke` / `@regression` tags, money checks on checkout totals. The `@smoke` tests also run in Firefox and WebKit | Live |
| [`cypress-migration/`](cypress-migration) | A Cypress spec, its Playwright migration with a Cypress-to-Playwright mapping table, and the mutation check on the result (5/5 killed) | Live |
| [`api-tests/`](api-tests) | API tests with [zod](https://zod.dev) contracts, an auth-token fixture that creates and cleans up its own data, negative and security cases | Live |
| [`site-tests/`](site-tests) | The portfolio tests itself: axe WCAG 2.1 AA checks on every page (both themes), titles, descriptions, favicon, one `h1`, and the custom 404, plus a `toHaveScreenshot` visual check of the 404 page | Live |
| [`lighthouserc.json`](lighthouserc.json) + [`scripts/check-links.mjs`](scripts/check-links.mjs) | Quality gates in CI: Lighthouse budgets (accessibility ≥ 95, best practices and SEO ≥ 90) and an internal link and anchor check. The site only deploys when they pass | Live |
| [`.github/workflows/ci.yml`](.github/workflows/ci.yml) | 4-way sharded runs in Chromium, Firefox and WebKit, merged HTML report, a pass/fail/flaky/skipped job summary, type check, ESLint (`eslint-plugin-playwright`) and Prettier, demo checks, Pages deploy of the site plus `/report` | Live |
| [`mutation-testing/`](mutation-testing) | Mutates one assertion at a time and checks the test fails; reports a mutation score and the assertions to strengthen ([sample output](mutation-testing/sample-output.txt)) | Live |
| [`mcp-rerun-server/`](mcp-rerun-server) | An MCP server an AI assistant can call to list tests and failures, explain a failure from its trace, rerun only the failures, or rerun by case ID; unit-tested | Live |
| [`ai-test-agent/`](ai-test-agent) | An agent that turns a user story into a test plan and a Playwright spec, runs it, and reports acceptance criteria with no passing test ([sample run](ai-test-agent/sample-run.txt)) | Live |

## Run it

For a concise, step-by-step setup and demo guide, see [`how-to-run.html`](how-to-run.html).

For the interactive agent evaluation lab, open [`agent-lab.html`](agent-lab.html) directly or visit it from the portfolio. It uses illustrative replay data and requires no API key. Replay locally with `npm run agent:lab -- --scenario all`; export JSON or HTML with `--format html --out agent-lab-report.html`. The browser lab also exports the selected scenario. Review decisions are local only and never execute generated code.

For a live model run, set `ANTHROPIC_API_KEY` in your shell and run `npm run agent -- ai-test-agent/stories/cart-badge.md`. The agent writes a local `.run.json` with model, measured duration, provider input/output tokens and Playwright results. Set `AGENT_INPUT_USD_PER_MILLION` and `AGENT_OUTPUT_USD_PER_MILLION` if you want an estimated API cost using your own rates; without rates, cost remains unset. Replay mode records no model usage.

Requires Node.js 20+.

```bash
npm ci
npx playwright install chromium firefox webkit
npm test                 # UI, API, cross-browser smoke, site, Cypress-migration and MCP unit suites
npx playwright test --project=site   # accessibility and page checks on the portfolio itself
node scripts/check-links.mjs         # internal link check
npm run test:smoke       # only @smoke
npm run lint             # ESLint with eslint-plugin-playwright
npm run format:check     # Prettier
npm run report           # open the HTML report
npm run build:portfolio-assets # regenerate social preview and demo recording
```

### Mutation testing

```bash
npm run mutate -- ui-tests/tests/checkout.spec.ts
npm run mutate -- mutation-testing/examples/weak-assertions.spec.ts   # shows a surviving, dead assertion
```

A **killed** mutant means the assertion really protects the behaviour. A **survivor** means the test stays green even when the expectation is wrong, which usually points at a weak or unreachable assertion.

### MCP rerun server

```bash
npx tsx mcp-rerun-server/smoke-client.ts   # starts the server over stdio and calls it
npm run test:unit                          # unit tests: report parser, trace and listing helpers, path guard, job summary
```

To use it from Claude Code or another MCP client, add the entry in [`mcp-rerun-server/mcp.example.json`](mcp-rerun-server/mcp.example.json) to your MCP config, run from the repo root. Tools:

| Tool | What it does |
|---|---|
| `list_failed_tests` | Reads the last JSON report and lists failed and flaky tests with their case IDs (read-only) |
| `show_trace` | Explains one failed test, found by case ID or title: the full error, where it was thrown, the failing step, and the trace and screenshot paths (read-only) |
| `list_tests` | Lists tests with their case IDs without running them (read-only) |
| `rerun_failed` | Reruns only the tests that failed last time |
| `rerun_by_id` | Reruns tests by case ID, e.g. `["TC-301", "TC-401"]` |
| `run_tests` | Runs a spec file or a project; paths outside the repo are refused |

Each tool returns a text summary plus structured counts. One run at a time, with a 10-minute timeout (`RERUN_TIMEOUT_MS`).

### AI test agent

```bash
npm run agent -- ai-test-agent/stories/cart-badge.md --replay   # no API key needed
ANTHROPIC_API_KEY=... npm run agent -- ai-test-agent/stories/cart-badge.md   # live
```

The agent is given the repo's page objects and fixtures, so the spec it writes reuses them instead of raw selectors. Each test title carries its acceptance-criterion number, which is how the gap report maps coverage.

## Design choices

- **Retries mark flakiness instead of hiding it.** CI retries once; a test that only passes on retry is reported as *flaky* with a saved trace.
- **Assert values, not presence.** The checkout test reads subtotal, tax and total and checks the arithmetic, the same way I check data behind the UI with SQL at work.
- **Visual checks only where the page is ours.** The screenshot test covers the portfolio's own 404 page, not the third-party demo apps, whose look can change at any time. Baselines come from Linux, the OS CI compares on, via the `update-snapshots` workflow.
- **Tests own their data.** The API fixture creates a booking for each test and deletes it afterwards, so tests run in parallel without sharing state.

## Toolkit

Playwright, Cypress, TypeScript, JavaScript, Node.js · Postman, REST, OpenAPI contract testing · SQL, Microsoft SQL Server, MySQL · Jenkins, GitHub Actions · JIRA, Xray, Confluence · Claude Code, GitHub Copilot, MCP server development · Android and iOS testing

## Experience

- **QA Automation Engineer II**, TCP Software (Nov 2024 – present): workforce and payroll systems for U.S. clients
- **SQA Engineer**, TECHVERX (Jul 2021 – Jul 2024): financial trading workflows for a U.S. client
- **BS Computer Science**, COMSATS University Islamabad (2017 – 2021)
