#!/usr/bin/env node
'use strict';
// Zero-dependency local server that behaves like Vercel: clean URLs with trailing slash, 404.html, /api/* functions and the headers from vercel.json.
const http = require('http'), fs = require('fs'), path = require('path');
const ROOT = path.join(__dirname, '..', 'frontend'), PORT = Number(process.env.PORT) || 3000;
const MIME = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.svg': 'image/svg+xml', '.png': 'image/png', '.jpg': 'image/jpeg', '.ico': 'image/x-icon', '.txt': 'text/plain; charset=utf-8', '.xml': 'application/xml', '.webmanifest': 'application/manifest+json', '.mp4': 'video/mp4' };
let GLOBAL = {};
try { const v = JSON.parse(fs.readFileSync(path.join(ROOT, 'vercel.json'), 'utf8')); for (const h of (v.headers.find(x => x.source === '/(.*)') || { headers: [] }).headers) GLOBAL[h.key] = h.value; } catch (e) { /* no vercel.json */ }
// plain http on localhost: drop the https-only directives
if (GLOBAL['Content-Security-Policy']) GLOBAL['Content-Security-Policy'] = GLOBAL['Content-Security-Policy'].replace('; upgrade-insecure-requests', '');
delete GLOBAL['Strict-Transport-Security'];
function file(res, status, fp) { res.writeHead(status, { 'Content-Type': MIME[path.extname(fp)] || 'application/octet-stream' }); fs.createReadStream(fp).pipe(res); }
function redirect(res, to) { res.writeHead(308, { Location: to }); res.end(); }
const server = http.createServer(async (req, res) => {
  for (const k in GLOBAL) res.setHeader(k, GLOBAL[k]);
  const u = new URL(req.url, 'http://localhost'); let p;
  try { p = decodeURIComponent(u.pathname); } catch (e) { res.statusCode = 400; return res.end(); }
  if (p.startsWith('/api/')) {
    const name = p.slice(5).replace(/\/$/, ''), f = path.join(ROOT, 'api', name + '.js');
    if (!/^[\w-]+$/.test(name) || name.startsWith('_') || !fs.existsSync(f)) { res.writeHead(404, { 'Content-Type': 'application/json' }); return res.end('{"error":"Not found"}'); }
    let body = ''; for await (const c of req) body += c;
    try { req.body = body ? JSON.parse(body) : {}; } catch (e) { req.body = {}; }
    res.status = c => { res.statusCode = c; return res; };
    res.json = o => { res.setHeader('Content-Type', 'application/json'); res.end(JSON.stringify(o)); return res; };
    try { await require(f)(req, res); } catch (e) { console.error(e); if (!res.headersSent) { res.statusCode = 500; res.end('{"error":"Server error"}'); } }
    return;
  }
  if (p.endsWith('/index.html')) return redirect(res, p.slice(0, -10) || '/');
  const fp = path.join(ROOT, p);
  if (!fp.startsWith(ROOT)) { res.statusCode = 403; return res.end(); }
  if (fs.existsSync(fp) && fs.statSync(fp).isDirectory()) {
    if (!p.endsWith('/')) return redirect(res, p + '/' + u.search);
    const ix = path.join(fp, 'index.html'); if (fs.existsSync(ix)) return file(res, 200, ix);
  } else if (fs.existsSync(fp)) return file(res, 200, fp);
  file(res, 404, path.join(ROOT, '404.html'));
});
if (require.main === module) server.listen(PORT, () => console.log('Nexus Forge dev server on http://localhost:' + PORT));
module.exports = server;
