const $=id=>document.getElementById(id);
const BASE=document.documentElement.dataset.base||'./';
const API=String(window.NEXUS_API||'').trim().replace(/\/$/,'')||(()=>{try{return localStorage.getItem('api')||''}catch(e){return ''}})()||(location.port==='8080'?'http://localhost:8000':'');
async function call(path,body){if(!API)throw new Error('offline');const r=await fetch(API+path,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)});if(!r.ok)throw new Error(r.status);return r.json()}
const esc=s=>String(s).replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
(function(){const el=$('apiState');if(!el)return;if(!API){el.textContent='Mode: runs fully in your browser';return}
fetch(API+'/api/health').then(r=>{if(!r.ok)throw 0;el.textContent='API: online'}).catch(()=>{el.textContent='API: offline (browser mode)'})})();
function toggleNav(b){const n=document.querySelector('header nav');const o=n.classList.toggle('open');if(b&&b.setAttribute)b.setAttribute('aria-expanded',o)}
['click','change','input'].forEach(t=>document.addEventListener(t,e=>{const k=t==='click'?'act':t==='change'?'chg':'inp',a=e.target.closest('[data-'+k+']');if(a&&typeof window[a.dataset[k]]==='function')window[a.dataset[k]](a)}));
const PAGES=[['Home',''],['Workspace','workspace/'],['Intelligence tools','workspace/#intelligence'],['Security lab','security/'],['Projects','projects/'],['Architecture','architecture/'],['Credentials','about/'],['FAQ','faq/'],['GitHub','https://github.com/Nikhil-creat']];
let pal;
function openPalette(){if(!pal){pal=document.createElement('dialog');pal.className='pal';pal.setAttribute('aria-label','Quick search');pal.innerHTML='<input type="search" aria-label="Search pages" autocomplete="off" placeholder="Jump to a page"><ul></ul>';document.body.appendChild(pal);
const q=pal.querySelector('input'),l=pal.querySelector('ul'),href=p=>p[1].startsWith('http')?p[1]:BASE+p[1],draw=()=>{const t=q.value.toLowerCase();l.innerHTML=PAGES.filter(p=>p[0].toLowerCase().includes(t)).map(p=>'<li><a href="'+esc(href(p))+'">'+esc(p[0])+'</a></li>').join('')};
q.addEventListener('input',draw);q.addEventListener('keydown',e=>{if(e.key==='Enter'){const a=l.querySelector('a');if(a)location.href=a.getAttribute('href')}});pal.addEventListener('click',e=>{if(e.target===pal)pal.close()});draw()}
if(!pal.open){pal.showModal();pal.querySelector('input').focus()}}
addEventListener('keydown',e=>{if((e.ctrlKey||e.metaKey)&&e.key.toLowerCase()==='k'){e.preventDefault();openPalette()}});
if(document.body.classList.contains('home')){const hd=document.querySelector('header');addEventListener('scroll',()=>hd.classList.toggle('show',scrollY>innerHeight*.8),{passive:true})}
(function(){const bg=$('burger'),hm=$('hmenu');if(!bg||!hm)return;bg.addEventListener('click',()=>{const o=hm.classList.toggle('open');bg.setAttribute('aria-expanded',o)});hm.addEventListener('click',()=>hm.classList.remove('open'))})();
if('serviceWorker' in navigator&&location.protocol.startsWith('http'))navigator.serviceWorker.register(BASE+'sw.js').catch(()=>{});
