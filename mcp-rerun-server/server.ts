/**
 * Entry point: starts the playwright-rerun MCP server over stdio.
 *   npx tsx mcp-rerun-server/server.ts        (from the Playwright project root)
 * The tools live in tools.ts; the report parsing in report.ts.
 */
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { createServer } from './tools';

createServer()
  .connect(new StdioServerTransport())
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
