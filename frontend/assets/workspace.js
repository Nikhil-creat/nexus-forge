function localAnalytics(t){const L=t.trim().split('\n').map(l=>l.split(','));const h=L.shift();const out={rows:L.length,columns:{}};
h.forEach((c,i)=>{const v=L.map(r=>(r[i]||'').trim()).filter(Boolean);const n=v.map(Number);
if(v.length&&n.every(x=>!isNaN(x))){const m=n.reduce((a,b)=>a+b,0)/n.length,sd=Math.sqrt(n.reduce((a,b)=>a+(b-m)**2,0)/n.length);
out.columns[c]={type:'number',mean:+m.toFixed(2),min:Math.min(...n),max:Math.max(...n),std:+sd.toFixed(2),outliers:n.filter(x=>sd&&Math.abs(x-m)>3*sd).length,missing:L.length-v.length}}
else{const f={};v.forEach(x=>f[x]=(f[x]||0)+1);out.columns[c]={type:'text',unique:Object.keys(f).length,top:Object.entries(f).sort((a,b)=>b[1]-a[1]).slice(0,3),missing:L.length-v.length}}});return out}
async function runAnalytics(){let r;try{r=await call('/api/analytics',{text:$('csv').value})}catch(e){try{r=localAnalytics($('csv').value)}catch(x){r={error:'Could not read the CSV. Check the header row.'}}}$('o1').textContent=JSON.stringify(r,null,2);drawHist()}

function localML(x,y,p){const n=x.length,mx=x.reduce((a,b)=>a+b)/n,my=y.reduce((a,b)=>a+b)/n;const d=x.reduce((a,b)=>a+(b-mx)**2,0);if(!d)throw Error('x values must differ');
const w=x.reduce((a,b,i)=>a+(b-mx)*(y[i]-my),0)/d,b0=my-w*mx;const sr=y.reduce((a,b,i)=>a+(b-(w*x[i]+b0))**2,0),st=y.reduce((a,b)=>a+(b-my)**2,0)||1;
return{slope:+w.toFixed(4),intercept:+b0.toFixed(4),r2:+(1-sr/st).toFixed(4),prediction:+(w*p+b0).toFixed(4)}}
async function runML(){const x=$('xs').value.split(',').map(Number),y=$('ys').value.split(',').map(Number),p=+$('px').value;let r;
if(x.length<2||x.length!==y.length||[...x,...y,p].some(isNaN)){$('o2').textContent='Enter equal-length lists of numbers.';return}
try{r=await call('/api/ml/predict',{x,y,predict:p})}catch(e){try{r=localML(x,y,p)}catch(z){r={error:z.message}}}$('o2').textContent=JSON.stringify(r,null,2)}

const PAT={'SQL injection':/(union\s+select|or\s+1=1|drop\s+table)/i,'XSS':/(<script|onerror\s*=|javascript:)/i,'Path traversal':/(\.\.\/|%2e%2e)/i,'Command injection':/(;\s*(rm|cat|wget|curl)\s)/i};
function localScan(t){const f=Object.keys(PAT).filter(k=>PAT[k].test(t));const c={};(t.match(/(?:failed|invalid)[^\n]*?\d{1,3}(?:\.\d{1,3}){3}/gi)||[]).forEach(m=>{const ip=m.match(/(\d{1,3}(?:\.\d{1,3}){3})/)[1];c[ip]=(c[ip]||0)+1});
const b=Object.keys(c).filter(k=>c[k]>=3),risk=Math.min(100,30*f.length+25*b.length);return{risk,level:risk>=60?'high':risk>=25?'medium':'low',findings:f,brute_force_ips:b}}
async function runScan(){let r;try{r=await call('/api/security/scan',{text:$('logs').value})}catch(e){r=localScan($('logs').value)}
call('/api/logs/ingest',{lines:$('logs').value.split('\n')}).catch(()=>{});
$('o3').innerHTML='<span class="risk-'+r.level+'">Risk '+r.risk+'/100 ('+r.level+')</span>\n'+esc(JSON.stringify({findings:r.findings,brute_force_ips:r.brute_force_ips},null,2))}

