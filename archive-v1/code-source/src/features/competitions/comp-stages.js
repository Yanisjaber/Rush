/* src/features/competitions/comp-stages.js — extrait de l'ancien app.js (découpage par fonctionnalité). */
import { appState } from '../../core/state.js';
import { extractGpxStats } from '../gpx/gpx-render.js';


// Champs gérés par les étapes (tout sauf le nom global qui reste partagé)
// Helpers temps <-> minutes (le "temps cible" compet est desormais stocke en minutes, comme duration)
export function parseTimeToMin(v) {
  if (v == null || v === '') return null;
  if (typeof v === 'number') return Math.round(v);
  var s = String(v).trim().toLowerCase();
  if (/^\d+(\.\d+)?$/.test(s)) return Math.round(+s);
  var m = s.match(/(\d+)\s*[h:]\s*(\d{0,2})/);
  if (m) return (+m[1]) * 60 + (m[2] ? +m[2] : 0);
  var m2 = s.match(/(\d+)\s*min/);
  if (m2) return +m2[1];
  var n = parseInt(s, 10);
  return isNaN(n) ? null : n;
}

export function fmtMinToTime(min) {
  if (min == null || min === '') return '';
  min = Math.round(+min);
  if (isNaN(min) || min <= 0) return '';
  var h = Math.floor(min / 60), m = min % 60;
  return h > 0 ? (h + 'h' + String(m).padStart(2, '0')) : (m + ' min');
}

const STAGE_FIELDS = ['date','time','type','km','dplus','target','laps','notes','sport','priority','gpx'];


// Priority et Sport sont GLOBAUX à la compé (ne changent pas par étape)
// → ils ne sont pas inclus dans le snapshot stage
export function readFormToStage() {
  const stage = {};
  stage.date = document.getElementById('comp-modal-date').value || '';
  stage.time = document.getElementById('comp-modal-time').value || '';
  stage.type = document.getElementById('comp-modal-type').value || '';
  stage.km = document.getElementById('comp-modal-km').value || '';
  stage.dplus = document.getElementById('comp-modal-dplus').value || '';
  stage.target = parseTimeToMin(document.getElementById('comp-modal-target').value);
  stage.laps = document.getElementById('comp-modal-laps').value || '';
  stage.notes = document.getElementById('comp-modal-notes').value || '';
  const gpxInput = document.getElementById('comp-modal-gpx');
  const newFile = gpxInput && gpxInput.files[0] ? gpxInput.files[0] : null;
  if (newFile) {
    // L'utilisateur a uploadé un nouveau fichier pour cette étape
    stage.gpxFile = newFile;
    stage.gpxName = newFile.name;
    stage.gpxContent = null; // sera lu en async au save
  } else {
    // Pas de nouveau fichier : on PRÉSERVE le gpx existant (en mémoire dans stagesData)
    const existing = (typeof appState.stagesData !== 'undefined' && appState.stagesData[appState.activeStageIdx]) || {};
    stage.gpxFile = existing.gpxFile || null;
    stage.gpxName = existing.gpxName || null;
    stage.gpxContent = existing.gpxContent || null;
  }
  return stage;
}


export function writeStageToForm(stage) {
  if (!stage) stage = {};
  // NOTE: priority et sport NE sont PAS touchés (globaux à la compé)
  document.getElementById('comp-modal-date').value = stage.date || '';
  document.getElementById('comp-modal-type').value = stage.type || '';
  // km/dplus : si GPX présent pour cette étape, on calcule depuis le fichier (vérité terrain)
  let effKm = stage.km, effDplus = stage.dplus;
  const lapsForStage = parseInt(stage.laps, 10) || 1;
  if (stage.gpxContent && typeof extractGpxStats === 'function') {
    const gs = extractGpxStats(stage.gpxContent, lapsForStage);
    if (gs) {
      effKm = gs.km;
      effDplus = gs.dplus;
    }
  }
  document.getElementById('comp-modal-km').value = effKm || '';
  document.getElementById('comp-modal-dplus').value = effDplus || '';
  document.getElementById('comp-modal-target').value = fmtMinToTime(stage.target);
  document.getElementById('comp-modal-laps').value = stage.laps || '';
  document.getElementById('comp-modal-notes').value = stage.notes || '';
  // Time stepper
  const [h, m] = (stage.time || '12:00').split(':').map(n => parseInt(n, 10) || 0);
  if (window.resetTimeStepper) window.resetTimeStepper('comp-modal-time', h, m);
  // Flatpickr date
  const dateInput = document.getElementById('comp-modal-date');
  if (dateInput && dateInput._flatpickr) {
    if (stage.date) dateInput._flatpickr.setDate(stage.date, false);
    else dateInput._flatpickr.clear();
  }
  // Custom select Type (priority/sport non touchés)
  const typeEl = document.getElementById('comp-modal-type');
  if (typeEl && typeEl._customUpdate) typeEl._customUpdate();
  // GPX picker : reset visual
  const gpxInput = document.getElementById('comp-modal-gpx');
  if (gpxInput) {
    gpxInput.value = '';
    const picker = gpxInput.closest('.file-picker');
    if (picker) {
      picker.classList.remove('has-file');
      const lbl = picker.querySelector('.file-picker-label');
      if (lbl) lbl.textContent = stage.gpxName || 'Choisir un fichier GPX';
      if (stage.gpxName) picker.classList.add('has-file');
      const clr = picker.querySelector('.file-picker-clear');
      if (clr) clr.hidden = !stage.gpxName;
    }
  }
}


