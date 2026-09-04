/* =====================================================================
   app.js — moteur du module 0 Parcoursup'easy (reconstruction autonome).
   Rend les pages a partir de content.js, gere navigation, fenetres,
   infobulles, quiz, activites en iframe, progression, score et SCORM.
   ===================================================================== */
(function(){
  'use strict';
  const $ = s => document.querySelector(s);
  const SLIDES = window.CONTENU;
  const PAGES = SLIDES.filter(s => !s.popup).sort((a, b) => a.order - b.order);
  const PAR_ID = {}; SLIDES.forEach(s => PAR_ID[s.id] = s);
  const W = 1200, H = 675;

  /* ---- les activites suivies (ordre du module) ---- */
  const ACTIVITES = [
    {id:'video',        titre:'Vidéo de bienvenue de Lisa'},
    {id:'conversation', titre:'Conversation avec Lisa (prénom et premiers choix)'},
    {id:'q1-mots',      titre:'Question 1 : comment te définis-tu en 3 mots ?'},
    {id:'q2-matieres',  titre:'Question 2 : matières préférées et moyennes'},
    {id:'q3-distance',  titre:'Question 3 : es-tu prêt·e à partir loin ?'},
    {id:'q4-encadre',   titre:"Question 4 : as-tu besoin d'être encadré·e ?"},
    {id:'q5-concret',   titre:'Question 5 : concret ou théorie ?'},
    {id:'q6-duree',     titre:'Question 6 : études longues ?'},
    {id:'q7-budget',    titre:'Question 7 : formation payante ?'},
    {id:'q8-alternance',titre:"Question 8 : l'alternance ?"},
  ];
  const SEUIL_REUSSITE = 80;   // pourcentage d'activites terminees pour "reussi"
  const QUIZ_IDS = {'7895aa63-c4fe-4fa5-bede-a8a7668a0de6':'q4-encadre', '16bd9192-6a9f-43af-aa8b-b71d311193ec':'q5-concret', '1a6551d3-9ce8-4602-a1cd-97d4593b9526':'q8-alternance'};

  /* ---- etat ---- */
  let etat = {page:1, fait:{}, reponses:[], debut:Date.now(), quiz:{}};
  const stage = $('#stage'), couche = $('#couche'), popup = $('#popup'), voile = $('#voile'), info = $('#infobulle');
  let pageCourante = 1, popupOuvert = null, ouvertA = Date.now();

  /* =============== rendu =============== */
  function el(tag, cls){ const d = document.createElement(tag); if(cls) d.className = cls; return d; }

  function styleBase(d, e){
    d.style.left = e.x + 'px'; d.style.top = e.y + 'px';
    if(e.w) d.style.width = e.w + 'px';
    if(e.h && e.type !== 'text' && e.type !== 'bubble') d.style.height = e.h + 'px';
    if(e.opacity !== undefined && e.opacity !== 1) d.style.opacity = e.opacity;
    if(e.rot){ d.style.setProperty('--rot', e.rot + 'deg'); d.style.transform = 'rotate(' + e.rot + 'deg)'; d.classList.add('tourne'); }
    if(e.hidden || e.revealed === false) d.classList.add('cache');
    if(e.fx && e.fx.in && e.fx.in !== 'none'){
      d.classList.add('fx', 'fx-' + e.fx.in);
      d.style.animationDuration = e.fx.dur + 's';
      d.style.animationDelay = (e.fx.delay || 0) + 's';
    }
    d.dataset.id = e.id;
  }

  function rendText(e){
    const d = el('div', 'el texte');
    styleBase(d, e);
    d.style.fontFamily = '"' + (e.font || 'Montserrat') + '",Montserrat,system-ui,sans-serif';
    d.style.fontSize = e.size + 'px';
    d.style.color = e.color || '#333';
    if(e.lh) d.style.lineHeight = e.lh;
    if(e.ls && e.ls !== '0') d.style.letterSpacing = e.ls + (String(e.ls).match(/[a-z%]/) ? '' : 'px');
    if(e.pad && e.pad !== '0px') d.style.padding = e.pad;
    if(e.bgc) d.style.background = e.bgc;
    if(e.h) d.style.minHeight = e.h + 'px';
    if(e.valign === 'middle' || e.valign === 'bottom'){ d.style.display = 'flex'; d.style.flexDirection = 'column'; d.style.justifyContent = e.valign === 'middle' ? 'center' : 'flex-end'; d.style.height = e.h + 'px'; }
    d.innerHTML = e.html;
    return d;
  }
  function rendImage(e){
    const d = el('div', 'el image' + (e.frame === 'img-circle' ? ' cercle' : '') + (/border-white/.test(e.frame || '') ? ' cadre-blanc' : '') + (/shadow/.test(e.frame || '') ? ' ombre' : ''));
    styleBase(d, e);
    const im = el('img'); im.src = /\.gif$/i.test(e.src) ? e.src + '?t=' + Date.now() : e.src; im.alt = e.name || ''; im.draggable = false;   // un GIF sans boucle doit repartir du debut a chaque affichage
    if(e.offset){
      const o = e.offset, l = o.left || 0, r = o.right || 0, t = o.top || 0, b = o.bottom || 0;
      im.style.width = (100 - l - r) + '%'; im.style.height = (100 - t - b) + '%';
      im.style.left = l + '%'; im.style.top = t + '%';
    }
    d.appendChild(im);
    return d;
  }
  function rendSvg(e){
    const d = el('div', 'el svg' + (e.composite ? ' composite' : '')); styleBase(d, e); d.innerHTML = e.svg; return d;
  }
  function rendGroupe(e, enfants){
    const d = el('div', 'el groupe'); styleBase(d, e);
    enfants.sort((a, b) => a.z - b.z).forEach(c => { const n = rend(c, []); if(n) d.appendChild(n); });
    return d;
  }
  function rendIframe(e){
    const d = el('div', 'el iframe'); styleBase(d, e);
    d.style.left = '0'; d.style.top = '0'; d.style.width = W + 'px'; d.style.height = H + 'px';
    const f = el('iframe'); f.src = e.src; f.allow = 'autoplay; fullscreen'; f.title = e.activity || 'activité';
    f.dataset.activity = e.activity;
    d.appendChild(f);
    return d;
  }
  function rendBulle(e){
    const d = el('div', 'el bulle-lisa queue-' + (e.tail || 'right')); styleBase(d, e);
    d.style.top = Math.max(14, Math.min(e.y, H - 200)) + 'px';
    d.style.width = Math.min(e.w, 470) + 'px';
    d.style.padding = e.pad + 'px';
    d.style.background = e.bgc; d.style.color = e.color; d.style.fontSize = e.size + 'px'; d.style.textAlign = e.align;
    d.style.fontFamily = '"' + e.font + '",Montserrat,system-ui,sans-serif';
    d.style.border = e.bw + 'px solid ' + e.border;
    d.textContent = e.text;
    return d;
  }
  function rendVideo(e){
    const d = el('div', 'el cadre-video'); styleBase(d, e);
    const v = el('video'); v.src = e.src; v.poster = e.poster; v.controls = true; v.playsInline = true; v.preload = 'metadata';
    v.addEventListener('ended', () => { termineActivite('video', {reponse:'true', type:'true-false', description:'Vidéo de bienvenue regardée jusqu\'au bout'}); });
    d.appendChild(v);
    return d;
  }
  function rendQuiz(e, slide){
    const actId = QUIZ_IDS[slide.id] || ('quiz-' + slide.order);
    const d = el('div', 'el quiz'); styleBase(d, e);
    const ap = e.appearance || {};
    if(ap.border) d.style.borderColor = ap.border;
    const q = el('div', 'q'); q.textContent = e.question; if(ap.qcolor) q.style.color = ap.qcolor; d.appendChild(q);
    const reps = el('div', 'reps'); d.appendChild(reps);
    const pied = el('div', 'pied'); const note = el('span', 'note'); const btn = el('button', 'envoyer'); btn.type = 'button'; btn.textContent = e.button || 'Envoyer';
    pied.appendChild(note); pied.appendChild(btn); d.appendChild(pied);
    let choix = null; const deja = etat.quiz[actId];
    e.answers.forEach(a => {
      const b = el('button', 'rep'); b.type = 'button'; b.innerHTML = '<span class="puce"></span><span></span>';
      b.lastChild.textContent = a.text; if(ap.abg) b.style.background = ap.abg;
      b.onclick = () => { choix = a; reps.querySelectorAll('.rep').forEach(x => x.classList.toggle('choisie', x === b)); btn.classList.add('pret'); note.classList.remove('vu'); };
      if(deja && deja.id === a.id){ b.classList.add('choisie'); choix = a; btn.classList.add('pret', 'fait'); }
      reps.appendChild(b);
    });
    if(deja){ note.textContent = 'Réponse enregistrée : tu peux la modifier.'; note.classList.add('vu'); }
    btn.onclick = () => {
      if(!choix){ note.textContent = 'Choisis une réponse d\'abord.'; note.classList.add('vu'); return; }
      const essai = ((etat.quiz[actId] || {}).n || 0) + 1;
      etat.quiz[actId] = {id:choix.id, texte:choix.text, n:essai};
      const lisa = e.answers.filter(a => a.lisa).map(a => a.text)[0] || '';
      enregistre({id:actId.replace(/-/g, '_') + (essai > 1 ? '_essai' + essai : ''), activite:actId, type:'choice', reponse:choix.text,
                  description:e.question, detail:{choixLisa:lisa, options:e.answers.map(a => a.text)}});
      termineActivite(actId, null);
      btn.classList.add('fait'); btn.textContent = '✓ ' + (e.button || 'Envoyer');
      note.textContent = 'C\'est noté ! Regarde l\'exemple de Lisa, puis passe à la suite.'; note.classList.add('vu');
      setTimeout(() => { btn.textContent = e.button || 'Envoyer'; }, 2500);
    };
    return d;
  }

  function rend(e, enfants, slide){
    switch(e.type){
      case 'text': return brancheActions(rendText(e), e);
      case 'image': return brancheActions(rendImage(e), e);
      case 'svg': return brancheActions(rendSvg(e), e);
      case 'group': return brancheActions(rendGroupe(e, enfants), e);
      case 'iframe': return rendIframe(e);
      case 'bubble': return rendBulle(e);
      case 'quiz': return rendQuiz(e, slide);
      case 'video': return rendVideo(e);
    }
    return null;
  }

  function rendSlide(s){
    const d = el('div', 'slide'); d.dataset.slide = s.id;
    d.style.background = (s.bg && s.bg !== 'transparent') ? s.bg : (s.popup ? 'transparent' : 'var(--teal-clair)');
    if(s.bgImage && !s.popup){ d.appendChild(el('div', 'fond-img')); }
    const enfantsDe = {};
    s.elements.forEach(e => { if(e.group){ (enfantsDe[e.group] = enfantsDe[e.group] || []).push(e); } });
    s.elements.filter(e => !e.group).sort((a, b) => a.z - b.z).forEach(e => {
      const n = rend(e, enfantsDe[e.id] || [], s); if(n) d.appendChild(n);
    });
    return d;
  }

  /* =============== actions =============== */
  function brancheActions(d, e){
    if(!e.actions || !e.actions.length) return d;
    d.dataset.actions = e.actions.map(a => a.on + ':' + a.type).join(' ');
    e.actions.forEach(a => {
      if(a.on === 'click'){
        d.classList.add('cliquable');
        d.addEventListener('click', ev => { ev.stopPropagation(); executeAction(a, d); });
      }else if(a.on === 'hover' && a.type === 'htmlTooltip'){
        d.addEventListener('mouseenter', () => montreInfobulle(d, a));
        d.addEventListener('mouseleave', cacheInfobulle);
      }
    });
    return d;
  }
  function executeAction(a, d){
    switch(a.type){
      case 'goToSlide':
        if(a.smart === 'nextPage') return va(pageCourante + 1);
        if(a.smart === 'previousPage') return va(pageCourante - 1);
        if(a.slide){ const s = PAR_ID[a.slide]; if(s) return va(s.order); }
        break;
      case 'slidePopup': return ouvrePopup(a.slide);
      case 'closeSlidePopup': return fermePopup();
      case 'showElements':
        (a.targets || []).forEach(id => {
          const cible = stage.querySelector('[data-id="' + id + '"]');
          if(cible){ cible.classList.remove('cache'); cible.style.animation = 'none'; void cible.offsetWidth; cible.style.animation = ''; }
        });
        break;
    }
  }
  function montreInfobulle(d, a){
    info.innerHTML = a.html.replace(/<\/?(head|body)>/g, '');
    info.style.background = a.bg || '#fff'; info.style.color = a.fg || '#000'; info.style.padding = a.pad || '18px';
    const r = d.getBoundingClientRect(), st = stage.getBoundingClientRect(), k = st.width / W;
    let x = (r.left - st.left) / k - 340, y = (r.top - st.top) / k - 10;
    if(x < 10) x = (r.right - st.left) / k + 12;
    info.style.left = x + 'px'; info.style.top = Math.max(8, y) + 'px';
    info.classList.add('vu');
  }
  function cacheInfobulle(){ info.classList.remove('vu'); }

  /* =============== navigation =============== */
  function va(n){
    if(n < 1 || n > PAGES.length) return;
    if(popupOuvert) fermePopup();
    cacheInfobulle();
    const s = PAGES[n - 1];
    couche.innerHTML = '';
    couche.appendChild(rendSlide(s));
    pageCourante = n; etat.page = n; ouvertA = Date.now();
    $('#navPrec').disabled = (n === 1);
    $('#navSuiv').disabled = (n === PAGES.length);
    majCompteur();
    SCORM.ecritEtat(etat);
    couche.focus && couche.focus();
  }
  function ouvrePopup(id){
    const s = PAR_ID[id]; if(!s) return;
    popup.innerHTML = ''; popup.appendChild(rendSlide(s)); popup.classList.add('vu'); voile.classList.add('vu'); popupOuvert = id;
  }
  function fermePopup(){ popup.innerHTML = ''; popup.classList.remove('vu'); voile.classList.remove('vu'); popupOuvert = null; }
  voile.addEventListener('click', fermePopup);
  $('#navPrec').addEventListener('click', () => va(pageCourante - 1));
  $('#navSuiv').addEventListener('click', () => va(pageCourante + 1));
  addEventListener('keydown', ev => {
    if(ev.target && (ev.target.tagName === 'INPUT' || ev.target.tagName === 'TEXTAREA')) return;
    if(ev.key === 'ArrowRight' || ev.key === 'PageDown') va(pageCourante + 1);
    if(ev.key === 'ArrowLeft' || ev.key === 'PageUp') va(pageCourante - 1);
    if(ev.key === 'Escape' && popupOuvert) fermePopup();
  });

  function majCompteur(){
    const faits = ACTIVITES.filter(a => etat.fait[a.id]).length;
    $('#compteur .num').textContent = pageCourante + ' / ' + PAGES.length;
    $('#compteur .barre i').style.width = Math.round(100 * faits / ACTIVITES.length) + '%';
    $('#compteur').title = faits + ' activité(s) sur ' + ACTIVITES.length + ' terminée(s)';
  }

  /* =============== suivi (SCORM) =============== */
  function enregistre(o){
    /* o : {id, activite, type, reponse, description, detail} */
    const rec = {id:o.id, act:o.activite, type:o.type, rep:String(o.reponse), q:o.description || '', d:o.detail || null, t:Date.now()};
    etat.reponses = etat.reponses.filter(r => r.id !== rec.id).concat([rec]);
    SCORM.interaction({id:'M0_' + o.id, type:o.type, reponse:o.reponse, description:o.description, latence:Date.now() - ouvertA,
                       resultat:'neutral'});
    SCORM.ecritEtat(etatCompact());
    if(window.parent !== window){ try{ parent.postMessage({pe:'journal', reponse:rec}, '*'); }catch(e){} }
  }
  function termineActivite(id, inter){
    if(inter){ enregistre(Object.assign({id:id.replace(/-/g, '_'), activite:id}, inter)); }
    if(!etat.fait[id]){ etat.fait[id] = Date.now(); }
    majCompteur(); majScore();
  }
  function majScore(){
    const faits = ACTIVITES.filter(a => etat.fait[a.id]).length;
    const pct = Math.round(100 * faits / ACTIVITES.length);
    const complet = faits === ACTIVITES.length;
    SCORM.score(pct, pct >= SEUIL_REUSSITE ? true : (complet ? false : null), complet);
    if(complet && !etat.bilanEnvoye){
      etat.bilanEnvoye = true;
      SCORM.commentaire(JSON.stringify({module:'Parcoursup\'easy module 0', reponses:etat.reponses.map(r => ({id:r.id, q:r.q, reponse:r.rep}))}));
    }
    SCORM.ecritEtat(etatCompact());
  }
  function etatCompact(){
    /* pour suspend_data (SCORM 1.2 : 4096 caracteres) on garde l'essentiel */
    const c = {page:etat.page, fait:etat.fait, quiz:etat.quiz, debut:etat.debut, bilanEnvoye:!!etat.bilanEnvoye,
               reponses:etat.reponses.map(r => ({id:r.id, act:r.act, type:r.type, rep:r.rep.slice(0, 160), q:r.q.slice(0, 80), t:r.t}))};
    return c;
  }

  /* messages des activites en iframe */
  addEventListener('message', ev => {
    const m = ev.data; if(!m || !m.pe) return;
    if(m.pe === 'reponse'){
      enregistre({id:m.id, activite:m.activite, type:m.type, reponse:m.reponse, description:m.texte, detail:m.detail});
    }else if(m.pe === 'termine'){
      termineActivite(m.activite, null);
    }
  });

  /* =============== demarrage =============== */
  function demarre(){
    SCORM.init();
    const sauve = SCORM.litEtat();
    const nom = SCORM.apprenant();
    if(nom) $('#reprise p').dataset.nom = nom;
    if(sauve && sauve.page && sauve.page > 1 && (sauve.fait || sauve.reponses)){
      etat = Object.assign(etat, sauve);
      $('#reprise').classList.add('vu');
      $('#reprise .oui').onclick = () => { $('#reprise').classList.remove('vu'); va(etat.page); };
      $('#reprise .non').onclick = () => { $('#reprise').classList.remove('vu'); etat = {page:1, fait:{}, reponses:[], debut:Date.now(), quiz:{}}; va(1); };
      va(1);
    }else{
      va(1);
    }
    majCompteur();
  }
  function ajuste(){
    const k = Math.min(innerWidth / W, innerHeight / H);
    stage.style.transform = 'scale(' + k + ')';
    $('#cadre').style.width = (W * k) + 'px'; $('#cadre').style.height = (H * k) + 'px';
  }
  if(/[?&]anim=0/.test(location.search)) document.documentElement.classList.add('sans-anim');
  addEventListener('resize', ajuste); ajuste();
  window.MODULE = {va:va, etat:() => etat, activites:ACTIVITES, pages:PAGES};
  demarre();
})();
