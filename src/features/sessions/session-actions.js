/* src/features/sessions/session-actions.js — extrait de l'ancien app.js (découpage par fonctionnalité). */
import { appState } from '../../core/state.js';
import { getActivityEdit, setActivityEdit } from '../calendar/overrides.js';
import { loadCompetitions, renderCompList, renderCompetitionsPage, saveCompetitions } from '../competitions/competitions-page.js';
import { closeSessionModal } from './session-modal.js';
import { _findActBySbId, extractGpxStats, openActivityEditModal } from '../gpx/gpx-render.js';
import { openTrainModal } from '../training/train-modal.js';
import { adaptCompSportForm, closeCompModal, fmtSegTime, openCompModal, removeCompFromDashboard, resetTriPanes } from '../competitions/comp-form.js';
import { renderCalendar } from '../calendar/realise-calendar.js';
import { enhanceSelect, populateFedSelectForSport, populateTypeSelectForSport, updateLevelFieldForFed } from '../competitions/comp-modal-ui.js';
import { fmtMinToTime, parseTimeToMin, renderStageTabs, writeStageToForm } from '../competitions/comp-stages.js';
import { compPrio } from '../../core/format.js';


// ========= STRAVA IGNORE LIST (masquer des activités Strava localement) =========
// « Masquer une activité » = drapeau hidden dans activity_edits (table mutualisée).
export function isStravaIgnored(id) { const ov = getActivityEdit(id); return !!(ov && ov.hidden); }

function addStravaIgnored(id) {
  const ov = getActivityEdit(id) || {};
  setActivityEdit(id, { ...ov, hidden: true });
}


// ========= TEMPLATE IA OVERRIDES (marquer un jour en repos / personnalisation) =========
const TEMPLATE_REST_KEY = 'coach_ia_template_rest_days_v1';

const TEMPLATE_REST_IA_KEY = 'coach_ia_template_rest_days_ia_v1';

function loadTemplateRestDays() {
  try { return JSON.parse(localStorage.getItem(TEMPLATE_REST_KEY) || '[]'); }
  catch { return []; }
}

function loadRestIaSet() {
  try { return JSON.parse(localStorage.getItem(TEMPLATE_REST_IA_KEY) || '[]'); }
  catch { return []; }
}

function isTemplateRestDay(iso) { return loadTemplateRestDays().includes(iso); }

// Jour de repos prévu (qu'il vienne de toi ou de l'IA : tout est affiché).
export function isRestDayForMode(iso) {
  return loadTemplateRestDays().includes(iso);
}

function addTemplateRestDay(iso, ia = false) {
  const arr = loadTemplateRestDays();
  if (!arr.includes(iso)) arr.push(iso);
  localStorage.setItem(TEMPLATE_REST_KEY, JSON.stringify(arr));
  if (ia) {
    const iaArr = loadRestIaSet();
    if (!iaArr.includes(iso)) iaArr.push(iso);
    localStorage.setItem(TEMPLATE_REST_IA_KEY, JSON.stringify(iaArr));
  }
  if (window.cloudSync) window.cloudSync.pushRestDay(iso, true, ia);
}

function removeTemplateRestDay(iso) {
  localStorage.setItem(TEMPLATE_REST_KEY, JSON.stringify(loadTemplateRestDays().filter(d => d !== iso)));
  localStorage.setItem(TEMPLATE_REST_IA_KEY, JSON.stringify(loadRestIaSet().filter(d => d !== iso)));
  if (window.cloudSync) window.cloudSync.pushRestDay(iso, false);
}

function toggleTemplateRestDay(iso) {
  if (isTemplateRestDay(iso)) removeTemplateRestDay(iso);
  else addTemplateRestDay(iso, false);
}


// Ouvre la modal d'ajout de compétition en mode édition (préremplie + sauvegarde update)
// Helper : applique l'état visuel "fichier sélectionné" au file-picker compé
function _setCompModalGpxVisual(gpxName) {
  const gpxEl = document.getElementById('comp-modal-gpx');
  if (!gpxEl) return;
  const picker = gpxEl.closest('.file-picker');
  if (!picker) return;
  const lbl = picker.querySelector('.file-picker-label');
  const clr = picker.querySelector('.file-picker-clear');
  if (gpxName) {
    picker.classList.add('has-file');
    if (lbl) lbl.textContent = gpxName;
    if (clr) clr.hidden = false;
  } else {
    picker.classList.remove('has-file');
    if (lbl) lbl.textContent = 'Choisir un fichier GPX';
    if (clr) clr.hidden = true;
  }
}


