'use strict';
const { pick, complete } = require('./_ai.js');
const { sameOrigin, ipOf, makeLimiter } = require('./_guard.js');
const SYSTEM = 'You are Nexus, an assistant for data analytics, machine learning and cybersecurity. Be concise and accurate.';
const AGENT = 'You are Nexus, a data and security analyst agent working inside a browser workspace. Tools available: analyze_csv(), detect_anomalies(values), fit_regression(x,y,predict), scan_logs(text), cluster(k). Omitted arguments mean "use the workspace inputs". Reply with ONLY one JSON object: {"tool":"name","args":{}} to call a tool, or {"final":"your answer"} when done. Never invent numbers. Use at most 3 tool calls.';
let budget = { d: '', n: 0 };
const limited = makeLimiter(() => Number(process.env.RATE_LIMIT) || 20);
const RAG = 'You answer questions using only the context the user provides. Cite passages as [1], [2]. If the answer is not in the context, say so. Be concise.';
function overBudget() {
  const d = new Date().toISOString().slice(0, 10);
  if (budget.d !== d) budget = { d, n: 0 };
  budget.n++;
  return budget.n > (Number(process.env.DAILY_LIMIT) || 400);
}
async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  if (req.method !== 'POST') { res.setHeader('Allow', 'POST'); return res.status(405).json({ error: 'Use POST.' }); }
  if (!sameOrigin(req)) return res.status(403).json({ error: 'Origin not allowed.' });
  if (limited(ipOf(req))) return res.status(429).json({ error: 'Too many requests. Try again in a minute.' });
  if (overBudget()) return res.status(429).json({ error: 'The daily request limit for this site was reached. Try again tomorrow or paste your own API key in the Assistant tab.' });
  const b = req.body && typeof req.body === 'object' ? req.body : {};
  const msg = typeof b.message === 'string' ? b.message.trim() : '';
  const max = b.persona === 'rag' ? 6000 : 2000;
  if (!msg || msg.length > max) return res.status(400).json({ error: 'Send a message of 1 to ' + max + ' characters.' });
  const hist = Array.isArray(b.history)
    ? b.history.slice(-6).filter(m => m && (m.role === 'user' || m.role === 'assistant') && typeof m.content === 'string').map(m => ({ role: m.role, content: m.content.slice(0, 2000) }))
    : [];
  const system = b.persona === 'agent' ? AGENT : b.persona === 'rag' ? RAG : SYSTEM;
  if (!pick()) return res.status(200).json({ mode: 'offline', reply: 'No AI key is configured on the server.' });
  if (b.stream !== true) {
    try {
      const r = await complete({ system: system, user: msg, history: hist });
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
    const r = await complete({ system: system, user: msg, history: hist, onToken: t => { w({ d: t.slice(sent) }); sent = t.length; } });
    if (sent === 0) w({ d: r.text });
    w({ done: true, provider: r.provider, model: r.model });
  } catch (e) { w({ error: e.message }); }
  res.end();
}
module.exports = handler;
module.exports._reset = () => { limited.reset(); budget = { d: '', n: 0 }; };
