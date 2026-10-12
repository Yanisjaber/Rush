/* src/features/training/template-modal.js — extrait de l'ancien app.js (découpage par fonctionnalité). */
import { appState } from '../../core/state.js';
import { closeTrainModal, loadRealisedTrainings, loadTrainings, openTrainModal, openTrainModalForEdit, saveRealisedTrainings, saveTrainFromModal, saveTrainings } from './train-modal.js';
import { getSportCategory, toIsoDate } from '../dashboard/filters.js';
import { _clearAllFieldErrors, _markFieldError, adaptTrainSportForm, closeCompModal, readDistAsKm } from '../competitions/comp-form.js';
import { loadCompetitions, renderCompList, renderCompetitionsPage, saveCompetitions } from '../competitions/competitions-page.js';
import { renderCalendar } from '../calendar/realise-calendar.js';
import { closeSessionModal } from '../sessions/session-modal.js';
import { setActivityCategory } from '../sessions/activity-edit.js';


// ============================================================
// Bibliothèque de séances : le modal de création/édition d'un MODÈLE réutilise
// le train-modal (même design + structure d'intervalles), sans date/heure/GPX.
// ============================================================
// Mapping clé bibliothèque -> sport Strava représentatif (pour le select)
const LIB_KEY_TO_RAW = { triathlon: 'Triathlon', cyclisme: 'Ride', vtt: 'MountainBikeRide', course: 'Run', trail: 'TrailRun', natation: 'Swim', musculation: 'WeightTraining', autre: 'Workout' };

// Mapping inverse : sport Strava -> clé de regroupement bibliothèque
function rawToLibKey(rawType) {
  if (rawType === 'MountainBikeRide' || rawType === 'EMountainBikeRide') return 'vtt';
  if (rawType === 'TrailRun') return 'trail';
  const cat = (typeof getSportCategory === 'function') ? getSportCategory(rawType) : 'autre';
  return ['cyclisme', 'course', 'natation', 'musculation', 'triathlon'].includes(cat) ? cat : 'autre';
}


// « + Bibliothèque » : enregistre la séance de la modal comme modèle,
// AVEC km / D+ / RPE (que l'éditeur de structure ne connaissait pas).
function addTrainModalToLibrary() {
  const name = document.getElementById('train-modal-name').value.trim();
  if (!name) { if (typeof _markFieldError === 'function') _markFieldError('train-modal-name', 'Nomme la séance d\'abord'); return; }
  const rawSport = document.getElementById('train-modal-sport').value || 'Ride';
  const structure = (typeof window.getCurrentWorkoutStructure === 'function') ? window.getCurrentWorkoutStructure() : null;
  let sm = null;
  if (Array.isArray(structure) && structure.length && window.StructEd && window.StructEd.summary) {
    try { sm = window.StructEd.summary(structure, rawSport); } catch (e) { sm = null; }
  }
  const kmField = (typeof readDistAsKm === 'function') ? readDistAsKm('train-modal-km') : (parseFloat(document.getElementById('train-modal-km').value) || null);
  const entry = {
    id: Date.now().toString() + Math.random().toString(36).slice(2, 5),
    sort_order: 0,
    sport: rawToLibKey(rawSport),
    sport_raw: rawSport,
    name,
    duration_min: sm ? sm.durMin : Math.round(window.__parseDurField(document.getElementById('train-modal-duration').value) || 0),
    tss: sm ? sm.tss : (parseInt(document.getElementById('train-modal-tss').value, 10) || 0),
    estWatts: sm ? sm.w : null,
    estBpm: sm ? sm.bpm : null,
    estSpeed: sm ? sm.speedKmh : null,
    estKj: sm ? sm.kj : null,
    estIf: sm ? sm.ifr : null,
    description: document.getElementById('train-modal-notes').value.trim(),
    rpe: parseFloat(document.getElementById('train-modal-rpe').value) || null,
    km: (sm && sm.km != null) ? sm.km : kmField,
    dplus: parseInt(document.getElementById('train-modal-dplus').value, 10) || null,
    structure: (structure && structure.length) ? structure : null,
  };
  if (window.libraryUpsertTemplate) window.libraryUpsertTemplate(entry);
  const btn = document.getElementById('train-modal-addlib');
  if (btn) { btn.textContent = 'Ajoutée ✓'; btn.disabled = true; setTimeout(() => { btn.textContent = '+ Bibliothèque'; btn.disabled = false; }, 2200); }
}

