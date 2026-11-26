function localAnalytics(t){const L=t.trim().split('\n').map(l=>l.split(','));const h=L.shift();const out={rows:L.length,columns:{}};
h.forEach((c,i)=>{const v=L.map(r=>(r[i]||'').trim()).filter(Boolean);const n=v.map(Number);
if(v.length&&n.every(x=>!isNaN(x))){const m=n.reduce((a,b)=>a+b,0)/n.length,sd=Math.sqrt(n.reduce((a,b)=>a+(b-m)**2,0)/n.length);
out.columns[c]={type:'number',mean:+m.toFixed(2),min:Math.min(...n),max:Math.max(...n),std:+sd.toFixed(2),outliers:n.filter(x=>sd&&Math.abs(x-m)>3*sd).length,missing:L.length-v.length}}
else{const f={};v.forEach(x=>f[x]=(f[x]||0)+1);out.columns[c]={type:'text',unique:Object.keys(f).length,top:Object.entries(f).sort((a,b)=>b[1]-a[1]).slice(0,3),missing:L.length-v.length}}});return out}
async function runAnalytics(){let r;try{r=await call('/api/analytics',{text:$('csv').value})}catch(e){try{r=localAnalytics($('csv').value)}catch(x){r={error:'Could not read the CSV. Check the header row.'}}}LASTSTATS=r.error?null:r;$('o1').innerHTML=statsTable(r);drawHist()}

function localML(x,y,p){const n=x.length,mx=x.reduce((a,b)=>a+b)/n,my=y.reduce((a,b)=>a+b)/n;const d=x.reduce((a,b)=>a+(b-mx)**2,0);if(!d)throw Error('x values must differ');
const w=x.reduce((a,b,i)=>a+(b-mx)*(y[i]-my),0)/d,b0=my-w*mx;const sr=y.reduce((a,b,i)=>a+(b-(w*x[i]+b0))**2,0),st=y.reduce((a,b)=>a+(b-my)**2,0)||1;
return{slope:+w.toFixed(4),intercept:+b0.toFixed(4),r2:+(1-sr/st).toFixed(4),prediction:+(w*p+b0).toFixed(4)}}
async function runML(){const x=$('xs').value.split(',').map(Number),y=$('ys').value.split(',').map(Number),p=+$('px').value;let r;
if(x.length<2||x.length!==y.length||[...x,...y,p].some(isNaN)){$('o2').textContent='Enter equal-length lists of numbers.';return}
try{r=await call('/api/ml/predict',{x,y,predict:p})}catch(e){try{r=localML(x,y,p)}catch(z){r={error:z.message}}}$('o2').textContent=r.error?r.error:'y = '+r.slope+' × x + '+r.intercept+'\nR² = '+r.r2+'\nPrediction for x = '+p+': '+r.prediction}

const PAT={'SQL injection':/(union\s+select|or\s+1=1|drop\s+table)/i,'XSS':/(<script|onerror\s*=|javascript:)/i,'Path traversal':/(\.\.\/|%2e%2e)/i,'Command injection':/(;\s*(rm|cat|wget|curl)\s)/i};
function localScan(t){const f=Object.keys(PAT).filter(k=>PAT[k].test(t));const c={};(t.match(/(?:failed|invalid)[^\n]*?\d{1,3}(?:\.\d{1,3}){3}/gi)||[]).forEach(m=>{const ip=m.match(/(\d{1,3}(?:\.\d{1,3}){3})/)[1];c[ip]=(c[ip]||0)+1});
const b=Object.keys(c).filter(k=>c[k]>=3),risk=Math.min(100,30*f.length+25*b.length);return{risk,level:risk>=60?'high':risk>=25?'medium':'low',findings:f,brute_force_ips:b}}
async function runScan(){let r;try{r=await call('/api/security/scan',{text:$('logs').value})}catch(e){r=localScan($('logs').value)}
call('/api/logs/ingest',{lines:$('logs').value.split('\n')}).catch(()=>{});
$('o3').innerHTML='<span class="risk-'+r.level+'">Risk '+r.risk+'/100 ('+r.level+')</span>\n'+esc(JSON.stringify({findings:r.findings,brute_force_ips:r.brute_force_ips},null,2))}

