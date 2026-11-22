const ORIGT=new WeakMap(),ATTRS=['placeholder','aria-label','title'];
function loadDict(cb){if(window.TE_DICT)return cb();const s=document.createElement('script');s.src=(document.documentElement.dataset.base||'./')+'assets/te.js?v=5.0';s.onload=cb;s.onerror=cb;document.head.appendChild(s)}
function applyLang(lang){const te=lang==='te',TE=window.TE_DICT||{};document.documentElement.lang=te?'te':'en';
const w=document.createTreeWalker(document.body,NodeFilter.SHOW_TEXT),nodes=[];let n;while((n=w.nextNode()))nodes.push(n);
for(const t of nodes){const p=t.parentNode&&t.parentNode.nodeName;if(p==='SCRIPT'||p==='STYLE'||p==='TEXTAREA')continue;if(!ORIGT.has(t))ORIGT.set(t,t.nodeValue);const o=ORIGT.get(t),k=o.trim();t.nodeValue=te&&TE[k]?o.replace(k,TE[k]):o}
document.querySelectorAll('[placeholder],[aria-label],[title]').forEach(e=>{for(const a of ATTRS){if(!e.hasAttribute(a))continue;const ds='o'+a.replace(/-/g,'');if(e.dataset[ds]===undefined)e.dataset[ds]=e.getAttribute(a);const o=e.dataset[ds];e.setAttribute(a,te&&TE[o]?TE[o]:o)}});
document.querySelectorAll('select.langsel').forEach(s=>{s.value=lang})}
function setLang(el){const lang=el&&el.value==='te'?'te':'en';try{localStorage.setItem('nf-lang',lang)}catch(e){}if(lang==='te')loadDict(()=>applyLang('te'));else applyLang('en')}
(function(){let l='en';try{l=localStorage.getItem('nf-lang')==='te'?'te':'en'}catch(e){}if(l==='te')loadDict(()=>applyLang('te'));else document.querySelectorAll('select.langsel').forEach(s=>{s.value='en'})})();