export function renderStageTabs() {
  const list = document.getElementById('comp-stage-tabs-list');
  if (!list) return;
  // Garde-fou : si stagesData vide, init avec 2 étapes vides
  if (!appState.stagesData || appState.stagesData.length < 2) {
    appState.stagesData = [appState.stagesData[0] || {}, appState.stagesData[1] || {}];
    appState.activeStageIdx = 0;
  }
  const hasClose = appState.stagesData.length > 2;
  list.innerHTML = appState.stagesData.map((s, i) => `
    <button type="button" class="stage-tab${i === appState.activeStageIdx ? ' active' : ''}${hasClose ? ' has-close' : ''}" data-stage="${i}">
      <span class="stage-tab-label" data-long="Étape ${i + 1}" data-short="E${i + 1}">Étape ${i + 1}</span>
      ${hasClose ? `<span class="stage-tab-close" data-close="${i}" title="Supprimer cette étape">×</span>` : ''}
    </button>
  `).join('');
  // Wire clicks
  list.querySelectorAll('.stage-tab').forEach(t => {
    t.addEventListener('click', (e) => {
      if (e.target.classList.contains('stage-tab-close')) return;
      const idx = +t.dataset.stage;
      if (idx === appState.activeStageIdx) return;
      appState.stagesData[appState.activeStageIdx] = readFormToStage();
      appState.activeStageIdx = idx;
      writeStageToForm(appState.stagesData[appState.activeStageIdx]);
      renderStageTabs();
    });
  });
  list.querySelectorAll('.stage-tab-close').forEach(c => {
    c.addEventListener('click', (e) => {
      e.stopPropagation();
      const idx = +c.dataset.close;
      if (appState.stagesData.length <= 2) return;
      appState.stagesData.splice(idx, 1);
      if (appState.activeStageIdx >= appState.stagesData.length) appState.activeStageIdx = appState.stagesData.length - 1;
      writeStageToForm(appState.stagesData[appState.activeStageIdx]);
      renderStageTabs();
    });
  });
  // Désactive visuellement le + si on atteint la limite (10)
  const addBtn = document.getElementById('comp-stage-tab-add');
  if (addBtn) {
    if (appState.stagesData.length >= 10) {
      addBtn.disabled = true;
      addBtn.style.opacity = '0.3';
      addBtn.style.cursor = 'not-allowed';
      addBtn.title = 'Maximum 10 étapes';
    } else {
      addBtn.disabled = false;
      addBtn.style.opacity = '';
      addBtn.style.cursor = '';
      addBtn.title = 'Ajouter une étape';
    }
  }
  // Après render : check si les tabs débordent et raccourcir si besoin
  adjustStageTabLabels();
}


// Détecte si UN des labels passe à la ligne (le chiffre va sur une 2e ligne)
// et bascule TOUS les labels en version courte (E1, E2, etc.)
function adjustStageTabLabels() {
  const list = document.getElementById('comp-stage-tabs-list');
  if (!list) return;
  const labels = list.querySelectorAll('.stage-tab-label');
  // Reset en version longue
  labels.forEach(l => { l.textContent = l.dataset.long; });
  // Mesure : si un label a une hauteur > 1 ligne (passage à la ligne), bascule en short
  requestAnimationFrame(() => {
    let mustShorten = false;
    // Compare scrollHeight (incluant wrapping) vs hauteur 1 ligne (~22px pour font 13)
    const oneLineMaxHeight = 22;
    labels.forEach(l => {
      // Méthode 1 : si le contenu wrap, offsetHeight dépasse une ligne
      if (l.offsetHeight > oneLineMaxHeight) mustShorten = true;
      // Méthode 2 : si le texte est tronqué horizontalement (avec nowrap)
      if (l.scrollWidth > l.clientWidth + 1) mustShorten = true;
    });
    if (mustShorten) {
      labels.forEach(l => { l.textContent = l.dataset.short; });
    }
  });
}


