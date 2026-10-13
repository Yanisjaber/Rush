/* src/features/training/train-modal.js — extrait de l'ancien app.js (découpage par fonctionnalité). */
import { appState } from '../../core/state.js';
import { initFlatpickrAll, populateSportSelect } from '../competitions/comp-modal-ui.js';
import { _clearAllFieldErrors, _markFieldError, adaptTrainSportForm, fmtPaceSec, readDistAsKm } from '../competitions/comp-form.js';
import { renderCalendar } from '../calendar/realise-calendar.js';
import { getSportCategory } from '../dashboard/filters.js';
import { saveTemplateFromTrainModal } from './template-modal.js';


// ========= MODAL D'AJOUT D'ENTRAÎNEMENT =========
const TRAIN_KEY = 'coach_ia_trainings_v1';

export function loadTrainings() {
  try {
    const raw = localStorage.getItem(TRAIN_KEY);
    if (!raw) return [];
    return JSON.parse(raw).filter(t => t.date && t.name);
  } catch (e) { return []; }
}

export function saveTrainings(arr) {
  let prev = [];
  try { prev = JSON.parse(localStorage.getItem(TRAIN_KEY) || '[]'); } catch {}
  const ids = new Set(arr.map(t => t.id));
  const deleted = prev.filter(p => !ids.has(p.id));
  localStorage.setItem(TRAIN_KEY, JSON.stringify(arr));
  // La projection de la courbe de charge dépend des prévus → refresh
  if (window.refreshLoadChart) window.refreshLoadChart();
  if (window.cloudSync) {
    for (const t of arr) {
      window.cloudSync.pushTraining(t, 'prevu').then(sbId => {
        if (sbId && !t._sbId) {
          t._sbId = sbId;
          try {
            const cur = JSON.parse(localStorage.getItem(TRAIN_KEY) || '[]');
            const idx = cur.findIndex(x => x.id === t.id);
            if (idx >= 0) { cur[idx]._sbId = sbId; localStorage.setItem(TRAIN_KEY, JSON.stringify(cur)); }
          } catch {}
        }
      });
    }
    for (const d of deleted) window.cloudSync.deleteTraining(d);
  }
}

const TRAIN_REALISE_KEY = 'coach_ia_trainings_realise_v1';

export function loadRealisedTrainings() {
  try {
    const raw = localStorage.getItem(TRAIN_REALISE_KEY);
    if (!raw) return [];
    return JSON.parse(raw).filter(t => t.date && t.name);
  } catch (e) { return []; }
}

export function saveRealisedTrainings(arr) {
  let prev = [];
  try { prev = JSON.parse(localStorage.getItem(TRAIN_REALISE_KEY) || '[]'); } catch {}
  const ids = new Set(arr.map(t => t.id));
  const deleted = prev.filter(p => !ids.has(p.id));
  localStorage.setItem(TRAIN_REALISE_KEY, JSON.stringify(arr));
  if (window.cloudSync) {
    for (const t of arr) {
      window.cloudSync.pushTraining(t, 'realise').then(sbId => {
        if (sbId && !t._sbId) {
          t._sbId = sbId;
          try {
            const cur = JSON.parse(localStorage.getItem(TRAIN_REALISE_KEY) || '[]');
            const idx = cur.findIndex(x => x.id === t.id);
            if (idx >= 0) { cur[idx]._sbId = sbId; localStorage.setItem(TRAIN_REALISE_KEY, JSON.stringify(cur)); }
          } catch {}
        }
      });
    }
    for (const d of deleted) window.cloudSync.deleteTraining(d);
  }
}


