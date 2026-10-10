/* src/features/sessions/sessions-panel.js — extrait de l'ancien app.js (découpage par fonctionnalité). */
import { appState } from '../../core/state.js';
import { enhanceSelect } from '../competitions/comp-modal-ui.js';
import { fmtDur } from '../../core/format.js';
import { openSessionModal } from './session-modal.js';
import { toIsoDate } from '../dashboard/filters.js';
import { escapeHtml } from '../../core/utils.js';

// Index plat de toutes les activités (une ligne = une activité, pas un jour),
// pour la recherche par titre + filtre sport.
function buildActivityIndex() {
  const out = [];
  for (const d of appState.data) {
    const acts = (d.activities && d.activities.length)
      ? d.activities
      : (d.sessionName ? [{ ...d, name: d.sessionName }] : []);
    for (const a of acts) {
      const dt = a.start_date_local ? new Date(a.start_date_local) : d.date;
      out.push({
        ...a,
        sessionName: a.name || d.sessionName || '—',
        date: (dt instanceof Date && !isNaN(dt)) ? dt : d.date,
        compliance: null,
      });
    }
  }
  out.sort((x, y) => y.date - x.date);
  return out;
}


function populateActSportFilter(allActs) {
  const sel = document.getElementById('act-sport-filter');
  if (!sel || sel.dataset.filled) return;
  const labels = new Set();
  for (const a of allActs) {
    const label = window.activitySportLabel ? window.activitySportLabel(a) : (a.sport || '');
    if (label) labels.add(label);
  }
  const opts = [...labels].sort((a, b) => a.localeCompare(b, 'fr'));
  sel.innerHTML = '<option value="">Tous les sports</option>'
    + opts.map(o => `<option value="${o}">${o}</option>`).join('');
  sel.dataset.filled = '1';
  // Dropdown custom (menu natif non stylable)
  if (typeof enhanceSelect === 'function') { enhanceSelect('act-sport-filter'); if (sel._customUpdate) sel._customUpdate(); }
}


const fmtSearchDate = d => d.toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric' });


// Valeur d'un input (chaîne vide si vide/absent)
const _fv = id => { const el = document.getElementById(id); return el && el.value !== '' ? el.value : ''; };

// val dans [min, max] ? (bornes vides ignorées ; valeur nulle exclue si une borne active)
function _inRange(val, min, max) {
  if (min !== '' && (val == null || val < +min)) return false;
  if (max !== '' && (val == null || val > +max)) return false;
  return true;
}


// Tri du tableau d'activités
let _actSort = { key: 'date', dir: 'desc' };

function _sortVal(a, key) {
  switch (key) {
    case 'sport': return (window.activitySportLabel ? window.activitySportLabel(a) : (a.sport || '')).toLowerCase();
    case 'date': return (a.date instanceof Date) ? a.date.getTime() : 0;
    case 'title': return (a.sessionName || '').toLowerCase();
    case 'duration': return a.duration || 0;
    case 'distance': return a.distance_km || 0;
    case 'elevation': return a.elevation_gain || 0;
    case 'tss': return a.tss || 0;
    default: return 0;
  }
}

function sortActs(arr) {
  const { key, dir } = _actSort;
  const mul = dir === 'asc' ? 1 : -1;
  return arr.sort((x, y) => {
    const vx = _sortVal(x, key), vy = _sortVal(y, key);
    if (vx < vy) return -mul;
    if (vx > vy) return mul;
    return 0;
  });
}

function updateSortIndicators() {
  document.querySelectorAll('.session-table th.th-sort').forEach(th => {
    const isActive = th.dataset.sort === _actSort.key;
    th.classList.toggle('active', isActive);
    th.classList.toggle('sort-asc', isActive && _actSort.dir === 'asc');
    th.classList.toggle('sort-desc', isActive && _actSort.dir === 'desc');
  });
}