function setStagesMode(on) {
  const tabsBar = document.getElementById('comp-stages-tabs');
  if (!tabsBar) return;
  if (on) {
    // 1ère activation : snapshot le form en stage 1 + ajoute un stage 2 vide
    // Réactivation : on garde toutes les étapes en mémoire, mais on sync le form courant
    // (qui a pu être édité en mode simple) sur l'étape 0
    if (appState.stagesData.length >= 2) {
      appState.stagesData[0] = readFormToStage();
      appState.activeStageIdx = Math.min(appState.activeStageIdx, appState.stagesData.length - 1);
    } else {
      const current = readFormToStage();
      appState.stagesData = [current, {}];
      appState.activeStageIdx = 0;
    }
    tabsBar.hidden = false;
    renderStageTabs();
    writeStageToForm(appState.stagesData[appState.activeStageIdx]);
  } else {
    // Avant de cacher, snapshot le form courant dans l'étape active
    // → si on réactive plus tard, on retrouve les éditions
    if (appState.stagesData.length > 0) {
      appState.stagesData[appState.activeStageIdx] = readFormToStage();
    }
    tabsBar.hidden = true;
    // Affiche les valeurs de l'étape 0 (= valeurs "principales" de la compé)
    if (appState.stagesData.length > 0) writeStageToForm(appState.stagesData[0]);
    // /!\ NE PAS vider stagesData → on garde tout en mémoire pour réactivation
  }
}

// Wire le bouton + d'ajout d'étape
const MAX_STAGES = 10;


// Helper : auto-remplit km et D+ depuis le GPX courant dans la modal compé,
// en multipliant par le nombre de tours saisi
export function _autofillKmDplusFromCompGpx() {
  const gpxInput = document.getElementById('comp-modal-gpx');
  const kmInput = document.getElementById('comp-modal-km');
  const dplusInput = document.getElementById('comp-modal-dplus');
  if (!gpxInput || !kmInput || !dplusInput) return;
  const file = gpxInput.files && gpxInput.files[0];
  const lapsVal = parseInt(document.getElementById('comp-modal-laps').value, 10) || 1;
  // Source du contenu : soit nouveau fichier upload, soit contenu déjà en mémoire (mode édition)
  function applyStats(gpxContent) {
    if (!gpxContent || typeof extractGpxStats !== 'function') return;
    const stats = extractGpxStats(gpxContent, lapsVal);
    if (!stats) return;
    kmInput.value = stats.km;
    dplusInput.value = stats.dplus;
    // Sync aussi le snapshot stage si on est en mode étapes
    if (typeof appState.stagesData !== 'undefined' && appState.stagesData[appState.activeStageIdx]) {
      appState.stagesData[appState.activeStageIdx].km = String(stats.km);
      appState.stagesData[appState.activeStageIdx].dplus = String(stats.dplus);
    }
  }
  if (file) {
    file.text().then(applyStats).catch(() => {});
  } else if (typeof appState.stagesData !== 'undefined' && appState.stagesData[appState.activeStageIdx] && appState.stagesData[appState.activeStageIdx].gpxContent) {
    applyStats(appState.stagesData[appState.activeStageIdx].gpxContent);
  }
}

export function bootCompStages() {


// ========= GESTION DES ÉTAPES (course par étapes) =========
appState.stagesData = [];

appState.activeStageIdx = 0;


// ResizeObserver pour re-vérifier si la modal change de taille (responsive)
if (typeof ResizeObserver !== 'undefined') {
  const list = document.getElementById('comp-stage-tabs-list');
  if (list) new ResizeObserver(() => adjustStageTabLabels()).observe(list);
}


// Wire le toggle stages
appState.stagesToggleEl = document.getElementById('comp-modal-stages-toggle');

if (appState.stagesToggleEl) {
  appState.stagesToggleEl.addEventListener('change', () => {
    setStagesMode(appState.stagesToggleEl.checked);
  });
}

appState.stageAddBtn = document.getElementById('comp-stage-tab-add');

if (appState.stageAddBtn) {
  appState.stageAddBtn.addEventListener('click', () => {
    if (appState.stagesData.length >= MAX_STAGES) return; // limite à 10 étapes
    appState.stagesData[appState.activeStageIdx] = readFormToStage();
    appState.stagesData.push({});
    appState.activeStageIdx = appState.stagesData.length - 1;
    writeStageToForm(appState.stagesData[appState.activeStageIdx]);
    renderStageTabs();
  });
}
}