export function openTrainModal(mode) {
  const modal = document.getElementById('train-modal');
  if (!modal) return;
  appState.trainModalMode = (mode === 'realise') ? 'realise' : 'prevu';
  window._trainModalMode = appState.trainModalMode;
  initFlatpickrAll(); // au cas où
  if (typeof _clearAllFieldErrors === 'function') _clearAllFieldErrors('#train-modal');
  // Reset mode édition par défaut (sera ré-activé par openTrainModalForEdit)
  window._editingTrainId = null;
  window._editingTrainMode = null;
  // Sortie du mode "modèle bibliothèque" : réaffiche date/heure/GPX masqués
  window._templateMode = false;
  window._templateEditing = null;
  { const _alb = document.getElementById('train-modal-addlib'); if (_alb) _alb.hidden = false; }
  { const _tc = document.getElementById('train-modal-tocomp'); if (_tc) _tc.hidden = true; } // visible seulement en édition prévu
  ['train-modal-date', 'train-modal-time'].forEach(id => {
    const el = document.getElementById(id);
    const lab = el && el.closest('label');
    if (lab) lab.style.display = '';
  });
  { const g = document.getElementById('train-modal-gpx'); const wrap = g && g.closest('.form-field'); if (wrap) wrap.style.display = ''; }
  const titleEl = document.getElementById('train-modal-title');
  if (titleEl) titleEl.textContent = (appState.trainModalMode === 'realise')
    ? 'Ajouter un entraînement réalisé'
    : 'Ajouter un entraînement prévu';
  const _rpeLab = document.getElementById('train-modal-rpe-label');
  if (_rpeLab) _rpeLab.textContent = (appState.trainModalMode === 'realise') ? 'RPE ressenti (1-10)' : 'RPE estimé (1-10)';
  const saveBtn = document.getElementById('train-modal-save');
  if (saveBtn) saveBtn.textContent = 'Enregistrer';
  // Poubelle cachée par défaut (visible seulement en édition)
  const delBtn = document.getElementById('train-modal-delete');
  if (delBtn) delBtn.hidden = true;
  ['train-tri-swim', 'train-tri-bike', 'train-tri-run'].forEach(id => { const e = document.getElementById(id); if (e) e.value = ''; });
  ['name','date','time','duration','tss','notes','rpe','km','dplus','speed'].forEach(k => {
    const el = document.getElementById('train-modal-' + k);
    if (el) el.value = '';
  });
  { const _c = document.getElementById('train-modal-act-controls'); if (_c) _c.hidden = true; }
  { const _tb = document.getElementById('train-modal-transform'); if (_tb) _tb.hidden = true; }
  if (window.resetTrainGpx) window.resetTrainGpx();
  // Reset structure (mode création)
  if (typeof window.resetWorkoutStructure === 'function') window.resetWorkoutStructure();
  if (typeof populateSportSelect === 'function') populateSportSelect('train-modal-sport', 'Ride');
  const s = document.getElementById('train-modal-sport');
  if (s) s.value = 'Ride';
  if (s && s._customUpdate) s._customUpdate();
  if (typeof adaptTrainSportForm === 'function') adaptTrainSportForm();
  // Date par défaut : aujourd'hui pour réalisé, demain pour prévu
  const dateInput = document.getElementById('train-modal-date');
  if (dateInput) {
    const d = new Date();
    if (appState.trainModalMode === 'prevu') d.setDate(d.getDate() + 1);
    const iso = d.toISOString().slice(0, 10);
    dateInput.value = iso;
    if (dateInput._flatpickr) dateInput._flatpickr.setDate(d, false);
  }
  modal.classList.add('active');
}

export function closeTrainModal() {
  const modal = document.getElementById('train-modal');
  if (modal) modal.classList.remove('active');
}

