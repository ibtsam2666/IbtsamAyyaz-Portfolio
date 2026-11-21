/**
 * Talks to the MCP server the way an AI assistant would: starts it over stdio, lists its tools,
 * lists the API tests with their case IDs (without running them), checks the last report for
 * failures, then reruns one test by case ID. Used in CI and locally:
 *   npx tsx mcp-rerun-server/smoke-client.ts
 */
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import path from 'node:path';

type Reply = { content: { text: string }[]; structuredContent?: Record<string, any> };

async function main() {
  const transport = new StdioClientTransport({
    command: process.execPath,
    args: [path.resolve('node_modules/tsx/dist/cli.mjs'), path.resolve('mcp-rerun-server/server.ts')],
  });
  const client = new Client({ name: 'smoke-client', version: '1.0.0' });
  await client.connect(transport);
  const call = async (name: string, args: Record<string, unknown> = {}) => {
    const r = (await client.callTool({ name, arguments: args })) as unknown as Reply;
    console.log(`\n${name} ${JSON.stringify(args)} →\n${r.content[0].text.split('\n').slice(0, 6).join('\n')}`);
    return r;
  };

  const names = (await client.listTools()).tools.map((t) => t.name);
  console.log('Tools:', names.join(', '));

  // Find tests by case ID before running anything, the way a test-management ID is used at work.
  const listed = await call('list_tests', { project: 'api' });
  await call('list_failed_tests');
  const byId = await call('rerun_by_id', { ids: ['TC-401'] });
  console.log('structured:', JSON.stringify(byId.structuredContent));
  await client.close();

  const counts = byId.structuredContent?.counts as { passed: number; skipped: number } | undefined;
  const checks: [string, boolean][] = [
    ['6 tools', ['list_failed_tests', 'show_trace', 'list_tests', 'rerun_failed', 'rerun_by_id', 'run_tests'].every((n) => names.includes(n))],
    ['list_tests finds the API cases', (listed.structuredContent?.withIds ?? 0) >= 10],
    ['rerun_by_id TC-401 ran', !!counts && counts.passed + counts.skipped >= 1],
  ];
  for (const [name, ok] of checks) console.log(`${ok ? 'ok  ' : 'FAIL'} ${name}`);
  if (checks.some(([, ok]) => !ok)) process.exit(1);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