export function openCompModalForEdit(comp) {
  if (typeof openCompModal !== 'function') return;
  // Compet REALISEE adossee a une vraie activite : la fiche compet (meta) est
  // souvent vide en base (target/dplus/notes/tss null) alors que l'activite a
  // tout. Fallback : on complete chaque champ manquant depuis l'activite,
  // pour que la modif affiche les memes infos que la fiche de detail.
  const _isRealisedComp = comp.realised === true || comp._table === 'activity' || comp._table === 'competition';
  if (_isRealisedComp && typeof _findActBySbId === 'function') {
    const _ids = [comp._sbId].concat(Array.isArray(comp.activityIds) ? comp.activityIds : []).filter(Boolean);
    let _f = null;
    for (const _id of _ids) { _f = _findActBySbId(_id); if (_f) break; }
    if (_f) {
      const a = _f.act;
      const _actTime = (String(a.start_date_local || '').match(/[T ](\d{2}:\d{2})/) || [])[1] || null;
      const _has = (v) => v != null && v !== '';
      comp = Object.assign({}, comp, {
        km: _has(comp.km) ? comp.km : (a.distance_km || a.km || null),
        dplus: _has(comp.dplus) ? comp.dplus : (Math.round(a.elevation_gain || a.total_elevation_gain || a.dplus || 0) || null),
        target: _has(comp.target) ? comp.target : (a.moving_time ? Math.round(a.moving_time / 60) : (a.duration ? Math.round(a.duration) : null)),
        tss: _has(comp.tss) ? comp.tss : (a.tss != null ? Math.round(a.tss) : null),
        rpe: _has(comp.rpe) ? comp.rpe : (a.rpe != null ? a.rpe : null),
        notes: comp.notes || a.notes || '',
        time: comp.time || _actTime,
      });
    }
  }
  openCompModal();
  // Marque le mode édition
  window._editingCompId = comp.id;
  // Pré-remplit les champs principaux
  document.getElementById('comp-modal-name').value = comp.name || '';
  document.getElementById('comp-modal-date').value = comp.date || '';
  if (document.getElementById('comp-modal-date')._flatpickr && comp.date) {
    document.getElementById('comp-modal-date')._flatpickr.setDate(comp.date, false);
  }
  // Time
  if (comp.time && window.resetTimeStepper) {
    const [h, m] = comp.time.split(':').map(n => parseInt(n, 10) || 0);
    window.resetTimeStepper('comp-modal-time', h, m);
  }
  // Selects (priority, sport, type)
  ['priority', 'sport', 'type'].forEach(k => {
    const el = document.getElementById('comp-modal-' + k);
    if (el && comp[k] !== undefined && comp[k] !== null) {
      el.value = (k === 'priority') ? compPrio(comp[k]).key : comp[k];
      if (el._customUpdate) el._customUpdate();
    }
  });
  if (typeof populateTypeSelectForSport === 'function' && comp.sport) {
    populateTypeSelectForSport(comp.sport);
    const t = document.getElementById('comp-modal-type');
    if (t && comp.type) { t.value = comp.type; if (t._customUpdate) t._customUpdate(); }
  }
  // Champs simples — si GPX présent, calcule km/dplus depuis le GPX (vérité terrain)
  // et écrase les valeurs manuelles (l'utilisateur veut que ça reflète le fichier)
  let effKm = comp.km, effDplus = comp.dplus;
  if (comp.gpxContent && typeof extractGpxStats === 'function') {
    const gs = extractGpxStats(comp.gpxContent, parseInt(comp.laps, 10) || 1);
    if (gs) {
      effKm = gs.km;
      effDplus = gs.dplus;
    }
  }
  document.getElementById('comp-modal-km').value = effKm != null ? effKm : '';
  document.getElementById('comp-modal-dplus').value = effDplus != null ? effDplus : '';
  {
    if (typeof resetTriPanes === 'function') resetTriPanes();
    // Tri legacy : donnees globales presentes mais aucun segment -> bloc standard visible
    const _hasSeg = comp.tri && (comp.tri.swim || comp.tri.bike || comp.tri.run || comp.tri.swim_m || comp.tri.bike_km || comp.tri.run_km);
    window._compEditLegacyStd = !_hasSeg && !!(comp.km || comp.target || comp.dplus);
    const t = comp.tri || {};
    const setV = (id, v) => { const e = document.getElementById(id); if (e && v != null && v !== '') e.value = v; };
    const sw = t.swim || {}, bk = t.bike || {}, rn = t.run || {};
    setV('comp-tri-nat-time', sw.min ? fmtSegTime(sw.min) : null);
    setV('comp-tri-nat-dist', sw.dist_m != null ? sw.dist_m : t.swim_m);
    setV('comp-tri-nat-pace', sw.pace);
    setV('comp-tri-nat-tss', sw.tss);
    setV('comp-tri-bike-tss', bk.tss);
    setV('comp-tri-run-tss', rn.tss);
    setV('comp-tri-t1-time', t.t1_min ? fmtSegTime(t.t1_min) : null);
    setV('comp-tri-bike-time', bk.min ? fmtSegTime(bk.min) : null);
    setV('comp-tri-bike-dist', bk.dist_km != null ? bk.dist_km : t.bike_km);
    setV('comp-tri-bike-speed', bk.speed);
    setV('comp-tri-bike-dplus', bk.dplus);
    setV('comp-tri-t2-time', t.t2_min ? fmtSegTime(t.t2_min) : null);
    setV('comp-tri-run-time', rn.min ? fmtSegTime(rn.min) : null);
    setV('comp-tri-run-dist', rn.dist_km != null ? rn.dist_km : t.run_km);
    setV('comp-tri-run-pace', rn.pace);
    // Vitesse moyenne (std) recalculée si temps + distance connus
    const spd = document.getElementById('comp-modal-speed');
    const tm2 = parseTimeToMin(comp.target), km3 = +comp.km || null;
    if (spd) { spd.value = (tm2 && km3) ? +(km3 / (tm2 / 60)).toFixed(1) : ''; if (spd.value) spd.dataset.auto = '1'; }
  }
  setTimeout(() => { if (typeof adaptCompSportForm === 'function') adaptCompSportForm(); }, 0);
  document.getElementById('comp-modal-target').value = fmtMinToTime(comp.target);
  document.getElementById('comp-modal-laps').value = comp.laps != null ? comp.laps : '';
  { const e1 = document.getElementById('comp-modal-tss'); if (e1) e1.value = comp.tss != null ? comp.tss : ''; }
  {
    if (typeof populateFedSelectForSport === 'function') populateFedSelectForSport(comp.sport || 'Ride');
    const f = document.getElementById('comp-modal-federation');
    if (f && comp.federation) {
      if (![...f.options].some(o => o.value === comp.federation)) {
        const o = document.createElement('option');
        o.value = comp.federation;
        o.textContent = comp.federation;
        f.appendChild(o);
        if (typeof enhanceSelect === 'function') enhanceSelect('comp-modal-federation');
      }
      f.value = comp.federation;
      if (f._customUpdate) f._customUpdate();
    }
    updateLevelFieldForFed((f && f.value) || comp.federation || '', comp.raceLevel || '');
    const tf = document.getElementById('comp-modal-triformat');
    if (tf) { tf.value = comp.triFormat || ''; if (tf._customUpdate) tf._customUpdate(); }
  }
  { const e2 = document.getElementById('comp-modal-rpe'); if (e2) e2.value = comp.rpe != null ? comp.rpe : ''; }
  document.getElementById('comp-modal-notes').value = comp.notes || '';
  // Toggle stages + remplissage stagesData si applicable
  const stagesToggle = document.getElementById('comp-modal-stages-toggle');
  if (stagesToggle) {
    stagesToggle.checked = !!comp.stages;
    if (comp.stages && Array.isArray(comp.stagesList) && comp.stagesList.length) {
      appState.stagesData = comp.stagesList.map(s => ({
        date: s.date || '',
        time: s.time || '',
        type: s.type || '',
        km: s.km != null ? String(s.km) : '',
        dplus: s.dplus != null ? String(s.dplus) : '',
        target: s.target != null ? s.target : null,
        laps: s.laps != null ? String(s.laps) : '',
        notes: s.notes || '',
        gpxName: s.gpxName || null,
        gpxContent: s.gpxContent || null, // conserve le contenu en mémoire
        gpxFile: null, // les fichiers File API ne peuvent pas être pré-remplis
      }));
      appState.activeStageIdx = 0;
      const tabsBar = document.getElementById('comp-stages-tabs');
      if (tabsBar) tabsBar.hidden = false;
      renderStageTabs();
      writeStageToForm(appState.stagesData[0]);
      // Force l'affichage du nom GPX de l'étape 0 dans le picker
      _setCompModalGpxVisual(appState.stagesData[0].gpxName);
    } else {
      // Compé simple : restaure le picker GPX si présent au niveau racine
      _setCompModalGpxVisual(comp.gpxName);
    }
  } else {
    _setCompModalGpxVisual(comp.gpxName);
  }
  // Adapter le titre + label du bouton "Enregistrer"
  const titleH2 = document.querySelector('#comp-modal .modal-title h2');
  if (titleH2) titleH2.textContent = 'Modifier la compétition';
  const saveBtn = document.getElementById('comp-modal-save');
  if (saveBtn) saveBtn.textContent = 'Enregistrer les modifications';
  // Affiche le bouton poubelle (uniquement en édition)
  const delBtn = document.getElementById('comp-modal-delete');
  if (delBtn) delBtn.hidden = false;
  // Bouton "Transformer en entrainement" : compet réalisée (activité en base)
  // OU compét prévue (conversion locale planned -> séance)
  const _toTrain = document.getElementById('comp-modal-to-training');
  if (_toTrain) {
    const _isRealisedAct = !!(comp._sbId && (comp._table === 'activity' || comp.realised === true));
    _toTrain.hidden = false;
    window._compToTrainingAct = _isRealisedAct ? { _sbId: comp._sbId, category: 'competition', name: comp.name, sport: comp.sport } : null;
    window._compToTrainingIso = comp.date || null;
    window._compToTrainingPlannedId = _isRealisedAct ? null : comp.id;
    // Exclusions records/stats : uniquement pour une compét réalisée (activité en base)
    const _ex = document.getElementById('comp-modal-excl');
    if (_ex) {
      _ex.hidden = !_isRealisedAct;
      window._compExclSbId = _isRealisedAct ? String(comp._sbId) : null;
      if (_isRealisedAct) {
        const _act = (typeof _findActBySbId === 'function') ? _findActBySbId(comp._sbId) : null;
        const _set = (m, on) => { const b = _ex.querySelector('.ae-metric-btn[data-m="' + m + '"]'); if (b) b.classList.toggle('active', !!on); };
        _set('power', _act && _act._exclPower); _set('hr', _act && _act._exclHr); _set('dist', _act && _act._exclDistance);
      }
    }
  }
}