async function ask(){const m=$('msg').value.trim();if(!m)return;const log=$('chatlog');log.insertAdjacentHTML('beforeend','<p class="me">You: '+esc(m)+'</p>');$('msg').value='';
try{const r=await call('/api/chat',{message:m});log.insertAdjacentHTML('beforeend','<p>Nexus: '+esc(r.reply)+'</p>')}catch(e){try{const t=await llm(SYSP,m,HIST);HIST=HIST.concat([{role:'user',content:m},{role:'assistant',content:t}]).slice(-6);log.insertAdjacentHTML('beforeend','<p>Nexus: '+esc(t)+'</p>')}catch(x){const o=kbAnswer(m);log.insertAdjacentHTML('beforeend','<p>Nexus: '+esc(x.message)+(o?'\n\nOffline answer: '+esc(o):'')+'</p>')}}log.scrollTop=log.scrollHeight}
$('msg').addEventListener('keydown',e=>{if(e.key==='Enter')ask()});

let TOKEN='',DOCS=[];
function iqrFlags(v){const s=[...v].sort((a,b)=>a-b),q1=s[Math.floor(s.length/4)],q3=s[Math.floor(3*s.length/4)],r=q3-q1,lo=q1-1.5*r,hi=q3+1.5*r,m=v.reduce((a,b)=>a+b)/v.length,sd=Math.sqrt(v.reduce((a,b)=>a+(b-m)**2,0)/v.length);
return{anomalies:v.map((x,i)=>x<lo||x>hi||(sd&&Math.abs(x-m)/sd>3)?i:-1).filter(i=>i>=0),bounds:[+lo.toFixed(2),+hi.toFixed(2)]}}
function drawSeries(v,bad){const c=$('chart'),x=c.getContext('2d'),w=c.width=c.clientWidth*2,h=c.height=200;x.clearRect(0,0,w,h);const mn=Math.min(...v),sp=(Math.max(...v)-mn)||1;
const pt=(y,i)=>[20+i*(w-40)/Math.max(v.length-1,1),h-20-(y-mn)/sp*(h-40)];x.strokeStyle='#ff9a3c';x.lineWidth=3;x.beginPath();v.forEach((y,i)=>{const[a,b]=pt(y,i);i?x.lineTo(a,b):x.moveTo(a,b)});x.stroke();
x.fillStyle='#FAD53E';bad.forEach(i=>{const[a,b]=pt(v[i],i);x.beginPath();x.arc(a,b,9,0,7);x.fill()})}
async function runAnom(){const v=$('series').value.split(',').map(Number);if(v.length<4||v.some(isNaN)){$('o4').textContent='Enter at least 4 numbers.';return}
let r;try{r=await call('/api/anomaly',{values:v})}catch(e){r=iqrFlags(v)}drawSeries(v,r.anomalies);$('o4').textContent=JSON.stringify(r,null,2)}
const tk=t=>t.toLowerCase().match(/[a-z0-9]+/g)||[];
async function addDoc(){const t=$('doc').value;try{const r=await call('/api/rag/add',{title:'pasted',text:t});$('o5').textContent='Indexed '+r.chunks+' passages on the server.'}catch(e){DOCS=t.split(/\n\s*\n/).filter(x=>x.trim().length>20);$('o5').textContent='Server offline. Indexed '+DOCS.length+' passages in your browser.'}}
async function askDoc(){const q=$('q').value;try{const r=await call('/api/rag/ask',{question:q});$('o5').textContent=r.answer+'\n\nSources: '+r.sources.join(', ')+(r.mode?' ('+r.mode+')':'')}catch(e){const w=new Set(tk(q));
const top=DOCS.map(d=>[tk(d).filter(x=>w.has(x)).length,d]).sort((a,b)=>b[0]-a[0]).filter(x=>x[0]>0).slice(0,3).map(x=>x[1]);
if(!top.length){$('o5').textContent='No match. Index a document first.';return}
try{$('o5').textContent=await llm('Answer only from the context. If the answer is not there, say so. Be concise.','Context:\n'+top.join('\n\n')+'\n\nQuestion: '+q)}catch(x){$('o5').textContent=top[0]}}}
function auditPw(){const p=$('pw').value;const pool=(/[a-z]/.test(p)?26:0)+(/[A-Z]/.test(p)?26:0)+(/\d/.test(p)?10:0)+(/\W/.test(p)?32:0);let bits=pool?Math.round(p.length*Math.log2(pool)):0;
if(['password','123456','qwerty','admin','letmein','nexus123'].includes(p.toLowerCase()))bits=5;const lv=bits<40?'weak':bits<60?'fair':bits<80?'strong':'excellent';
$('pwbar').style.width=Math.min(100,bits)+'%';$('pwbar').style.background=bits<40?'var(--rd)':bits<60?'var(--am)':'var(--ok)';$('o7').textContent=p?bits+' bits of entropy: '+lv:'Checked in your browser. Nothing is sent anywhere.'}
async function doLogin(){try{const r=await call('/api/auth/login',{username:$('u').value,password:$('p').value});TOKEN=r.token;$('p').value='';$('o6').textContent='Signed in. The token lives in memory only and expires in one hour.'}catch(e){$('o6').textContent='Sign-in failed. Check the credentials and that the API is online.'}}
async function loadHistory(){if(!TOKEN){$('o6').textContent='Sign in first.';return}try{const r=await fetch(API+'/api/history',{headers:{Authorization:'Bearer '+TOKEN}});if(!r.ok)throw 0;const h=await r.json();$('o6').textContent=h.length?h.map(x=>new Date(x.ts*1000).toLocaleTimeString()+'  '+x.kind).join('\n'):'No history yet. Run an action in the lab.'}catch(e){$('o6').textContent='Could not load history. Sign in again.'}}

