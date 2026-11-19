'use strict';
const { pick, complete } = require('./_ai.js');
const SYSTEM = 'You are Nexus, an assistant for data analytics, machine learning and cybersecurity. Be concise and accurate.';
const hits = new Map();

function limited(ip) {
  const now = Date.now(), a = (hits.get(ip) || []).filter(t => now - t < 60000);
  a.push(now); hits.set(ip, a);
  if (hits.size > 500) hits.clear();
  return a.length > (Number(process.env.RATE_LIMIT) || 20);
}
function sameOrigin(req) {
  const o = req.headers.origin;
  if (!o) return true;
  try { if (new URL(o).host === req.headers.host) return true; } catch (e) { return false; }
  return String(process.env.ALLOWED_ORIGINS || '').split(',').map(s => s.trim()).filter(Boolean).includes(o);
}
async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  if (req.method !== 'POST') { res.setHeader('Allow', 'POST'); return res.status(405).json({ error: 'Use POST.' }); }
  if (!sameOrigin(req)) return res.status(403).json({ error: 'Origin not allowed.' });
  const ip = String(req.headers['x-forwarded-for'] || (req.socket && req.socket.remoteAddress) || '?').split(',')[0].trim();
  if (limited(ip)) return res.status(429).json({ error: 'Too many requests. Try again in a minute.' });
  const b = req.body && typeof req.body === 'object' ? req.body : {};
  const msg = typeof b.message === 'string' ? b.message.trim() : '';
  if (!msg || msg.length > 2000) return res.status(400).json({ error: 'Send a message of 1 to 2000 characters.' });
  const hist = Array.isArray(b.history)
    ? b.history.slice(-6).filter(m => m && (m.role === 'user' || m.role === 'assistant') && typeof m.content === 'string').map(m => ({ role: m.role, content: m.content.slice(0, 2000) }))
    : [];
  if (!pick()) return res.status(200).json({ mode: 'offline', reply: 'No AI key is configured on the server.' });
  if (b.stream !== true) {
    try {
      const r = await complete({ system: SYSTEM, user: msg, history: hist });
      return res.status(200).json({ mode: 'live', reply: r.text, provider: r.provider, model: r.model });
    } catch (e) { return res.status(502).json({ error: e.message }); }
  }
  res.statusCode = 200;
  res.setHeader('Content-Type', 'text/event-stream; charset=utf-8');
  res.setHeader('Cache-Control', 'no-store, no-transform');
  res.setHeader('X-Accel-Buffering', 'no');
  let sent = 0;
  const w = o => res.write('data: ' + JSON.stringify(o) + '\n\n');
  try {
    const r = await complete({ system: SYSTEM, user: msg, history: hist, onToken: t => { w({ d: t.slice(sent) }); sent = t.length; } });
    if (sent === 0) w({ d: r.text });
    w({ done: true, provider: r.provider, model: r.model });
  } catch (e) { w({ error: e.message }); }
  res.end();
}
module.exports = handler;
module.exports._hits = hits;
