/**
 * Talks to the MCP server the way an AI assistant would: starts it over stdio,
 * lists its tools, calls list_failed_tests, then reruns one test by case ID. Used in CI and locally:
 *   npx tsx mcp-rerun-server/smoke-client.ts
 */
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import path from 'node:path';

async function main() {
  const transport = new StdioClientTransport({
    command: process.execPath,
    args: [path.resolve('node_modules/tsx/dist/cli.mjs'), path.resolve('mcp-rerun-server/server.ts')],
  });
  const client = new Client({ name: 'smoke-client', version: '1.0.0' });
  await client.connect(transport);

  const { tools } = await client.listTools();
  console.log('Tools:', tools.map((t) => t.name).join(', '));

  const res = await client.callTool({ name: 'list_failed_tests', arguments: {} });
  console.log('\nlist_failed_tests →\n' + (res.content as { text: string }[])[0].text);

  // Run one fast API test by its case ID, the way a test-management ID is used at work.
  const byId = await client.callTool({ name: 'rerun_by_id', arguments: { ids: ['TC-401'] } });
  console.log('\nrerun_by_id TC-401 →\n' + (byId.content as { text: string }[])[0].text.split('\n')[0]);
  console.log('structured:', JSON.stringify(byId.structuredContent));

  await client.close();
  const names = tools.map((t) => t.name);
  const ran = (byId.structuredContent as { counts?: { passed: number; skipped: number } } | undefined)?.counts;
  if (!['rerun_failed', 'rerun_by_id', 'run_tests', 'list_failed_tests'].every((n) => names.includes(n))) process.exit(1);
  if (!ran || ran.passed + ran.skipped < 1) process.exit(1);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