function loadCsv(i){const f=i.files[0];if(!f)return;const r=new FileReader();r.onload=()=>{$('csv').value=String(r.result).slice(0,200000)};r.readAsText(f)}
async function signup(){try{const r=await call('/api/auth/signup',{username:$('u').value,password:$('p').value});TOKEN=r.token;$('p').value='';$('o6').textContent='Account created and signed in.'}catch(e){$('o6').textContent='Could not create the account. Use a 3 to 20 character username and a password of 8 or more characters. The name may be taken.'}}
const COL=['#ff9a3c','#3dd6f5','#4ade80','#ff6b6b','#c084fc','#FAD53E','#f472b6','#94a3b8'];
const rows=t=>t.trim().split('\n').map(l=>l.split(',').map(x=>x.trim())).filter(r=>r.length>1);
function km(P,k){const d=(a,b)=>Math.hypot(a[0]-b[0],a[1]-b[1]);let C=[P[0]];while(C.length<k)C.push(P.reduce((b,p)=>Math.min(...C.map(c=>d(p,c)))>Math.min(...C.map(c=>d(b,c)))?p:b,P[0]));let L=[];
for(let t=0;t<50;t++){L=P.map(p=>C.map(c=>d(p,c)).reduce((bi,v,i,a)=>v<a[bi]?i:bi,0));const N=C.map((c,i)=>{const m=P.filter((_,j)=>L[j]===i);return m.length?[m.reduce((a,p)=>a+p[0],0)/m.length,m.reduce((a,p)=>a+p[1],0)/m.length]:c});if(JSON.stringify(N)===JSON.stringify(C))break;C=N}
return{labels:L,centroids:C.map(c=>c.map(v=>+v.toFixed(3))),inertia:+P.reduce((a,p,j)=>a+d(p,C[L[j]])**2,0).toFixed(3)}}
function drawScatter(P,r){const c=$('sc'),x=c.getContext('2d'),w=c.width=c.clientWidth*2,h=c.height=360,xs=P.map(p=>p[0]),ys=P.map(p=>p[1]),ax=Math.min(...xs),bx=(Math.max(...xs)-ax)||1,ay=Math.min(...ys),by=(Math.max(...ys)-ay)||1;
const m=([a,b])=>[24+(a-ax)/bx*(w-48),h-24-(b-ay)/by*(h-48)];x.clearRect(0,0,w,h);P.forEach((p,i)=>{const[a,b]=m(p);x.fillStyle=COL[r.labels[i]%8];x.beginPath();x.arc(a,b,8,0,7);x.fill()});
x.strokeStyle='#fff';x.lineWidth=3;r.centroids.forEach(c=>{const[a,b]=m(c);x.beginPath();x.arc(a,b,14,0,7);x.stroke()})}
async function runCluster(){const P=rows($('pts').value).map(r=>[+r[0],+r[1]]),k=+$('kk').value;if(P.length<k||k<2||k>8||P.some(p=>p.some(isNaN))){$('o8').textContent='Enter "x,y" numbers, and use k from 2 to 8 with at least k points.';return}
let r;try{r=await call('/api/ml/cluster',{points:P,k})}catch(e){r=km(P,k)}drawScatter(P,r);$('o8').textContent=JSON.stringify({centroids:r.centroids,inertia:r.inertia},null,2)}
function knnL(X,y,q,k){const o=X.map((p,i)=>[Math.hypot(p[0]-q[0],p[1]-q[1]),y[i]]).sort((a,b)=>a[0]-b[0]).slice(0,k),v={};o.forEach(([d,l])=>v[l]=(v[l]||0)+1/(1e-9+d));return Object.entries(v).sort((a,b)=>b[1]-a[1])[0][0]}
async function runKnn(){const R=rows($('tr').value),X=R.map(r=>[+r[0],+r[1]]),y=R.map(r=>r[2]),q=$('qq').value.split(',').map(Number);
if(R.length<3||R.some(r=>r.length<3)||X.some(p=>p.some(isNaN))||q.length<2||q.some(isNaN)){$('o9').textContent='Use "x,y,label" lines (3 or more) and a query like 4.6,4.4.';return}
let r;try{r=await call('/api/ml/classify',{X,y,query:q,k:3})}catch(e){let ok=0;X.forEach((p,i)=>{ok+=knnL(X.filter((_,j)=>j!==i),y.filter((_,j)=>j!==i),p,Math.min(3,X.length-1))===y[i]});r={label:knnL(X,y,q,Math.min(3,X.length)),loo_accuracy:+(ok/X.length).toFixed(3)}}
$('o9').textContent=JSON.stringify(r,null,2)}
function exportReport(){const parts=[['Data analytics','o1'],['Regression','o2'],['Security scan','o3'],['Anomaly detection','o4'],['Document Q&A','o5'],['Clustering','o8'],['Classifier','o9']];
const html='<!doctype html><meta charset="utf-8"><title>Nexus Forge report</title><body style="font-family:system-ui;max-width:720px;margin:2rem auto;padding:0 1rem"><h1>Nexus Forge report</h1><p>'+new Date().toLocaleString()+'</p>'+parts.map(([n,i])=>'<h2>'+n+'</h2><pre style="white-space:pre-wrap;background:#f4f4f4;padding:10px">'+esc($(i).textContent)+'</pre>').join('');
const a=document.createElement('a');a.href=URL.createObjectURL(new Blob([html],{type:'text/html'}));a.download='nexus-forge-report.html';a.click();setTimeout(()=>URL.revokeObjectURL(a.href),1000)}

