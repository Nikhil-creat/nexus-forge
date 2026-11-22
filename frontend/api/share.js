'use strict';
const crypto = require('crypto');
const { store } = require('./_store.js');
const { sameOrigin, ipOf, makeLimiter } = require('./_guard.js');
const FIELDS = ['csv', 'xs', 'ys', 'px', 'series', 'doc', 'q', 'pts', 'kk', 'tr', 'qq', 'logs'];
const TTL = 30 * 24 * 3600, ABC = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
const limited = makeLimiter(() => Number(process.env.SHARE_RATE_LIMIT) || 20);

async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  const db = store();
  if (!db) return res.status(503).json({ error: 'Short links are not enabled on this site.' });
  if (limited(ipOf(req))) return res.status(429).json({ error: 'Too many requests. Try again in a minute.' });
  try {
    if (req.method === 'GET') {
      const id = String((req.query && req.query.id) || new URL(req.url || '/', 'http://x').searchParams.get('id') || '');
      if (!/^[A-Za-z0-9]{10}$/.test(id)) return res.status(400).json({ error: 'Invalid link.' });
      const v = await db.get('share:' + id);
      if (!v) return res.status(404).json({ error: 'This link expired or does not exist.' });
      return res.status(200).json({ data: JSON.parse(v) });
    }
    if (req.method !== 'POST') { res.setHeader('Allow', 'GET, POST'); return res.status(405).json({ error: 'Use GET or POST.' }); }
    if (!sameOrigin(req)) return res.status(403).json({ error: 'Origin not allowed.' });
    const src = req.body && req.body.data && typeof req.body.data === 'object' ? req.body.data : null;
    if (!src) return res.status(400).json({ error: 'Nothing to share.' });
    const data = {}; let total = 0;
    for (const k of FIELDS) if (typeof src[k] === 'string') { data[k] = src[k].slice(0, 150000); total += data[k].length; }
    if (!total) return res.status(400).json({ error: 'Nothing to share.' });
    if (total > 200000) return res.status(413).json({ error: 'This workspace is too large to share (limit about 200 KB).' });
    const id = Array.from(crypto.randomBytes(10), b => ABC[b % 62]).join('');
    await db.set('share:' + id, JSON.stringify(data), TTL);
    return res.status(200).json({ id, days: 30 });
  } catch (e) { return res.status(502).json({ error: 'The link store is unavailable right now.' }); }
}
module.exports = handler;
module.exports._reset = () => limited.reset();