// Ouvre la modal entraînement en mode édition (pré-remplie)
export function openTrainModalForEdit(training, mode) {
  if (!training || typeof openTrainModal !== 'function') return;
  openTrainModal(mode);
  window._editingTrainId = training.id;
  window._editingTrainMode = mode;
  { const _tc = document.getElementById('train-modal-tocomp'); if (_tc) _tc.hidden = mode !== 'prevu'; }
  appState.trainModalMode = mode;
  document.getElementById('train-modal-name').value = training.name || '';
  document.getElementById('train-modal-date').value = training.date || '';
  { const _tt = document.getElementById('train-modal-time'); if (_tt) _tt.value = training.time || ''; }
  if (document.getElementById('train-modal-date')._flatpickr && training.date) {
    document.getElementById('train-modal-date')._flatpickr.setDate(training.date, false);
  }
  if (training.sport) {
    const s = document.getElementById('train-modal-sport');
    if (s) { s.value = training.sport; if (s._customUpdate) s._customUpdate(); }
  }
  if (training.type) {
    const t = document.getElementById('train-modal-type');
    if (t) { t.value = training.type; if (t._customUpdate) t._customUpdate(); }
  }
  document.getElementById('train-modal-duration').value = training.duration != null ? window.__fmtDurField(training.duration) : '';
  document.getElementById('train-modal-tss').value = training.tss != null ? training.tss : '';
  document.getElementById('train-modal-notes').value = training.notes || '';
  document.getElementById('train-modal-rpe').value = training.rpe != null ? training.rpe : '';
  document.getElementById('train-modal-km').value = training.km != null ? training.km : '';
  document.getElementById('train-modal-dplus').value = training.dplus != null ? training.dplus : '';
  {
    const t = training.tri || {};
    const setV = (id, v) => { const e = document.getElementById(id); if (e) e.value = (v != null ? v : ''); };
    setV('train-tri-swim', t.swim_m); setV('train-tri-bike', t.bike_km); setV('train-tri-run', t.run_km);
  }
  if (window.setTrainGpx) window.setTrainGpx(training.gpxName || null, training.gpxContent || null);
  // Charger la structure si présente (mode édition)
  if (typeof window.setWorkoutStructure === 'function') {
    window.setWorkoutStructure(training.structure || []);
  }
  // Adapte le formulaire au sport (convertit l'affichage km->m si natation)
  if (typeof adaptTrainSportForm === 'function') adaptTrainSportForm();
  // Vitesse/allure : la structure fait foi si elle existe (est.pace stocké ou
  // resynchronisé par fillFields) ; sinon recalcul depuis durée + distance
  {
    const sp = document.getElementById('train-modal-speed');
    const _hasPaceStruct = Array.isArray(training.structure) && training.structure.length
      && window._trainSpeedMode && window._trainSpeedMode !== 'speed';
    if (sp && !_hasPaceStruct) {
      const m = window._trainSpeedMode || 'speed';
      let v = '';
      // valeur STOCKÉE d'abord (est_speed canonique en km/h, convertie ici)
      if (+training.estSpeed > 0) {
        if (m === 'speed') v = +(+training.estSpeed).toFixed(1);
        else v = fmtPaceSec((m === 'pace_100m' ? 360 : 3600) / +training.estSpeed);
      } else {
        const mins = +training.duration || 0, km2 = +training.km || 0;
        if (mins > 0 && km2 > 0) {
          if (m === 'speed') v = +(km2 / (mins / 60)).toFixed(1);
          else if (m === 'pace_km') v = fmtPaceSec(mins * 60 / km2);
          else v = fmtPaceSec(mins * 60 / (km2 * 10));
        }
      }
      sp.value = v;
      if (v) sp.dataset.auto = '1';
    } else if (sp && _hasPaceStruct && +training.estSpeed > 0) {
      sp.value = fmtPaceSec(((window._trainSpeedMode === 'pace_100m') ? 360 : 3600) / +training.estSpeed);
    }
  }
  // Controles "activite" (mode realise edite) : exclusions records + transformer en compet
  {
    const _ctrls = document.getElementById('train-modal-act-controls');
    if (_ctrls) {
      if (mode === 'realise' && training._sbId) {
        _ctrls.hidden = false;
        { const _tb = document.getElementById('train-modal-transform'); if (_tb) _tb.hidden = false; }
        window._trainEditActId = String(training._sbId);
        window._trainEditIso = training.date;
        const _set = (m, on) => { const b = _ctrls.querySelector('.ae-metric-btn[data-m="' + m + '"]'); if (b) b.classList.toggle('active', !!on); };
        _set('power', training.exclPower); _set('hr', training.exclHr); _set('dist', training.exclDistance);
      } else {
        _ctrls.hidden = true;
        window._trainEditActId = null;
      }
    }
  }
  // Adapter titre + bouton + affiche poubelle
  const titleEl = document.getElementById('train-modal-title');
  if (titleEl) titleEl.textContent = (mode === 'realise')
    ? 'Modifier l\'entraînement réalisé'
    : 'Modifier l\'entraînement prévu';
  const saveBtn = document.getElementById('train-modal-save');
  if (saveBtn) saveBtn.textContent = 'Enregistrer les modifications';
  const delBtn = document.getElementById('train-modal-delete');
  if (delBtn) delBtn.hidden = false;
}


