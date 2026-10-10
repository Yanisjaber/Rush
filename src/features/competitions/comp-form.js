/* src/features/competitions/comp-form.js — extrait de l'ancien app.js (découpage par fonctionnalité). */
import { appState } from '../../core/state.js';
import { getSportCategory, toIsoDate } from '../dashboard/filters.js';
import { enhanceSelect, initFilePickers, initFlatpickrAll, populateFedSelectForSport, populateSportSelect, populateTypeSelectForSport, updateLapsVisibility } from './comp-modal-ui.js';
import { _autofillKmDplusFromCompGpx, fmtMinToTime, parseTimeToMin, readFormToStage } from './comp-stages.js';
import { loadCompetitions, renderCompList, saveCompetitions } from './competitions-page.js';
import { _findActBySbId, setActivityCategory } from '../gpx/gpx-render.js';
import { renderCalendar } from '../calendar/realise-calendar.js';


// ============================================================
// Adaptation des FORMULAIRES au sport sélectionné (natation -> distance en m,
// pas de D+/GPX ; musculation -> section Parcours masquée ; etc.).
// Conversion m<->km à l'affichage UNIQUEMENT : le stockage reste en km
// (input.dataset.distUnit porte l'unité affichée, lue au moment du save).
// ============================================================
// Pose data-vis = nb de champs visibles sur chaque .add-sec-grid.
// Le CSS mobile s'en sert : 2 champs visibles -> meme ligne (PARTOUT),
// au lieu de compter les enfants caches via nth-child.
export function reflowSecGrids() {
  document.querySelectorAll('.add-sec-grid').forEach(g => {
    let vis = 0;
    for (const c of g.children) {
      if (c.hidden || c.style.display === 'none' || getComputedStyle(c).display === 'none') continue;
      vis++;
    }
    g.dataset.vis = String(vis);
  });
}


function adaptSportForm(selectId, ids) {
  const sel = document.getElementById(selectId);
  if (!sel || !window.SportProfiles || !window.SportProfiles.formConfig) return;
  const cfg = window.SportProfiles.formConfig(sel.value);
  const kmInput = ids.km ? document.getElementById(ids.km) : null;
  if (kmInput) {
    const lab = kmInput.closest('label');
    const span = lab && lab.querySelector('span');
    const prev = kmInput.dataset.distUnit || 'km';
    const next = cfg.dist || 'km';
    if (prev !== next && kmInput.value !== '') {
      const v = parseFloat(kmInput.value);
      if (!isNaN(v)) kmInput.value = next === 'm' ? Math.round(v * 1000) : +(v / 1000).toFixed(2);
    }
    kmInput.dataset.distUnit = next;
    if (span) span.textContent = next === 'm' ? 'Distance (m)' : 'Distance (km)';
    if (lab) lab.style.display = cfg.dist ? '' : 'none';
  }
  if (ids.dplus) {
    const el = document.getElementById(ids.dplus);
    const lab = el && el.closest('label');
    if (lab) lab.style.display = cfg.dplus ? '' : 'none';
  }
  if (ids.gpx) {
    const g = document.getElementById(ids.gpx);
    const wrap = g && g.closest('.form-field');
    if (wrap) wrap.style.display = cfg.gpx ? '' : 'none';
  }
  if (ids.laps) {
    const l = document.getElementById(ids.laps);
    const lab2 = l && l.closest('label');
    const span2 = lab2 && lab2.querySelector('span');
    if (span2 && cfg.laps) span2.textContent = cfg.laps;
  }
  if (ids.speed) {
    const sp = document.getElementById(ids.speed);
    const lab3 = sp && sp.closest('label');
    const span3 = document.getElementById(ids.speed + '-label') || (lab3 && lab3.querySelector('span'));
    const cat = (typeof getSportCategory === 'function') ? getSportCategory(sel.value) : 'autre';
    const conf = (cat === 'course') ? { mode: 'pace_km', lab: 'Allure (min/km)', ph: 'ex : 4:30' }
      : (cat === 'natation') ? { mode: 'pace_100m', lab: 'Allure (/100m)', ph: 'ex : 1:45' }
      : { mode: 'speed', lab: 'Vitesse moy (km/h)', ph: 'km/h' };
    // triathlon / muscu : pas de champ vitesse global
    const show = !!cfg.dist && cat !== 'triathlon';
    if (lab3) lab3.style.display = show ? '' : 'none';
    if (sp) {
      if (window._trainSpeedMode && window._trainSpeedMode !== conf.mode) sp.value = ''; // unite changee
      sp.placeholder = conf.ph;
    }
    if (span3) span3.textContent = conf.lab;
    window._trainSpeedMode = conf.mode;
  }
  // Section Parcours entière (train-modal) : masquée si plus aucun champ dedans
  if (ids.hideSection && kmInput) {
    const sec = kmInput.closest('.add-sec');
    if (sec) sec.style.display = (cfg.dist || cfg.dplus || cfg.gpx) ? '' : 'none';
  }
  reflowSecGrids();
}

// Lit une distance saisie en respectant l'unité affichée -> renvoie des KM
export function readDistAsKm(inputId) {
  const el = document.getElementById(inputId);
  if (!el) return null;
  const v = parseFloat(el.value);
  if (isNaN(v) || v <= 0) return null;
  return el.dataset.distUnit === 'm' ? +(v / 1000).toFixed(3) : v;
}

export const adaptTrainSportForm = () => {
  adaptSportForm('train-modal-sport', { km: 'train-modal-km', dplus: 'train-modal-dplus', gpx: 'train-modal-gpx', speed: 'train-modal-speed', hideSection: true });
  // Triathlon : 3 distances par discipline (pas en mode modèle bibliothèque)
  const sel = document.getElementById('train-modal-sport');
  const isTri = !window._templateMode && !!sel && typeof getSportCategory === 'function' && getSportCategory(sel.value) === 'triathlon';
  const triRow = document.getElementById('train-tri-fields');
  const kmLab = document.getElementById('train-modal-km')?.closest('label');
  if (triRow) triRow.hidden = !isTri;
  if (kmLab && isTri) kmLab.style.display = 'none';
};