export function saveTemplateFromTrainModal() {
  if (typeof _clearAllFieldErrors === 'function') _clearAllFieldErrors('#train-modal');
  const name = document.getElementById('train-modal-name').value.trim();
  if (!name) {
    if (typeof _markFieldError === 'function') _markFieldError('train-modal-name', 'Champ requis');
    return;
  }
  const rawSport = document.getElementById('train-modal-sport').value || 'Ride';
  const prev = window._templateEditing;
  const structure = (typeof window.getCurrentWorkoutStructure === 'function') ? window.getCurrentWorkoutStructure() : null;
  // Structure = source de vérité (mêmes dérivations que le save d'une séance)
  let sm = null;
  if (Array.isArray(structure) && structure.length && window.StructEd && window.StructEd.summary) {
    try { sm = window.StructEd.summary(structure, rawSport); } catch (e) { sm = null; }
  }
  const entry = {
    id: (prev && prev.id) || (Date.now().toString() + Math.random().toString(36).slice(2, 5)),
    _sbId: (prev && prev._sbId) || undefined,
    sort_order: (prev && prev.sort_order) || 0,
    sport: rawToLibKey(rawSport),      // clé de regroupement bibliothèque
    sport_raw: rawSport,               // sport Strava exact (repris à l'insertion calendrier)
    name,
    duration_min: sm ? sm.durMin : Math.round(window.__parseDurField(document.getElementById('train-modal-duration').value) || 0),
    tss: sm ? sm.tss : (parseInt(document.getElementById('train-modal-tss').value, 10) || 0),
    estWatts: sm ? sm.w : null,
    estBpm: sm ? sm.bpm : null,
    estSpeed: sm ? sm.speedKmh : null,
    estKj: sm ? sm.kj : null,
    estIf: sm ? sm.ifr : null,
    description: document.getElementById('train-modal-notes').value.trim(),
    rpe: parseFloat(document.getElementById('train-modal-rpe').value) || null,
    km: (sm && sm.km != null) ? sm.km : ((typeof readDistAsKm === 'function') ? readDistAsKm('train-modal-km') : (parseFloat(document.getElementById('train-modal-km').value) || null)),
    dplus: parseInt(document.getElementById('train-modal-dplus').value, 10) || null,
    structure: (structure && structure.length) ? structure : null,
  };
  if (window.libraryUpsertTemplate) window.libraryUpsertTemplate(entry);
  window._templateMode = false;
  window._templateEditing = null;
  closeTrainModal();
}


// Helpers globaux pour edit/delete depuis n'importe où
// Reconstruit un objet "entrainement" depuis DASHBOARD_DATA (pour editer une seance
// presente en base mais pas dans le localStorage de ce navigateur).
function buildTrainingFromData(id) {
  if (!Array.isArray(appState.data)) return null;
  for (const d of appState.data) {
    for (const x of (d.activities || [])) {
      if (String(x._manualId) === String(id) || String(x.client_id) === String(id) || String(x.id) === String(id)) {
        return {
          id: x._manualId || x.client_id || x.id,
          _sbId: x._sbId || null,
          name: x.name || '',
          date: (x.start_date_local ? String(x.start_date_local).slice(0, 10) : toIsoDate(d.date)),
          time: (x.start_date_local ? ((String(x.start_date_local).match(/T(\d{2}:\d{2})/) || [])[1] || '') : ''),
          sport: x.raw_type || x.sport || 'Ride',
          type: x.type || '',
          duration: x.duration || 0,
          tss: x.tss || 0,
          notes: x.notes || '',
          km: (x.distance_km != null ? x.distance_km : null),
          dplus: (x.elevation_gain != null ? x.elevation_gain : null),
          rpe: (x.rpe != null ? x.rpe : null),
          laps: (x.laps != null ? x.laps : null),
          structure: x.structure || null,
          exclPower: !!x._exclPower, exclHr: !!x._exclHr, exclDistance: !!x._exclDistance,
          mode: 'realise',
        };
      }
    }
  }
  return null;
}

