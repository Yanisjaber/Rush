/* src/features/sessions/session-modal-helpers.js — helpers window.* de la modale de séance
   (comparaison prévu/réalisé, lien prévu↔réalisé, blocs repliables, tuiles de stats).
   Déplacé tel quel depuis session-modal.js (aucun changement de comportement). */
import { appState } from '../../core/state.js';
import { getSportCategory } from '../dashboard/filters.js';
import { loadTrainings } from '../training/train-modal.js';
import { fmtDur } from '../../core/format.js';
import { buildRealisedDay } from './realised-day.js';
import { openSessionModal } from './session-modal.js';

export function bootSessionModalHelpers() {

// ============================================================
// Comparaison PRÉVU vs RÉALISÉ (affichée dans la modale du réalisé).
// Rapproche une activité réalisée avec une séance prévue : même jour, même sport,
// et (si plusieurs réalisées le même jour) durée la plus proche (appariement greedy).
// ============================================================
// Rapprochement PREVU<->REALISE : renvoie {planned:[prevus du jour], matched:prevu|null}
// et persiste le lien auto la 1re fois (meme jour + sport + duree la plus proche, greedy).
window.__plannedMatch = function (act, iso) {
  var empty = { planned: [], matched: null };
  try {
    if (!act || act.category === 'competition') return empty;
    var planned = ((typeof loadTrainings === 'function') ? loadTrainings() : [])
      .filter(function (t) { return t.date === iso; });
    var catOf = function (x) { return (typeof getSportCategory === 'function') ? getSportCategory(x) : x; };
    var actCat = catOf(act.raw_type || act.sport);
    var link = act.planned_id;
    var matched = null;
    if (link && link !== 'none') {
      matched = planned.find(function (p) { return String(p._sbId) === String(link); });
      if (!matched) link = null;
    }
    if (!matched && link !== 'none') {
      var cands = planned.filter(function (p) { return catOf(p.sport) === actCat; });
      if (cands.length) {
        var dayObj = (typeof buildRealisedDay === 'function') ? buildRealisedDay(iso) : null;
        var reals = ((dayObj && dayObj.activities) ? dayObj.activities : [act]).filter(function (x) { return catOf(x.raw_type || x.sport) === actCat; });
        var keyOf = function (x) { return String(x._sbId || x.client_id || x._manualId || x.id || (x.name + '|' + (x.duration || 0))); };
        var actKey = keyOf(act);
        var combos = [];
        cands.forEach(function (p, pi) { reals.forEach(function (r, ri) { combos.push({ pi: pi, ri: ri, diff: Math.abs((+p.duration || 0) - (+r.duration || 0)) }); }); });
        combos.sort(function (x, y) { return x.diff - y.diff; });
        var usedP = {}, usedR = {};
        combos.forEach(function (c) {
          if (usedP[c.pi] || usedR[c.ri]) return;
          usedP[c.pi] = 1; usedR[c.ri] = 1;
          if (keyOf(reals[c.ri]) === actKey) matched = cands[c.pi];
        });
        if (matched && matched._sbId && act._sbId) {
          act.planned_id = String(matched._sbId);
          if (typeof window.__setActPlannedLink === 'function') window.__setActPlannedLink(act._sbId, String(matched._sbId));
          if (window.cloudSync && window.cloudSync.linkActivityPlanned) window.cloudSync.linkActivityPlanned(act._sbId, String(matched._sbId));
        }
      }
    }
    return { planned: planned, matched: matched };
  } catch (e) { console.warn('[planned match]', e && e.message); return empty; }
};


// Section comparaison (corps de la modale) : uniquement si une seance prevue est rapprochee.
window.renderPrevuVsRealiseHTML = function (act, iso) {
  try {
    var mm = window.__plannedMatch(act, iso);
    var p = mm.matched;
    if (!p) return '';
    var fmtD = function (min) { return (typeof fmtDur === 'function') ? fmtDur(+min || 0) : (Math.round(+min || 0) + ' min'); };
    // Une barre par metrique : remplissage = realise, repere = cible prevue.
    // Couleur : au-dessus de la cible = vert, en dessous = orange, sans cible = neutre.
    function barRow(label, pv, rv, fmt) {
      var hasP = (pv != null && pv !== ''), hasR = (rv != null && rv !== '');
      if (!hasP && !hasR) return '';
      var pvn = +pv || 0, rvn = +rv || 0, d = rvn - pvn;
      var col = !hasP ? '#9aa6b6' : (d > 0 ? '#5fb87a' : (d < 0 ? '#d08442' : '#9aa6b6'));
      var scale = Math.max(pvn, rvn, 1);
      var fillPct = Math.max(3, Math.min(100, rvn / scale * 100));
      var targetPct = hasP ? Math.max(0, Math.min(100, pvn / scale * 100)) : null;
      var right = '<span style="color:var(--text,#e7ecf3);font-weight:600">' + (hasR ? fmt(rvn) : '—');
      if (hasP) right += ' <span style="color:var(--text-mute,#6b7686);font-weight:400">/ ' + fmt(pvn) + ' prévu</span>';
      if (hasP && hasR && d !== 0) right += ' <span style="color:' + col + '">' + (d > 0 ? '+' : '−') + fmt(Math.abs(d)) + '</span>';
      right += '</span>';
      return '<div style="margin-top:13px">'
        + '<div style="display:flex;justify-content:space-between;font-size:12.5px;margin-bottom:5px"><span style="color:var(--text-dim,#9aa6b6)">' + label + '</span>' + right + '</div>'
        + '<div style="position:relative;height:7px;background:var(--bg-elev,#222b3d);border-radius:4px">'
        + '<div style="width:' + fillPct + '%;height:100%;background:' + col + ';border-radius:4px"></div>'
        + (targetPct != null ? '<div style="position:absolute;left:' + targetPct + '%;top:-2px;width:2px;height:11px;background:#cdd5e5"></div>' : '')
        + '</div></div>';
    }
    var _pKj = (p.structure && p.structure.length && window.__estKjFromStructure) ? window.__estKjFromStructure(p.structure) : null;
    var bars = ''
      + barRow('Durée', p.duration, act.duration, function (x) { return fmtD(x); })
      + barRow('Distance', p.km, act.distance_km, function (x) { return Math.round(x) + ' km'; })
      + barRow('Énergie', (_pKj != null ? Math.round(_pKj) : null), act.kj, function (x) { return Math.round(x) + ' kJ'; })
      + barRow('TSS', p.tss, act.tss, function (x) { return '' + Math.round(x); });
    if (!bars) return '';
    var structHTML = '';
    if (Array.isArray(p.structure) && p.structure.length && window.renderWorkoutProfileHTML) {
      structHTML = '<div style="margin-top:16px">'
        + '<div style="font-size:10px;text-transform:uppercase;letter-spacing:.5px;color:var(--text-mute,#6b7686);margin-bottom:7px">Structure prévue (objectif)</div>'
        + window.renderWorkoutProfileHTML(p.structure, { height: 56, labels: false, sport: p.sport || act.raw_type || act.sport })
        // Adhérence par intervalle : rempli par fillAdherenceSlot() quand les streams arrivent
        + '<div id="pvr-adherence" data-structure="' + encodeURIComponent(JSON.stringify(p.structure)) + '"></div>'
        + '</div>';
      // Streams déjà en mémoire (réouverture de la même activité) : remplit direct
      setTimeout(function () { if (window.fillAdherenceSlot) window.fillAdherenceSlot(); }, 100);
    }
    return window.__collapsible('pvr', 'Prévu vs Réalisé', bars + structHTML);
  } catch (e) { console.warn('[prevu vs realise]', e && e.message); return ''; }
};


// Bouton/selecteur de lien dans le HEADER de la modale (a cote des "...").
window.__setupModalLinkSelect = function (act, iso) {
  var wrap = document.getElementById('modal-link-wrap');
  var menu = document.getElementById('modal-link-menu');
  var btn = document.getElementById('modal-link-btn');
  if (!wrap || !menu) return;
  if (!act || act.category === 'competition' || !act._sbId) { wrap.hidden = true; return; }
  var mm = window.__plannedMatch(act, iso);
  if (!mm.planned.length) { wrap.hidden = true; return; }
  var esc = function (x) { return String(x == null ? '' : x).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); };
  var opt = function (val, label, sel) { return '<button class="pvr-opt' + (sel ? ' sel' : '') + '" type="button" data-val="' + esc(val) + '">' + label + '<span class="pvr-check">✓</span></button>'; };
  var html = opt('none', 'Aucune', !mm.matched);
  if (mm.planned.length) html += '<div class="pvr-sep"></div>';
  html += mm.planned.map(function (pp) {
    var lab = (pp.name || 'Séance') + ' · ' + ((typeof fmtDur === 'function') ? fmtDur(+pp.duration || 0) : ((+pp.duration || 0) + ' min'));
    var seld = (mm.matched && String(mm.matched._sbId) === String(pp._sbId));
    return opt(pp._sbId, esc(lab), seld);
  }).join('');
  menu.innerHTML = html;
  menu.dataset.sbid = act._sbId;
  menu.hidden = true;
  wrap.classList.remove('open');
  wrap.hidden = false;
  if (btn) btn.style.color = '';
  wrap.title = mm.matched ? ('Séance prévue liée : ' + (mm.matched.name || '')) : 'Aucune séance prévue liée';
};