export function bootSessionActions() {

// Expose pour modules ES6 externes (day-extras.js)
window.isTemplateRestDay = isTemplateRestDay;

window.isRestDayForMode = isRestDayForMode;

window.addTemplateRestDay = addTemplateRestDay;

window.removeTemplateRestDay = removeTemplateRestDay;

window.toggleTemplateRestDay = toggleTemplateRestDay;


// ========= Bouton "Modifier" (⋯) dans le header du modal détail =========
// Route selon kind : comp → édition compé, training → édition entraînement, template → matérialiser
appState._modalEditBtn = document.getElementById('modal-edit-btn');

if (appState._modalEditBtn) {
  appState._modalEditBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    const kind = appState._modalEditBtn.dataset.kind;
    if (kind === 'comp') {
      const compId = appState._modalEditBtn.dataset.compId;
      if (!compId) return;
      const comp = loadCompetitions().find(c => c.id === compId);
      if (!comp) return;
      closeSessionModal();
      openCompModalForEdit(comp);
    } else if (kind === 'training') {
      const id = appState._modalEditBtn.dataset.trainingId;
      const mode = appState._modalEditBtn.dataset.trainingMode || 'prevu';
      if (!id) return;
      closeSessionModal();
      if (typeof window.gpxEditTraining === 'function') window.gpxEditTraining(id, mode);
    } else if (kind === 'strava-edit') {
      const aid = appState._modalEditBtn.dataset.activityId;
      const iso = appState._modalEditBtn.dataset.iso;
      closeSessionModal();
      openActivityEditModal(aid, iso);
    } else if (kind === 'template') {
      // Matérialise la suggestion IA en entraînement manuel prévu modifiable
      const isoT = appState._modalEditBtn.dataset.templateIso;
      let payload = {};
      try { payload = JSON.parse(appState._modalEditBtn.dataset.templateData || '{}'); } catch {}
      closeSessionModal();
      if (typeof openTrainModal === 'function') {
        openTrainModal('prevu');
        // Préremplit les champs (Date + valeurs du template)
        const setVal = (id, v) => { const el = document.getElementById(id); if (el && v != null) el.value = v; };
        setVal('train-modal-name', payload.name);
        setVal('train-modal-date', isoT);
        const dateEl = document.getElementById('train-modal-date');
        if (dateEl && dateEl._flatpickr && isoT) dateEl._flatpickr.setDate(isoT, false);
        setVal('train-modal-duration', payload.duration != null ? window.__fmtDurField(payload.duration) : null);
        setVal('train-modal-tss', payload.tss);
        setVal('train-modal-notes', payload.notes);
        const sportEl = document.getElementById('train-modal-sport');
        if (sportEl && payload.sport) { sportEl.value = payload.sport; if (sportEl._customUpdate) sportEl._customUpdate(); }
        const typeEl = document.getElementById('train-modal-type');
        if (typeEl && payload.type) { typeEl.value = payload.type; if (typeEl._customUpdate) typeEl._customUpdate(); }
      }
    }
  });
}