// Re-compacte les rangées du bloc Parcours : les champs VISIBLES se regroupent
// 2 par ligne (les champs masqués par le sport laissaient des lignes à 1 seul champ).
export function reflowCompParcoursRows() {
  const std = document.getElementById('comp-parcours-std');
  if (!std) return;
  const rows = Array.from(std.querySelectorAll('.add-sec-grid.g2'));
  if (!rows.length) return;
  const labels = rows.flatMap(r => Array.from(r.children));
  // Ordre canonique fixe (le déplacement de nœuds ne doit jamais le perturber)
  const ORDER = ['comp-modal-target', 'comp-modal-km', 'comp-modal-dplus', 'comp-modal-speed', 'comp-modal-laps'];
  const rank = (l) => { const inp = l.querySelector('input,select'); const i = inp ? ORDER.indexOf(inp.id) : -1; return i === -1 ? 99 : i; };
  labels.sort((a, b) => rank(a) - rank(b));
  const visible = labels.filter(l => l.style.display !== 'none');
  const hidden = labels.filter(l => l.style.display === 'none');
  const ordered = visible.concat(hidden);
  rows.forEach(r => { while (r.firstChild) r.removeChild(r.firstChild); });
  ordered.forEach((l, i) => rows[Math.min(Math.floor(i / 2), rows.length - 1)].appendChild(l));
  rows.forEach(r => { r.style.display = Array.from(r.children).some(c => c.style.display !== 'none') ? '' : 'none'; });
}


export const adaptCompSportForm = () => {
  adaptSportForm('comp-modal-sport', { km: 'comp-modal-km', dplus: 'comp-modal-dplus', gpx: 'comp-modal-gpx', laps: 'comp-modal-laps' });
  // Pas de distance pour ce sport -> la vitesse moyenne n'a pas de sens non plus
  {
    const sel0 = document.getElementById('comp-modal-sport');
    const cfg0 = (sel0 && window.SportProfiles && window.SportProfiles.formConfig) ? window.SportProfiles.formConfig(sel0.value) : null;
    const spd0 = document.getElementById('comp-modal-speed');
    const spdLab = spd0 && spd0.closest('label');
    if (spdLab && cfg0) spdLab.style.display = cfg0.dist ? '' : 'none';
  }
  // Triathlon : bloc standard remplacé par les onglets Nat/T1/Vélo/T2/CAP
  const sel = document.getElementById('comp-modal-sport');
  const isTri = !!sel && typeof getSportCategory === 'function' && getSportCategory(sel.value) === 'triathlon';
  const std = document.getElementById('comp-parcours-std');
  const tri = document.getElementById('comp-parcours-tri');
  // Compét tri "legacy" (données dans temps cible/distance/D+ mais pas de segments) :
  // on laisse le bloc standard visible pour ne pas masquer les données existantes.
  if (std) std.hidden = isTri && !window._compEditLegacyStd;
  if (tri) tri.hidden = !isTri;
  if (typeof updateLapsVisibility === 'function') updateLapsVisibility();
  reflowCompParcoursRows();
};


// ============================================================
// TRIOS temps / distance / vitesse-allure auto-calculés + onglets triathlon.
// Règle : dès que 2 des 3 champs sont remplis, le 3e (vide ou auto) se calcule.
// Un champ rempli à la main perd son statut "auto" et n'est plus écrasé.
// ============================================================
// "1h20" -> 80 ; "25:30" -> 25.5 (mm:ss) ; "90" -> 90 min
function parseSegTime(v) {
  if (v == null || String(v).trim() === '') return null;
  const s2 = String(v).trim().toLowerCase();
  let m = s2.match(/^(\d+)\s*h\s*(\d{0,2})$/);
  if (m) return (+m[1]) * 60 + (m[2] ? +m[2] : 0);
  m = s2.match(/^(\d+):(\d{1,2})$/);
  if (m) return (+m[1]) + (+m[2]) / 60;          // mm:ss
  const n = parseFloat(s2.replace(',', '.'));
  return isNaN(n) ? null : n;
}

export function fmtSegTime(min) {
  if (min == null || !isFinite(min) || min <= 0) return '';
  if (min >= 60) { const hh3 = Math.floor(min / 60), mm3 = Math.round(min % 60); return hh3 + 'h' + String(mm3).padStart(2, '0'); }
  const mm4 = Math.floor(min), ss4 = Math.round((min - mm4) * 60);
  return mm4 + ':' + String(ss4).padStart(2, '0');
}

// "1:45" -> 105 s ; "4:30" -> 270 s
function parsePace(v) {
  if (v == null || String(v).trim() === '') return null;
  const m = String(v).trim().match(/^(\d+):(\d{1,2})$/);
  if (m) return (+m[1]) * 60 + (+m[2]);
  const n = parseFloat(String(v).replace(',', '.'));
  return isNaN(n) ? null : n * 60;
}

export function fmtPaceSec(sec) {
  if (sec == null || !isFinite(sec) || sec <= 0) return '';
  return Math.floor(sec / 60) + ':' + String(Math.round(sec % 60)).padStart(2, '0');
}

