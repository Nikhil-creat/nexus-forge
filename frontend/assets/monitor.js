const LP={'SQL injection':/(union\s+select|or\s+1=1|drop\s+table)/i,'XSS':/(<script|onerror\s*=|javascript:)/i,'Path traversal':/(\.\.\/|%2e%2e)/i,'Command injection':/(;\s*(rm|cat|wget|curl)\s)/i};
let LOCAL=[],bad=0;
function analyzeLocal(lines){const ev=[],f={},now=Date.now()/1000;lines.forEach(l=>{for(const k in LP)if(LP[k].test(l))ev.push({level:'high',label:k,ip:'',ts:now});const m=l.match(/(?:failed|invalid)[^\n]*?(\d{1,3}(?:\.\d{1,3}){3})/i);if(m)f[m[1]]=(f[m[1]]||0)+1});
for(const ip in f)ev.push(f[ip]>=3?{level:'high',label:'Brute-force burst',ip,ts:now}:{level:'medium',label:'Failed login',ip,ts:now});return ev}
function summarize(ev){const c={high:0,medium:0,low:0};ev.forEach(e=>c[e.level]++);return{total:ev.length,high:c.high,medium:c.medium,low:c.low,recent:ev.slice(-8).reverse()}}
function render(r){$('cTotal').textContent=r.total;$('cHigh').textContent=r.high;$('cMed').textContent=r.medium;$('cLow').textContent=r.low;
$('feed').innerHTML=r.recent.length?r.recent.map(e=>'<li class="risk-'+e.level+'">'+new Date(e.ts*1000).toLocaleTimeString()+'  '+esc(e.label)+(e.ip?'  ('+esc(e.ip)+')':'')+'</li>').join(''):'<li class="empty">No events yet.</li>'}
async function poll(){if(!API)return;try{const r=await fetch(API+'/api/logs/summary');if(!r.ok)throw 0;render(await r.json());bad=0}catch(e){if(++bad>2)clearInterval(timer)}}
async function ingest(){const lines=$('mlogs').value.split('\n').filter(x=>x.trim()).slice(0,500);if(!lines.length){$('mout').textContent='Paste some log lines first.';return}
try{const r=await call('/api/logs/ingest',{lines});$('mout').textContent='Analyzed '+lines.length+' lines and recorded '+r.events+' events on the server.';await poll()}
catch(e){LOCAL=LOCAL.concat(analyzeLocal(lines));render(summarize(LOCAL));$('mout').textContent='The API is not connected. Analyzed '+lines.length+' lines in your browser. Nothing is stored.'}}
const timer=setInterval(poll,10000);poll();