// Reflete le lien prevu<->realise dans DASHBOARD_DATA (memoire) pour persistance en session.
window.__setActPlannedLink = function (sbId, val) {
  if (!Array.isArray(appState.data) || !sbId) return;
  for (var di = 0; di < appState.data.length; di++) {
    var acts = appState.data[di].activities || [];
    for (var ai = 0; ai < acts.length; ai++) {
      if (String(acts[ai]._sbId) === String(sbId)) acts[ai].planned_id = val;
    }
  }
};


// Menu custom du lien Prevu<->Realise : ouvrir / choisir / fermer
document.addEventListener('click', function (e) {
  var trg = e.target;
  var menu = document.getElementById('modal-link-menu');
  var wrap = document.getElementById('modal-link-wrap');
  var hitBtn = trg.closest ? trg.closest('#modal-link-btn') : null;
  if (hitBtn && menu) {
    e.preventDefault(); e.stopPropagation();
    menu.hidden = !menu.hidden;
    if (wrap) wrap.classList.toggle('open', !menu.hidden);
    return;
  }
  var opt = trg.closest ? trg.closest('.pvr-opt') : null;
  if (opt && menu) {
    e.preventDefault(); e.stopPropagation();
    var sbid = menu.dataset.sbid, val = opt.dataset.val;
    menu.hidden = true; if (wrap) wrap.classList.remove('open');
    if (sbid) {
      if (typeof window.__setActPlannedLink === 'function') window.__setActPlannedLink(sbid, val);
      if (window.cloudSync && window.cloudSync.linkActivityPlanned) window.cloudSync.linkActivityPlanned(sbid, val);
      if (typeof window.__modalActIdx === 'number') window.__openActIdx = window.__modalActIdx;
      if (window.__currentModalIso && typeof openSessionModal === 'function') openSessionModal(window.__currentModalIso, window.__currentModalSource || 'realise');
    }
    return;
  }
  if (menu && !menu.hidden && !(trg.closest && trg.closest('#modal-link-wrap'))) {
    menu.hidden = true; if (wrap) wrap.classList.remove('open');
  }
});