// ========= Bouton "Supprimer" (🗑️) dans le header du modal détail =========
appState._modalDelBtn = document.getElementById('modal-delete-btn');

if (appState._modalDelBtn) {
  appState._modalDelBtn.addEventListener('click', async (e) => {
    e.stopPropagation();
    const kind = appState._modalDelBtn.dataset.kind;
    if (kind === 'comp') {
      const compId = appState._modalDelBtn.dataset.compId;
      if (!compId) return;
      const comp = loadCompetitions().find(c => c.id === compId);
      const name = comp ? comp.name : 'cette compétition';
      const ok = await appConfirm({
        title: 'Supprimer cette compétition',
        html: `Supprimer <strong>${window._confirmEscape(name)}</strong> ?`,
        confirmLabel: 'Supprimer',
        danger: true,
      });
      if (!ok) return;
      const remaining = loadCompetitions().filter(c => c.id !== compId);
      saveCompetitions(remaining);
      if (comp) removeCompFromDashboard(comp);
      closeSessionModal();
      if (typeof window.__applyOverridesAndRerender === 'function') window.__applyOverridesAndRerender();
      else if (typeof renderCalendar === 'function') renderCalendar();
      if (typeof renderCompetitionsPage === 'function') renderCompetitionsPage();
    } else if (kind === 'training') {
      const id = appState._modalDelBtn.dataset.trainingId;
      const mode = appState._modalDelBtn.dataset.trainingMode || 'prevu';
      const sbId = appState._modalDelBtn.dataset.sbId || '';
      if (!id && !sbId) return;
      if (typeof window.gpxDeleteTraining === 'function') window.gpxDeleteTraining(id, mode, sbId);
    } else if (kind === 'strava') {
      const aid = appState._modalDelBtn.dataset.activityId;
      if (!aid) return;
      const ok = await appConfirm({
        title: 'Masquer cette activité',
        message: 'Masquer cette activité Strava du calendrier ?\n\nElle reste sur Strava, c\'est juste un filtre local.',
        confirmLabel: 'Masquer',
        danger: true,
      });
      if (!ok) return;
      addStravaIgnored(aid);
      closeSessionModal();
      if (typeof renderCalendar === 'function') renderCalendar();
    } else if (kind === 'template') {
      const isoT = appState._modalDelBtn.dataset.templateIso;
      if (!isoT) return;
      const ok = await appConfirm({
        title: 'Marquer ce jour comme repos',
        message: 'Ignorer la suggestion IA et marquer ce jour comme repos ?',
        confirmLabel: 'Marquer en repos',
        danger: true,
      });
      if (!ok) return;
      addTemplateRestDay(isoT);
      closeSessionModal();
      if (typeof renderCalendar === 'function') renderCalendar();
    }
  });
}


