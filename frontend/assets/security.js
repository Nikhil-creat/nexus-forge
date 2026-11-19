const LP={'SQL injection':/(union\s+select|or\s+1=1|drop\s+table)/i,'XSS':/(<script|onerror\s*=|javascript:)/i,'Path traversal':/(\.\.\/|%2e%2e)/i,'Command injection':/(;\s*(rm|cat|wget|curl)\s)/i};
let LOCAL=[],bad=0;
function analyzeLocal(lines){const ev=[],f={},now=Date.now()/1000;lines.forEach(l=>{for(const k in LP)if(LP[k].test(l))ev.push({level:'high',label:k,ip:'',ts:now});const m=l.match(/(?:failed|invalid)[^\n]*?(\d{1,3}(?:\.\d{1,3}){3})/i);if(m)f[m[1]]=(f[m[1]]||0)+1});
for(const ip in f)ev.push(f[ip]>=3?{level:'high',label:'Brute-force burst',ip,ts:now}:{level:'medium',label:'Failed login',ip,ts:now});return ev}
function summarize(ev){const c={high:0,medium:0,low:0};ev.forEach(e=>c[e.level]++);return{total:ev.length,high:c.high,medium:c.medium,low:c.low,recent:ev.slice(-8).reverse()}}
function render(r){$('cTotal').textContent=r.total;$('cHigh').textContent=r.high;$('cMed').textContent=r.medium;$('cLow').textContent=r.low;
$('feed').innerHTML=r.recent.length?r.recent.map(e=>'<li class="risk-'+e.level+'">'+new Date(e.ts*1000).toLocaleTimeString()+'  '+esc(e.label)+(e.ip?'  ('+esc(e.ip)+')':'')+'</li>').join(''):'<li class="empty">No events yet.</li>'}
async function poll(){const h=await HEALTH;if(!API||!h||!(h.caps||[]).includes('logs'))return;try{const r=await fetch(API+'/api/logs/summary');if(!r.ok)throw 0;render(await r.json());bad=0}catch(e){if(++bad>2)clearInterval(timer)}}
async function ingest(){const lines=$('mlogs').value.split('\n').filter(x=>x.trim()).slice(0,500);if(!lines.length){$('mout').textContent='Paste some log lines first.';return}
try{const r=await call('/api/logs/ingest',{lines});$('mout').textContent='Analyzed '+lines.length+' lines and recorded '+r.events+' events on the server.';await poll()}
catch(e){LOCAL=LOCAL.concat(analyzeLocal(lines));render(summarize(LOCAL));$('mout').textContent='Analyzed '+lines.length+' lines in your browser. Nothing is stored or sent.'}}
const timer=setInterval(poll,10000);poll();
const enc=new TextEncoder(),dec=new TextDecoder();
const b64=b=>btoa(String.fromCharCode(...new Uint8Array(b))),unb64=s=>Uint8Array.from(atob(s),c=>c.charCodeAt(0));
async function keyFrom(pw,salt){const k=await crypto.subtle.importKey('raw',enc.encode(pw),'PBKDF2',false,['deriveKey']);return crypto.subtle.deriveKey({name:'PBKDF2',salt,iterations:600000,hash:'SHA-256'},k,{name:'AES-GCM',length:256},false,['encrypt','decrypt'])}
async function vaultEncrypt(){const pw=$('vpw').value,t=$('vtext').value;if(!pw||!t||t.length>20000){$('vout').textContent='Enter a passphrase and up to 20,000 characters of text.';return}
try{const salt=crypto.getRandomValues(new Uint8Array(16)),iv=crypto.getRandomValues(new Uint8Array(12)),ct=await crypto.subtle.encrypt({name:'AES-GCM',iv},await keyFrom(pw,salt),enc.encode(t));$('vout').textContent='nf1.'+b64(salt)+'.'+b64(iv)+'.'+b64(ct)}catch(e){$('vout').textContent='Encryption is not available in this browser.'}}
async function vaultDecrypt(){const pw=$('vpw').value,p=$('vtext').value.trim().split('.');if(!pw||p.length!==4||p[0]!=='nf1'){$('vout').textContent='Paste a value that starts with nf1. and enter the passphrase.';return}
try{const t=await crypto.subtle.decrypt({name:'AES-GCM',iv:unb64(p[2])},await keyFrom(pw,unb64(p[1])),unb64(p[3]));$('vout').textContent=dec.decode(t)}catch(e){$('vout').textContent='Wrong passphrase or damaged data.'}}
async function hashFile(i){const f=i.files[0];if(!f)return;if(f.size>52428800){$('hout').textContent='Pick a file under 50 MB.';return}
try{const d=await crypto.subtle.digest('SHA-256',await f.arrayBuffer());$('hout').textContent=f.name+'\nSHA-256: '+[...new Uint8Array(d)].map(b=>b.toString(16).padStart(2,'0')).join('')}catch(e){$('hout').textContent='Could not read that file.'}}