export function renderSessionsTable() {
  const allActs = buildActivityIndex();
  populateActSportFilter(allActs);

  const sportF = document.getElementById('act-sport-filter')?.value || '';
  const distMin = _fv('act-dist-min'), distMax = _fv('act-dist-max');
  const durMin = _fv('act-dur-min'), durMax = _fv('act-dur-max');
  const dpMin = _fv('act-dplus-min'), dpMax = _fv('act-dplus-max');
  const tssMin = _fv('act-tss-min'), tssMax = _fv('act-tss-max');

  let filtered = allActs;
  if (sportF) filtered = filtered.filter(a => (window.activitySportLabel ? window.activitySportLabel(a) : a.sport) === sportF);
  filtered = filtered.filter(a => _inRange(a.distance_km, distMin, distMax));
  filtered = filtered.filter(a => _inRange(a.duration, durMin, durMax));
  filtered = filtered.filter(a => _inRange(a.elevation_gain, dpMin, dpMax));
  filtered = filtered.filter(a => _inRange(a.tss, tssMin, tssMax));

  const total = filtered.length;
  sortActs(filtered);
  updateSortIndicators();
  appState.sessions = filtered.slice(0, 10);

  const tbody = document.getElementById('sessions-tbody');
  tbody.innerHTML = appState.sessions.map((s, i) => {
    const sportLabel = window.activitySportLabel ? window.activitySportLabel(s) : (s.sport || '—');
    const sportCat = window.activitySportColorKey ? window.activitySportColorKey(s) : 'autre';
    const dist = s.distance_km != null
      ? window.fmtDist(s.distance_km, s.raw_type || s.sport).replace('.', ',')
      : '—';
    const dplus = s.elevation_gain != null ? Math.round(s.elevation_gain) + ' m' : '—';
    return `
    <tr data-idx="${i}">
      <td><span class="sport-pill" data-sport-cat="${sportCat}">${sportLabel}</span></td>
      <td>${fmtSearchDate(s.date)}</td>
      <td class="act-title-cell">${escapeHtml(s.sessionName)}</td>
      <td>${fmtDur(s.duration)}</td>
      <td>${dist}</td>
      <td>${dplus}</td>
      <td>${s.tss || 0}</td>
    </tr>
    `;
  }).join('');

  const countEl = document.getElementById('act-search-count');
  if (countEl) countEl.textContent = total
    ? `${total} activité${total > 1 ? 's' : ''}${total > 10 ? ' · 10 affichées' : ''}`
    : 'Aucune activité ne correspond aux filtres.';

  if (!appState._actSearchInited) {
    appState._actSearchInited = true;
    const bar = document.getElementById('act-filter-bar');
    bar?.addEventListener('input', () => renderSessionsTable());
    bar?.addEventListener('change', () => renderSessionsTable());
    document.getElementById('act-filter-reset')?.addEventListener('click', () => {
      bar.querySelectorAll('input').forEach(i => { i.value = ''; });
      const sel = document.getElementById('act-sport-filter');
      if (sel) sel.value = '';
      renderSessionsTable();
    });
    document.querySelector('.session-table thead')?.addEventListener('click', (e) => {
      const th = e.target.closest('.th-sort');
      if (!th) return;
      const key = th.dataset.sort;
      if (_actSort.key === key) {
        _actSort.dir = _actSort.dir === 'asc' ? 'desc' : 'asc';
      } else {
        _actSort.key = key;
        _actSort.dir = (key === 'title' || key === 'sport') ? 'asc' : 'desc';
      }
      renderSessionsTable();
    });
    // Clic sur une ligne → ouvre le détail de l'activité (sans bouger le calendrier)
    document.getElementById('sessions-tbody')?.addEventListener('click', (e) => {
      const tr = e.target.closest('tr');
      if (!tr) return;
      const s = appState.sessions[+tr.dataset.idx];
      if (s && typeof openSessionModal === 'function') openSessionModal(toIsoDate(s.date), 'realise');
    });
  }
}

export function bootSessionsPanel() {


// ========= PANEL 4: SESSIONS =========
appState.sessions = [];


appState._actSearchInited = false;

try { renderSessionsTable(); } catch (e) { console.error('[renderSessionsTable]', e); }
}