// Handler suppression compé depuis la modal d'édition
appState._compModalDelBtn = document.getElementById('comp-modal-delete');

if (appState._compModalDelBtn) {
  appState._compModalDelBtn.addEventListener('click', async () => {
    const id = window._editingCompId;
    if (!id) return;
    const comp = (typeof loadCompetitions === 'function') ? loadCompetitions().find(c => c.id === id) : null;
    const name = comp ? comp.name : 'cette compétition';
    const ok = await appConfirm({
      title: 'Supprimer cette compétition',
      html: `Supprimer <strong>${window._confirmEscape(name)}</strong> ? Cette action est irréversible.`,
      confirmLabel: 'Supprimer',
      danger: true,
    });
    if (!ok) return;
    const remaining = loadCompetitions().filter(c => c.id !== id);
    saveCompetitions(remaining);
    window._editingCompId = null;
    if (typeof closeCompModal === 'function') closeCompModal();
    if (typeof renderCompList === 'function') renderCompList();
    if (typeof renderCalendar === 'function') renderCalendar();
  });
}

document.getElementById('session-modal').addEventListener('click', (e) => {
  if (e.target.id === 'session-modal') closeSessionModal();
});

document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') closeSessionModal();
});


// Handlers des sous-onglets
document.querySelectorAll('#calendar-subtabs .subtab').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('#calendar-subtabs .subtab').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    appState.calendarMode = btn.dataset.mode;
    // Reset selectedMonth mais on garde le mois courant affiché dans l'input
    appState.selectedMonth = null;
    appState.calendarAnchorDate = null;
    document.getElementById('month-input').value = `${appState.today.getFullYear()}-${(appState.today.getMonth()+1).toString().padStart(2,'0')}`;
    renderCalendar();
  });
});


