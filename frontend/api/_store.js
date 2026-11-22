'use strict';
// Tiny key-value store over the Upstash Redis REST API (the same API Vercel KV uses). Returns null when no database is configured.
function store(env, f) {
  env = env || process.env; f = f || fetch;
  const url = String(env.UPSTASH_REDIS_REST_URL || env.KV_REST_API_URL || '').replace(/\/$/, '');
  const token = String(env.UPSTASH_REDIS_REST_TOKEN || env.KV_REST_API_TOKEN || '');
  if (!url || !token) return null;
  async function cmd(args) {
    const r = await f(url, { method: 'POST', headers: { Authorization: 'Bearer ' + token, 'Content-Type': 'application/json' }, body: JSON.stringify(args) });
    if (!r.ok) throw new Error('Store error ' + r.status);
    const d = await r.json();
    if (d.error) throw new Error('Store error');
    return d.result;
  }
  return { set: (k, v, ttl) => cmd(['SET', k, v, 'EX', ttl, 'NX']), get: k => cmd(['GET', k]) };
}
module.exports = { store };