// Câble un trio : cfg = { timeId, distId, rateId, mode: 'speed'|'pace_km'|'pace_100m' }
// time en min (parseSegTime OU parseTimeToMin pour le temps cible), dist selon champ, rate selon mode.
function wireTrio(cfg) {
  const t = document.getElementById(cfg.timeId), d = document.getElementById(cfg.distId), r = document.getElementById(cfg.rateId);
  if (!t || !d || !r || t._trioWired) return;
  t._trioWired = true;
  // mode statique ('speed'|'pace_km'|'pace_100m') OU fonction (sport dynamique)
  const modeOf = () => (typeof cfg.mode === 'function' ? cfg.mode() : cfg.mode);
  const readTime = () => {
    if (cfg.timeParse === 'target') return parseTimeToMin(t.value);
    if (cfg.timeParse === 'minutes') { const v = window.__parseDurField(t.value); return (v == null || v <= 0) ? null : v; }
    return parseSegTime(t.value);
  };
  const readDist = () => {
    let v = parseFloat(String(d.value).replace(',', '.'));
    if (isNaN(v) || v <= 0) return null;
    if (d.dataset.distUnit === 'm' && modeOf() === 'speed') v = v / 1000;  // vitesse km/h depuis des metres
    return v;
  };
  const readRate = () => (modeOf() === 'speed' ? (parseFloat(String(r.value).replace(',', '.')) || null) : parsePace(r.value));
  // dist en km pour speed/pace_km ; en m pour pace_100m
  // Règle DÉTERMINISTE (recalcul même si les 3 champs sont remplis) :
  // - je modifie le TEMPS      -> la vitesse/allure se recalcule (distance = fait de terrain)
  // - je modifie la DISTANCE   -> la vitesse/allure se recalcule
  // - je modifie la VITESSE    -> le temps se recalcule
  // (si le champ prioritaire manque, on calcule celui qui est possible)
  const setRate = (tm, dv) => {
    const m = modeOf();
    if (m === 'speed') r.value = +(dv / (tm / 60)).toFixed(1);
    else if (m === 'pace_km') r.value = fmtPaceSec(tm * 60 / dv);
    else r.value = fmtPaceSec(tm * 60 / (dv / 100));
    r.dataset.auto = '1';
  };
  const setDist = (tm, rv) => {
    const m = modeOf();
    let dv;
    if (m === 'speed') dv = +(rv * tm / 60).toFixed(1);
    else if (m === 'pace_km') dv = +(tm * 60 / rv).toFixed(1);
    else dv = Math.round(tm * 60 / rv * 100);
    if (dv > 0) { d.value = (m === 'speed' && d.dataset.distUnit === 'm') ? Math.round(dv * 1000) : dv; d.dataset.auto = '1'; }
  };
  const setTime = (dv, rv) => {
    const m = modeOf();
    let mins;
    if (m === 'speed') mins = dv / rv * 60;
    else if (m === 'pace_km') mins = dv * rv / 60;
    else mins = (dv / 100) * rv / 60;
    let out;
    if (cfg.timeParse === 'target') out = fmtMinToTime(Math.round(mins));
    else if (cfg.timeParse === 'minutes') out = window.__fmtDurField(Math.round(mins));
    else out = fmtSegTime(mins);
    if (out) { t.value = out; t.dataset.auto = '1'; }
  };
  const compute = (changed) => {
    const tm = readTime(), dv = readDist(), rv = readRate();
    const rateLocked = !!(cfg.lockRate && cfg.lockRate()); // allure pilotée par la structure
    const timeLocked = !!(cfg.lockTime && cfg.lockTime()); // durée pilotée par la structure
    if (changed === 'time') {
      if (tm == null) return;
      if (dv != null && !rateLocked) setRate(tm, dv);
      else if (rv != null && !cfg.noAutoDist) setDist(tm, rv);
    } else if (changed === 'dist') {
      if (dv == null) return;
      if (tm != null && !rateLocked) setRate(tm, dv);
      else if (rv != null && !timeLocked) setTime(dv, rv);
    } else {
      if (rv == null) return;
      // temps figé par la structure : la vitesse pilote la DISTANCE
      if (timeLocked) { if (tm != null) setDist(tm, rv); }
      else if (dv != null) setTime(dv, rv);
      else if (tm != null && !cfg.noAutoDist) setDist(tm, rv);
    }
  };
  t.addEventListener('input', () => { delete t.dataset.auto; compute('time'); });
  d.addEventListener('input', () => { delete d.dataset.auto; compute('dist'); });
  r.addEventListener('input', () => { delete r.dataset.auto; compute('rate'); });
}

function wireCompTrios() {
  wireTrio({ timeId: 'comp-modal-target', distId: 'comp-modal-km', rateId: 'comp-modal-speed', mode: 'speed', timeParse: 'target' });
  wireTrio({ timeId: 'train-modal-duration', distId: 'train-modal-km', rateId: 'train-modal-speed', timeParse: 'minutes', noAutoDist: true,
    lockRate: () => { const tg = document.getElementById('sb-toggle'); return !!(tg && tg.checked) && window._trainSpeedMode && window._trainSpeedMode !== 'speed'; },
    lockTime: () => { const tg = document.getElementById('sb-toggle'); return !!(tg && tg.checked); },
    mode: () => window._trainSpeedMode || 'speed' });
  wireTrio({ timeId: 'comp-tri-nat-time', distId: 'comp-tri-nat-dist', rateId: 'comp-tri-nat-pace', mode: 'pace_100m' });
  wireTrio({ timeId: 'comp-tri-bike-time', distId: 'comp-tri-bike-dist', rateId: 'comp-tri-bike-speed', mode: 'speed' });
  wireTrio({ timeId: 'comp-tri-run-time', distId: 'comp-tri-run-dist', rateId: 'comp-tri-run-pace', mode: 'pace_km' });
}

export function resetTriPanes() {
  document.querySelectorAll('#comp-parcours-tri input').forEach(i => { if (i.type !== 'file') { i.value = ''; delete i.dataset.auto; } });
  const g = document.getElementById('comp-tri-gpx'); if (g) g.value = '';
  document.querySelectorAll('#comp-tri-tabs .tri-tab').forEach((b, i2) => { b.classList.toggle('active', i2 === 0); b.classList.remove('filled'); });
  // Retour sur l'onglet Natation -> la section Charge estimée redevient visible
  const _chg = document.getElementById('comp-charge-sec'); if (_chg) _chg.hidden = false;
  document.querySelectorAll('#comp-parcours-tri .tri-pane').forEach((pn) => { pn.hidden = pn.dataset.pane !== 'nat'; });
}