// Handlers du filtre mois
appState.monthInput = document.getElementById('month-input');

// Pré-remplit avec le mois courant à l'init (sans changer selectedMonth = vue par défaut)
appState.monthInput.value = `${appState.today.getFullYear()}-${(appState.today.getMonth()+1).toString().padStart(2,'0')}`;


// Overlay "4 sem" : en vue 4 dernières semaines (selectedMonth null), on masque le mois
// affiché par l'input natif et on superpose "4 sem" pour ne pas tromper l'utilisateur.
(function setupMonthOverlay() {
  const wrap = document.createElement('span');
  wrap.className = 'month-input-wrap';
  appState.monthInput.parentNode.insertBefore(wrap, appState.monthInput);
  wrap.appendChild(appState.monthInput);
  const overlay = document.createElement('span');
  overlay.className = 'month-input-overlay';
  overlay.textContent = '4 sem';
  wrap.appendChild(overlay);
  window.__updateMonthOverlay = function () {
    const fourWeek = (appState.selectedMonth === null);
    overlay.style.display = fourWeek ? '' : 'none';
    appState.monthInput.classList.toggle('hide-value', fourWeek);
  };
  window.__updateMonthOverlay();
})();

document.getElementById('month-prev').addEventListener('click', () => {
  appState.calendarAnchorDate = null;
  const base = appState.selectedMonth || new Date(appState.today.getFullYear(), appState.today.getMonth(), 1);
  appState.selectedMonth = new Date(base.getFullYear(), base.getMonth() - 1, 1);
  appState.monthInput.value = `${appState.selectedMonth.getFullYear()}-${(appState.selectedMonth.getMonth()+1).toString().padStart(2,'0')}`;
  renderCalendar();
});

document.getElementById('month-next').addEventListener('click', () => {
  appState.calendarAnchorDate = null;
  if (appState.selectedMonth === null) {
    // Depuis la vue "4 sem" : le clic → affiche le mois en cours (pas le mois suivant)
    appState.selectedMonth = new Date(appState.today.getFullYear(), appState.today.getMonth(), 1);
  } else {
    appState.selectedMonth = new Date(appState.selectedMonth.getFullYear(), appState.selectedMonth.getMonth() + 1, 1);
  }
  appState.monthInput.value = `${appState.selectedMonth.getFullYear()}-${(appState.selectedMonth.getMonth()+1).toString().padStart(2,'0')}`;
  renderCalendar();
});

appState.monthInput.addEventListener('change', () => {
  appState.calendarAnchorDate = null;
  if (!appState.monthInput.value) {
    appState.selectedMonth = null;
  } else {
    const [y, m] = appState.monthInput.value.split('-').map(Number);
    appState.selectedMonth = new Date(y, m - 1, 1);
  }
  renderCalendar();
});

document.getElementById('month-reset').addEventListener('click', () => {
  appState.selectedMonth = null;
  appState.calendarAnchorDate = null;
  // Garde le mois courant affiché visuellement (au lieu de tout vider)
  appState.monthInput.value = `${appState.today.getFullYear()}-${(appState.today.getMonth()+1).toString().padStart(2,'0')}`;
  renderCalendar();
});
}
