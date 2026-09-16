// Local preview server for the exported static build. Serves game/out on a port so the
// page can be opened in a browser (and so the standalone host-detection path is exercised
// the same way a judge would hit it). Static files only, no framework, no deps.
//   node scripts/preview.mjs [port]
import { createServer } from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { dirname, extname, join, normalize, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..', 'out');
const port = Number(process.argv[2] ?? 3400);

const TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.txt': 'text/plain; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.webp': 'image/webp',
  '.png': 'image/png',
  '.woff2': 'font/woff2',
};

// Deliberately no X-Frame-Options and no frame-ancestors: the Chain.wtf host embeds this
// page in an iframe, and a blocking header would break the integration (jam site: a host
// that blocks framing shows only a pitch teaser instead of a live game).

async function resolveFile(urlPath) {
  const clean = normalize(decodeURIComponent(urlPath.split('?')[0])).replace(/^(\.\.[/\\])+/, '');
  const candidates = [
    join(root, clean),
    join(root, `${clean}.html`),
    join(root, clean, 'index.html'),
  ];
  for (const candidate of candidates) {
    try {
      const info = await stat(candidate);
      if (info.isFile()) return candidate;
    } catch {
      /* try the next shape */
    }
  }
  return null;
}

createServer(async (req, res) => {
  const file = await resolveFile(req.url ?? '/');
  if (!file) {
    const notFound = join(root, '404.html');
    try {
      const body = await readFile(notFound);
      res.writeHead(404, { 'content-type': TYPES['.html'] }).end(body);
    } catch {
      res.writeHead(404, { 'content-type': TYPES['.txt'] }).end('not found');
    }
    return;
  }
  const body = await readFile(file);
  res.writeHead(200, { 'content-type': TYPES[extname(file)] ?? 'application/octet-stream' }).end(body);
}).listen(port, () => {
  console.log(`preview: http://localhost:${port}  (serving ${root})`);
});