export function openCompModal() {
  const modal = document.getElementById('comp-modal');
  if (!modal) return;
  initFlatpickrAll(); // au cas où
  // Reset éventuels états d'erreur d'une précédente saisie
  if (typeof _clearAllFieldErrors === 'function') _clearAllFieldErrors('#comp-modal');
  // Reset mode édition (sera ré-activé par openCompModalForEdit si applicable)
  window._editingCompId = null;
  // Restaure le titre et le bouton en mode "création" par défaut
  const titleH2 = document.querySelector('#comp-modal .modal-title h2');
  if (titleH2) titleH2.textContent = 'Ajouter une compétition';
  const saveBtn = document.getElementById('comp-modal-save');
  if (saveBtn) saveBtn.textContent = 'Enregistrer';
  // Cache le bouton poubelle par défaut (sera affiché par openCompModalForEdit)
  const delBtn = document.getElementById('comp-modal-delete');
  if (delBtn) delBtn.hidden = true;
  { const _tt = document.getElementById('comp-modal-to-training'); if (_tt) _tt.hidden = true; }
  { const _ex = document.getElementById('comp-modal-excl'); if (_ex) _ex.hidden = true; }
  window._compExclSbId = null;
  window._compToTrainingAct = null; window._compToTrainingIso = null;
  // Reset form (sauf "time" qui est géré par le stepper)
  ['name','date','type','km','dplus','target','laps','notes','speed','tss','rpe','level'].forEach(k => {
    const el = document.getElementById('comp-modal-' + k);
    if (el) el.value = '';
  });
  // Reset toggle course par étapes + state stages
  const stagesToggle = document.getElementById('comp-modal-stages-toggle');
  if (stagesToggle) stagesToggle.checked = false;
  appState.stagesData = [];
  appState.activeStageIdx = 0;
  const tabsBar = document.getElementById('comp-stages-tabs');
  if (tabsBar) tabsBar.hidden = true;
  // Reset le stepper d'heure à 12h00 par défaut
  if (window.resetTimeStepper) window.resetTimeStepper('comp-modal-time', 12, 0);
  const prioEl = document.getElementById('comp-modal-priority');
  if (prioEl) {
    prioEl.value = 'principal';
    if (typeof enhanceSelect === 'function') enhanceSelect('comp-modal-priority');
    if (prioEl._customUpdate) prioEl._customUpdate();
  }
  // Peuple le select sport (au cas où SPORTS_CATALOG n'était pas dispo à l'init)
  if (typeof populateSportSelect === 'function') populateSportSelect('comp-modal-sport', 'Ride');
  const sportEl = document.getElementById('comp-modal-sport');
  if (sportEl) sportEl.value = 'Ride';
  if (typeof resetTriPanes === 'function') resetTriPanes();
  window._compEditLegacyStd = false;
  { const sp = document.getElementById('comp-modal-speed'); if (sp) { sp.value = ''; delete sp.dataset.auto; } }
  setTimeout(() => { if (typeof adaptCompSportForm === 'function') adaptCompSportForm(); }, 0);
  if (sportEl && sportEl._customUpdate) sportEl._customUpdate();
  // Peuple le select Type d'épreuve selon le sport actif
  if (typeof populateTypeSelectForSport === 'function') populateTypeSelectForSport('Ride');
  if (typeof populateFedSelectForSport === 'function') populateFedSelectForSport('Ride');
  { const tf = document.getElementById('comp-modal-triformat'); if (tf) { tf.value = ''; if (tf._customUpdate) tf._customUpdate(); } }
  // Reset AGRESSIF du file-picker GPX (l'input file peut garder son state entre ouvertures)
  const gpxEl = document.getElementById('comp-modal-gpx');
  if (gpxEl) {
    try { gpxEl.value = ''; } catch (e) {}
    // Force aussi un FileList vide via DataTransfer (plus fiable que value='')
    try {
      const dt = new DataTransfer();
      gpxEl.files = dt.files;
    } catch (e) { /* navigateurs anciens */ }
    const picker = gpxEl.closest('.file-picker');
    if (picker) {
      picker.classList.remove('has-file');
      const lbl = picker.querySelector('.file-picker-label');
      if (lbl) lbl.textContent = 'Choisir un fichier GPX';
      const clr = picker.querySelector('.file-picker-clear');
      if (clr) clr.hidden = true;
    }
  }
  // Cleanup global de tous les file-pickers de la modal compé (au cas où il y en aurait plusieurs)
  document.querySelectorAll('#comp-modal .file-picker').forEach(p => {
    p.classList.remove('has-file');
    const lbl = p.querySelector('.file-picker-label');
    if (lbl) lbl.textContent = 'Choisir un fichier GPX';
    const clr = p.querySelector('.file-picker-clear');
    if (clr) clr.hidden = true;
    const inp = p.querySelector('input[type="file"]');
    if (inp) {
      try { inp.value = ''; } catch (e) {}
      try { inp.files = new DataTransfer().files; } catch (e) {}
    }
  });
  if (typeof initFilePickers === 'function') initFilePickers();
  modal.classList.add('active');
}

export function closeCompModal() {
  const modal = document.getElementById('comp-modal');
  if (modal) modal.classList.remove('active');
}


// Helper validation : marque un champ comme requis manquant + affiche un mini message
export function _markFieldError(inputId, message) {
  const el = document.getElementById(inputId);
  if (!el) return;
  // Cherche le form-field parent (peut être un label ou un div)
  const field = el.closest('.form-field') || el.parentElement;
  if (!field) return;
  field.classList.add('field-error');
  // Si un message d'erreur existe déjà, on l'update, sinon on le crée
  let msg = field.querySelector('.field-error-msg');
  if (!msg) {
    msg = document.createElement('div');
    msg.className = 'field-error-msg';
    field.appendChild(msg);
  }
  msg.textContent = message;
  // Cleanup auto au prochain input/change
  const clearOnce = () => {
    field.classList.remove('field-error');
    if (msg && msg.parentNode) msg.parentNode.removeChild(msg);
    el.removeEventListener('input', clearOnce);
    el.removeEventListener('change', clearOnce);
  };
  el.addEventListener('input', clearOnce);
  el.addEventListener('change', clearOnce);
}

