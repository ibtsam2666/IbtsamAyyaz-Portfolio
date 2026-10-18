// Minimal static server for the portfolio pages, used by the site tests and Lighthouse.
//   node scripts/serve.mjs [port]
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { extname, relative, resolve, sep } from 'node:path';

const root = process.cwd();
const port = Number(process.argv[2] ?? process.env.PORT ?? 4179);
const mime = {
  '.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8', '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json', '.txt': 'text/plain; charset=utf-8', '.md': 'text/markdown; charset=utf-8',
  '.svg': 'image/svg+xml', '.png': 'image/png', '.webm': 'video/webm', '.pdf': 'application/pdf', '.xml': 'application/xml',
};

createServer(async (req, res) => {
  let pathname = decodeURIComponent(new URL(req.url, 'http://localhost').pathname);
  if (pathname.endsWith('/')) pathname += 'index.html';
  const target = resolve(root, `.${pathname}`);
  const rel = relative(root, target);
  if (rel.startsWith('..') || rel.split(sep).includes('node_modules')) return res.writeHead(403).end('Forbidden');
  try {
    const data = await readFile(target);
    res.writeHead(200, { 'content-type': mime[extname(target)] ?? 'application/octet-stream' }).end(data);
  } catch {
    const notFound = await readFile(resolve(root, '404.html')).catch(() => 'Not found');
    res.writeHead(404, { 'content-type': 'text/html; charset=utf-8' }).end(notFound);
  }
}).listen(port, '127.0.0.1', () => console.log(`Serving ${root} on http://127.0.0.1:${port}`));
