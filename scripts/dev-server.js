'use strict';
// Local server that mirrors the Vercel layout: static files from the project
// root and serverless functions from /api. Usage: npm run dev [-- --port 3000]
const http = require('http');
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const portArg = process.argv.indexOf('--port');
const PORT = Number(portArg > -1 ? process.argv[portArg + 1] : process.env.PORT) || 3000;
const TYPES = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.svg': 'image/svg+xml', '.png': 'image/png', '.ico': 'image/x-icon', '.md': 'text/plain; charset=utf-8' };
const PUBLIC = new Set(['index.html', 'terms.html', 'privacy.html']);

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, `http://localhost:${PORT}`);
  const route = url.pathname.match(/^\/api\/([a-z-]+)\/?$/);
  if (route) {
    const file = path.join(ROOT, 'api', `${route[1]}.js`);
    if (!fs.existsSync(file)) { res.statusCode = 404; return res.end('{"ok":false,"error":"Not found"}'); }
    return require(file)(req, res);
  }
  const name = url.pathname === '/' ? 'index.html' : decodeURIComponent(url.pathname.slice(1));
  if (!PUBLIC.has(name)) { res.statusCode = 404; res.setHeader('Content-Type', 'text/plain'); return res.end('Not found'); }
  res.setHeader('Content-Type', TYPES[path.extname(name)] || 'application/octet-stream');
  res.setHeader('Cache-Control', 'no-store');
  fs.createReadStream(path.join(ROOT, name)).pipe(res);
});

server.listen(PORT, '127.0.0.1', () => console.log(`EquityLens running at http://localhost:${PORT}`));