export function _clearAllFieldErrors(modalSel) {
  document.querySelectorAll(`${modalSel} .field-error`).forEach(f => f.classList.remove('field-error'));
  document.querySelectorAll(`${modalSel} .field-error-msg`).forEach(m => m.remove());
}


// Compet REALISEE = activite (category='competition') dans DASHBOARD_DATA. Ces helpers
// mettent a jour DASHBOARD_DATA en memoire pour un affichage IMMEDIAT (edition/suppression).
export function removeCompFromDashboard(comp) {
  if (!window.DASHBOARD_DATA || !Array.isArray(window.DASHBOARD_DATA.days) || !comp) return;
  for (const d of window.DASHBOARD_DATA.days) {
    if (!d.activities) continue;
    d.activities = d.activities.filter(x => !(
      (comp._sbId && String(x._sbId) === String(comp._sbId)) ||
      (comp.id && String(x.client_id) === String(comp.id))
    ));
  }
}

function upsertCompInDashboard(comp) {
  if (!window.DASHBOARD_DATA || !Array.isArray(window.DASHBOARD_DATA.days) || !comp || !comp.date) return;
  const iso = comp.date;
  const row = {
    id: comp._sbId || ('local-' + comp.id),
    _sbId: comp._sbId || null,
    source: 'manual', category: 'competition', client_id: comp.id,
    name: comp.name,
    sport: (typeof getSportCategory === 'function' ? getSportCategory(comp.sport) : comp.sport),
    raw_type: comp.sport,
    start_date_local: iso + 'T' + (comp.time || '12:00') + ':00',
    distance_km: comp.km || null, elevation_gain: comp.dplus || null, course_dplus: comp.dplus || null,
    target: comp.target || null, moving_time: comp.target ? comp.target * 60 : null,
    duration: comp.target || 0,
    priority: comp.priority || null, laps: comp.laps || null,
    notes: comp.notes || '', type: comp.type || null, event: comp.event || null, tss: 0,
  };
  let day = window.DASHBOARD_DATA.days.find(d => String(d.date) === iso);
  if (!day) { day = { date: iso, activities: [] }; window.DASHBOARD_DATA.days.push(day); }
  if (!Array.isArray(day.activities)) day.activities = [];
  // Si la compétition correspond à une VRAIE activité (Strava/import) déjà dans le
  // jour : mise à jour des champs compet uniquement — ne JAMAIS remplacer par le
  // stub (sinon durée/TSS/NP/cardio disparaissent jusqu'au rechargement).
  const existing = day.activities.find(x =>
    (comp._sbId && String(x._sbId) === String(comp._sbId)) ||
    (String(x.client_id) === String(comp.id))
  );
  // Vraie activité (Strava/import) OU parent multisport fusionné (_msLegs) :
  // mise à jour des champs compet uniquement — ne JAMAIS remplacer par le stub
  // (sinon durée/TSS/streams — ou les étapes du triathlon — disparaissent
  // jusqu'au rechargement).
  if (existing && (existing.source !== 'manual' || existing._msLegs)) {
    existing.name = comp.name;
    existing.category = 'competition';
    existing.priority = comp.priority || null;
    existing.target = comp.target || null;
    existing.laps = comp.laps || null;
    existing.course_dplus = comp.dplus || null;
    if (comp.notes) existing.notes = comp.notes;
    if (comp.tri) existing.tri = comp.tri;
    return;
  }
  day.activities = day.activities.filter(x => !(
    (comp._sbId && String(x._sbId) === String(comp._sbId)) ||
    (String(x.client_id) === String(comp.id))
  ));
  day.activities.push(row);
}

