// hero video: two clips alternate so the last second crossfades into the first
(function(){const rm=matchMedia('(prefers-reduced-motion: reduce)').matches,q=s=>document.querySelector(s);if(rm)return;
const vw=$('vw'),V=[0,1].map(()=>{const v=document.createElement('video');v.muted=true;v.playsInline=true;v.preload='auto';v.setAttribute('aria-hidden','true');v.disablePictureInPicture=true;v.src="https://d2ol7oe51mr4n9.cloudfront.net/user_38xzZboKViGWJOttwIXH07lWA1P/6ad9485f-ab40-444b-bd3c-40dcb9bd0e2f.mp4";vw.appendChild(v);return v});let cur=0;
V[0].addEventListener('loadeddata',()=>{V[0].style.opacity=1;V[0].play().catch(()=>{});vw.classList.add('on');loop()},{once:true});
function loop(){const v=V[cur],n=V[1-cur],d=v.duration;if(d){const t=v.currentTime-(d-1);if(t>0){if(n.paused){n.currentTime=0;n.play().catch(()=>{})}const a=Math.min(1,t);v.style.opacity=1-a;n.style.opacity=a}
if(v.ended||v.currentTime>=d-.03){v.pause();v.style.opacity=0;cur=1-cur}}requestAnimationFrame(loop)}
const E={duration:700,easing:'cubic-bezier(.2,.7,.2,1)',fill:'backwards'},rise=[{opacity:0,transform:'translateY(16px)'},{opacity:1,transform:'none'}];
[['.lg',0],['.hlinks',100],['.login',200],['.burger',200]].forEach(([s,d])=>{const e=q(s);e&&e.animate([{opacity:0},{opacity:1}],{...E,delay:d})});
q('.badge').animate([{opacity:0,transform:'scale(.2)'},{opacity:1,transform:'none'}],{...E,delay:300});
q('.h100 h1').animate([{clipPath:'inset(100% 0 0 0)',transform:'translateY(30%)'},{clipPath:'inset(0)',transform:'none'}],{...E,duration:900,delay:500});
q('.sl').animate(rise,{...E,delay:900});[...document.querySelectorAll('.cta a')].forEach((e,i)=>e.animate(rise,{...E,delay:1100+i*150}))})();