// Met a jour DASHBOARD_DATA (source d'affichage) avec une seance manuelle realisee,
// pour qu'une creation/edition apparaisse IMMEDIATEMENT sans attendre un re-pull cloud.
function upsertManualInDashboard(entry) {
  if (!window.DASHBOARD_DATA || !Array.isArray(window.DASHBOARD_DATA.days) || !entry || !entry.date) return;
  const iso = entry.date;
  const row = {
    id: entry._sbId || ('local-' + entry.id),
    _sbId: entry._sbId || null,
    source: 'manual', _manual: true, _manualId: entry.id,
    category: 'entrainement', client_id: entry.id,
    notes: entry.notes || '', name: entry.name,
    sport: entry.sportCategory || entry.sport, raw_type: entry.sport,
    tss: entry.tss || 0, duration: entry.duration || 0,
    moving_time: (entry.duration || 0) * 60,
    start_date_local: iso + 'T' + (entry.time || '12:00') + ':00',
    distance_km: entry.km || null, elevation_gain: entry.dplus || null,
    rpe: (entry.rpe != null ? entry.rpe : null),
    laps: (entry.laps != null ? entry.laps : null),
    structure: entry.structure || null,
    type: entry.type || '',
    _exclPower: !!entry.exclPower, _exclHr: !!entry.exclHr, _exclDistance: !!entry.exclDistance,
  };
  let day = window.DASHBOARD_DATA.days.find(d => String(d.date) === iso);
  if (!day) { day = { date: iso, activities: [] }; window.DASHBOARD_DATA.days.push(day); }
  if (!Array.isArray(day.activities)) day.activities = [];
  day.activities = day.activities.filter(x => !(
    (entry._sbId && String(x._sbId) === String(entry._sbId)) ||
    (String(x.client_id) === String(entry.id))
  ));
  day.activities.push(row);
}