async function saveCompFromModal() {
  _clearAllFieldErrors('#comp-modal');
  const name = document.getElementById('comp-modal-name').value.trim();
  const date = document.getElementById('comp-modal-date').value;
  if (!name || !date) {
    if (!name) _markFieldError('comp-modal-name', 'Champ requis');
    if (!date) _markFieldError('comp-modal-date', 'Champ requis');
    // Scroll vers le premier champ en erreur
    const first = document.querySelector('#comp-modal .field-error');
    if (first) first.scrollIntoView({ behavior: 'smooth', block: 'center' });
    return;
  }
  const time = document.getElementById('comp-modal-time').value || '';
  const priority = document.getElementById('comp-modal-priority').value;
  const sport = document.getElementById('comp-modal-sport').value;
  const typeEpr = document.getElementById('comp-modal-type').value.trim();
  let km = (typeof readDistAsKm === 'function') ? readDistAsKm('comp-modal-km') : (parseFloat(document.getElementById('comp-modal-km').value) || null);
  // Triathlon : segments detailles (onglets Nat/T1/Velo/T2/CAP)
  let tri = null;
  let triDplus = null, triTargetMin = null;
  {
    const triWrap = document.getElementById('comp-parcours-tri');
    if (triWrap && !triWrap.hidden) {
      const num = (id) => { const v = parseFloat(String((document.getElementById(id) || {}).value || '').replace(',', '.')); return isNaN(v) || v <= 0 ? null : v; };
      const seg = (tId) => parseSegTime((document.getElementById(tId) || {}).value);
      const swim = { min: seg('comp-tri-nat-time'), dist_m: num('comp-tri-nat-dist'), pace: (document.getElementById('comp-tri-nat-pace') || {}).value || null, tss: num('comp-tri-nat-tss') };
      const bike = { min: seg('comp-tri-bike-time'), dist_km: num('comp-tri-bike-dist'), speed: num('comp-tri-bike-speed'), dplus: num('comp-tri-bike-dplus'), tss: num('comp-tri-bike-tss') };
      const run = { min: seg('comp-tri-run-time'), dist_km: num('comp-tri-run-dist'), pace: (document.getElementById('comp-tri-run-pace') || {}).value || null, tss: num('comp-tri-run-tss') };
      const t1 = seg('comp-tri-t1-time'), t2 = seg('comp-tri-t2-time');
      const any = swim.min || swim.dist_m || bike.min || bike.dist_km || run.min || run.dist_km || t1 || t2;
      if (any) {
        tri = {
          swim, t1_min: t1, bike, t2_min: t2, run,
          // miroirs legacy (affichage cartes + compat)
          swim_m: swim.dist_m, bike_km: bike.dist_km, run_km: run.dist_km,
        };
        km = +(((swim.dist_m || 0) / 1000) + (bike.dist_km || 0) + (run.dist_km || 0)).toFixed(1) || null;
        triDplus = bike.dplus || null;
        const times = [swim.min, t1, bike.min, t2, run.min];
        if (swim.min && bike.min && run.min) triTargetMin = Math.round(times.reduce((a2, b2) => a2 + (b2 || 0), 0));
      }
    }
  }
  const dplus = parseInt(document.getElementById('comp-modal-dplus').value, 10) || null;
  const target = parseTimeToMin(document.getElementById('comp-modal-target').value);
  const laps = parseInt(document.getElementById('comp-modal-laps').value, 10) || null;
  const notes = document.getElementById('comp-modal-notes').value.trim();
  const federation = (document.getElementById('comp-modal-federation') || {}).value || null;
  const _lvlSel = document.getElementById('comp-modal-level-select');
  const raceLevel = ((_lvlSel && !_lvlSel.hidden) ? _lvlSel.value : ((document.getElementById('comp-modal-level') || {}).value || '')).trim() || null;
  const triFormat = (document.getElementById('comp-modal-triformat') || {}).value || null;
  const compTss = parseInt((document.getElementById('comp-modal-tss') || {}).value, 10) || null;
  const compRpe = parseFloat(String((document.getElementById('comp-modal-rpe') || {}).value || '').replace(',', '.')) || null;
  // (champ Événement supprimé de la modale ; on préserve la valeur existante en édition)
  const event = (window._editingCompId ? ((loadCompetitions().find(c => c.id === window._editingCompId) || {}).event || '') : '');
  const stagesEl = document.getElementById('comp-modal-stages-toggle');
  const stages = !!(stagesEl && stagesEl.checked);

  // Si course par étapes : on récupère la liste des étapes (snapshot du form pour l'étape active)
  let stagesList = null;
  if (stages) {
    appState.stagesData[appState.activeStageIdx] = readFormToStage();
    // Lit les GPX async (chaque étape peut en avoir un)
    stagesList = [];
    for (let i = 0; i < appState.stagesData.length; i++) {
      const s = appState.stagesData[i];
      // Priorité : nouveau fichier > contenu existant en mémoire (édition sans re-upload)
      let gpxContent = s.gpxContent || null;
      if (s.gpxFile) {
        try { gpxContent = await s.gpxFile.text(); } catch (e) { console.warn('GPX étape ' + (i + 1) + ' :', e); }
      }
      stagesList.push({
        date: s.date || null,
        time: s.time || null,
        // priority et sport ne sont PAS stockés par étape (globaux à la compé)
        type: s.type || null,
        km: parseFloat(s.km) || null,
        dplus: parseInt(s.dplus, 10) || null,
        target: s.target || null,
        laps: parseInt(s.laps, 10) || null,
        notes: s.notes || null,
        gpxName: s.gpxName || null,
        gpxContent,
      });
    }
  }

  // GPX (lecture optionnelle) — en mode triathlon, le GPX vient de l'onglet Vélo
  let gpxContent = null;
  let gpxName = null;
  const _triWrapG = document.getElementById('comp-parcours-tri');
  const _gpxSrc = (_triWrapG && !_triWrapG.hidden && document.getElementById('comp-tri-gpx') && document.getElementById('comp-tri-gpx').files[0])
    ? document.getElementById('comp-tri-gpx') : document.getElementById('comp-modal-gpx');
  const gpxFile = _gpxSrc.files[0];
  if (gpxFile) {
    try {
      gpxContent = await gpxFile.text();
      gpxName = gpxFile.name;
    } catch (e) {
      console.warn('Lecture GPX impossible :', e);
    }
  }

  const comps = loadCompetitions();
  // Une compétition à date FUTURE n'est JAMAIS "réalisée", même créée depuis
  // l'onglet Réalisé (sinon elle part dans activities et disparaît du calendrier Prévu).
  const _isFutureComp = date > toIsoDate(appState.today);
  const newEntry = {
    id: window._editingCompId || Date.now().toString(),
    realised: _isFutureComp ? false : (window.coachCalendarMode ? window.coachCalendarMode() === 'realise' : false),
    name, date, time, priority, sport,
    type: typeEpr, km,
    dplus: (tri ? (triDplus != null ? triDplus : null) : dplus),
    target: (tri && triTargetMin ? triTargetMin : target),
    laps: (tri ? null : laps), notes, event,
    tss: compTss, rpe: compRpe,
    federation, raceLevel, triFormat: (tri || getSportCategory(sport) === 'triathlon') ? triFormat : null,
    tri,
    stages,
    stagesList,
    gpxName, gpxContent
  };
  if (window._editingCompId) {
    // Mode édition : remplace la compé existante
    const idx = comps.findIndex(c => c.id === window._editingCompId);
    if (idx >= 0) {
      // Conserve les éventuels champs GPX existants si non modifiés
      const old = comps[idx];
      // IMPORTANT : conserver l'id Supabase pour METTRE À JOUR la ligne existante
      // (sinon le push crée une nouvelle ligne et la modif est perdue au rechargement)
      if (old._sbId) newEntry._sbId = old._sbId;
      if (old.realised != null && !_isFutureComp) newEntry.realised = old.realised;
      // Conserver aussi la table d'origine + liens : sans _table, le push ne cible
      // plus la bonne ligne (doublon ou écrasement de la vraie activité Strava).
      if (old._table) newEntry._table = old._table;
      if (old.activityIds) newEntry.activityIds = old.activityIds;
      if (!gpxContent && old.gpxContent) {
        newEntry.gpxName = old.gpxName;
        newEntry.gpxContent = old.gpxContent;
      }
      // Conserve gpxContent par étape si l'utilisateur n'a pas ré-uploadé
      if (stagesList && old.stagesList) {
        for (let i = 0; i < stagesList.length; i++) {
          if (!stagesList[i].gpxContent && old.stagesList[i] && old.stagesList[i].gpxContent) {
            stagesList[i].gpxContent = old.stagesList[i].gpxContent;
            stagesList[i].gpxName = old.stagesList[i].gpxName;
          }
        }
        newEntry.stagesList = stagesList;
      }
      comps[idx] = newEntry;
    } else {
      comps.push(newEntry); // au cas où l'ID a disparu, on l'ajoute
    }
    window._editingCompId = null;
  } else {
    comps.push(newEntry);
  }
  saveCompetitions(comps);
  // Exclusions records/stats (compét réalisée) : mise à jour de l'activité en base
  if (window._compExclSbId) {
    const _ex = document.getElementById('comp-modal-excl');
    const _on = (m) => !!(_ex && _ex.querySelector('.ae-metric-btn[data-m="' + m + '"].active'));
    const _excl = { excl_power: _on('power'), excl_hr: _on('hr'), excl_distance: _on('dist') };
    try { if (window.sb) await window.sb.from('activities').update(_excl).eq('id', window._compExclSbId); } catch (e) { console.warn('[comp excl]', e.message || e); }
    const _act = (typeof _findActBySbId === 'function') ? _findActBySbId(window._compExclSbId) : null;
    if (_act) { _act._exclPower = _excl.excl_power; _act._exclHr = _excl.excl_hr; _act._exclDistance = _excl.excl_distance; }
    if (typeof window.__applyOverridesAndRerender === 'function') window.__applyOverridesAndRerender();
    window._compExclSbId = null;
  }
  closeCompModal();
  renderCompList();
  if (newEntry.realised) {
    upsertCompInDashboard(newEntry);
    if (typeof window.__applyOverridesAndRerender === 'function') window.__applyOverridesAndRerender();
    else renderCalendar();
  } else {
    renderCalendar();
  }
}