async function serverChat(m,hist,onTok,persona){const h=await HEALTH,cap=persona==='agent'?'agent':'chat';if(!API||!h||!(h.caps||[]).includes(cap))throw new Error('offline');
const r=await fetch(API+'/api/chat',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({message:m,history:hist,stream:true,persona:persona||'assistant'})});
if(!r.ok){let e='';try{e=(await r.json()).error||''}catch(x){}throw new Error(e||'The server returned HTTP '+r.status)}
if((r.headers.get('content-type')||'').includes('event-stream')&&r.body){const rd=r.body.getReader(),dc=new TextDecoder();let buf='',out='';
for(;;){const x=await rd.read();if(x.done)break;buf+=dc.decode(x.value,{stream:true});const ls=buf.split('\n');buf=ls.pop();
for(const l of ls){if(!l.startsWith('data:'))continue;let j;try{j=JSON.parse(l.slice(5))}catch(e){continue}if(j.error)throw new Error(j.error);if(j.d){out+=j.d;onTok(out)}}}
if(!out)throw new Error('The server returned an empty answer.');return out}
const j=await r.json();if(j.mode!=='live'||!j.reply)throw new Error('offline');onTok(j.reply);return j.reply}
function vlang(){const e=$('vlang');return e&&e.value?e.value:'en-IN'}
function say(t){const c=$('readaloud');if(!c||!c.checked||!window.speechSynthesis||!window.SpeechSynthesisUtterance)return;try{speechSynthesis.cancel();const u=new SpeechSynthesisUtterance(String(t).slice(0,600));u.lang=vlang();speechSynthesis.speak(u)}catch(e){}}
let rec=null;
function speak(){const SR=window.SpeechRecognition||window.webkitSpeechRecognition,st=$('voicest');
if(!SR){st.textContent='Speech input is not supported in this browser. Try Chrome.';return}
if(rec){rec.stop();return}
rec=new SR();rec.lang=vlang();rec.interimResults=true;
rec.onresult=e=>{let t='';for(const r of e.results)t+=r[0].transcript;$('msg').value=t};
rec.onerror=e=>{st.textContent='Voice input stopped: '+(e.error||'error')+'.'};
rec.onend=()=>{rec=null;if(st.textContent==='Listening...')st.textContent='';if($('msg').value.trim())ask()};
st.textContent='Listening...';try{rec.start()}catch(e){rec=null;st.textContent='Could not start the microphone.'}}
const AGENT_SYS='You are Nexus, a data and security analyst agent working inside a browser workspace. Tools available: analyze_csv(), detect_anomalies(values), fit_regression(x,y,predict), scan_logs(text), cluster(k). Omitted arguments mean "use the workspace inputs". Reply with ONLY one JSON object: {"tool":"name","args":{}} to call a tool, or {"final":"your answer"} when done. Never invent numbers. Use at most 3 tool calls.';
function toolRun(name,a){a=a||{};
if(name==='analyze_csv')return localAnalytics($('csv').value);
if(name==='detect_anomalies'){const v=Array.isArray(a.values)?a.values.map(Number):$('series').value.split(',').map(Number);if(v.length<4||v.some(isNaN))throw new Error('Need at least 4 numbers');return iqrFlags(v)}
if(name==='fit_regression'){const x=Array.isArray(a.x)?a.x.map(Number):$('xs').value.split(',').map(Number),y=Array.isArray(a.y)?a.y.map(Number):$('ys').value.split(',').map(Number),p=a.predict!==undefined?Number(a.predict):Number($('px').value);if(x.length<2||x.length!==y.length||[...x,...y,p].some(isNaN))throw new Error('Need matching numeric x and y lists');return localML(x,y,p)}
if(name==='scan_logs')return localScan(typeof a.text==='string'?a.text:$('logs').value);
if(name==='cluster'){const P=rows($('pts').value).map(r=>[+r[0],+r[1]]),k=Math.max(2,Math.min(8,Number(a.k)||3));if(P.length<k||P.some(p=>p.some(isNaN)))throw new Error('Need at least k numeric points');return km(P,k)}
throw new Error('Unknown tool '+name)}
function heuristicTool(q){q=q.toLowerCase();return/anomal|outlier/.test(q)?'detect_anomalies':/regress|predict|trend/.test(q)?'fit_regression':/log|attack|inject|brute|scan/.test(q)?'scan_logs':/cluster|group/.test(q)?'cluster':/csv|data|column|analy|summar/.test(q)?'analyze_csv':''}
function parseAgent(t){const m=String(t).match(/\{[\s\S]*\}/);if(!m)return{final:String(t).trim()};try{const j=JSON.parse(m[0]);return j&&(j.tool||j.final!==undefined)?j:{final:String(t).trim()}}catch(e){return{final:String(t).trim()}}}
async function brain(user,hist){try{return await serverChat(user,hist,()=>{},'agent')}catch(e){if(e.message!=='offline'&&!keyOf())throw e}return llm(AGENT_SYS,user,hist)}
async function runAgent(q,b,log){const lines=[],show=t=>{b.textContent=lines.concat(t?[t]:[]).join('\n');log.scrollTop=log.scrollHeight};let hist=[],user=q;
try{for(let i=0;i<4;i++){const j=parseAgent(await brain(user,hist));
if(j.final!==undefined){show(String(j.final));say(String(j.final));return}
lines.push('Tool: '+j.tool+'('+JSON.stringify(j.args||{}).slice(0,80)+')');show();let obs;try{obs=JSON.stringify(toolRun(j.tool,j.args)).slice(0,1500)}catch(e){obs='Error: '+e.message}
hist=hist.concat([{role:'user',content:user},{role:'assistant',content:JSON.stringify(j)}]).slice(-8);user='Tool result: '+obs}
show('Stopped after the tool-call limit.')}
catch(e){const t=heuristicTool(q);if(t){try{lines.push('Tool: '+t+'() (no AI connected)');show(JSON.stringify(toolRun(t,{})).slice(0,900));return}catch(x){show(x.message);return}}show('Agent mode needs an AI. '+e.message)}}
async function ask(){const m=$('msg').value.trim();if(!m)return;const log=$('chatlog');log.insertAdjacentHTML('beforeend','<p class="me"></p><p class="ai"></p>');
const bs=log.querySelectorAll('p'),me=bs[bs.length-2],b=bs[bs.length-1];me.textContent=m;$('msg').value='';
if($('agentmode')&&$('agentmode').checked)return runAgent(m,b,log);
const done=t=>{b.textContent=t;log.scrollTop=log.scrollHeight},keep=t=>{HIST=HIST.concat([{role:'user',content:m},{role:'assistant',content:t}]).slice(-6);say(t)};let se='';
try{const t=await serverChat(m,HIST,done);keep(t);done(t);return}catch(e){se=e.message==='offline'?'':e.message}
try{const t=await llm(SYSP,m,HIST,done);keep(t);done(t)}
catch(x){const o=kbAnswer(m);done((se||x.message)+(o?'\n\nOffline answer: '+o:''))}}
$('msg').addEventListener('keydown',e=>{if(e.key==='Enter')ask()});

