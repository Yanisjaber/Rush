/* src/features/training/structure-page.js — extrait de l'ancien app.js (découpage par fonctionnalité). */
import { appState } from '../../core/state.js';
import { activatePanel } from '../../routing/tabs.js';
import { getSportCategory, toIsoDate } from '../dashboard/filters.js';
import { loadStreamsFromSupabase, streamsCache } from '../streams/streams-cache.js';
import { openSessionModal } from '../sessions/session-modal.js';

var __PC_VERSION = 3;


export function _buildRecordsTable(S) {
  var W = S.wattsRaw || S.watts || [], CAD = S.cadence || [], ALT = S.altitude || [], DIST = S.distance || [], n = W.length;
  if (!n) return '';
  var pref = new Float64Array(n + 1);
  for (var i = 0; i < n; i++) { var w = W[i]; pref[i + 1] = pref[i] + ((w == null || isNaN(w)) ? 0 : +w); }
  var bestWin = function (d) { var best = -1, bi = 0; for (var s = 0; s + d <= n; s++) { var avg = (pref[s + d] - pref[s]) / d; if (avg > best) { best = avg; bi = s; } } return { avg: best, start: bi }; };
  // sauve la courbe de l'activite courante (memoire + DB) pour qu'elle compte dans le rang
  var curCurve = window.__powerCurveFromWatts(W);
  if (curCurve && window.__lastActSbId) {
    if (Array.isArray(appState.data)) appState.data.forEach(function (dd) { (dd.activities || []).forEach(function (a) { if (String(a._sbId) === String(window.__lastActSbId)) a.power_curve = curCurve; }); });
    if (window.cloudSync && window.cloudSync.savePowerCurve) { try { window.cloudSync.savePowerCurve(window.__lastActSbId, curCurve); } catch (e) {} }
  }
  var byDur = (typeof window.__allPowerCurvesByDur === 'function') ? window.__allPowerCurvesByDur(window.__lastActDate, window.__lastActSport) : {};
  var distMax = 0; for (var di = 0; di < DIST.length; di++) { var dv = DIST[di]; if (dv != null && dv > distMax) distMax = dv; }
  var toM = distMax > 1000 ? 1 : 1000;
  var distAt = function (idx) { var x = DIST[Math.min(idx, DIST.length - 1)]; return (x == null ? 0 : x) * toM; };
  var altGain = function (s0, s1) { var g = 0, prev = null; for (var k = s0; k < s1; k++) { var x = ALT[k]; if (x == null) continue; if (prev != null && x > prev) g += x - prev; prev = x; } return g; };
  var avgR = function (arr, s0, s1) { var sum = 0, c = 0; for (var k = s0; k < s1; k++) { var x = arr[k]; if (x != null && !isNaN(x)) { sum += x; c++; } } return c ? sum / c : 0; };
  var fmtT = function (sec) { var h = Math.floor(sec / 3600), m = Math.floor((sec % 3600) / 60), s = Math.round(sec % 60); return (h > 0 ? (h + ':' + String(m).padStart(2, '0')) : ('' + m)) + ':' + String(s).padStart(2, '0'); };
  var fmtDur = function (d) {
    if (d < 60) return d + 's';
    if (d < 3600) return (d % 60 === 0) ? (d / 60 + 'min') : (Math.floor(d / 60) + 'min' + (d % 60) + 's');
    var h = Math.floor(d / 3600), m = Math.round((d % 3600) / 60);
    return m === 0 ? (h + 'h') : (h + 'h' + String(m).padStart(2, '0') + 'm');
  };
  var std = appState.__PC_TABLE_DURS.filter(function (d) { return d <= n; });
  var hasCad = CAD.some(function (x) { return x != null; });
  var rows = std.map(function (d) {
    var bw = bestWin(d), s0 = bw.start, s1 = Math.min(n, s0 + d), cur = Math.round(bw.avg);
    var arr = byDur[d] || []; var greater = 0; for (var z = 0; z < arr.length; z++) { if (arr[z] > cur) greater++; }
    var rank = greater + 1, totalR = arr.length || 1;
    var pct = totalR > 0 ? Math.max(2, Math.round((totalR - rank + 1) / totalR * 100)) : 0;
    var medal = rank === 1 ? '\ud83e\udd47 ' : (rank === 2 ? '\ud83e\udd48 ' : (rank === 3 ? '\ud83e\udd49 ' : ''));
    var rankTxtCol = (rank <= 10) ? '#fbbf24' : 'var(--text-dim,#9aa6b6)';
    var distM = Math.max(0, distAt(s1) - distAt(s0));
    var spd = distM > 0 ? ((distM / 1000) / (d / 3600)) : 0;
    var dplus = altGain(s0, s1);
    var cad = avgR(CAD, s0, s1);
    return '<tr class="rec-row" data-dur="' + d + '" style="cursor:pointer">'
      + '<td><span class="rec-caret">\u25b8</span> ' + fmtDur(d) + '</td>'
      + '<td class="af-tw"><b>' + cur + ' W</b></td>'
      + '<td style="min-width:170px"><div style="display:flex;align-items:center;gap:9px"><span style="color:' + rankTxtCol + ';font-weight:700;white-space:nowrap">' + medal + rank + '<span style="color:var(--text-mute,#6b7686);font-weight:400"> / ' + totalR + '</span></span><div style="flex:1;height:5px;background:var(--bg-elev,#222b3d);border-radius:3px;overflow:hidden"><div style="width:' + pct + '%;height:100%;background:#5fb87a"></div></div></div></td>'
      + '<td>' + fmtT(s0) + ' \u2192 ' + fmtT(s1) + '</td>'
      + '</tr>';
  }).join('');
  return '<div class="af-table-wrap"><table class="af-table"><thead><tr><th>Durée</th><th>Puissance</th><th>Rang</th><th>Intervalle</th></tr></thead><tbody>' + rows + '</tbody></table></div>';
}