export function bootCompForm() {

window.reflowSecGrids = reflowSecGrids;

document.getElementById('train-modal-sport')?.addEventListener('change', adaptTrainSportForm);

document.getElementById('comp-modal-sport')?.addEventListener('change', adaptCompSportForm);

// Champ Durée en saisie libre : parse (15 · 15min · 15s · 1h15 · 4:30 · 1,5)
// et affichage canonique — au-delà de 60 min on passe en heures (1h15).
// Distance affichée à la dizaine de mètres près (35.42 km), zéros superflus retirés
window.fmtKm = function (v) { const n = Math.round((+v || 0) * 100) / 100; return String(n); };

// Distance selon le sport : natation en mètres, le reste en km.
// prec '100m' (cartes calendrier) : les km s'arrondissent à la centaine de
// mètres (7.4 km) ; les valeurs en MÈTRES gardent la dizaine (1420 m).
window.fmtDist = function (km, sport, prec) {
  const cat = window.getSportCategory ? window.getSportCategory(sport || '') : 'autre';
  if (cat === 'natation') return (Math.round((+km || 0) * 100) * 10) + ' m';
  if (prec === '100m') return String(Math.round((+km || 0) * 10) / 10) + ' km';
  return window.fmtKm(km) + ' km';
};

// Vitesse/allure selon le sport : course en min/km, natation en min/100m, sinon km/h
window.fmtRate = function (km, durMin, sport) {
  km = +km || 0; durMin = +durMin || 0;
  if (!(km > 0) || !(durMin > 0)) return null;
  const cat = window.getSportCategory ? window.getSportCategory(sport || '') : 'autre';
  const mmss = (sec) => Math.floor(sec / 60) + ':' + String(Math.round(sec) % 60).padStart(2, '0');
  if (cat === 'course') return mmss(durMin * 60 / km) + ' /km';
  if (cat === 'natation') return mmss(durMin * 60 / (km * 10)) + ' /100m';
  return (Math.round(km / (durMin / 60) * 10) / 10) + ' km/h';
};

window.rateLabel = function (sport) {
  const cat = window.getSportCategory ? window.getSportCategory(sport || '') : 'autre';
  return (cat === 'course' || cat === 'natation') ? 'Allure' : 'Vitesse';
};

// Vitesse canonique (km/h) -> affichage selon sport (min/km, min/100m, km/h)
window.speedToRate = function (kmh, sport) {
  kmh = +kmh; if (!(kmh > 0)) return null;
  const cat = window.getSportCategory ? window.getSportCategory(sport || '') : 'autre';
  const mmss = (sec) => Math.floor(sec / 60) + ':' + String(Math.round(sec) % 60).padStart(2, '0');
  if (cat === 'course') return mmss(3600 / kmh) + ' /km';
  if (cat === 'natation') return mmss(360 / kmh) + ' /100m';
  return (Math.round(kmh * 10) / 10) + ' km/h';
};

window.__parseDurField = function (v) {
  if (typeof v === 'number') return isNaN(v) ? null : v;
  if (window.__durParse) return window.__durParse(v);
  const f = parseFloat(String(v || '').replace(',', '.'));
  return isNaN(f) ? null : f;
};

window.__fmtDurField = function (min) {
  min = +min || 0; if (min <= 0) return '';
  const tot = Math.round(min * 60), h = Math.floor(tot / 3600), m = Math.floor((tot % 3600) / 60), s = tot % 60;
  const p2 = (n) => (n < 10 ? '0' : '') + n;
  if (h) return h + 'h' + (m || s ? p2(m) : '') + (s ? ':' + p2(s) : '');
  if (s) return m + ':' + p2(s);
  return String(m);
};

wireCompTrios();

// Normalise l'affichage du champ Durée après saisie (90 -> 1h30, 15s -> 0:15…)
(function wireDurField() {
  const el = document.getElementById('train-modal-duration');
  if (!el || el._durWired) return;
  el._durWired = true;
  el.addEventListener('change', function () {
    const v = window.__parseDurField(el.value);
    el.value = v && v > 0 ? window.__fmtDurField(v) : '';
  });
})();


// Onglets triathlon : bascule des panneaux + marquage "rempli"
(function wireTriTabs() {
  const tabs = document.getElementById('comp-tri-tabs');
  if (!tabs) return;
  tabs.addEventListener('click', (e) => {
    const btn = e.target.closest('.tri-tab');
    if (!btn) return;
    tabs.querySelectorAll('.tri-tab').forEach(b => b.classList.toggle('active', b === btn));
    document.querySelectorAll('#comp-parcours-tri .tri-pane').forEach(pn => { pn.hidden = pn.dataset.pane !== btn.dataset.pane; });
    // Pas de charge estimée pour une transition (T1/T2) : la section est masquée
    const _chg = document.getElementById('comp-charge-sec');
    if (_chg) _chg.hidden = (btn.dataset.pane === 't1' || btn.dataset.pane === 't2');
  });
  // marque les onglets qui contiennent des valeurs
  document.querySelectorAll('#comp-parcours-tri input').forEach(inp => {
    inp.addEventListener('input', () => {
      document.querySelectorAll('#comp-parcours-tri .tri-pane').forEach(pn => {
        const filled = Array.from(pn.querySelectorAll('input')).some(i => i.value && i.type !== 'file');
        const tb = tabs.querySelector(`.tri-tab[data-pane="${pn.dataset.pane}"]`);
        if (tb) tb.classList.toggle('filled', filled);
      });
    });
  });
  // TSS par discipline -> le TSS global (Charge estimée) devient la somme (auto).
  // Une saisie manuelle du global reprend la main (perte du statut auto).
  const _segTssIds = ['comp-tri-nat-tss', 'comp-tri-bike-tss', 'comp-tri-run-tss'];
  const _globalTss = document.getElementById('comp-modal-tss');
  if (_globalTss && !_globalTss._triSumWired) {
    _globalTss._triSumWired = true;
    _globalTss.addEventListener('input', () => { delete _globalTss.dataset.auto; });
    const _sumSegTss = () => {
      const vals = _segTssIds.map(id => parseInt((document.getElementById(id) || {}).value, 10) || 0);
      const sum = vals.reduce((a2, b2) => a2 + b2, 0);
      if (!sum) return;
      if (!_globalTss.value || _globalTss.dataset.auto === '1') {
        _globalTss.value = sum;
        _globalTss.dataset.auto = '1';
      }
    };
    _segTssIds.forEach(id => {
      const el = document.getElementById(id);
      if (el) el.addEventListener('input', () => { if (_globalTss.dataset.auto === '1') _globalTss.value = ''; _sumSegTss(); });
    });
  }
})();


// Wire up modal triggers (défensif)
appState.openCompBtn = document.getElementById('open-comp-modal');

if (appState.openCompBtn) appState.openCompBtn.addEventListener('click', openCompModal);

// Boutons + des en-têtes "Compétitions à venir" (calendrier + page compétitions)
document.querySelectorAll('.comp-add-btn').forEach(b => b.addEventListener('click', openCompModal));

appState.compModalClose = document.getElementById('comp-modal-close');

if (appState.compModalClose) appState.compModalClose.addEventListener('click', closeCompModal);

appState.compModalCancel = document.getElementById('comp-modal-cancel');

if (appState.compModalCancel) appState.compModalCancel.addEventListener('click', closeCompModal);

appState.compModalSave = document.getElementById('comp-modal-save');

if (appState.compModalSave) appState.compModalSave.addEventListener('click', saveCompFromModal);

appState._compToTrainingBtn = document.getElementById('comp-modal-to-training');

if (appState._compToTrainingBtn) appState._compToTrainingBtn.addEventListener('click', async () => {
  const act = window._compToTrainingAct, iso = window._compToTrainingIso;
  const plannedId = window._compToTrainingPlannedId;
  if (typeof closeCompModal === 'function') closeCompModal();
  if (act && act._sbId) {
    if (typeof setActivityCategory === 'function') await setActivityCategory(act, 'entrainement', iso);
  } else if (plannedId != null && window.convertPlannedCompToTraining) {
    window.convertPlannedCompToTraining(plannedId);
  }
});

appState.compModalOverlay = document.getElementById('comp-modal');

if (appState.compModalOverlay) appState.compModalOverlay.addEventListener('click', (e) => {
  if (e.target === appState.compModalOverlay) closeCompModal();
});


// Auto-remplit km + D+ depuis le GPX dès qu'un fichier est sélectionné
appState._compGpxInput = document.getElementById('comp-modal-gpx');

if (appState._compGpxInput) {
  appState._compGpxInput.addEventListener('change', () => {
    // Petit délai pour que le file-picker UI mette d'abord à jour son visuel
    setTimeout(() => { if (typeof _autofillKmDplusFromCompGpx === 'function') _autofillKmDplusFromCompGpx(); }, 50);
  });
}

// Recalcule km + D+ quand le nombre de tours change (si un GPX est présent)
appState._compLapsInput = document.getElementById('comp-modal-laps');

if (appState._compLapsInput) {
  appState._compLapsInput.addEventListener('input', () => {
    if (typeof _autofillKmDplusFromCompGpx === 'function') _autofillKmDplusFromCompGpx();
  });
}
}