let TOKEN='',DOCS=[];
function iqrFlags(v){const s=[...v].sort((a,b)=>a-b),q1=s[Math.floor(s.length/4)],q3=s[Math.floor(3*s.length/4)],r=q3-q1,lo=q1-1.5*r,hi=q3+1.5*r,m=v.reduce((a,b)=>a+b)/v.length,sd=Math.sqrt(v.reduce((a,b)=>a+(b-m)**2,0)/v.length);
return{anomalies:v.map((x,i)=>x<lo||x>hi||(sd&&Math.abs(x-m)/sd>3)?i:-1).filter(i=>i>=0),bounds:[+lo.toFixed(2),+hi.toFixed(2)]}}
function drawSeries(v,bad){const c=$('chart'),x=c.getContext('2d'),w=c.width=c.clientWidth*2,h=c.height=200;x.clearRect(0,0,w,h);const mn=Math.min(...v),sp=(Math.max(...v)-mn)||1;
const pt=(y,i)=>[20+i*(w-40)/Math.max(v.length-1,1),h-20-(y-mn)/sp*(h-40)];x.strokeStyle='#ff9a3c';x.lineWidth=3;x.beginPath();v.forEach((y,i)=>{const[a,b]=pt(y,i);i?x.lineTo(a,b):x.moveTo(a,b)});x.stroke();
x.fillStyle='#FAD53E';bad.forEach(i=>{const[a,b]=pt(v[i],i);x.beginPath();x.arc(a,b,9,0,7);x.fill()})}
async function runAnom(){const v=$('series').value.split(',').map(Number);if(v.length<4||v.some(isNaN)){$('o4').textContent='Enter at least 4 numbers.';return}
let r;try{r=await call('/api/anomaly',{values:v})}catch(e){r=iqrFlags(v)}drawSeries(v,r.anomalies);$('o4').textContent=(r.anomalies.length?'Anomalies at positions '+r.anomalies.map(i=>(i+1)+' (value '+v[i]+')').join(', '):'No anomalies found.')+'\nNormal range: '+r.bounds[0]+' to '+r.bounds[1]}
const tk=t=>String(t).toLowerCase().match(/[\p{L}\p{N}]+/gu)||[];
let CH=[];
function chunkText(t){const clean=String(t).replace(/\r/g,'').replace(/[ \t]+/g,' ').trim(),out=[];let cur='';
for(const p of clean.split(/\n{2,}/)){if(cur&&(cur+'\n'+p).length>700){out.push(cur.trim());cur=''}
if(p.length>900){if(cur){out.push(cur.trim());cur=''}for(let i=0;i<p.length;i+=700)out.push(p.slice(i,i+800))}else cur+=(cur?'\n':'')+p}
if(cur.trim())out.push(cur.trim());return out.filter(x=>x.length>1)}
function prep(name,t){return chunkText(t).map(x=>{const w=tk(x),tf={};w.forEach(a=>{tf[a]=(tf[a]||0)+1});return{name,t:x,tf,len:w.length||1}})}
function bm25(q,chunks){const qs=[...new Set(tk(q).filter(w=>w.length>1))],N=chunks.length;if(!N||!qs.length)return[];const avg=chunks.reduce((a,c)=>a+c.len,0)/N||1,df={};
qs.forEach(w=>{df[w]=chunks.filter(c=>c.tf[w]).length});
return chunks.map(c=>({c,s:qs.reduce((a,w)=>{const f=c.tf[w]||0;if(!f)return a;const idf=Math.log(1+(N-df[w]+.5)/(df[w]+.5));return a+idf*f*2.2/(f+1.2*(.25+.75*c.len/avg))},0)})).filter(x=>x.s>0).sort((a,b)=>b.s-a.s)}
async function inflateRaw(u8){const ds=new Blob([u8]).stream().pipeThrough(new DecompressionStream('deflate-raw'));return new Uint8Array(await new Response(ds).arrayBuffer())}
async function docxText(ab){const u=new Uint8Array(ab),dv=new DataView(ab);let i=u.length-22;while(i>=0&&dv.getUint32(i,true)!==0x06054b50)i--;if(i<0)throw new Error('This is not a valid .docx file.');
const n=dv.getUint16(i+10,true);let p=dv.getUint32(i+16,true);
for(let k=0;k<n;k++){if(dv.getUint32(p,true)!==0x02014b50)break;const meth=dv.getUint16(p+10,true),csz=dv.getUint32(p+20,true),nl=dv.getUint16(p+28,true),el=dv.getUint16(p+30,true),cl=dv.getUint16(p+32,true),off=dv.getUint32(p+42,true),name=new TextDecoder().decode(u.subarray(p+46,p+46+nl));
if(name==='word/document.xml'){const start=off+30+dv.getUint16(off+26,true)+dv.getUint16(off+28,true),data=u.subarray(start,start+csz),raw=meth===0?data:await inflateRaw(data);
return new TextDecoder().decode(raw).replace(/<\/w:p>/g,'\n\n').replace(/<w:tab\/>/g,' ').replace(/<[^>]+>/g,'').replace(/&lt;/g,'<').replace(/&gt;/g,'>').replace(/&quot;/g,'"').replace(/&apos;/g,"'").replace(/&amp;/g,'&')}
p+=46+nl+el+cl}
throw new Error('No text was found in this .docx file.')}
function bin2str(u){let s='';for(let i=0;i<u.length;i+=8192)s+=String.fromCharCode.apply(null,u.subarray(i,i+8192));return s}
async function inflateZ(u8){const ds=new Blob([u8]).stream().pipeThrough(new DecompressionStream('deflate'));return new Uint8Array(await new Response(ds).arrayBuffer())}
function a85(u8){let s=bin2str(u8).replace(/\s/g,'');if(s.startsWith('<~'))s=s.slice(2);const e=s.indexOf('~>');if(e>=0)s=s.slice(0,e);const out=[],t=[];let cnt=0;
for(const ch of s){if(ch==='z'&&cnt===0){out.push(0,0,0,0);continue}const v=ch.charCodeAt(0)-33;if(v<0||v>84)continue;t[cnt++]=v;if(cnt===5){let n=0;for(let k=0;k<5;k++)n=n*85+t[k];out.push((n>>>24)&255,(n>>>16)&255,(n>>>8)&255,n&255);cnt=0}}
if(cnt>1){for(let k=cnt;k<5;k++)t[k]=84;let n=0;for(let k=0;k<5;k++)n=n*85+t[k];out.push(...[(n>>>24)&255,(n>>>16)&255,(n>>>8)&255,n&255].slice(0,cnt-1))}return new Uint8Array(out)}
function ahex(u8){const h=bin2str(u8).split('>')[0].replace(/[^0-9A-Fa-f]/g,'');const o=[];for(let i=0;i<h.length;i+=2)o.push(parseInt(h.substr(i,2).padEnd(2,'0'),16));return new Uint8Array(o)}
function bal(d,j,o,c){let depth=0,i=j;while(i<d.length){if(d.startsWith(o,i)){depth++;i+=o.length}else if(d.startsWith(c,i)){depth--;i+=c.length;if(!depth)return d.slice(j,i)}else i++}return d.slice(j)}
function pval(d,key){if(!d)return null;const m=new RegExp('/'+key+'(?![A-Za-z0-9])').exec(d);if(!m)return null;let j=m.index+key.length+1;while(j<d.length&&/\s/.test(d[j]))j++;
if(d.startsWith('<<',j))return bal(d,j,'<<','>>');if(d[j]==='[')return bal(d,j,'[',']');const r=/^(\d+)\s+(\d+)\s+R/.exec(d.slice(j,j+30));if(r)return r[0];const t=/^\/?[^\s/<>\[\]()]+/.exec(d.slice(j,j+80));return t?t[0]:null}
function hex2str(h){if(h.length<=2)return String.fromCharCode(parseInt(h||'0',16));let o='';for(let i=0;i+3<=h.length;i+=4)o+=String.fromCharCode(parseInt(h.substr(i,4),16));return o}
function parseCMap(t){const m=new Map();let bytes=0;const cs=/begincodespacerange\s*<([0-9A-Fa-f]+)>\s*<([0-9A-Fa-f]+)>/.exec(t);if(cs)bytes=cs[1].length/2;
for(const blk of t.matchAll(/beginbfchar([\s\S]*?)endbfchar/g))for(const x of blk[1].matchAll(/<([0-9A-Fa-f]+)>\s*<([0-9A-Fa-f]*)>/g))m.set(parseInt(x[1],16),hex2str(x[2]));
for(const blk of t.matchAll(/beginbfrange([\s\S]*?)endbfrange/g)){const re=/<([0-9A-Fa-f]+)>\s*<([0-9A-Fa-f]+)>\s*(<[0-9A-Fa-f]*>|\[[^\]]*\])/g;let x;
while((x=re.exec(blk[1]))){const lo=parseInt(x[1],16),hi=parseInt(x[2],16);
if(x[3][0]==='<'){const b=hex2str(x[3].slice(1,-1));for(let c=lo;c<=hi&&c-lo<65536;c++)m.set(c,b.slice(0,-1)+String.fromCharCode(b.charCodeAt(b.length-1)+c-lo))}
else{const arr=[...x[3].matchAll(/<([0-9A-Fa-f]*)>/g)];for(let c=lo;c<=hi&&c-lo<arr.length;c++)m.set(c,hex2str(arr[c-lo][1]))}}}
return{map:m,bytes}}
function pdfTokens(cs,h){let i=0;const n=cs.length,st=[],stack=[];const push=v=>{(stack.length?stack[stack.length-1]:st).push(v)};
while(i<n){const ch=cs[i];
if(/[\s\0]/.test(ch)){i++;continue}
if(ch==='%'){while(i<n&&cs[i]!=='\n'&&cs[i]!=='\r')i++;continue}
if(ch==='('){let d=1,o='';i++;while(i<n){const c=cs[i];
if(c==='\\'){const x=cs[i+1];if(x==='n')o+='\n';else if(x==='r')o+='\r';else if(x==='t')o+='\t';else if(x==='b')o+='\b';else if(x==='f')o+='\f';
else if(x!==undefined&&/[0-7]/.test(x)){let cnt=1;while(cnt<3&&/[0-7]/.test(cs[i+1+cnt]||''))cnt++;o+=String.fromCharCode(parseInt(cs.substr(i+1,cnt),8)&255);i+=1+cnt;continue}
else if(x!=='\r'&&x!=='\n'&&x!==undefined)o+=x;i+=2;continue}
if(c==='(')d++;else if(c===')'){d--;if(!d){i++;break}}o+=c;i++}push({s:o});continue}
if(ch==='<'&&cs[i+1]==='<'){let d=0;while(i<n){if(cs.startsWith('<<',i)){d++;i+=2}else if(cs.startsWith('>>',i)){d--;i+=2;if(!d)break}else i++}continue}
if(ch==='<'){const e=cs.indexOf('>',i);let hx=cs.slice(i+1,e<0?n:e).replace(/\s/g,'');if(hx.length%2)hx+='0';let o='';for(let k=0;k<hx.length;k+=2)o+=String.fromCharCode(parseInt(hx.substr(k,2),16));push({s:o});i=e<0?n:e+1;continue}
if(ch==='['){stack.push([]);i++;continue}
if(ch===']'){const a=stack.pop();if(a)push({a});i++;continue}
if(ch==='/'){let j=i+1;while(j<n&&!/[\s/<>\[\]()%]/.test(cs[j]))j++;push({n:cs.slice(i+1,j)});i=j;continue}
const nm=/^[+-]?(\d+\.?\d*|\.\d+)/.exec(cs.substr(i,24));if(nm){push(parseFloat(nm[0]));i+=nm[0].length;continue}
let j=i;while(j<n&&!/[\s/<>\[\]()%]/.test(cs[j]))j++;if(j===i)j=i+1;const op=cs.slice(i,j);i=j;
if(op==='BI'){const e=cs.indexOf('EI',i);i=e<0?n:e+2;st.length=0;continue}
h(op,st.slice());st.length=0}}
function pdfShow(str,f){const t=pdfDecode(str,f);let w=0;if(f&&f.wf){const b=f.bytes||1;for(let i=0;i+b<=str.length;i+=b){let c=0;for(let k=0;k<b;k++)c=c*256+str.charCodeAt(i+k);w+=f.wf(c)/1000}}return{t,w}}
function pdfDecode(str,f){if(f&&f.map){let o='';for(let i=0;i+f.bytes<=str.length;i+=f.bytes){let c=0;for(let k=0;k<f.bytes;k++)c=c*256+str.charCodeAt(i+k);const t=f.map.get(c);if(t!==undefined)o+=t}return o}if(f&&f.t0)return'';return str.replace(/[\x00-\x08\x0b-\x1f]/g,'')}
function pdfPage(cs,fonts){let out='',font=null,lastY=null,fsz=1,adv=0;const nl=()=>{if(out&&!out.endsWith('\n'))out+='\n'},sp=()=>{if(out&&!/\s$/.test(out))out+=' '},last=a=>a[a.length-1];
pdfTokens(cs,(op,a)=>{
if(op==='Tf'){const nm=a[a.length-2];if(nm&&nm.n!==undefined)font=fonts[nm.n]||null;const sz=last(a);if(typeof sz==='number')fsz=Math.abs(sz)||1}
else if(op==='Tj'){const x=last(a);if(x&&x.s!==undefined){const r=pdfShow(x.s,font);out+=r.t;adv+=r.w}}
else if(op==='TJ'){const arr=last(a);if(arr&&arr.a)for(const it of arr.a){if(it&&it.s!==undefined){const r=pdfShow(it.s,font);out+=r.t;adv+=r.w}else if(typeof it==='number'){adv-=it/1000;if(it<-200)sp()}}}
else if(op==="'"||op==='"'){nl();const x=last(a);if(x&&x.s!==undefined)out+=pdfDecode(x.s,font)}
else if(op==='T*')nl();
else if(op==='Td'||op==='TD'){const ty=last(a),tx=a[a.length-2];if(typeof ty==='number'&&Math.abs(ty)>0.5)nl();else if(typeof tx==='number'&&tx>0&&(tx-adv*fsz)>0.18*fsz)sp();adv=0}
else if(op==='Tm'){const y=last(a);if(typeof y==='number'){if(lastY!==null&&Math.abs(y-lastY)>1)nl();else sp();lastY=y}}
else if(op==='ET')sp()});
return out}
async function pdfText(ab){const u=new Uint8Array(ab),s=bin2str(u);
if(s.slice(0,5)!=='%PDF-')throw new Error('This is not a valid PDF file.');
if(/\/Encrypt\s*(\d|<|\/)/.test(s))throw new Error('This PDF is encrypted, so its text cannot be read here. Remove the protection or paste the text instead.');
const O={},re=/(\d+)\s+(\d+)\s+obj\b/g;let m;
while((m=re.exec(s))){const st=m.index+m[0].length,e=s.indexOf('endobj',st),body=e<0?s.slice(st):s.slice(st,e),dm=/>>\s*stream\r?\n/.exec(body);
if(dm){const ds=st+dm.index+dm[0].length,de=s.indexOf('endstream',ds);O[+m[1]]={d:body.slice(0,dm.index+2),a:ds,b:de<0?(e<0?s.length:e):de}}else O[+m[1]]={d:body};
re.lastIndex=e<0?s.length:e+6}
async function sdata(o){if(!o||o.a===undefined)return null;let a=o.a,b=o.b;const lm=!/\/Length\s+\d+\s+\d+\s+R/.test(o.d)&&/\/Length\s+(\d+)/.exec(o.d);
if(lm&&a+ +lm[1]<=b+2)b=a+ +lm[1];else while(b>a&&(u[b-1]===10||u[b-1]===13))b--;
let data=u.subarray(a,b);const f=/\/Filter\s*(\[[^\]]*\]|\/\w+)/.exec(o.d),fs=f?f[1]:'';
for(const x of fs.matchAll(/\/(\w+)/g)){const nm=x[1];
if(nm==='ASCII85Decode'||nm==='A85')data=a85(data);else if(nm==='ASCIIHexDecode'||nm==='AHx')data=ahex(data);else if(nm==='FlateDecode'||nm==='Fl'){try{data=await inflateZ(data)}catch(e){return null}}else return null}
return data}
for(const k of Object.keys(O)){const o=O[k];if(o.a!==undefined&&/\/Type\s*\/ObjStm/.test(o.d)){try{const data=await sdata(o);if(!data)continue;const t=bin2str(data),N=+/\/N\s+(\d+)/.exec(o.d)[1],F=+/\/First\s+(\d+)/.exec(o.d)[1],hd=t.slice(0,F).trim().split(/\s+/).map(Number);
for(let i=0;i<N;i++){const on=hd[2*i],off=hd[2*i+1],end=i+1<N?hd[2*i+3]:t.length-F;O[on]={d:t.slice(F+off,F+end)}}}catch(e){}}}
const refNum=v=>{const x=v&&/^(\d+)\s+\d+\s+R$/.exec(String(v).trim());return x?+x[1]:null},dict=v=>{const n=refNum(v);return n&&O[n]?O[n].d:v};
let cat=null;for(const k of Object.keys(O)){if(/\/Type\s*\/Catalog\b/.test(O[k].d)){cat=O[k].d;break}}
const pages=[];(function walk(d,res,depth){if(!d||depth>40)return;const ty=pval(d,'Type'),r=pval(d,'Resources')||res;
if(ty==='/Pages'){const ks=String(dict(pval(d,'Kids'))||'');for(const x of ks.matchAll(/(\d+)\s+\d+\s+R/g)){const o=O[+x[1]];if(o)walk(o.d,r,depth+1)}}
else if(ty==='/Page'||pval(d,'Contents')){pages.push({c:pval(d,'Contents'),r})}})(cat?dict(pval(cat,'Pages')):null,null,0);
const FC={};async function finfo(n){if(FC[n])return FC[n];const d=O[n]?O[n].d:'',t0=/\/Subtype\s*\/Type0/.test(d),tu=refNum(pval(d,'ToUnicode'));let map=null,bytes=t0?2:1;
if(tu&&O[tu]){const data=await sdata(O[tu]);if(data){const c=parseCMap(bin2str(data));map=c.map;if(c.bytes)bytes=c.bytes}}let wf=null;
if(t0){const dfv=String(dict(pval(d,'DescendantFonts'))||pval(d,'DescendantFonts')||''),dr=/(\d+)\s+\d+\s+R/.exec(dfv),cd=dr&&O[+dr[1]]?O[+dr[1]].d:'',dw=+pval(cd,'DW')||1000,wm=new Map();
const W=String(dict(pval(cd,'W'))||'').trim().replace(/^\[/,'').replace(/\]$/,''),tk2=[...W.matchAll(/\[([^\]]*)\]|(-?[\d.]+)/g)].map(x=>x[1]!==undefined?{a:x[1].trim().split(/\s+/).map(Number)}:{n:parseFloat(x[2])});
for(let i=0;i<tk2.length;){const t=tk2[i];if(t.n===undefined){i++;continue}const nx=tk2[i+1];if(nx&&nx.a){nx.a.forEach((w,k)=>wm.set(t.n+k,w));i+=2}else if(nx&&nx.n!==undefined&&tk2[i+2]&&tk2[i+2].n!==undefined){for(let c=t.n;c<=nx.n&&c-t.n<65536;c++)wm.set(c,tk2[i+2].n);i+=3}else i++}
wf=c=>wm.has(c)?wm.get(c):dw}
else{const fc=+pval(d,'FirstChar')||0,wa=(String(dict(pval(d,'Widths'))||'').match(/-?[\d.]+/g)||[]).map(Number);if(wa.length)wf=c=>wa[c-fc]!==undefined?wa[c-fc]:500}
return FC[n]={map,bytes,t0,wf}}
const texts=[];
for(const p of pages){const fonts={},fd=dict(pval(String(dict(p.r)||''),'Font'))||'';
for(const x of String(fd).matchAll(/\/([^\s/<>\[\]()]+)\s+(\d+)\s+\d+\s+R/g))fonts[x[1]]=await finfo(+x[2]);
let cs='';const cv=String(dict(p.c)||'');const refs=/^\s*\[/.test(cv)||refNum(p.c)===null?[...cv.matchAll(/(\d+)\s+\d+\s+R/g)].map(x=>+x[1]):[refNum(p.c)];
for(const n of refs){const data=await sdata(O[n]);if(data)cs+=bin2str(data)+'\n'}
texts.push(pdfPage(cs,fonts))}
const text=texts.join('\n\n').replace(/[ \t]+/g,' ').replace(/ ?\n ?/g,'\n').replace(/\n{3,}/g,'\n\n').trim();
if(text.replace(/\s/g,'').length<10)throw new Error('No readable text was found in this PDF. Scanned or image-only PDFs need OCR, which is not supported.');
return text}
async function readDoc(f){const n=f.name.toLowerCase();
if(n.endsWith('.pdf'))return pdfText(await f.arrayBuffer());
if(n.endsWith('.docx'))return docxText(await f.arrayBuffer());
const t=await f.text();
if(/\.html?$/.test(n)){const d=new DOMParser().parseFromString(t,'text/html');d.querySelectorAll('script,style').forEach(e=>e.remove());return d.body.textContent}
return t}
function renderDocs(){const st=$('docst');if(!st)return;if(!CH.length){st.textContent='No documents indexed yet.';return}const c={};CH.forEach(x=>{c[x.name]=(c[x.name]||0)+1});
st.textContent=Object.keys(c).length+' document'+(Object.keys(c).length>1?'s':'')+', '+CH.length+' passages: '+Object.entries(c).map(([k,v])=>k+' ('+v+')').join(', ')}
async function addFiles(input){const st=$('docst'),msgs=[];
for(const f of [...input.files].slice(0,8)){if(f.size>3000000){msgs.push(f.name+' is over 3 MB and was skipped.');continue}
try{const t=await readDoc(f),p=prep(f.name,t);if(!p.length){msgs.push(f.name+' has no text.');continue}CH=CH.filter(x=>x.name!==f.name).concat(p)}catch(e){msgs.push(f.name+': '+e.message)}}
renderDocs();if(msgs.length&&st)st.textContent+=' | '+msgs.join(' ');try{input.value=''}catch(e){}}
function addDoc(){const t=$('doc').value;if(!t.trim()){$('o5').textContent='Paste some text first.';return}CH=CH.filter(x=>x.name!=='Pasted text').concat(prep('Pasted text',t));renderDocs();$('o5').textContent='Indexed. Now ask a question.'}
function clearDocs(){CH=[];renderDocs();$('o5').textContent='Documents cleared.'}
async function brainDoc(q,ctxs){const msg='Context:\n'+ctxs+'\n\nQuestion: '+q;
try{return await serverChat(msg,[],()=>{},'rag')}catch(e){if(e.message!=='offline'&&!keyOf())throw e}
return llm('Answer using only the context. Cite passages as [1], [2]. If the answer is not in the context, say so. Be concise.',msg)}
async function askDoc(){const q=$('q').value.trim(),o=$('o5');if(!q)return;
try{const r=await call('/api/rag/ask',{question:q});o.textContent=r.answer+'\n\nSources: '+r.sources.join(', ');return}catch(e){}
if(!CH.length){o.textContent='Add a document first: upload files, or paste text and press Index.';return}
const top=bm25(q,CH).slice(0,4);if(!top.length){o.textContent='No matching passage was found in your documents.';return}
const ctxs=top.map((x,i)=>'['+(i+1)+'] ('+x.c.name+') '+x.c.t).join('\n\n'),src='\n\nSources:\n'+top.map((x,i)=>'['+(i+1)+'] '+x.c.name+': '+x.c.t.slice(0,110).replace(/\s+/g,' ')+'…').join('\n');
o.textContent='Searching...';try{o.textContent=(await brainDoc(q,ctxs))+src}catch(e){o.textContent=top[0].c.t+src+'\n\n(No AI is connected, so this is the best matching passage.)'}}
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
let r;try{r=await call('/api/ml/cluster',{points:P,k})}catch(e){r=km(P,k)}drawScatter(P,r);$('o8').textContent=r.centroids.map((c,i)=>'Cluster '+(i+1)+' centre: ('+c.join(', ')+')').join('\n')+'\nInertia: '+r.inertia}
function knnL(X,y,q,k){const o=X.map((p,i)=>[Math.hypot(p[0]-q[0],p[1]-q[1]),y[i]]).sort((a,b)=>a[0]-b[0]).slice(0,k),v={};o.forEach(([d,l])=>v[l]=(v[l]||0)+1/(1e-9+d));return Object.entries(v).sort((a,b)=>b[1]-a[1])[0][0]}
async function runKnn(){const R=rows($('tr').value),X=R.map(r=>[+r[0],+r[1]]),y=R.map(r=>r[2]),q=$('qq').value.split(',').map(Number);
if(R.length<3||R.some(r=>r.length<3)||X.some(p=>p.some(isNaN))||q.length<2||q.some(isNaN)){$('o9').textContent='Use "x,y,label" lines (3 or more) and a query like 4.6,4.4.';return}
let r;try{r=await call('/api/ml/classify',{X,y,query:q,k:3})}catch(e){let ok=0;X.forEach((p,i)=>{ok+=knnL(X.filter((_,j)=>j!==i),y.filter((_,j)=>j!==i),p,Math.min(3,X.length-1))===y[i]});r={label:knnL(X,y,q,Math.min(3,X.length)),loo_accuracy:+(ok/X.length).toFixed(3)}}
$('o9').textContent='Predicted label: '+r.label+(r.loo_accuracy!=null?'\nLeave-one-out accuracy: '+Math.round(r.loo_accuracy*100)+'%':'')}
function exportReport(){const parts=[['Data analytics','o1'],['Regression','o2'],['Security scan','o3'],['Anomaly detection','o4'],['Document Q&A','o5'],['Clustering','o8'],['Classifier','o9']];
const html='<!doctype html><meta charset="utf-8"><title>Nexus Forge report</title><body style="font-family:system-ui;max-width:720px;margin:2rem auto;padding:0 1rem"><h1>Nexus Forge report</h1><p>'+new Date().toLocaleString()+'</p>'+parts.map(([n,i])=>'<h2>'+n+'</h2><pre style="white-space:pre-wrap;background:#f4f4f4;padding:10px">'+esc($(i).textContent)+'</pre>').join('');
const a=document.createElement('a');a.href=URL.createObjectURL(new Blob([html],{type:'text/html'}));a.download='nexus-forge-report.html';a.click();setTimeout(()=>URL.revokeObjectURL(a.href),1000)}

