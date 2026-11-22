'use strict';
// Shared request guards for the Vercel Functions.
function sameOrigin(req) {
  const o = req.headers.origin;
  if (!o) return true;
  try { if (new URL(o).host === req.headers.host) return true; } catch (e) { return false; }
  return String(process.env.ALLOWED_ORIGINS || '').split(',').map(s => s.trim()).filter(Boolean).includes(o);
}
function ipOf(req) {
  return String(req.headers['x-forwarded-for'] || (req.socket && req.socket.remoteAddress) || '?').split(',')[0].trim();
}
function makeLimiter(getMax) {
  const hits = new Map();
  const fn = ip => {
    const now = Date.now(), a = (hits.get(ip) || []).filter(t => now - t < 60000);
    a.push(now); hits.set(ip, a);
    if (hits.size > 500) hits.clear();
    return a.length > getMax();
  };
  fn.reset = () => hits.clear();
  return fn;
}
module.exports = { sameOrigin, ipOf, makeLimiter };
