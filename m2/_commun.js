(function(){function fit(){var k=Math.min(innerWidth/1200,innerHeight/675);document.documentElement.style.setProperty('--k',k)}addEventListener('resize',fit);fit();
window.PE={get:function(k,d){try{return JSON.parse(localStorage.getItem(k))??d}catch(e){return d}},set:function(k,v){try{localStorage.setItem(k,JSON.stringify(v))}catch(e){}}};
window.LISA='https://meujesse.github.io/parcoursup-easy/lisa-anim/';})();