export function bootTemplateModal() {


window.openLibraryTemplateModal = function (tpl) {
  openTrainModal('prevu');            // reset complet (champs, structure, GPX)
  window._templateMode = true;
  window._templateEditing = tpl || null;
  // mode modèle : « + Bibliothèque » n'a pas de sens (Enregistrer fait le travail)
  { const _alb = document.getElementById('train-modal-addlib'); if (_alb) _alb.hidden = true; }
  // Masque les champs sans objet pour un modèle : date, heure, GPX
  ['train-modal-date', 'train-modal-time'].forEach(id => {
    const el = document.getElementById(id);
    const lab = el && el.closest('label');
    if (lab) lab.style.display = 'none';
  });
  { const g = document.getElementById('train-modal-gpx'); const wrap = g && g.closest('.form-field'); if (wrap) wrap.style.display = 'none'; }
  const titleEl = document.getElementById('train-modal-title');
  if (titleEl) titleEl.textContent = tpl ? 'Modifier la séance (bibliothèque)' : 'Nouvelle séance (bibliothèque)';
  // Pré-remplissage en édition
  if (tpl) {
    document.getElementById('train-modal-name').value = tpl.name || '';
    document.getElementById('train-modal-duration').value = tpl.duration_min ? window.__fmtDurField(tpl.duration_min) : '';
    document.getElementById('train-modal-tss').value = tpl.tss || '';
    document.getElementById('train-modal-notes').value = tpl.description || '';
    document.getElementById('train-modal-rpe').value = tpl.rpe != null ? tpl.rpe : '';
    document.getElementById('train-modal-km').value = tpl.km != null ? tpl.km : '';
    document.getElementById('train-modal-dplus').value = tpl.dplus != null ? tpl.dplus : '';
    const s = document.getElementById('train-modal-sport');
    if (s) { s.value = tpl.sport_raw || LIB_KEY_TO_RAW[tpl.sport] || 'Ride'; if (s._customUpdate) s._customUpdate(); }
    if (typeof window.setWorkoutStructure === 'function') window.setWorkoutStructure(tpl.structure || []);
    if (typeof adaptTrainSportForm === 'function') adaptTrainSportForm();
    const delBtn = document.getElementById('train-modal-delete');
    if (delBtn) delBtn.hidden = false;
  }
  const saveBtn = document.getElementById('train-modal-save');
  if (saveBtn) saveBtn.textContent = tpl ? 'Enregistrer les modifications' : 'Enregistrer';
};


// ===== Conversions prévu : séance <-> compétition (mêmes données, autre catégorie) =====
window.convertPlannedCompToTraining = function (compId) {
  const comp = loadCompetitions().find(c => String(c.id) === String(compId));
  if (!comp) return;
  const entry = {
    id: Date.now().toString() + Math.random().toString(36).slice(2, 5),
    name: comp.name, date: comp.date, time: comp.time || '', sport: comp.sport || 'Ride', type: '',
    duration: comp.target || 0, tss: comp.tss || 0,
    estWatts: null, estBpm: null, estKj: null, estIf: null,
    estSpeed: (comp.km > 0 && comp.target > 0) ? Math.round(comp.km / (comp.target / 60) * 100) / 100 : null,
    notes: comp.notes || '', rpe: comp.rpe ?? null, km: comp.km ?? null, dplus: comp.dplus ?? null,
    laps: null, tri: comp.tri ?? null, gpxName: comp.gpxName || null, gpxContent: comp.gpxContent || null,
    mode: 'prevu', structure: null,
  };
  const arr = loadTrainings(); arr.push(entry); saveTrainings(arr);
  saveCompetitions(loadCompetitions().filter(c => String(c.id) !== String(compId)));
  if (typeof renderCompList === 'function') renderCompList();
  if (typeof renderCompetitionsPage === 'function') renderCompetitionsPage();
  if (typeof renderCalendar === 'function') renderCalendar();
};

window.convertTrainingToComp = function (trainingId) {
  const arr = loadTrainings();
  const t = arr.find(x => String(x.id) === String(trainingId));
  if (!t) return;
  const comp = {
    id: Date.now().toString() + Math.random().toString(36).slice(2, 5),
    name: t.name, date: t.date, time: t.time || null, sport: t.sport || 'Ride',
    priority: 'B', km: t.km ?? null, dplus: t.dplus ?? null,
    target: t.duration || null, tss: t.tss || null, rpe: t.rpe ?? null,
    notes: t.notes || '', laps: t.laps ?? null, tri: t.tri ?? null,
    gpxName: t.gpxName || null, gpxContent: t.gpxContent || null,
  };
  const comps = loadCompetitions(); comps.push(comp); saveCompetitions(comps);
  saveTrainings(arr.filter(x => String(x.id) !== String(trainingId)));
  if (typeof renderCompList === 'function') renderCompList();
  if (typeof renderCompetitionsPage === 'function') renderCompetitionsPage();
  if (typeof renderCalendar === 'function') renderCalendar();
};

{
  const _albBtn = document.getElementById('train-modal-addlib');
  if (_albBtn) _albBtn.addEventListener('click', addTrainModalToLibrary);
  const _tcBtn = document.getElementById('train-modal-tocomp');
  if (_tcBtn) _tcBtn.addEventListener('click', async () => {
    const id = window._editingTrainId;
    if (!id || !window.convertTrainingToComp) return;
    const ok = await (window.appConfirm
      ? window.appConfirm({ title: 'Transformer en compétition', message: 'Cette séance deviendra une compétition (priorité B, modifiable ensuite). Continuer ?', confirmLabel: 'Transformer' })
      : Promise.resolve(window.confirm('Transformer en compétition ?')));
    if (!ok) return;
    closeTrainModal();
    window.convertTrainingToComp(id);
  });
}


// Insertion d'un modèle de la bibliothèque sur un jour (glisser-déposer).
// mode 'prevu' → entraînement prévu ; mode 'realise' → activité manuelle réalisée.
// Les deux passent par le système d'entraînements existant (sync Supabase incluse).
window.coachInsertTemplate = function (iso, tpl, mode, ia) {
  if (!iso || !tpl) return;
  const m = mode === 'realise' ? 'realise' : 'prevu';
  const sport = tpl.sport_raw || tpl.sport || 'cyclisme';
  // Les stats STOCKÉES sur le template sont transférées telles quelles.
  // Fallback summary() uniquement pour les vieux templates sans colonnes est_*.
  const hasEst = tpl.estWatts != null || tpl.estBpm != null || tpl.estSpeed != null || tpl.estKj != null || tpl.estIf != null;
  let sm = null;
  if (!hasEst && Array.isArray(tpl.structure) && tpl.structure.length && window.StructEd && window.StructEd.summary) {
    try { sm = window.StructEd.summary(tpl.structure, sport); } catch (e) { sm = null; }
  }
  const entry = {
    id: Date.now().toString() + Math.random().toString(36).slice(2, 5),
    name: tpl.name || 'Séance',
    date: iso,
    sport,
    type: tpl.type || '',
    duration: hasEst ? (tpl.duration_min || 0) : (sm ? sm.durMin : (tpl.duration_min || 0)),
    tss: hasEst ? (tpl.tss || 0) : (sm ? sm.tss : (tpl.tss || 0)),
    estWatts: hasEst ? (tpl.estWatts ?? null) : (sm ? sm.w : null),
    estBpm: hasEst ? (tpl.estBpm ?? null) : (sm ? sm.bpm : null),
    estSpeed: hasEst ? (tpl.estSpeed ?? null) : (sm ? sm.speedKmh : null),
    estKj: hasEst ? (tpl.estKj ?? null) : (sm ? sm.kj : null),
    estIf: hasEst ? (tpl.estIf ?? null) : (sm ? sm.ifr : null),
    notes: tpl.description || '',
    rpe: (tpl.rpe != null ? tpl.rpe : null),
    km: hasEst ? (tpl.km != null ? tpl.km : null) : ((sm && sm.km != null) ? sm.km : (tpl.km != null ? tpl.km : null)),
    dplus: (tpl.dplus != null ? tpl.dplus : null),
    mode: m,
    structure: tpl.structure || null,
    ia: ia === true,
  };
  const arr = m === 'realise' ? loadRealisedTrainings() : loadTrainings();
  arr.push(entry);
  if (m === 'realise') saveRealisedTrainings(arr); else saveTrainings(arr);
  if (typeof renderCalendar === 'function') renderCalendar();
};

// Sous-mode courant du calendrier (réalisé / prévu) pour le drop.
window.coachCalendarMode = function () {
  const b = document.querySelector('#calendar-subtabs .subtab.active');
  return b && b.dataset.mode === 'realise' ? 'realise' : 'prevu';
};

window.gpxEditTraining = function(id, mode) {
  const arr = mode === 'realise' ? loadRealisedTrainings() : loadTrainings();
  let t = arr.find(x => x.id === id);
  if (!t) t = buildTrainingFromData(id); // pas de copie locale -> reconstruit depuis la base
  if (t && typeof openTrainModalForEdit === 'function') openTrainModalForEdit(t, mode);
};

window.gpxDeleteTraining = async function(id, mode, sbId) {
  const arr = mode === 'realise' ? loadRealisedTrainings() : loadTrainings();
  const t = arr.find(x => x.id === id || (sbId && x._sbId === sbId));
  const name = t ? t.name : 'cette séance';
  const ok = await appConfirm({
    title: 'Supprimer cette séance',
    html: `Supprimer <strong>${window._confirmEscape(name)}</strong> ?`,
    confirmLabel: 'Supprimer',
    danger: true,
  });
  if (!ok) return;
  // localStorage (si la séance y est présente sur ce navigateur)
  if (t) {
    const remaining = arr.filter(x => x !== t);
    if (mode === 'realise') saveRealisedTrainings(remaining);
    else saveTrainings(remaining);
  }
  // Base : supprime la ligne, sinon elle réapparaît au prochain pull cloud.
  const effSbId = (t && t._sbId) || sbId || null;
  if (window.cloudSync && window.cloudSync.deleteTraining) {
    try { await window.cloudSync.deleteTraining({ mode, _sbId: effSbId, id: (t && t.id) || id }); } catch (_) {}
  }
  // Retire l'activité de DASHBOARD_DATA en mémoire pour qu'elle disparaisse IMMÉDIATEMENT
  // (sinon le prochain rebuild la réaffiche jusqu'au refresh).
  if (window.DASHBOARD_DATA && window.DASHBOARD_DATA.days) {
    for (const d of window.DASHBOARD_DATA.days) {
      if (!d.activities) continue;
      d.activities = d.activities.filter(x => !(
        (effSbId && String(x._sbId) === String(effSbId)) ||
        (id && String(x.client_id) === String(id)) ||
        (id && String(x.id) === String(id))
      ));
    }
  }
  if (typeof closeSessionModal === 'function') closeSessionModal();
  if (typeof window.__applyOverridesAndRerender === 'function') window.__applyOverridesAndRerender();
  else if (typeof renderCalendar === 'function') renderCalendar();
};


// Exclusions records/stats de la modale competition : toggle simple
{
  const _ex = document.getElementById('comp-modal-excl');
  if (_ex) _ex.querySelectorAll('.ae-metric-btn').forEach(b => b.addEventListener('click', () => b.classList.toggle('active')));
}

// Cablage (une fois) des controles activite de la modale entrainement.
{
  const _c = document.getElementById('train-modal-act-controls');
  if (_c) _c.querySelectorAll('.ae-metric-btn').forEach(b => b.addEventListener('click', () => b.classList.toggle('active')));
  const _tb = document.getElementById('train-modal-transform');
  if (_tb) _tb.addEventListener('click', async () => {
    const id = window._trainEditActId, iso = window._trainEditIso;
    if (!id) return;
    const act = { _sbId: id, category: 'entrainement',
      name: (document.getElementById('train-modal-name').value || 'Competition'),
      sport: document.getElementById('train-modal-sport').value };
    if (typeof closeTrainModal === 'function') closeTrainModal();
    if (typeof setActivityCategory === 'function') await setActivityCategory(act, 'competition', iso);
  });
}

appState.openTrainBtn = document.getElementById('open-train-modal');

if (appState.openTrainBtn) appState.openTrainBtn.addEventListener('click', () => openTrainModal('prevu'));

appState.openTrainRealiseBtn = document.getElementById('open-train-realise-modal');

if (appState.openTrainRealiseBtn) appState.openTrainRealiseBtn.addEventListener('click', () => openTrainModal('realise'));

appState.trainModalClose = document.getElementById('train-modal-close');

if (appState.trainModalClose) appState.trainModalClose.addEventListener('click', closeTrainModal);

appState.trainModalCancel = document.getElementById('train-modal-cancel');

if (appState.trainModalCancel) appState.trainModalCancel.addEventListener('click', closeTrainModal);

appState.trainModalSave = document.getElementById('train-modal-save');

if (appState.trainModalSave) appState.trainModalSave.addEventListener('click', saveTrainFromModal);

appState.trainModalOverlay = document.getElementById('train-modal');

if (appState.trainModalOverlay) appState.trainModalOverlay.addEventListener('click', (e) => {
  if (e.target === appState.trainModalOverlay) closeTrainModal();
});


// Esc ferme les modals d'ajout aussi
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') {
    closeCompModal();
    closeTrainModal();
  }
});
}
