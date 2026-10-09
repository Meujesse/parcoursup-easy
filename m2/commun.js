(function(){function fit(){var k=Math.min(innerWidth/1200,innerHeight/675);document.documentElement.style.setProperty('--k',k)}addEventListener('resize',fit);fit();
window.PE={get:function(k,d){try{return JSON.parse(localStorage.getItem(k))??d}catch(e){return d}},set:function(k,v){try{localStorage.setItem(k,JSON.stringify(v))}catch(e){}}};
window.LISA='https://meujesse.github.io/parcoursup-easy/lisa-anim/';})();
(function(){var k=document.body&&document.body.getAttribute('data-voix');if(!k)return;var s=document.getElementById('s');if(!s)return;
var b=document.createElement('button');b.id='voix';b.type='button';b.title='Écouter Lisa';b.setAttribute('aria-label','Écouter Lisa');
b.innerHTML='<svg viewBox="0 0 24 24" width="26" height="26" fill="none" stroke="#fff" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M11 5 6 9H3v6h3l5 4z" fill="#fff"/><path d="M15.5 8.5a5 5 0 0 1 0 7"/><path d="M18.5 5.5a9 9 0 0 1 0 13"/></svg>';
var pos=document.body.getAttribute('data-voix-pos')||'right:16px;top:50px';b.style.cssText='position:absolute;'+pos+';width:52px;height:52px;border-radius:50%;border:3px solid #fff;background:var(--rose);box-shadow:0 6px 16px rgba(0,0,0,.25);cursor:pointer;display:flex;align-items:center;justify-content:center;padding:0;z-index:50';
var a=new Audio('https://meujesse.github.io/parcoursup-easy/audio/m2/lisa-m2-'+k+'.mp3');a.preload='none';
b.onclick=function(){if(a.paused){a.play();b.style.background='var(--canard)';}else{a.pause();a.currentTime=0;b.style.background='var(--rose)';}};
a.onended=function(){b.style.background='var(--rose)';};s.appendChild(b);})();
/* Carte de l'ascension : progression par zone + retour à la carte */
(function(){
PE.GENIALLY='6ac43071a8dbcbfb106aad3f'; PE.CARTE_SLIDE='a85af7c2-864b-4bea-84ec-ace0d93c2af6';
PE.zones=function(){return PE.get('pe_m2_zones',{done:[]});};
PE.zoneDone=function(n){var z=PE.zones(); if(z.done.indexOf(n)<0){z.done.push(n); PE.set('pe_m2_zones',z);} return z;};
PE.goSlide=function(id){var base=null; try{var u=new URL(document.referrer); if(/genially\.com$/.test(u.hostname)&&/view/.test(u.pathname+u.hostname)){u.searchParams.set('idSlide',id); base=u.href;}}catch(e){} if(!base) base='https://view.genially.com/'+PE.GENIALLY+'?idSlide='+id; try{window.parent.location.href=base;}catch(e){window.open(base,'_top');}};
PE.goCarte=function(){PE.goSlide(PE.CARTE_SLIDE);};
var fin=document.body&&document.body.getAttribute('data-zone-fin'); if(!fin) return;
PE.zoneDone(+fin);
var s=document.getElementById('s'); if(!s||true) return;
var b=document.createElement('button'); b.type='button'; b.className='btn'; b.id='retourcarte'; b.innerHTML='🗺️ Retour à la carte de l’ascension';
var pos=document.body.getAttribute('data-zone-pos')||'left:16px;bottom:16px'; b.style.cssText='position:absolute;'+pos+';z-index:60;font-size:15px;padding:10px 18px';
b.onclick=PE.goCarte; s.appendChild(b);
})();