export function _buildAfCharts(S) {
  if (!S || !window.Chart) return;
  var grid = 'rgba(255,255,255,0.06)', tick = '#9aa6b6';
  var opts = function (extra) {
    var o = { responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false } }, scales: { x: { grid: { color: grid }, ticks: { color: tick, font: { size: 10 } } }, y: { grid: { color: grid }, ticks: { color: tick, font: { size: 10 } }, beginAtZero: true } } };
    if (extra) { for (var k in extra) o[k] = extra[k]; }
    return o;
  };
  var hide = function (id) { var s = document.getElementById(id); if (s) s.style.display = 'none'; };
  var W = (S.wattsRaw || S.watts || []).map(function (x) { return (x == null || isNaN(x)) ? null : +x; });
  var HR = (S.hr || []).map(function (x) { return (x == null || isNaN(x)) ? null : +x; });
  var ftp = S.ftp || 250, hrMax = S.hrMax || 190;
  var ZHEX = ['#3b82f6', '#22c55e', '#eab308', '#f97316', '#ef4444', '#a855f7', '#ec4899'];
  var hasW = W.some(function (x) { return x != null; });
  var hasH = HR.some(function (x) { return x != null; });
  // Courbe de puissance (mean-max) seconde par seconde + tableau de records
  if (hasW) {
    var n = W.length;
    var pref = new Float64Array(n + 1);
    for (var i = 0; i < n; i++) pref[i + 1] = pref[i] + (W[i] || 0);
    var bestWin = function (d) { var best = -1, bi = 0; for (var s = 0; s + d <= n; s++) { var avg = (pref[s + d] - pref[s]) / d; if (avg > best) { best = avg; bi = s; } } return { avg: best, start: bi }; };
    var durs = [];
    for (var d = 1; d <= 60; d++) durs.push(d);
    for (d = 65; d <= 300; d += 5) durs.push(d);
    for (d = 320; d <= 1200; d += 20) durs.push(d);
    for (d = 1260; d <= 3600; d += 60) durs.push(d);
    for (d = 3900; d <= n; d += 300) durs.push(d);
    durs = durs.filter(function (x) { return x <= n; });
    // Echelle X compressee (donne moins de place aux courtes durees qu'un log pur)
    var PW = 0.32, TX = function (t) { return Math.pow(t, PW); }, iTX = function (v) { return Math.pow(v, 1 / PW); };
    var fmtSec = function (t) { t = Math.round(t); if (t < 60) return t + 's'; if (t < 3600) return Math.round(t / 60) + 'min'; var h = Math.floor(t / 3600), mm = Math.round((t % 3600) / 60); return mm ? (h + 'h' + (mm < 10 ? '0' + mm : mm)) : (h + 'h'); };
    var fmtPrec = function (t) { t = Math.round(t); if (t < 60) return t + 's'; if (t < 3600) { var m = Math.floor(t / 60), s = t % 60; return s ? (m + 'min' + s + 's') : (m + 'min'); } var h = Math.floor(t / 3600), mm = Math.round((t % 3600) / 60); return mm ? (h + 'h' + (mm < 10 ? '0' + mm : mm) + 'm') : (h + 'h'); };
    var pts = durs.map(function (x) { return { x: TX(x), y: Math.round(bestWin(x).avg) }; });
    // Record all-time (envelope des meilleures perfs <= date) par duree standard
    // Utilise la VRAIE courbe (dense, brute) de l'activite courante dans l'agregation
    // (sinon l'ancienne courbe stockee, plus basse/lissee, fausse le record).
    try { var _curC = window.__powerCurveFromWatts(W); if (_curC && window.__lastActSbId && Array.isArray(appState.data)) appState.data.forEach(function (dd) { (dd.activities || []).forEach(function (aa) { if (String(aa._sbId) === String(window.__lastActSbId)) aa.power_curve = _curC; }); }); } catch (e) {}
    var byDur = (typeof window.__allPowerCurvesByDur === 'function') ? window.__allPowerCurvesByDur(window.__lastActDate, window.__lastActSport) : {};
    // Record all-time : VRAIE valeur a chaque point (max sur l'historique a cette duree exacte).
    // Cette sortie fait partie des records -> le Record est au moins egal a "Cette sortie"
    // (evite que le record passe sous la sortie quand la courbe stockee est plus ancienne/lissee).
    var recPts = durs.map(function (x) {
      var arr = byDur[x]; if (!arr || !arr.length) return { x: TX(x), y: null };
      var mx = 0; for (var z = 0; z < arr.length; z++) if (arr[z] > mx) mx = arr[z];
      return { x: TX(x), y: mx > 0 ? Math.round(mx) : null };
    });
    var tickT = [1, 5, 10, 30, 60, 300, 1200, 3600, 9000, 18000].filter(function (t) { return t <= n; });
    window.__afCharts.push(new Chart(document.getElementById('af-pcurve'), {
      type: 'line',
      data: { datasets: [
        { label: 'Record', data: recPts, borderColor: '#7c8698', borderDash: [5, 4], borderWidth: 2, pointRadius: 0, fill: false, tension: 0.2 },
        { label: 'Cette sortie', data: pts, borderColor: '#fbbf24', backgroundColor: 'rgba(251,191,36,.15)', fill: true, tension: 0.2, pointRadius: 0, borderWidth: 2.5 }
      ] },
      options: opts({
        interaction: { mode: 'nearest', intersect: false, axis: 'x' },
        scales: {
          x: { type: 'linear', min: TX(1), max: TX(n), grid: { color: grid }, afterBuildTicks: function (ax) { ax.ticks = tickT.map(function (t) { return { value: TX(t) }; }); }, ticks: { color: tick, font: { size: 10 }, autoSkip: false, callback: function (v) { return fmtSec(iTX(v)); } } },
          y: { grid: { color: grid }, ticks: { color: tick, font: { size: 10 } }, beginAtZero: true }
        },
        plugins: { legend: { display: true, labels: { color: tick, boxWidth: 14, font: { size: 11 } } }, tooltip: { callbacks: { title: function (c) { return fmtPrec(iTX(c[0].parsed.x)); }, label: function (c) { return c.dataset.label + ' : ' + c.parsed.y + ' W'; } } } }
      })
    }));
    try { var _rt = document.getElementById('af-records'); if (_rt) _rt.innerHTML = _buildRecordsTable(S); } catch (e) { console.warn('[records]', e && e.message); }
  } else { hide('af-s-pc'); }
  // Temps par zone - puissance
  if (hasW) {
    var zsec = [0, 0, 0, 0, 0, 0, 0];
    W.forEach(function (w) { if (w == null) return; var p = w / ftp * 100; var z = p < 55 ? 0 : p < 76 ? 1 : p < 91 ? 2 : p < 106 ? 3 : p < 121 ? 4 : p < 151 ? 5 : 6; zsec[z]++; });
    window.__afCharts.push(new Chart(document.getElementById('af-zpow'), { type: 'bar', data: { labels: ['Z1', 'Z2', 'Z3', 'Z4', 'Z5', 'Z6', 'Z7'], datasets: [{ data: zsec.map(function (s) { return Math.round(s / 60 * 10) / 10; }), backgroundColor: ZHEX }] }, options: opts({ indexAxis: 'y', plugins: { legend: { display: false }, tooltip: { callbacks: { label: function (c) { return c.parsed.x + ' min'; } } } } }) }));
  } else { hide('af-s-zp'); }
  // Temps par zone - FC
  if (hasH) {
    var hsec = [0, 0, 0, 0, 0];
    HR.forEach(function (h) { if (h == null) return; var p = h / hrMax * 100; var z = p < 60 ? 0 : p < 70 ? 1 : p < 82 ? 2 : p < 93 ? 3 : 4; hsec[z]++; });
    window.__afCharts.push(new Chart(document.getElementById('af-zhr'), { type: 'bar', data: { labels: ['Z1', 'Z2', 'Z3', 'Z4', 'Z5'], datasets: [{ data: hsec.map(function (s) { return Math.round(s / 60 * 10) / 10; }), backgroundColor: ['#60a5fa', '#22c55e', '#eab308', '#f97316', '#ef4444'] }] }, options: opts({ indexAxis: 'y', plugins: { legend: { display: false }, tooltip: { callbacks: { label: function (c) { return c.parsed.x + ' min'; } } } } }) }));
  } else { hide('af-s-zh'); }
  // Distribution de puissance
  if (hasW) {
    var mx = 0; W.forEach(function (w) { if (w != null && w > mx) mx = w; });
    var bin = 20, nb = Math.floor(mx / bin) + 1, hist = new Array(nb).fill(0);
    W.forEach(function (w) { if (w == null) return; var b = Math.min(nb - 1, Math.floor(w / bin)); hist[b]++; });
    var dl = []; for (var k = 0; k < nb; k++) dl.push('' + (k * bin));
    window.__afCharts.push(new Chart(document.getElementById('af-dist'), { type: 'bar', data: { labels: dl, datasets: [{ data: hist.map(function (s) { return Math.round(s / 60 * 10) / 10; }), backgroundColor: '#3b82f6' }] }, options: opts({ plugins: { legend: { display: false }, tooltip: { callbacks: { title: function (c) { return c[0].label + '-' + (+c[0].label + bin) + ' W'; }, label: function (c) { return c.parsed.y + ' min'; } } } } }) }));
  } else { hide('af-s-di'); }
}

