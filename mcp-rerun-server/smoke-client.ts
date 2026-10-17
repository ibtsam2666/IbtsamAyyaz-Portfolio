/**
 * Talks to the MCP server the way an AI assistant would: starts it over stdio,
 * lists its tools and calls list_failed_tests. Used as a quick check in CI and locally:
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

  await client.close();
  if (!tools.some((t) => t.name === 'rerun_failed')) process.exit(1);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
