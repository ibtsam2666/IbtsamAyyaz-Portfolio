# Ibtsam Ayyaz · QA Automation Engineer / SDET

[![CI](https://github.com/ibtsam2666/IbtsamAyyaz-Portfolio/actions/workflows/ci.yml/badge.svg)](https://github.com/ibtsam2666/IbtsamAyyaz-Portfolio/actions/workflows/ci.yml)

I build test automation that engineers trust: Playwright and Cypress in TypeScript, fast CI pipelines, and AI-driven QA agents that plan, write, triage and migrate tests.

- **Portfolio site:** https://ibtsam2666.github.io/IbtsamAyyaz-Portfolio/
- **Latest test report (from CI):** https://ibtsam2666.github.io/IbtsamAyyaz-Portfolio/report/
- **LinkedIn:** https://www.linkedin.com/in/ibtsamayyaz/
- **Email:** ibtsamayyaz01@gmail.com

Based in Lahore, Pakistan. Open to remote roles (including U.S. hours) and to relocation with visa sponsorship.

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
| [`index.html`](index.html) | The portfolio site: live canvas background, simulated test run, interactive agent pipeline, mutation lab, command palette (Ctrl K) | Live |
| [`ui-tests/`](ui-tests) | Playwright + TypeScript UI framework: Page Object Model, custom fixtures, data-driven logins from JSON, `@smoke` / `@regression` tags, money checks on checkout totals | Live |
| [`api-tests/`](api-tests) | API tests with [zod](https://zod.dev) contracts, an auth-token fixture that creates and cleans up its own data, negative and security cases | Live |
| [`.github/workflows/ci.yml`](.github/workflows/ci.yml) | 4-way sharded test runs, merged HTML report, type check, demo checks, Pages deploy of the site plus `/report` | Live |
| [`mutation-testing/`](mutation-testing) | Mutates one assertion at a time and checks the test fails; reports a mutation score and the assertions to strengthen ([sample output](mutation-testing/sample-output.txt)) | Live |
| [`mcp-rerun-server/`](mcp-rerun-server) | An MCP server an AI assistant can call to list failed or flaky tests and rerun only those | Live |
| [`ai-test-agent/`](ai-test-agent) | An agent that turns a user story into a test plan and a Playwright spec, runs it, and reports acceptance criteria with no passing test ([sample run](ai-test-agent/sample-run.txt)) | Live |

## Run it

Requires Node.js 20+.

```bash
npm ci
npx playwright install chromium
npm test                 # UI + API suites (20 tests)
npm run test:smoke       # only @smoke
npm run report           # open the HTML report
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
```

To use it from Claude Code or another MCP client, add the entry in [`mcp-rerun-server/mcp.example.json`](mcp-rerun-server/mcp.example.json) to your MCP config, run from the repo root. Tools: `list_failed_tests`, `rerun_failed`, `run_tests`.

### AI test agent

```bash
npm run agent -- ai-test-agent/stories/cart-badge.md --replay   # no API key needed
ANTHROPIC_API_KEY=... npm run agent -- ai-test-agent/stories/cart-badge.md   # live
```

The agent is given the repo's page objects and fixtures, so the spec it writes reuses them instead of raw selectors. Each test title carries its acceptance-criterion number, which is how the gap report maps coverage.

## Design choices

- **Retries mark flakiness instead of hiding it.** CI retries once; a test that only passes on retry is reported as *flaky* with a saved trace.
- **Assert values, not presence.** The checkout test reads subtotal, tax and total and checks the arithmetic, the same way I check data behind the UI with SQL at work.
- **Tests own their data.** The API fixture creates a booking for each test and deletes it afterwards, so tests run in parallel without sharing state.

## Toolkit

Playwright, Cypress, TypeScript, JavaScript, Node.js · Postman, REST, OpenAPI contract testing · SQL, Microsoft SQL Server, MySQL · Jenkins, GitHub Actions · JIRA, Xray, Confluence · Claude Code, GitHub Copilot, MCP server development · Android and iOS testing

## Experience

- **QA Automation Engineer II**, TCP Software (Nov 2024 – present): workforce and payroll systems for U.S. clients
- **SQA Engineer**, TECHVERX (Jul 2021 – Jul 2024): financial trading workflows for a U.S. client
- **BS Computer Science**, COMSATS University Islamabad (2017 – 2021)