const SYSP='You are Nexus, an assistant for data analytics, ML and cybersecurity. Be concise.';
function keyOf(){const el=$('gkey'),v=el&&el.value?String(el.value).replace(/["'\s]/g,''):'';if(v)return v;try{return sessionStorage.getItem('aikey')||''}catch(e){return ''}}
function provider(k){if(k.startsWith('gsk_'))return'Groq';if(k.startsWith('sk-ant-'))return'Anthropic';if(k.startsWith('sk-or-'))return'OpenRouter';if(k.startsWith('AIza'))return'Gemini';if(k.startsWith('sk-'))return'OpenAI';return''}
function saveKey(el){const k=String(el.value).replace(/["'\s]/g,'');try{sessionStorage.setItem('aikey',k)}catch(e){}const p=provider(k);
$('kstatus').textContent=!k?'No key entered. Groq, Gemini, Anthropic, OpenRouter and OpenAI keys are detected automatically.':p?'Detected: '+p+'. The key stays in this tab.':'Key format not recognized. Supported: Groq, Gemini, Anthropic, OpenRouter, OpenAI.'}
const CHAIN={Groq:['llama-3.3-70b-versatile','llama-3.1-8b-instant'],OpenRouter:['openrouter/auto'],OpenAI:['gpt-4o-mini'],Gemini:['gemini-flash-latest','gemini-flash-lite-latest'],Anthropic:['claude-haiku-5-5']};
const CACHE=new Map();let busy=false,reqs=0,HIST=[];
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
function note(t){const e=$('kstatus');if(e)e.textContent=t}
async function send(p,k,model,sys,hist,u){const J={'Content-Type':'application/json'},msgs=hist.concat([{role:'user',content:u}]);let url,opt;
if(p==='Gemini'){url='https://generativelanguage.googleapis.com/v1beta/models/'+encodeURIComponent(model)+':generateContent';opt={method:'POST',headers:{...J,'x-goog-api-key':k},body:JSON.stringify({systemInstruction:{parts:[{text:sys}]},contents:msgs.map(m=>({role:m.role==='assistant'?'model':'user',parts:[{text:m.content}]})),generationConfig:{maxOutputTokens:1024}})}}
else if(p==='Anthropic'){url='https://api.anthropic.com/v1/messages';opt={method:'POST',headers:{...J,'x-api-key':k,'anthropic-version':'2023-06-01','anthropic-dangerous-direct-browser-access':'true'},body:JSON.stringify({model,max_tokens:700,system:sys,messages:msgs})}}
else{url={Groq:'https://api.groq.com/openai/v1/chat/completions',OpenRouter:'https://openrouter.ai/api/v1/chat/completions',OpenAI:'https://api.openai.com/v1/chat/completions'}[p];opt={method:'POST',headers:{...J,Authorization:'Bearer '+k},body:JSON.stringify(Object.assign({model,messages:[{role:'system',content:sys}].concat(msgs)},p==='OpenAI'?{max_completion_tokens:700}:{max_tokens:700}))}}
const r=await fetch(url,opt);
if(!r.ok){let m='';try{const d=await r.json();m=(d.error&&(d.error.message||d.error))||d.message||''}catch(e){}throw{status:r.status,msg:String(m).slice(0,160),wait:Number(r.headers&&r.headers.get&&r.headers.get('retry-after'))||0}}
const d=await r.json();return p==='Gemini'?d.candidates[0].content.parts[0].text:p==='Anthropic'?d.content[0].text:d.choices[0].message.content}
function explain(p,e){const s=e&&e.status,m=e&&e.msg?' Provider says: '+e.msg:'';
if(s===429)return p+' says you are over its rate or quota limit (HTTP 429).'+m+' Wait a minute and try again, check your usage in the provider console, or paste a key from another provider.';
if(s===404)return p+' could not find the model (HTTP 404).'+m+' Type a current model name in the Model box.';
return 'Detected '+p+', but the request failed (HTTP '+s+').'+m}
async function llm(sys,user,hist){hist=hist||[];const k=keyOf(),p=provider(k);
if(!k)throw new Error('No AI is connected. Paste an API key above (Groq, Gemini, Anthropic, OpenRouter or OpenAI) or connect the backend.');
if(!p)throw new Error('Key format not recognized. Supported: Groq, Gemini, Anthropic, OpenRouter, OpenAI.');
const ov=$('gmodel')&&$('gmodel').value?String($('gmodel').value).trim():'',chain=ov?[ov]:CHAIN[p],u=user.slice(0,6000),ck=p+'|'+chain[0]+'|'+sys+'|'+JSON.stringify(hist)+'|'+u;
if(CACHE.has(ck))return CACHE.get(ck);
if(busy)throw new Error('Wait for the previous answer to finish.');busy=true;let last;
try{for(const model of chain){for(let a=0;a<2;a++){try{note('Asking '+p+' ('+model+')...');reqs++;const t=await send(p,k,model,sys,hist,u);CACHE.set(ck,t);if(CACHE.size>30)CACHE.delete(CACHE.keys().next().value);note('Connected to '+p+' using '+model+'. Requests this tab: '+reqs);return t}
catch(e){last=e;if(typeof e.status!=='number')throw new Error('Detected '+p+', but the browser could not reach it (network error, or the provider blocks browser access).');
if(e.status===401||e.status===403)throw new Error('Detected '+p+', but the key was rejected (HTTP '+e.status+'). Create a new key and paste it again.');
if((e.status===429||e.status===503)&&a===0){const w=Math.min(e.wait||3,15);note(p+' is busy (HTTP '+e.status+'). Retrying in '+w+'s...');await sleep(w*1000);continue}
break}}}}finally{busy=false}
note(explain(p,last));throw new Error(explain(p,last))}
const KB=[[['outlier','anomal'],'An outlier is a value far from the rest of the data. Common rules flag points beyond 1.5 times the interquartile range from the quartiles, or more than 3 standard deviations from the mean.'],
[['regression','slope','r2','r²'],'Linear regression fits the line y = slope x + intercept that minimises squared error. R² shows how much of the variation the line explains; 1 is a perfect fit.'],
[['k-means','kmeans','cluster','inertia'],'k-means groups points into k clusters by assigning each point to the nearest centroid and moving each centroid to the mean of its points. Inertia is the sum of squared distances to the centroids; lower means tighter clusters.'],
[['nearest','knn','classif'],'k-nearest neighbours classifies a point by the majority label among its k closest training points. Leave-one-out accuracy estimates how well it generalises.'],
[['rag','retrieval'],'Retrieval-augmented generation finds relevant passages in your documents first and gives them to a language model, so answers stay grounded in your sources.'],
[['overfit'],'Overfitting is when a model memorises noise in the training data and does worse on new data. Hold out test data or use cross-validation to detect it.'],
[['precision','recall','f1'],'Precision is the share of predicted positives that are correct. Recall is the share of actual positives that were found. F1 is their harmonic mean.'],
[['sql'],'SQL injection inserts SQL into an input so the database runs it. Prevent it with parameterised queries and least-privilege database accounts.'],
[['xss','cross-site'],'Cross-site scripting injects script into a page that other people view. Prevent it by escaping output, setting a strict Content-Security-Policy and avoiding innerHTML with untrusted data.'],
[['brute','password'],'A brute-force attack tries many passwords. Defend with rate limiting, lockouts or delays, long unique passwords and multi-factor authentication.'],
[['aes','encrypt','gcm'],'AES-256-GCM is authenticated encryption: it hides the data and detects tampering. Here the key is derived from your passphrase with PBKDF2 and a random salt.'],
[['sha','hash','checksum','fingerprint'],'SHA-256 turns any file into a 256-bit fingerprint. Any change to the file changes the hash, so matching hashes show a download is intact.'],
[['standard deviation','std','spread'],'Standard deviation measures how spread out values are around the mean.']];
function kbAnswer(q){q=q.toLowerCase();let best='',n=0;KB.forEach(([ks,t])=>{const c=ks.filter(x=>q.includes(x)).length;if(c>n){n=c;best=t}});return best}
function clearChat(){HIST=[];const l=$('chatlog');if(l)l.innerHTML=''}
async function testKey(){const st=$('kstatus');st.textContent='Testing the key...';try{const r=await llm('Reply with the single word OK.','ping '+Date.now());st.textContent='Connected to '+provider(keyOf())+'. The model replied: '+r.slice(0,40)}catch(e){st.textContent=e.message}}
async function explainData(){const t=$('o1').textContent;if(!t||t.startsWith('Results appear')){$('oai').textContent='Press Analyze data first.';return}
$('oai').textContent='Thinking...';try{$('oai').textContent=await llm('You are a careful data analyst. Explain the findings in plain language, point out outliers and data quality issues, and suggest next steps. Be concise.','Column statistics:\n'+t)}catch(e){$('oai').textContent=e.message}}
(function(){const k=keyOf();if(k&&$('gkey')){$('gkey').value=k;saveKey($('gkey'))}})();
function drawHist(){const c=$('hist');if(!c)return;const L=$('csv').value.trim().split('\n').map(l=>l.split(',')),h=L.shift();let ci=-1,v=[];
for(let i=0;i<h.length&&ci<0;i++){const cells=L.map(r=>(r[i]||'').trim()).filter(Boolean),n=cells.map(Number);if(n.length>=3&&n.every(x=>!isNaN(x))){ci=i;v=n}}
const x=c.getContext('2d'),w=c.width=c.clientWidth*2,H=c.height=200;x.clearRect(0,0,w,H);if(ci<0)return;const mn=Math.min(...v),mx=Math.max(...v),B=8,k=Array(B).fill(0);
v.forEach(a=>k[Math.min(B-1,Math.floor((a-mn)/((mx-mn)||1)*B))]++);const top=Math.max(...k),bw=(w-40)/B;x.fillStyle='#ff9a3c';k.forEach((n,i)=>x.fillRect(20+i*bw+4,H-20-n/top*(H-50),bw-8,n/top*(H-50)));x.fillStyle='#fff';x.font='22px sans-serif';x.fillText(h[ci].trim()+' distribution',20,24)}