// SVGs + bloc stats reutilisable (heros + tuiles centrees, max 2 rangees).
window.__statSvg = {
  clock: '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/></svg>',
  route: '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="6" cy="19" r="2"/><circle cx="18" cy="5" r="2"/><path d="M8 19h7a3 3 0 0 0 0-6H9a3 3 0 0 1 0-6h7"/></svg>',
  mtn: '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 20 9 8l3.5 6 2.5-4.5L21 20Z"/></svg>',
  bolt: '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M13 2 4 14h7l-1 8 9-12h-7z"/></svg>',
  speed: '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="14" r="2"/><path d="M13.4 12.6 19 7"/><path d="M3.6 19a9 9 0 1 1 16.8 0"/></svg>'
};

// Section repliable reutilisable (bouton Masquer/Afficher a droite, etat memorise par cle).
window.__collapsible = function (key, titleInner, contentHTML) {
  var collapsed = false;
  try { collapsed = localStorage.getItem(key + '_collapsed') === '1'; } catch (e) { }
  var chev = collapsed ? '▸' : '▾';
  return '<div class="modal-section">'
    + '<div class="modal-section-title" style="display:flex;align-items:center;gap:10px">'
    +   '<span>' + titleInner + '</span>'
    +   '<button class="coll-toggle" type="button" data-key="' + key + '" style="background:var(--bg-elev2);border:1px solid var(--border2,#374256);color:var(--text-dim,#9aa6b6);border-radius:7px;padding:4px 11px;font-size:11px;font-weight:600;cursor:pointer;font-family:inherit;text-transform:none;letter-spacing:0;display:inline-flex;align-items:center;gap:6px;flex:none">'
    +     '<span class="coll-label">' + (collapsed ? 'Afficher' : 'Masquer') + '</span><span class="coll-chev" style="display:inline-block;width:9px;text-align:center">' + chev + '</span>'
    +   '</button>'
    + '</div>'
    + '<div class="coll-content"' + (collapsed ? ' hidden' : '') + '>' + contentHTML + '</div>'
    + '</div>';
};

