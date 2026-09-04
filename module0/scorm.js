/* =====================================================================
   scorm.js — liaison LMS pour le module 0 Parcoursup'easy.
   SCORM 1.2 et SCORM 2004 (3e/4e edition) detectes automatiquement.
   Sans LMS : tout est conserve dans le navigateur (localStorage) et un
   journal reste consultable (window.SCORM.journal).
   ===================================================================== */
(function(){
  var API = null, version = null, initialise = false, termine = false;
  var journal = [];
  var CLE_LOCAL = 'pe-module0-v2';

  function note(m){ journal.push(new Date().toISOString().slice(11,19) + ' ' + m); if(journal.length > 400) journal.shift(); }

  /* ---- decouverte de l'API (fenetres parentes puis opener) ---- */
  function cherche(win){
    var n = 0;
    while(win && n < 12){
      try{
        if(win.API_1484_11){ version = '2004'; return win.API_1484_11; }
        if(win.API){ version = '1.2'; return win.API; }
      }catch(e){}
      if(win.parent === win) break;
      win = win.parent; n++;
    }
    return null;
  }
  function trouve(){
    var a = cherche(window);
    if(!a && window.opener){ try{ a = cherche(window.opener); }catch(e){} }
    return a;
  }

  /* ---- primitives ---- */
  function get(k){
    if(!API) return null;
    var v = (version === '2004') ? API.GetValue(k) : API.LMSGetValue(k);
    var err = (version === '2004') ? API.GetLastError() : API.LMSGetLastError();
    if(String(err) !== '0' && String(err) !== '403'){ note('get ' + k + ' erreur ' + err); }
    return v;
  }
  function set(k, v){
    if(!API) return false;
    v = String(v);
    var ok = (version === '2004') ? API.SetValue(k, v) : API.LMSSetValue(k, v);
    if(String(ok) !== 'true'){
      var err = (version === '2004') ? API.GetLastError() : API.LMSGetLastError();
      note('set ' + k + ' refuse (' + err + ')');
      return false;
    }
    return true;
  }
  function commit(){
    if(!API) return;
    (version === '2004') ? API.Commit('') : API.LMSCommit('');
  }

  /* ---- cycle de vie ---- */
  function init(){
    API = trouve();
    if(!API){ note('aucun LMS : mode autonome'); return false; }
    var ok = (version === '2004') ? API.Initialize('') : API.LMSInitialize('');
    if(String(ok) !== 'true'){ note('Initialize a echoue'); API = null; return false; }
    initialise = true;
    note('LMS SCORM ' + version + ' connecte');
    if(version === '2004'){
      var st = get('cmi.completion_status');
      if(st === 'unknown' || st === 'not attempted' || !st) set('cmi.completion_status', 'incomplete');
      set('cmi.exit', 'suspend');
    }else{
      var s12 = get('cmi.core.lesson_status');
      if(s12 === 'not attempted' || !s12) set('cmi.core.lesson_status', 'incomplete');
      set('cmi.core.exit', 'suspend');
    }
    commit();
    return true;
  }
  function quitte(){
    if(!API || termine) return;
    termine = true;
    (version === '2004') ? API.Terminate('') : API.LMSFinish('');
  }

  /* ---- etat sauvegarde ---- */
  function litEtat(){
    var brut = null;
    if(API){ brut = get(version === '2004' ? 'cmi.suspend_data' : 'cmi.suspend_data'); }
    if(!brut){ try{ brut = localStorage.getItem(CLE_LOCAL); }catch(e){} }
    if(!brut) return null;
    try{ return JSON.parse(brut); }catch(e){ return null; }
  }
  function ecritEtat(etat){
    var s = JSON.stringify(etat);
    try{ localStorage.setItem(CLE_LOCAL, s); }catch(e){}
    if(API){
      if(version === '1.2' && s.length > 4000) s = s.slice(0, 4000);
      set('cmi.suspend_data', s);
      set(version === '2004' ? 'cmi.location' : 'cmi.core.lesson_location', String(etat.page || 1));
      commit();
    }
  }
  function apprenant(){
    if(!API) return '';
    return get(version === '2004' ? 'cmi.learner_name' : 'cmi.core.student_name') || '';
  }

  /* ---- interactions ---- */
  var nInter = null;
  function nettoieId(id){ return String(id).replace(/[^A-Za-z0-9_.\-]/g, '_').slice(0, 250); }
  function interaction(o){
    /* o : {id, type, reponse, description, resultat, latence, correct} */
    if(!API){ note('interaction (locale) ' + o.id + ' = ' + o.reponse); return; }
    if(nInter === null){
      var c = parseInt(get('cmi.interactions._count') || '0', 10); nInter = isNaN(c) ? 0 : c;
    }
    var i = nInter++;
    var p = 'cmi.interactions.' + i + '.';
    var type = o.type || 'other';
    var types12 = ['true-false','choice','fill-in','matching','performance','sequencing','likert','numeric'];
    if(version === '1.2'){
      if(types12.indexOf(type) < 0) type = 'fill-in';
      set(p + 'id', nettoieId(o.id));
      set(p + 'type', type);
      set(p + 'time', heureCourte());
      if(o.correct) set(p + 'correct_responses.0.pattern', String(o.correct).slice(0, 255));
      set(p + 'student_response', String(o.reponse).slice(0, 255));
      set(p + 'result', o.resultat || 'neutral');
      set(p + 'weighting', '1');
      if(o.latence) set(p + 'latency', dureeScorm12(o.latence));
    }else{
      if(type === 'fill-in' && String(o.reponse).length > 250) type = 'long-fill-in';
      set(p + 'id', nettoieId(o.id));
      set(p + 'type', type);
      set(p + 'timestamp', horodatage());
      if(o.description) set(p + 'description', String(o.description).slice(0, 250));
      if(o.correct) set(p + 'correct_responses.0.pattern', String(o.correct).slice(0, 250));
      set(p + 'learner_response', String(o.reponse).slice(0, type === 'long-fill-in' ? 4000 : 250));
      set(p + 'result', o.resultat || 'neutral');
      set(p + 'weighting', '1');
      if(o.latence) set(p + 'latency', dureeIso(o.latence));
    }
    commit();
    note('interaction ' + o.id + ' enregistree');
  }

  /* ---- score / statut ---- */
  function score(pct, reussi, complet){
    if(!API) return;
    if(version === '2004'){
      set('cmi.score.raw', Math.round(pct)); set('cmi.score.min', '0'); set('cmi.score.max', '100');
      set('cmi.score.scaled', (pct / 100).toFixed(2));
      set('cmi.progress_measure', (pct / 100).toFixed(2));
      if(complet) set('cmi.completion_status', 'completed');
      if(reussi !== null) set('cmi.success_status', reussi ? 'passed' : 'failed');
    }else{
      set('cmi.core.score.raw', Math.round(pct)); set('cmi.core.score.min', '0'); set('cmi.core.score.max', '100');
      if(complet) set('cmi.core.lesson_status', reussi === false ? 'failed' : (reussi ? 'passed' : 'completed'));
    }
    commit();
  }
  function commentaire(txt){
    if(!API) return;
    if(version === '2004'){
      var c = parseInt(get('cmi.comments_from_learner._count') || '0', 10) || 0;
      set('cmi.comments_from_learner.' + c + '.comment', String(txt).slice(0, 4000));
      set('cmi.comments_from_learner.' + c + '.location', 'bilan');
      set('cmi.comments_from_learner.' + c + '.timestamp', horodatage());
    }else{
      set('cmi.comments', String(txt).slice(0, 4000));
    }
    commit();
  }

  /* ---- utilitaires temps ---- */
  function heureCourte(){ var d = new Date(); return [d.getHours(), d.getMinutes(), d.getSeconds()].map(function(x){ return (x < 10 ? '0' : '') + x; }).join(':'); }
  function horodatage(){ return new Date().toISOString().replace(/\.\d+Z$/, ''); }
  function dureeIso(ms){ var s = Math.max(0, Math.round(ms / 1000)); return 'PT' + Math.floor(s / 3600) + 'H' + Math.floor((s % 3600) / 60) + 'M' + (s % 60) + 'S'; }
  function dureeScorm12(ms){ var s = Math.max(0, Math.round(ms / 1000)); var h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), r = s % 60; return (h < 10 ? '0' : '') + h + ':' + (m < 10 ? '0' : '') + m + ':' + (r < 10 ? '0' : '') + r + '.00'; }
  var debut = Date.now();
  function tempsSession(){
    var ms = Date.now() - debut;
    if(!API) return;
    set('cmi.' + (version === '2004' ? 'session_time' : 'core.session_time'), version === '2004' ? dureeIso(ms) : dureeScorm12(ms));
  }

  window.SCORM = {
    init: init, quitte: quitte, litEtat: litEtat, ecritEtat: ecritEtat, interaction: interaction,
    score: score, commentaire: commentaire, apprenant: apprenant, tempsSession: tempsSession,
    get connecte(){ return !!API; }, get version(){ return version; }, journal: journal
  };
  addEventListener('beforeunload', function(){ try{ tempsSession(); commit(); quitte(); }catch(e){} });
  addEventListener('pagehide', function(){ try{ tempsSession(); commit(); quitte(); }catch(e){} });
})();
