// Checks every internal link and asset in the portfolio pages:
//   - relative hrefs/srcs point at a file that exists (or a folder CI generates, like report/)
//   - "#anchor" and "page.html#anchor" targets exist as an id on that page
//   - absolute links to this site's own GitHub Pages URL resolve to a real file
// External sites are not fetched, so the check is fast and never flaky.
//   node scripts/check-links.mjs
import { existsSync, readFileSync } from 'node:fs';
import { dirname, join, normalize } from 'node:path';

const SITE = 'https://ibtsam2666.github.io/IbtsamAyyaz-Portfolio/';
const PAGES = ['index.html', 'agent-lab.html', 'how-to-run.html', 'how-ai-agents-work.html', 'case-studies/cart-badge-agent.html', '404.html'];
const GENERATED = ['report/']; // produced by CI at deploy time

const idsCache = new Map();
const idsOf = (file) => {
  if (!idsCache.has(file)) idsCache.set(file, new Set([...readFileSync(file, 'utf8').matchAll(/\sid="([^"]+)"/g)].map((m) => m[1])));
  return idsCache.get(file);
};

let checked = 0;
const problems = [];
for (const page of PAGES) {
  const html = readFileSync(page, 'utf8');
  // Skip URLs built inside <script> blocks; they are template strings, not links.
  const markup = html.replace(/<script[\s\S]*?<\/script>/g, '');
  for (const [, attr, raw] of markup.matchAll(/\s(href|src|poster)="([^"]*)"/g)) {
    let url = raw.trim();
    if (!url || /^(mailto:|tel:|data:|javascript:)/.test(url)) continue;
    if (/^https?:\/\//.test(url)) {
      if (!url.startsWith(SITE)) continue; // external: not fetched
      url = url.slice(SITE.length) || 'index.html';
    } else if (url.startsWith('/IbtsamAyyaz-Portfolio/')) {
      url = url.slice('/IbtsamAyyaz-Portfolio/'.length) || 'index.html';
    } else if (!url.startsWith('#')) {
      url = normalize(join(dirname(page), url)).replace(/\\/g, '/');
    }
    checked++;
    const [path, anchor] = url.split('#');
    const target = path === '' ? page : path;
    if (GENERATED.some((g) => target.startsWith(g))) continue;
    const file = target.endsWith('/') ? `${target}index.html` : target;
    if (!existsSync(file)) {
      problems.push(`${page}: ${attr}="${raw}" → missing file ${file}`);
      continue;
    }
    if (anchor && file.endsWith('.html') && !idsOf(file).has(anchor)) problems.push(`${page}: ${attr}="${raw}" → no element with id="${anchor}" in ${file}`);
  }
}

console.log(`Checked ${checked} internal links across ${PAGES.length} pages.`);
if (problems.length) {
  console.error(`\n${problems.length} broken link(s):\n  ${problems.join('\n  ')}`);
  process.exit(1);
}
console.log('No broken internal links.');