export function bootStructurePage() {

// ============================================================
// ÉDITEUR DE STRUCTURE EN PLEINE PAGE : la section #sb-section (builder
// d'intervalles) est DÉPLACÉE de la modale entraînement vers une page dédiée
// (plus de place pour construire), puis remise à sa place au retour.
// L'état du builder et des champs de la modale est conservé (même DOM).
// ============================================================
window.openStructureEditor = function () {
  // Éditeur v2 (structure-editor.js) : page dédiée complète — prioritaire
  if (window.StructEd && typeof window.StructEd.open === 'function') { window.StructEd.open(); return; }
  var sec = document.getElementById('sb-section');
  if (!sec) return;
  // Ancre pour remettre la section exactement à sa place au retour
  if (!document.getElementById('sb-home-anchor')) {
    var ph = document.createElement('div');
    ph.id = 'sb-home-anchor';
    ph.hidden = true;
    sec.parentNode.insertBefore(ph, sec);
  }
  var modal = document.getElementById('train-modal');
  window.__sbModalWasOpen = !!(modal && modal.classList.contains('active'));
  if (modal) modal.classList.remove('active');
  var container = document.querySelector('.main .container') || document.querySelector('.container');
  if (!container) return;
  var page = document.getElementById('p-structure');
  if (!page) { page = document.createElement('section'); page.className = 'panel'; page.id = 'p-structure'; container.appendChild(page); }
  var nm = (document.getElementById('train-modal-name') || {}).value || '';
  page.innerHTML = '<div class="sbp-head">'
    + '<button type="button" class="af-back" id="sbp-back">← Retour à la séance</button>'
    + '<h2 class="sbp-title">Structure' + (nm ? ' — ' + nm.replace(/[<>]/g, '') : '') + '</h2>'
    + '<button type="button" class="btn-primary" id="sbp-done" style="margin-left:auto;">Valider la structure</button>'
    + '</div><div id="sbp-slot"></div>';
  page.querySelector('#sbp-back').addEventListener('click', function () { window.closeStructureEditor(); });
  page.querySelector('#sbp-done').addEventListener('click', function () { window.closeStructureEditor(); });
  page.querySelector('#sbp-slot').appendChild(sec);
  sec.classList.add('sb-fullpage');
  var cur = document.querySelector('.panel.active');
  window.__sbPrevPanelId = (cur && cur.id && cur.id !== 'p-structure') ? cur.id : (window.__sbPrevPanelId || 'p2');
  document.querySelectorAll('.panel').forEach(function (p) { p.classList.remove('active'); });
  page.classList.add('active');
  window.scrollTo(0, 0);
};

window.closeStructureEditor = function () {
  var sec = document.getElementById('sb-section');
  var anchor = document.getElementById('sb-home-anchor');
  if (sec && anchor && anchor.parentNode) anchor.parentNode.insertBefore(sec, anchor.nextSibling);
  if (sec) sec.classList.remove('sb-fullpage');
  var page = document.getElementById('p-structure');
  if (page) page.classList.remove('active');
  if (typeof activatePanel === 'function') activatePanel(window.__sbPrevPanelId || 'p2', false);
  if (window.__sbModalWasOpen) {
    var m = document.getElementById('train-modal');
    if (m) m.classList.add('active');
  }
  if (window.__updateSbMini) window.__updateSbMini();
};

document.addEventListener('click', function (e) {
  var b = e.target.closest ? e.target.closest('#sb-expand') : null;
  if (!b) return;
  e.preventDefault();
  window.openStructureEditor();
});

// ===== Résumé de structure dans la MODALE (l'éditeur ne vit QUE dans la page) =====
// - mini-profil en lecture seule + bouton « Ouvrir l'éditeur »
// - activer le toggle depuis la modale ouvre directement la page de création
window.__updateSbMini = function () {
  var mini = document.getElementById('sb-mini');
  var btn = document.getElementById('sb-expand');
  if (!mini || !btn) return;
  var inPage = !!document.querySelector('#p-structure #sb-section');
  var tg = document.getElementById('sb-toggle');
  var on = !!(tg && tg.checked);
  if (inPage || !on) { mini.hidden = true; btn.hidden = true; mini.innerHTML = ''; return; }
  var blocks = (typeof window.getCurrentWorkoutStructure === 'function') ? window.getCurrentWorkoutStructure() : null;
  mini.hidden = false;
  btn.hidden = false;
  if (blocks && blocks.length && window.renderWorkoutProfileHTML) {
    var html = window.renderWorkoutProfileHTML(blocks, { height: 46, labels: false });
    // moyennes de la structure (W moy / bpm moy / allure moy) sous le mini-profil
    try {
      var pretty = { 'W MOY': 'W moy', 'BPM MOY': 'bpm moy', 'ALLURE MOY': 'allure moy' };
      var avgs = (window.StructEd && window.StructEd.avgStats) ? window.StructEd.avgStats(blocks) : [];
      if (avgs.length) html += '<div class="sb-mini-avgs">' + avgs.map(function (a) {
        return '<b>' + a.val + '</b> ' + (pretty[a.label] || a.label.toLowerCase());
      }).join(' · ') + '</div>';
    } catch (e) { /* éditeur non chargé : pas de moyennes */ }
    mini.innerHTML = html;
  } else {
    mini.innerHTML = '<div class="sb-mini-empty">Aucun bloc pour l\'instant — ouvre l\'éditeur pour construire la séance.</div>';
  }
};

// Toggle « Activer » : affiche simplement le résumé + le bouton d'ouverture
// (l'utilisateur ouvre la page de création quand IL le décide).
document.addEventListener('change', function (e) {
  if (!e.target || e.target.id !== 'sb-toggle') return;
  if (window.__updateSbMini) window.__updateSbMini();
});

// Le builder re-rend son DOM à chaque changement (setBlocks au pré-remplissage,
// édition dans la page...) : on suit ces mutations pour rafraîchir le résumé.
(function wireSbMiniObserver() {
  var root = document.getElementById('sb-root'); // le builder uniquement (PAS #sb-mini, sinon boucle)
  if (!root || window.__sbMiniObs) return;
  window.__sbMiniObs = new MutationObserver(function () {
    clearTimeout(window.__sbMiniT);
    window.__sbMiniT = setTimeout(function () { if (window.__updateSbMini) window.__updateSbMini(); }, 120);
  });
  window.__sbMiniObs.observe(root, { childList: true, subtree: true });
})();

// Clic sur "Voir l'analyse detaillee" (delegation -> robuste quel que soit le moment de rendu)
document.addEventListener('click', function (e) {
  var b = e.target.closest ? e.target.closest('#toggle-detailed') : null;
  if (!b) return;
  e.preventDefault();
  if (typeof window.openFullAnalysis === 'function') window.openFullAnalysis();
});

// Lignes AFFICHEES dans le tableau des records (lisible, pas trop de lignes).
appState.__PC_TABLE_DURS = (function () {
  var d = [], s;
  for (s = 1; s <= 10; s++) d.push(s);
  for (s = 15; s <= 30; s += 5) d.push(s);
  d.push(45);
  for (s = 60; s <= 600; s += 60) d.push(s);
  for (s = 900; s <= 3600; s += 300) d.push(s);
  for (s = 4500; s <= 9000; s += 900) d.push(s);
  for (s = 10800; s <= 28800; s += 1800) d.push(s);
  return d;
})();

// Resolution de STOCKAGE / records : dense (vraies valeurs a chaque seconde la ou ca compte).
// chaque seconde jusqu'a 10 min, puis 5 s jusqu'a 30 min, 30 s jusqu'a 1 h, 5 min au-dela.
appState.__PC_DURS = (function () {
  var d = [], s;
  for (s = 1; s <= 600; s++) d.push(s);
  for (s = 605; s <= 1800; s += 5) d.push(s);
  for (s = 1830; s <= 3600; s += 30) d.push(s);
  for (s = 3900; s <= 28800; s += 300) d.push(s);
  return d;
})();

window.__powerCurveFromWatts = function (watts) {
  if (!watts || !watts.length) return null;
  var n = watts.length, pref = new Float64Array(n + 1);
  for (var i = 0; i < n; i++) { var w = watts[i]; pref[i + 1] = pref[i] + ((w == null || isNaN(w)) ? 0 : +w); }
  var out = {};
  appState.__PC_DURS.forEach(function (d) { if (d > n) return; var best = 0; for (var s = 0; s + d <= n; s++) { var avg = (pref[s + d] - pref[s]) / d; if (avg > best) best = avg; } out[d] = Math.round(best); });
  out._v = __PC_VERSION;
  return out;
};

// toutes les courbes connues, regroupees par duree -> pour le rang
window.__allPowerCurvesByDur = function (cutoffIso, sportCat) {
  var m = {};
  var catOf = function (x) { return (typeof getSportCategory === 'function') ? getSportCategory(x) : x; };
  if (Array.isArray(appState.data)) appState.data.forEach(function (dd) {
    var diso = (typeof toIsoDate === 'function') ? toIsoDate(dd.date) : null;
    if (cutoffIso && diso && diso > cutoffIso) return;   // sorties POSTERIEURES ignorees (rang fige a la date)
    (dd.activities || []).forEach(function (a) {
      if (!a || a._exclPower) return;                                          // masquee des records
      if (sportCat && catOf(a.raw_type || a.sport) !== sportCat) return;       // autre sport
      var pc = a.power_curve; if (!pc) return;
      for (var k in pc) { if (k === '_v') continue; var v = +pc[k]; if (!isNaN(v)) { (m[k] = m[k] || []).push(v); } }
    });
  });
  return m;
};

// Top N enregistrements {w, nom, date} pour une duree donnee (meme filtre que le rang).
window.__topRecordsForDur = function (dur, cutoffIso, sportCat, limit) {
  var out = [];
  var catOf = function (x) { return (typeof getSportCategory === 'function') ? getSportCategory(x) : x; };
  if (Array.isArray(appState.data)) appState.data.forEach(function (dd) {
    var diso = (typeof toIsoDate === 'function') ? toIsoDate(dd.date) : null;
    if (cutoffIso && diso && diso > cutoffIso) return;
    (dd.activities || []).forEach(function (a) {
      if (!a || a._exclPower) return;
      if (sportCat && catOf(a.raw_type || a.sport) !== sportCat) return;
      var pc = a.power_curve; if (!pc) return;
      var v = +pc[dur]; if (isNaN(v) || v <= 0) return;
      out.push({ w: Math.round(v), name: a.name || 'Activité', date: diso, sbId: (a._sbId != null ? String(a._sbId) : '') });
    });
  });
  out.sort(function (x, y) { return y.w - x.w; });
  return out.slice(0, limit || 30);
};

// recalcul global : parcourt les sorties avec puissance, calcule + sauve la courbe
window.recalcAllPowerCurves = async function (onProgress) {
  var list = [];
  if (Array.isArray(appState.data)) appState.data.forEach(function (dd) { (dd.activities || []).forEach(function (a) { if (a && a._sbId && (a.id || a.activityId) && (a.avg_watts || a.np)) list.push(a); }); });
  var total = list.length, done = 0, ok = 0, errs = 0;
  for (var i = 0; i < list.length; i++) {
    var a = list[i];
    if (a.power_curve && +a.power_curve._v === __PC_VERSION) { ok++; done++; if (onProgress) onProgress(done, total, ok); continue; }
    try {
      var sid = a.id || a.activityId;
      // Fetch SANS cache : evite l'accumulation memoire + le depassement de quota localStorage
      // qui faisaient planter le recalcul vers ~500 activites.
      var streams = (typeof loadStreamsFromSupabase === 'function') ? await loadStreamsFromSupabase(sid) : null;
      var watts = streams ? (Array.isArray(streams) ? ((streams.find(function (x) { return x && x.type === 'watts'; }) || {}).data) : streams.watts) : null;
      if (watts && watts.length) {
        var curve = window.__powerCurveFromWatts(watts);
        if (curve) { a.power_curve = curve; if (window.cloudSync && window.cloudSync.savePowerCurve) await window.cloudSync.savePowerCurve(a._sbId, curve); ok++; }
      }
      streams = null; watts = null;                                   // libere la memoire
      try { if (typeof streamsCache !== 'undefined' && streamsCache[sid] !== undefined) delete streamsCache[sid]; } catch (e2) {}
    } catch (e) { errs++; }
    done++; if (onProgress) onProgress(done, total, ok);
    if ((i & 7) === 0) await new Promise(function (r) { setTimeout(r, 0); });   // rend la main au navigateur (UI + GC)
  }
  return { total: total, ok: ok, errors: errs };
};

// Clic sur une ligne de record -> deplie le top 30 (rang, W, nom, date) defilable.
if (!window.__recRowWired) {
  window.__recRowWired = true;
  document.addEventListener('click', function (e) {
    var line = e.target.closest ? e.target.closest('.rec-line') : null;
    if (line && line.dataset.sbid) {
      var liso = line.dataset.iso, lsb = line.dataset.sbid, idx = 0;
      if (Array.isArray(appState.data)) { var dday = appState.data.find(function (d) { return ((typeof toIsoDate === 'function') ? toIsoDate(d.date) : d.date) === liso; }); if (dday) { var ii = (dday.activities || []).findIndex(function (a) { return String(a._sbId) === lsb; }); if (ii >= 0) idx = ii; } }
      window.__openActIdx = idx;
      if (typeof closeFullAnalysis === 'function') closeFullAnalysis(false);
      if (typeof openSessionModal === 'function') openSessionModal(liso, 'realise');
      return;
    }
    var row = e.target.closest ? e.target.closest('.rec-row') : null;
    var host = document.getElementById('af-records');
    if (!row || !host || !host.contains(row)) return;
    var dur = +row.dataset.dur;
    var next = row.nextElementSibling;
    var setCaret = function (r, open) { var c = r.querySelector('.rec-caret'); if (c) c.textContent = open ? '▾' : '▸'; };
    if (next && next.classList.contains('rec-exp') && +next.dataset.dur === dur) { next.remove(); setCaret(row, false); return; }
    host.querySelectorAll('.rec-exp').forEach(function (x) { x.remove(); });
    host.querySelectorAll('.rec-caret').forEach(function (c) { c.textContent = '▸'; });
    var list = (typeof window.__topRecordsForDur === 'function') ? window.__topRecordsForDur(dur, window.__lastActDate, window.__lastActSport, 30) : [];
    var fmtDate = function (iso) { if (!iso) return ''; try { return new Date(iso + 'T00:00:00').toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' }); } catch (e2) { return iso; } };
    var inner = list.map(function (r, i) {
      var rkCol = (i < 3) ? '#fbbf24' : 'var(--text-mute,#6b7686)';
      var isCur = r.sbId && window.__lastActSbId && String(r.sbId) === String(window.__lastActSbId);
      var nmStyle = isCur ? ' style="color:var(--accent);font-weight:700"' : '';
      return '<div class="rec-line' + (isCur ? ' rec-line-cur' : '') + '" data-iso="' + (r.date || '') + '" data-sbid="' + (r.sbId || '') + '"><span class="rec-rk" style="color:' + rkCol + '">' + (i + 1) + '</span><span class="rec-w">' + r.w + ' W</span><span class="rec-nm"' + nmStyle + '>' + String(r.name || '').replace(/</g, '&lt;') + '</span><span class="rec-dt">' + fmtDate(r.date) + '</span></div>';
    }).join('');
    if (!inner) inner = '<div style="color:var(--text-mute);padding:10px">Aucun enregistrement sur cette durée.</div>';
    var tr = document.createElement('tr');
    tr.className = 'rec-exp'; tr.dataset.dur = dur;
    tr.innerHTML = '<td colspan="4"><div class="rec-exp-box">' + inner + '</div></td>';
    row.parentNode.insertBefore(tr, row.nextSibling);
    setCaret(row, true);
  });
}
}