const SYSP='You are Nexus, an assistant for data analytics, ML and cybersecurity. Be concise.';
function keyOf(){const el=$('gkey'),v=el&&el.value?String(el.value).replace(/["'\s]/g,''):'';if(v)return v;try{return sessionStorage.getItem('aikey')||''}catch(e){return ''}}
function provider(k){if(k.startsWith('gsk_'))return'Groq';if(k.startsWith('sk-ant-'))return'Anthropic';if(k.startsWith('sk-or-'))return'OpenRouter';if(k.startsWith('AIza'))return'Gemini';if(k.startsWith('sk-'))return'OpenAI';return''}
function saveKey(el){const k=String(el.value).replace(/["'\s]/g,'');try{sessionStorage.setItem('aikey',k)}catch(e){}const p=provider(k);setAI('AI: '+(p||'not connected'));clearTimeout(dtimer);if(p&&k.length>=20)dtimer=setTimeout(()=>modelsFor(p,k).then(m=>note('Detected '+p+'. '+(ALLM[p]?ALLM[p].length+' models available, using '+m[0]+'.':'Using the default model '+m[0]+'.'))).catch(e=>note(e.message)),700);
$('kstatus').textContent=!k?'No key entered. Groq, Gemini, Anthropic, OpenRouter and OpenAI keys are detected automatically.':p?'Detected: '+p+'. The key stays in this tab.':'Key format not recognized. Supported: Groq, Gemini, Anthropic, OpenRouter, OpenAI.'}
const CHAIN={Groq:['openai/gpt-oss-120b','openai/gpt-oss-20b'],OpenRouter:['openrouter/auto'],OpenAI:['gpt-4o-mini'],Gemini:['gemini-flash-latest','gemini-flash-lite-latest'],Anthropic:['claude-haiku-5-5']};
const PREF={Groq:[/gpt-oss-120b/,/gpt-oss-20b/,/llama-3\.3-70b/,/qwen/,/llama/],Gemini:[/^gemini-flash-latest$/,/^gemini-flash-lite-latest$/,/flash(?!-lite)/,/flash-lite/,/pro/],OpenAI:[/^gpt-4o-mini$/,/mini/,/^gpt-4o$/,/^gpt-/],Anthropic:[/haiku/,/sonnet/,/./],OpenRouter:[/^openrouter\/auto$/]};
const SKIP=/whisper|tts|orpheus|guard|safeguard|embed|compound|moderation|image|audio|realtime|transcribe|dall-e|davinci|babbage|search|live|veo|imagen|robotics|computer-use|omni|nano-banana/i;
const CACHE=new Map(),MODELS={},ALLM={};let busy=false,reqs=0,HIST=[],dtimer=0;
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
function note(t){const e=$('kstatus');if(e)e.textContent=t}
async function listModels(p,k){let url,h;
if(p==='Groq'){url='https://api.groq.com/openai/v1/models';h={Authorization:'Bearer '+k}}
else if(p==='OpenAI'){url='https://api.openai.com/v1/models';h={Authorization:'Bearer '+k}}
else if(p==='Gemini'){url='https://generativelanguage.googleapis.com/v1beta/models?pageSize=200';h={'x-goog-api-key':k}}
else if(p==='Anthropic'){url='https://api.anthropic.com/v1/models';h={'x-api-key':k,'anthropic-version':'2023-06-01','anthropic-dangerous-direct-browser-access':'true'}}
else return null;
const r=await fetch(url,{headers:h});if(!r.ok)throw{status:r.status,msg:''};const d=await r.json();
const ids=p==='Gemini'?(d.models||[]).filter(m=>(m.supportedGenerationMethods||[]).includes('generateContent')).map(m=>String(m.name).replace(/^models\//,'')):(d.data||[]).map(m=>m.id);
return ids.filter(x=>!SKIP.test(x))}
function rank(p,ids){const out=[];for(const re of PREF[p]||[])for(const id of ids)if(re.test(id)&&!out.includes(id))out.push(id);return out}
function fillList(ids){const dl=$('mlist');if(dl)dl.innerHTML=ids.slice(0,60).map(i=>'<option value="'+esc(i)+'">').join('')}
async function modelsFor(p,k){const mk=p+':'+k.slice(-8);if(MODELS[mk])return MODELS[mk];
try{const ids=await listModels(p,k);if(ids&&ids.length){ALLM[p]=ids;fillList(ids);const r=rank(p,ids).slice(0,4);if(r.length){MODELS[mk]=r;return r}}}
catch(e){if(e&&(e.status===401||e.status===403))throw new Error('Detected '+p+', but the key was rejected (HTTP '+e.status+'). Create a new key and paste it again.')}
MODELS[mk]=CHAIN[p];return MODELS[mk]}
async function send(p,k,model,sys,hist,u,onTok){const J={'Content-Type':'application/json'},msgs=hist.concat([{role:'user',content:u}]);let url,opt;
if(p==='Gemini'){url='https://generativelanguage.googleapis.com/v1beta/models/'+encodeURIComponent(model)+':generateContent';opt={method:'POST',headers:{...J,'x-goog-api-key':k},body:JSON.stringify({systemInstruction:{parts:[{text:sys}]},contents:msgs.map(m=>({role:m.role==='assistant'?'model':'user',parts:[{text:m.content}]})),generationConfig:{maxOutputTokens:1024}})}}
else if(p==='Anthropic'){url='https://api.anthropic.com/v1/messages';opt={method:'POST',headers:{...J,'x-api-key':k,'anthropic-version':'2023-06-01','anthropic-dangerous-direct-browser-access':'true'},body:JSON.stringify({model,max_tokens:700,system:sys,messages:msgs})}}
else{url={Groq:'https://api.groq.com/openai/v1/chat/completions',OpenRouter:'https://openrouter.ai/api/v1/chat/completions',OpenAI:'https://api.openai.com/v1/chat/completions'}[p];
const lim=p==='OpenAI'?{max_completion_tokens:1500}:{max_tokens:p==='Groq'?1500:900},rs=p==='Groq'&&/gpt-oss/.test(model)?{reasoning_effort:'low'}:{};
opt={method:'POST',headers:{...J,Authorization:'Bearer '+k},body:JSON.stringify(Object.assign({model,messages:[{role:'system',content:sys}].concat(msgs)},lim,rs,onTok?{stream:true}:{}))}}
const r=await fetch(url,opt);
if(!r.ok){let m='';try{const d=await r.json();m=(d.error&&(d.error.message||d.error))||d.message||''}catch(e){}throw{status:r.status,msg:String(m).slice(0,160),wait:Number(r.headers&&r.headers.get&&r.headers.get('retry-after'))||0}}
if(onTok&&r.body&&r.body.getReader&&p!=='Gemini'&&p!=='Anthropic'){const rd=r.body.getReader(),dc=new TextDecoder();let buf='',out='';
for(;;){const x=await rd.read();if(x.done)break;buf+=dc.decode(x.value,{stream:true});const ls=buf.split('\n');buf=ls.pop();
for(const l of ls){if(!l.startsWith('data:'))continue;const j=l.slice(5).trim();if(j==='[DONE]')continue;try{const t=JSON.parse(j).choices[0].delta.content;if(t){out+=t;onTok(out)}}catch(e){}}}
if(out)return out;throw{status:502,msg:'empty stream'}}
const d=await r.json();let t='';try{t=p==='Gemini'?d.candidates[0].content.parts[0].text:p==='Anthropic'?d.content[0].text:d.choices[0].message.content}catch(e){}
if(!t||!String(t).trim())throw{status:502,msg:'empty reply'};return t}
function explain(p,e){const s=e&&e.status,m=e&&e.msg?' Provider says: '+e.msg:'',av=ALLM[p]?' Available models: '+ALLM[p].slice(0,8).join(', ')+'.':'';
if(s===429)return p+' says you are over its rate or quota limit (HTTP 429).'+m+' Wait a minute and try again, check your usage in the provider console, or paste a key from another provider.';
if(s===404)return p+' could not find the model (HTTP 404).'+m+av+' Pick one from the Model box suggestions, or leave the box empty.';
return 'Detected '+p+', but the request failed (HTTP '+s+').'+m+av}
async function llm(sys,user,hist,onTok){hist=hist||[];const k=keyOf(),p=provider(k);
if(!k)throw new Error('No AI is connected. Paste an API key above (Groq, Gemini, Anthropic, OpenRouter or OpenAI) or connect the backend.');
if(!p)throw new Error('Key format not recognized. Supported: Groq, Gemini, Anthropic, OpenRouter, OpenAI.');
const auto=await modelsFor(p,k),ov=$('gmodel')&&$('gmodel').value?String($('gmodel').value).trim():'',known=ALLM[p];
const bad=!ov||/^(groq|gemini|openai|anthropic|openrouter)$/i.test(ov)||/\s|key|token|secret/i.test(ov)||(known&&!known.includes(ov));
if(ov&&bad)note('The Model box value "'+ov.slice(0,40)+'" is not an available model, so it was ignored.');
const chain=(bad?[]:[ov]).concat(auto.filter(m=>m!==ov)),u=user.slice(0,6000),ck=p+'|'+chain[0]+'|'+sys+'|'+JSON.stringify(hist)+'|'+u;
if(CACHE.has(ck)){const c=CACHE.get(ck);if(onTok)onTok(c);return c}
if(busy)throw new Error('Wait for the previous answer to finish.');busy=true;let last;
try{for(const model of chain){for(let a=0;a<2;a++){try{note('Asking '+p+' ('+model+')...');reqs++;const t=await send(p,k,model,sys,hist,u,onTok);CACHE.set(ck,t);if(CACHE.size>30)CACHE.delete(CACHE.keys().next().value);note('Connected to '+p+' using '+model+'. Requests this tab: '+reqs);setAI('AI: '+p+' · '+model);return t}
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
async function explainData(){const t=LASTSTATS?JSON.stringify(LASTSTATS):'';if(!t){$('oai').textContent='Press Analyze data first.';return}
$('oai').textContent='Thinking...';try{$('oai').textContent=await llm('You are a careful data analyst. Explain the findings in plain language, point out outliers and data quality issues, and suggest next steps. Be concise.','Column statistics:\n'+t)}catch(e){$('oai').textContent=e.message}}
(function(){const k=keyOf();if(k&&$('gkey')){$('gkey').value=k;saveKey($('gkey'))}})();
function drawHist(){const c=$('hist');if(!c)return;const L=$('csv').value.trim().split('\n').map(l=>l.split(',')),h=L.shift();let ci=-1,v=[];
for(let i=0;i<h.length&&ci<0;i++){const cells=L.map(r=>(r[i]||'').trim()).filter(Boolean),n=cells.map(Number);if(n.length>=3&&n.every(x=>!isNaN(x))){ci=i;v=n}}
const x=c.getContext('2d'),w=c.width=c.clientWidth*2,H=c.height=200;x.clearRect(0,0,w,H);if(ci<0)return;const mn=Math.min(...v),mx=Math.max(...v),B=8,k=Array(B).fill(0);
v.forEach(a=>k[Math.min(B-1,Math.floor((a-mn)/((mx-mn)||1)*B))]++);const top=Math.max(...k),bw=(w-40)/B;x.fillStyle='#ff9a3c';k.forEach((n,i)=>x.fillRect(20+i*bw+4,H-20-n/top*(H-50),bw-8,n/top*(H-50)));x.fillStyle='#fff';x.font='22px sans-serif';x.fillText(h[ci].trim()+' distribution',20,24)}
let LASTSTATS=null;
const TABS=['data','models','assistant','security','session'];
function showTab(id){if(!TABS.includes(id))id='data';TABS.forEach(x=>{const p=$(x),b=$('tab-'+x);if(p)p.hidden=x!==id;if(b){b.setAttribute('aria-selected',String(x===id));b.tabIndex=x===id?0:-1}})}
function tab(el){const id=el.dataset.tab;showTab(id);try{history.replaceState(null,'','#'+id)}catch(e){}}
function setAI(t){const e=$('stAI');if(e)e.textContent=t}
function statsTable(r){if(!r||r.error)return esc((r&&r.error)||'No result');
const rows=Object.entries(r.columns).map(([c,v])=>'<tr><td>'+esc(c)+'</td><td>'+esc(v.type)+'</td><td>'+(v.type==='number'?'mean '+v.mean+' · median '+(v.median!==undefined?v.median:'n/a')+' · min '+v.min+' · max '+v.max+' · std '+v.std+' · outliers '+v.outliers:v.unique+' unique · top '+v.top.map(t=>esc(t[0])+' ('+t[1]+')').join(', '))+(v.missing?' · missing '+v.missing:'')+'</td></tr>').join('');
return '<table class="st"><caption>'+r.rows+' rows, '+Object.keys(r.columns).length+' columns</caption><tr><th>Column</th><th>Type</th><th>Summary</th></tr>'+rows+'</table>'}
(function(){if(!$('tab-data'))return;showTab(location.hash.slice(1));addEventListener('hashchange',()=>showTab(location.hash.slice(1)));
const tl=document.querySelector('.tabs');if(tl)tl.addEventListener('keydown',e=>{const i=TABS.findIndex(x=>$('tab-'+x)===document.activeElement);if(i<0)return;const n=e.key==='ArrowRight'?i+1:e.key==='ArrowLeft'?i-1:-1;if(n<0||n>=TABS.length)return;e.preventDefault();showTab(TABS[n]);$('tab-'+TABS[n]).focus()});
const sm=$('stMode');if(sm)sm.textContent=API?'Mode: checking the API...':'Mode: runs in your browser';
const c=$('csv');if(c){c.addEventListener('dragover',e=>e.preventDefault());c.addEventListener('drop',e=>{e.preventDefault();const f=e.dataTransfer&&e.dataTransfer.files[0];if(!f)return;const r=new FileReader();r.onload=()=>{c.value=String(r.result).slice(0,200000)};r.readAsText(f)})}})();
const SAVE=['csv','xs','ys','px','series','doc','q','pts','kk','tr','qq','logs'];
function saveState(){try{const s={};SAVE.forEach(i=>{if($(i))s[i]=$(i).value});localStorage.setItem('nf-state',JSON.stringify(s))}catch(e){}}
function resetState(){try{localStorage.removeItem('nf-state')}catch(e){}location.reload()}
(function(){if(!$('tab-data'))return;try{const s=JSON.parse(localStorage.getItem('nf-state')||'{}');SAVE.forEach(i=>{if(typeof s[i]==='string'&&$(i))$(i).value=s[i]})}catch(e){}
document.addEventListener('input',e=>{if(e.target&&SAVE.includes(e.target.id))saveState()})})();
function snapshot(){const s={};SAVE.forEach(i=>{if($(i))s[i]=$(i).value});return s}
function applySnapshot(s){SAVE.forEach(i=>{if(s&&typeof s[i]==='string'&&$(i))$(i).value=s[i]});saveState()}
function sessionsList(){try{const a=JSON.parse(localStorage.getItem('nf-sessions')||'[]');return Array.isArray(a)?a:[]}catch(e){return[]}}
function putSessions(a){try{localStorage.setItem('nf-sessions',JSON.stringify(a.slice(0,20)))}catch(e){const s=$('shst');if(s)s.textContent='Could not save: browser storage is full or blocked.'}}
function drawSessions(){const l=$('sessions');if(!l)return;const a=sessionsList();
l.innerHTML=a.length?a.map((x,i)=>'<li><span>'+esc(x.name)+'</span> <button class="btn alt sm" type="button" data-act="loadSession" data-i="'+i+'">Load</button> <button class="btn alt sm" type="button" data-act="deleteSession" data-i="'+i+'">Delete</button></li>').join(''):'<li class="empty">No saved sessions yet.</li>'}
function saveSession(){const n=($('sname').value||'').trim().slice(0,40)||'Session '+new Date().toLocaleString(),a=sessionsList().filter(x=>x.name!==n);a.unshift({name:n,at:Date.now(),data:snapshot()});putSessions(a);drawSessions();$('shst').textContent='Saved "'+n+'" on this device.'}
function loadSession(el){const x=sessionsList()[Number(el.dataset.i)];if(!x)return;applySnapshot(x.data);$('shst').textContent='Loaded "'+x.name+'". Go to the Data tab and run the analysis.'}
function deleteSession(el){const a=sessionsList();a.splice(Number(el.dataset.i),1);putSessions(a);drawSessions()}
async function packSnapshot(){const cs=new Blob([JSON.stringify(snapshot())]).stream().pipeThrough(new CompressionStream('gzip')),b=new Uint8Array(await new Response(cs).arrayBuffer());let bin='';b.forEach(x=>{bin+=String.fromCharCode(x)});return btoa(bin).replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/,'')}
async function unpackSnapshot(t){const bin=atob(String(t).replace(/-/g,'+').replace(/_/g,'/')),u=Uint8Array.from(bin,c=>c.charCodeAt(0)),ds=new Blob([u]).stream().pipeThrough(new DecompressionStream('gzip'));return JSON.parse(await new Response(ds).text())}
function shareBase(){return location.origin+location.pathname.replace(/#.*$/,'')}
function showLink(u,msg){$('shareurl').value=u;$('shst').textContent=msg}
async function shareLink(){try{const z=await packSnapshot();if(z.length>6000){$('shst').textContent='This workspace is too large for a link in the address. Use "Download report", or create a short link if it is available.';return}
showLink(shareBase()+'#z='+z,'Link created. Your data is inside the link itself and is not stored anywhere.')}catch(e){$('shst').textContent='Could not create the link in this browser.'}}
async function shortLink(){const h=await HEALTH;if(!API||!h||!(h.caps||[]).includes('share')){$('shst').textContent='Short links are not enabled on this site.';return}
try{const r=await call('/api/share',{data:snapshot()});showLink(shareBase()+'#id='+r.id,'Short link created. Your inputs are stored on the server for '+r.days+' days, and anyone with the link can open them.')}catch(e){$('shst').textContent='Could not create the short link. '+(e.message==='offline'?'':'Try again later.')}}
async function copyShare(){const u=$('shareurl').value;if(!u){$('shst').textContent='Create a link first.';return}try{await navigator.clipboard.writeText(u);$('shst').textContent='Link copied.'}catch(e){try{$('shareurl').select();document.execCommand('copy');$('shst').textContent='Link copied.'}catch(x){$('shst').textContent='Copy failed. Select the link and copy it manually.'}}}
async function loadShared(){const h=location.hash.slice(1);if(!/^(z|id)=/.test(h))return;const n=$('notice');
try{let d;if(h.startsWith('z='))d=await unpackSnapshot(h.slice(2));else{const hh=await HEALTH;if(!API||!hh||!(hh.caps||[]).includes('share'))throw new Error('Short links are not enabled on this site.');const r=await fetch(API+'/api/share?id='+encodeURIComponent(h.slice(3)));if(!r.ok)throw new Error((await r.json()).error||'The link could not be opened.');d=(await r.json()).data}
applySnapshot(d);showTab('data');if(n)n.textContent='Shared workspace loaded. Press the analysis buttons to run it.';try{history.replaceState(null,'',location.pathname)}catch(e){}}
catch(e){if(n)n.textContent='Could not open this shared link: '+e.message}}
(function(){if(!$('tab-data'))return;drawSessions();loadShared();addEventListener('hashchange',loadShared);HEALTH.then(h=>{const c=h&&h.caps||[],b=$('shortbtn'),a=$('authcard');if(b&&c.includes('share'))b.hidden=false;if(a&&c.includes('auth'))a.hidden=false})})();
