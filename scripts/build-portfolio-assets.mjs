import { chromium } from 'playwright';
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { mkdirSync } from 'node:fs';
import { dirname, extname, join, relative, resolve, sep } from 'node:path';

const root = process.cwd();
const port = 4178;
const baseUrl = `http://127.0.0.1:${port}`;
const mime = {
  '.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8', '.txt': 'text/plain; charset=utf-8',
  '.md': 'text/markdown; charset=utf-8', '.png': 'image/png', '.webm': 'video/webm',
};

const server = createServer(async (req, res) => {
  const pathname = decodeURIComponent(new URL(req.url, baseUrl).pathname);
  const target = resolve(root, `.${pathname === '/' ? '/index.html' : pathname}`);
  const rel = relative(root, target);
  if (rel === '..' || rel.startsWith(`..${sep}`) || resolve(rel) === resolve('..')) {
    res.writeHead(403).end('Forbidden');
    return;
  }
  try {
    const data = await readFile(target);
    res.writeHead(200, { 'content-type': mime[extname(target)] ?? 'application/octet-stream' });
    res.end(data);
  } catch {
    res.writeHead(404).end('Not found');
  }
});

await new Promise((ok, fail) => {
  server.once('error', fail);
  server.listen(port, '127.0.0.1', ok);
});

const out = (name) => resolve(root, name);
for (const path of ['media', 'node_modules/.cache/portfolio-video']) mkdirSync(out(path), { recursive: true });
const browser = await chromium.launch({ headless: true });

try {
  const preview = await browser.newPage({ viewport: { width: 1200, height: 630 }, deviceScaleFactor: 1 });
  await preview.setContent(`<!doctype html><html><head><style>
    *{box-sizing:border-box}html,body{margin:0;width:1200px;height:630px;overflow:hidden}
    body{background:#05090b;color:#e7f2f1;font:24px/1.4 Arial,sans-serif;display:flex;align-items:center;padding:70px;position:relative}
    body:before{content:"";position:absolute;inset:20px;border:1px solid rgba(120,220,230,.35);border-radius:22px}
    .orb{position:absolute;width:410px;height:410px;border:1px solid rgba(62,230,255,.2);border-radius:50%;right:-30px;top:105px;box-shadow:0 0 90px rgba(62,230,255,.08),inset 0 0 90px rgba(156,255,87,.05)}
    .orb:before,.orb:after{content:"";position:absolute;border:1px solid rgba(156,255,87,.25);border-radius:50%;inset:45px}.orb:after{inset:105px}
    .content{position:relative;z-index:1;width:760px}.eyebrow{font:16px Consolas,monospace;letter-spacing:.22em;color:#3ee6ff;text-transform:uppercase}
    h1{font-size:74px;line-height:1;margin:24px 0 14px;letter-spacing:-.04em}h1 span{color:#9cff57}
    p{font-size:26px;color:#a9bfbe;margin:0}.chips{margin-top:30px;display:flex;gap:10px}.chips span{font:15px Consolas,monospace;border:1px solid rgba(120,220,230,.34);border-radius:999px;padding:7px 13px;color:#b6ccca}
    .url{margin-top:34px;font:15px Consolas,monospace;color:#3ee6ff}
  </style></head><body><div class="orb"></div><div class="content"><div class="eyebrow">QA Automation Engineer · SDET</div><h1>Ibtsam <span>Ayyaz</span></h1><p>Reliable test automation, CI and AI-assisted QA.</p><div class="chips"><span>PLAYWRIGHT</span><span>TYPESCRIPT</span><span>AI QA AGENTS</span></div><div class="url">Lahore, Pakistan · Open to remote and relocation</div></div></body></html>`);
  await preview.screenshot({ path: out('social-preview.png') });

  const context = await browser.newContext({
    viewport: { width: 1280, height: 720 },
    deviceScaleFactor: 1,
    recordVideo: { dir: out('node_modules/.cache/portfolio-video'), size: { width: 1280, height: 720 } },
  });
  const page = await context.newPage();
  await page.goto(`${baseUrl}/#demo`, { waitUntil: 'domcontentloaded' });
  await page.locator('a[href="#agents"].primary').click();
  await page.waitForTimeout(20_000);
  const video = page.video();
  await context.close();
  await video.saveAs(out('media/qa-agent-walkthrough.webm'));
  console.log('Built social-preview.png and media/qa-agent-walkthrough.webm. resume.pdf is maintained as a supplied document.');
} finally {
  await browser.close();
  await new Promise((ok) => server.close(ok));
}