export function saveTrainFromModal() {
  // Mode "modèle bibliothèque" : on enregistre un template, pas un entraînement
  if (window._templateMode) { saveTemplateFromTrainModal(); return; }
  if (typeof _clearAllFieldErrors === 'function') _clearAllFieldErrors('#train-modal');
  const name = document.getElementById('train-modal-name').value.trim();
  const date = document.getElementById('train-modal-date').value;
  if (!name || !date) {
    if (typeof _markFieldError === 'function') {
      if (!name) _markFieldError('train-modal-name', 'Champ requis');
      if (!date) _markFieldError('train-modal-date', 'Champ requis');
      const first = document.querySelector('#train-modal .field-error');
      if (first) first.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
    return;
  }
  const time = (document.getElementById('train-modal-time') || {}).value || '';
  const sport = document.getElementById('train-modal-sport').value;
  const type = (document.getElementById('train-modal-type') || {}).value || '';
  const duration = Math.round(window.__parseDurField(document.getElementById('train-modal-duration').value) || 0);
  const tss = parseInt(document.getElementById('train-modal-tss').value, 10) || 0;
  const notes = document.getElementById('train-modal-notes').value.trim();
  const rpe = parseFloat(document.getElementById('train-modal-rpe').value) || null;
  let km = (typeof readDistAsKm === 'function') ? readDistAsKm('train-modal-km') : (parseFloat(document.getElementById('train-modal-km').value) || null);
  let tri = null;
  {
    const triRow = document.getElementById('train-tri-fields');
    if (triRow && !triRow.hidden) {
      const swim = parseFloat(document.getElementById('train-tri-swim').value) || null;
      const bike = parseFloat(document.getElementById('train-tri-bike').value) || null;
      const run = parseFloat(document.getElementById('train-tri-run').value) || null;
      if (swim || bike || run) {
        tri = { swim_m: swim, bike_km: bike, run_km: run };
        km = +(((swim || 0) / 1000) + (bike || 0) + (run || 0)).toFixed(1) || null;
      }
    }
  }
  const dplus = parseInt(document.getElementById('train-modal-dplus').value, 10) || null;
  const laps = null; // champ 'nombre de tours' retire des entrainements (garde pour les competitions)
  const _gpx = (window.getTrainGpx ? window.getTrainGpx() : { name: null, content: null });
  const editingId = window._editingTrainId;
  // Structure (intervalles) si activée dans la modal — null sinon
  const structure = (typeof window.getCurrentWorkoutStructure === 'function')
    ? window.getCurrentWorkoutStructure()
    : null;
  const _ac = document.getElementById('train-modal-act-controls');
  const _exclOn = (mm) => !!(_ac && !_ac.hidden && _ac.querySelector('.ae-metric-btn[data-m="' + mm + '"].active'));
  const exclPower = _exclOn('power'), exclHr = _exclOn('hr'), exclDistance = _exclOn('dist');
  // Structure = source de vérité : TOUT ce qui en découle est dérivé ICI,
  // au save, par StructEd.summary, puis stocké en base (une colonne chacun).
  let sm = null;
  if (Array.isArray(structure) && structure.length && window.StructEd && window.StructEd.summary) {
    try { sm = window.StructEd.summary(structure, sport); } catch (e) { sm = null; }
  }
  // Vitesse/allure UNIFIÉE : une seule valeur canonique en km/h (est_speed).
  // Priorité : structure (sm.speedKmh) > champ saisi > temps÷distance.
  const _cat = getSportCategory(sport);
  const _spdField = String((document.getElementById('train-modal-speed') || {}).value || '').trim();
  let estSpeed = (sm && sm.speedKmh) ? sm.speedKmh : null;
  if (estSpeed == null) {
    if (_cat === 'course' || _cat === 'natation') {
      const mm = _spdField.match(/^(\d{1,2}):(\d{2})$/);
      if (mm) { const sec = (+mm[1]) * 60 + (+mm[2]); estSpeed = Math.round(((_cat === 'natation' ? 360 : 3600) / sec) * 100) / 100; }
    } else {
      estSpeed = parseFloat(_spdField.replace(',', '.')) || null;
    }
    if (estSpeed == null && km > 0 && duration > 0) estSpeed = Math.round(km / (duration / 60) * 100) / 100;
  }
  const entry = {
    id: editingId || Date.now().toString(),
    name, date, time, sport, type, notes,
    duration: sm ? sm.durMin : duration,
    tss: sm ? sm.tss : tss,
    estWatts: sm ? sm.w : null,
    estBpm: sm ? sm.bpm : null,
    estSpeed,
    estKj: sm ? sm.kj : null,
    estIf: sm ? sm.ifr : null,
    rpe, km: (sm && sm.km != null) ? sm.km : km,
    dplus, laps, tri, gpxName: _gpx.name, gpxContent: _gpx.content,
    exclPower, exclHr, exclDistance,
    sportCategory: (typeof getSportCategory === 'function' ? getSportCategory(sport) : sport),
    mode: appState.trainModalMode,
    structure, // [] | null | [{dur, target, reps}, ...]
  };

  const loadFn = appState.trainModalMode === 'realise' ? loadRealisedTrainings : loadTrainings;
  const saveFn = appState.trainModalMode === 'realise' ? saveRealisedTrainings : saveTrainings;
  const arr = loadFn();
  if (editingId) {
    // Mode édition : remplace l'entry existante en conservant l'id Supabase
    const idx = arr.findIndex(t => t.id === editingId);
    if (idx >= 0) {
      if (arr[idx]._sbId) entry._sbId = arr[idx]._sbId; // sinon le push crée un doublon
      arr[idx] = entry;
    } else {
      arr.push(entry);
    }
  } else {
    arr.push(entry);
  }
  saveFn(arr);
  window._editingTrainId = null;
  window._editingTrainMode = null;
  closeTrainModal();
  if (appState.trainModalMode === 'realise') {
    upsertManualInDashboard(entry);
    if (typeof window.__applyOverridesAndRerender === 'function') window.__applyOverridesAndRerender();
    else renderCalendar();
  } else {
    renderCalendar();
  }
}

export function bootTrainModal() {


// État local : mode d'ouverture de la modal entraînement ('prevu' ou 'realise')
appState.trainModalMode = 'prevu';


// Handler suppression entraînement depuis la modal d'édition
appState._trainModalDelBtn = document.getElementById('train-modal-delete');

if (appState._trainModalDelBtn) {
  appState._trainModalDelBtn.addEventListener('click', async () => {
    // Mode "modèle bibliothèque" : suppression du template
    if (window._templateMode) {
      const tpl = window._templateEditing;
      if (!tpl) return;
      const ok = await appConfirm({
        title: 'Supprimer cette séance',
        html: `Supprimer <strong>${window._confirmEscape(tpl.name || 'cette séance')}</strong> de la bibliothèque ?`,
        confirmLabel: 'Supprimer',
        danger: true,
      });
      if (!ok) return;
      if (window.libraryDeleteTemplate) window.libraryDeleteTemplate(tpl.id);
      window._templateMode = false;
      window._templateEditing = null;
      closeTrainModal();
      return;
    }
    const id = window._editingTrainId;
    const mode = window._editingTrainMode || appState.trainModalMode;
    if (!id) return;
    const arr = mode === 'realise' ? loadRealisedTrainings() : loadTrainings();
    const t = arr.find(x => x.id === id);
    const name = t ? t.name : 'cet entraînement';
    const ok = await appConfirm({
      title: 'Supprimer cet entraînement',
      html: `Supprimer <strong>${window._confirmEscape(name)}</strong> ?`,
      confirmLabel: 'Supprimer',
      danger: true,
    });
    if (!ok) return;
    const remaining = arr.filter(x => x.id !== id);
    if (mode === 'realise') saveRealisedTrainings(remaining);
    else saveTrainings(remaining);
    window._editingTrainId = null;
    window._editingTrainMode = null;
    closeTrainModal();
    if (typeof renderCalendar === 'function') renderCalendar();
  });
}
}