document.addEventListener('click', function (e) {
  var t = e.target.closest ? e.target.closest('.coll-toggle') : null;
  if (!t) return;
  var sec = t.closest('.modal-section');
  var content = sec ? sec.querySelector('.coll-content') : null;
  if (!content) return;
  var nowHidden = !content.hidden;
  content.hidden = nowHidden;
  var chev = t.querySelector('.coll-chev'); if (chev) chev.textContent = nowHidden ? '▸' : '▾';
  var lab = t.querySelector('.coll-label'); if (lab) lab.textContent = nowHidden ? 'Afficher' : 'Masquer';
  try { localStorage.setItem((t.dataset.key || 'coll') + '_collapsed', nowHidden ? '1' : '0'); } catch (e2) { }
});


// Estime l'energie (kJ) d'une structure planifiee : Σ (watts cibles x duree).
window.__estKjFromStructure = function (blks, ftp) {
  if (!Array.isArray(blks) || !blks.length) return null;
  ftp = +ftp || ((window.DASHBOARD_DATA && window.DASHBOARD_DATA.athlete && +window.DASHBOARD_DATA.athlete.ftp) || 250);
  var total = 0;
  blks.forEach(function (b) {
    var reps = Math.max(1, b.reps | 0);
    var segs = [b.work]; if (b.type === 'interval' && b.rec) segs.push(b.rec);
    for (var r = 0; r < reps; r++) segs.forEach(function (s) { if (!s) return; var mid = (s.intHi != null && +s.intHi > 0) ? ((+s.int + +s.intHi) / 2) : (+s.int || 0); total += (ftp * mid / 100) * ((+s.min || 0) * 60); });
  });
  return total / 1000;
};


// Même markup/classes que la modale réalisé (openSessionModal) : .act-hero-row /
// .act-hero / .act-tile-grid / .act-tile -> les styles desktop + mobile
// (modals.css, mobile.css) s'appliquent à l'identique, aucun style inline.
window.renderStatsBlockHTML = function (heroes, tiles) {
  var heroCard = function (hh) {
    return '<div class="act-hero">'
      + (hh.svg ? '<span class="act-hero-ico" style="color:' + hh.color + '">' + hh.svg + '</span>' : '')
      + '<div class="act-hero-tx"><div class="act-hero-val">' + hh.val + (hh.unit ? '<span class="act-hero-unit"> ' + hh.unit + '</span>' : '') + '</div>'
      + '<div class="act-hero-lab">' + hh.lab + '</div></div></div>';
  };
  var tileHTML = function (tt) {
    return '<div class="act-tile" style="background:' + tt.color + '17;--tile-c:' + tt.color + '">'
      + '<div class="act-tile-lab">' + tt.lab + '</div>'
      + '<div class="act-tile-val">' + tt.val + '</div></div>';
  };
  heroes = (heroes || []).filter(Boolean); tiles = (tiles || []).filter(Boolean);
  var heroRow = heroes.length ? '<div class="act-hero-row" data-n="' + Math.min(heroes.length, 4) + '">' + heroes.slice(0, 4).map(heroCard).join('') + '</div>' : '';
  var n = tiles.length, cols = n <= 4 ? Math.max(1, n) : Math.ceil(n / 2);
  var grid = n ? '<div class="act-tile-grid" data-n="' + n + '" style="--tile-cols:' + cols + ';--tile-tracks:' + (cols * 2) + '">' + tiles.map(tileHTML).join('') + '</div>' : '';
  return (heroRow || grid) ? '<div class="modal-section">' + heroRow + grid + '</div>' : '';
};


}
