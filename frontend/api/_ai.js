'use strict';
// Provider-agnostic chat client for Vercel Functions: discovers live models, retries rate limits, falls back to smaller models, streams.
const ENV = [['GROQ_API_KEY', 'Groq'], ['GEMINI_API_KEY', 'Gemini'], ['OPENROUTER_API_KEY', 'OpenRouter'], ['OPENAI_API_KEY', 'OpenAI'], ['ANTHROPIC_API_KEY', 'Anthropic']];
const CHAIN = { Groq: ['openai/gpt-oss-120b', 'openai/gpt-oss-20b'], OpenRouter: ['openrouter/auto'], OpenAI: ['gpt-4o-mini'], Gemini: ['gemini-flash-latest', 'gemini-flash-lite-latest'], Anthropic: ['claude-haiku-5-5'] };
const PREF = { Groq: [/gpt-oss-120b/, /gpt-oss-20b/, /llama-3\.3-70b/, /qwen/, /llama/], Gemini: [/^gemini-flash-latest$/, /^gemini-flash-lite-latest$/, /flash(?!-lite)/, /flash-lite/, /pro/], OpenAI: [/^gpt-4o-mini$/, /mini/, /^gpt-4o$/, /^gpt-/], Anthropic: [/haiku/, /sonnet/, /./], OpenRouter: [/^openrouter\/auto$/] };
const SKIP = /whisper|tts|orpheus|guard|safeguard|embed|compound|moderation|image|audio|realtime|transcribe|dall-e|davinci|babbage|search|live|veo|imagen|robotics|computer-use|omni|nano-banana/i;
const cache = new Map();

function pick(env) {
  env = env || process.env;
  for (const [v, name] of ENV) { const key = String(env[v] || '').trim(); if (key) return { name, key }; }
  return null;
}
async function listModels(f, p, k) {
  let url, h;
  if (p === 'Groq') { url = 'https://api.groq.com/openai/v1/models'; h = { Authorization: 'Bearer ' + k }; }
  else if (p === 'OpenAI') { url = 'https://api.openai.com/v1/models'; h = { Authorization: 'Bearer ' + k }; }
  else if (p === 'Gemini') { url = 'https://generativelanguage.googleapis.com/v1beta/models?pageSize=200'; h = { 'x-goog-api-key': k }; }
  else if (p === 'Anthropic') { url = 'https://api.anthropic.com/v1/models'; h = { 'x-api-key': k, 'anthropic-version': '2023-06-01' }; }
  else return null;
  const r = await f(url, { headers: h });
  if (!r.ok) throw { status: r.status };
  const d = await r.json();
  const ids = p === 'Gemini'
    ? (d.models || []).filter(m => (m.supportedGenerationMethods || []).includes('generateContent')).map(m => String(m.name).replace(/^models\//, ''))
    : (d.data || []).map(m => m.id);
  return ids.filter(x => !SKIP.test(x));
}
function rank(p, ids) {
  const out = [];
  for (const re of PREF[p] || []) for (const id of ids) if (re.test(id) && !out.includes(id)) out.push(id);
  return out;
}
async function modelsFor(f, sel) {
  const ck = sel.name + ':' + sel.key.slice(-8);
  if (cache.has(ck)) return cache.get(ck);
  let list = CHAIN[sel.name];
  try {
    const ids = await listModels(f, sel.name, sel.key);
    if (ids && ids.length) { const r = rank(sel.name, ids).slice(0, 4); if (r.length) list = r; }
  } catch (e) {
    if (e && (e.status === 401 || e.status === 403)) throw new Error(sel.name + ' rejected the API key (HTTP ' + e.status + ').');
  }
  cache.set(ck, list);
  return list;
}
async function send(f, p, k, model, sys, hist, u, onTok) {
  const J = { 'Content-Type': 'application/json' }, msgs = hist.concat([{ role: 'user', content: u }]);
  let url, opt;
  if (p === 'Gemini') {
    url = 'https://generativelanguage.googleapis.com/v1beta/models/' + encodeURIComponent(model) + ':generateContent';
    opt = { method: 'POST', headers: { ...J, 'x-goog-api-key': k }, body: JSON.stringify({ systemInstruction: { parts: [{ text: sys }] }, contents: msgs.map(m => ({ role: m.role === 'assistant' ? 'model' : 'user', parts: [{ text: m.content }] })), generationConfig: { maxOutputTokens: 1024 } }) };
  } else if (p === 'Anthropic') {
    url = 'https://api.anthropic.com/v1/messages';
    opt = { method: 'POST', headers: { ...J, 'x-api-key': k, 'anthropic-version': '2023-06-01' }, body: JSON.stringify({ model, max_tokens: 900, system: sys, messages: msgs }) };
  } else {
    url = { Groq: 'https://api.groq.com/openai/v1/chat/completions', OpenRouter: 'https://openrouter.ai/api/v1/chat/completions', OpenAI: 'https://api.openai.com/v1/chat/completions' }[p];
    const lim = p === 'OpenAI' ? { max_completion_tokens: 1500 } : { max_tokens: p === 'Groq' ? 1500 : 900 };
    const rs = p === 'Groq' && /gpt-oss/.test(model) ? { reasoning_effort: 'low' } : {};
    opt = { method: 'POST', headers: { ...J, Authorization: 'Bearer ' + k }, body: JSON.stringify(Object.assign({ model, messages: [{ role: 'system', content: sys }].concat(msgs) }, lim, rs, onTok ? { stream: true } : {})) };
  }
  const r = await f(url, opt);
  if (!r.ok) {
    let m = '';
    try { const d = await r.json(); m = (d.error && (d.error.message || d.error)) || d.message || ''; } catch (e) { /* no body */ }
    throw { status: r.status, msg: String(m).slice(0, 160), wait: Number(r.headers && r.headers.get && r.headers.get('retry-after')) || 0 };
  }
  if (onTok && r.body && r.body.getReader && p !== 'Gemini' && p !== 'Anthropic') {
    const rd = r.body.getReader(), dc = new TextDecoder();
    let buf = '', out = '';
    for (;;) {
      const x = await rd.read();
      if (x.done) break;
      buf += dc.decode(x.value, { stream: true });
      const ls = buf.split('\n'); buf = ls.pop();
      for (const l of ls) {
        if (!l.startsWith('data:')) continue;
        const j = l.slice(5).trim();
        if (j === '[DONE]') continue;
        try { const t = JSON.parse(j).choices[0].delta.content; if (t) { out += t; onTok(out); } } catch (e) { /* keep-alive line */ }
      }
    }
    if (out) return out;
    throw { status: 502, msg: 'empty stream' };
  }
  const d = await r.json();
  let t = '';
  try { t = p === 'Gemini' ? d.candidates[0].content.parts[0].text : p === 'Anthropic' ? d.content[0].text : d.choices[0].message.content; } catch (e) { /* handled below */ }
  if (!t || !String(t).trim()) throw { status: 502, msg: 'empty reply' };
  return t;
}
async function complete(o, deps) {
  const d = deps || {}, f = d.fetch || fetch, sleep = d.sleep || (ms => new Promise(r => setTimeout(r, ms))), sel = pick(d.env);
  if (!sel) return null;
  const models = await modelsFor(f, sel);
  let last;
  for (const model of models) {
    for (let a = 0; a < 2; a++) {
      try {
        const text = await send(f, sel.name, sel.key, model, o.system, o.history || [], o.user, o.onToken);
        return { text, provider: sel.name, model };
      } catch (e) {
        last = e;
        if (typeof e.status !== 'number') throw new Error(sel.name + ' could not be reached.');
        if (e.status === 401 || e.status === 403) throw new Error(sel.name + ' rejected the API key (HTTP ' + e.status + ').');
        if ((e.status === 429 || e.status === 503) && a === 0) { await sleep(Math.min(e.wait || 3, 15) * 1000); continue; }
        break;
      }
    }
  }
  throw new Error(sel.name + ' failed (HTTP ' + (last && last.status) + '). ' + (last && last.status === 429 ? 'Rate or quota limit reached; try again in a minute.' : 'Check the provider status and your key.'));
}
module.exports = { pick, complete, rank, CHAIN, _cache: cache };
