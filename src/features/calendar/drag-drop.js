/* src/features/calendar/drag-drop.js — extrait de l'ancien app.js (découpage par fonctionnalité). */
import { appState } from '../../core/state.js';
import { dayActivityIndex, dayPrevuIndex, renderCalendar } from './realise-calendar.js';
import { loadTrainings, saveTrainings } from '../training/train-modal.js';
import { loadCompetitions, loadCompetitionsExpanded, renderCompList, renderCompetitionsPage, saveCompetitions } from '../competitions/competitions-page.js';
import { openSessionModal } from '../sessions/session-modal.js';
import { enforceWtLabels } from './week-summary.js';
import { toIsoDate } from '../dashboard/filters.js';
import { openRestDayModal } from '../gpx/gpx-render.js';


// ============================================================
// GLISSER-DÉPOSER des séances prévues entre les jours du calendrier.
// Même mécanique pointer-events que la bibliothèque : seuil 6px, ghost,
// dépôt sur une case prévu -> la séance/compét change de date (+ sync cloud).
// ============================================================
function movePlannedItem(kind, id, newIso) {
  if (kind === 'training') {
    const arr = loadTrainings();
    const t = arr.find(x => String(x.id) === String(id));
    if (!t || t.date === newIso) return false;
    t.date = newIso;
    saveTrainings(arr);
  } else {
    const comps = loadCompetitions();
    const c = comps.find(x => String(x.id) === String(id));
    if (!c || c.stages || c.date === newIso) return false;
    c.date = newIso;
    saveCompetitions(comps);
    if (typeof renderCompList === 'function') renderCompList();
    if (typeof renderCompetitionsPage === 'function') renderCompetitionsPage();
  }
  renderCalendar();
  return true;
}

export function bootDragDrop() {

appState._dayPtr = null;
appState._dayJustDragged = false;

(function wireDayMoveDrag() {
  const cal = document.getElementById('week-calendar');
  if (!cal || window.__dayMoveWired) return;
  window.__dayMoveWired = true;
  const clearHover = () => document.querySelectorAll('.day-card.day-move-hover').forEach(c => c.classList.remove('day-move-hover'));
  cal.addEventListener('pointerdown', (e) => {
    if (e.pointerType === 'touch') return;                 // tactile : scroll prioritaire
    if (e.button != null && e.button > 0) return;
    if (e.target.closest && e.target.closest('button')) return; // flèches, +, etc.
    // carte simple OU colonne d'un jour multi-activités
    const card = e.target.closest ? e.target.closest('.day-card[data-move-id], .day-multi-col[data-move-id]') : null;
    if (!card) return;
    appState._dayPtr = { card, kind: card.dataset.moveKind, id: card.dataset.moveId, from: card.dataset.iso, x: e.clientX, y: e.clientY, started: false, ghost: null };
  });
  document.addEventListener('pointermove', (e) => {
    if (!appState._dayPtr) return;
    if (!appState._dayPtr.started) {
      if (Math.abs(e.clientX - appState._dayPtr.x) + Math.abs(e.clientY - appState._dayPtr.y) < 6) return;
      appState._dayPtr.started = true;
      document.body.classList.add('day-move-dragging');
      const g = appState._dayPtr.card.cloneNode(true);
      g.id = 'day-drag-ghost';
      g.style.width = appState._dayPtr.card.offsetWidth + 'px';
      g.style.height = appState._dayPtr.card.offsetHeight + 'px';
      document.body.appendChild(g);
      appState._dayPtr.ghost = g;
      appState._dayPtr.card.classList.add('day-move-source');
    }
    if (appState._dayPtr.ghost) { appState._dayPtr.ghost.style.left = e.clientX + 'px'; appState._dayPtr.ghost.style.top = e.clientY + 'px'; }
    const el = document.elementFromPoint(e.clientX, e.clientY);
    const target = el && el.closest ? el.closest('.day-card[data-iso][data-source="prevu"]') : null;
    clearHover();
    if (target && target !== appState._dayPtr.card) target.classList.add('day-move-hover');
  });
  document.addEventListener('pointerup', (e) => {
    if (!appState._dayPtr) return;
    const st = appState._dayPtr; appState._dayPtr = null;
    if (st.ghost) st.ghost.remove();
    document.body.classList.remove('day-move-dragging');
    if (st.card) st.card.classList.remove('day-move-source');
    clearHover();
    if (!st.started) return;                               // simple clic -> modale du jour
    appState._dayJustDragged = true; setTimeout(() => { appState._dayJustDragged = false; }, 250);
    const el = document.elementFromPoint(e.clientX, e.clientY);
    const target = el && el.closest ? el.closest('.day-card[data-iso][data-source="prevu"]') : null;
    const iso = target && target.dataset.iso;
    if (iso && iso !== st.from) movePlannedItem(st.kind, st.id, iso);
  });
  document.addEventListener('pointercancel', () => {
    if (appState._dayPtr && appState._dayPtr.ghost) appState._dayPtr.ghost.remove();
    if (appState._dayPtr && appState._dayPtr.card) appState._dayPtr.card.classList.remove('day-move-source');
    appState._dayPtr = null;
    document.body.classList.remove('day-move-dragging');
    clearHover();
  });
})();


// Handler flèches + clic carte (event delegation sur le calendrier)
document.getElementById('week-calendar').addEventListener('click', (e) => {
  // Fin de drag : ne pas ouvrir la modale du jour
  if (appState._dayJustDragged) { e.stopPropagation(); return; }
  // Flèches de switch de vue sur les cartes totaux (Volume ↔ Charge)
  const isWtArrow = e.target.classList.contains('wt-arrow');
  if (isWtArrow) {
    e.stopPropagation();
    const card = e.target.closest('.week-totals');
    if (!card) return;
    const current = card.getAttribute('data-view') || 'volume';
    const views = ['volume', 'charge'];
    const idx = views.indexOf(current);
    const dir = e.target.classList.contains('wt-next') ? 1 : -1;
    let next = (idx + dir + views.length) % views.length;
    card.setAttribute('data-view', views[next]);
    enforceWtLabels(); // la vue affichée change → re-mesurer les intitulés
    return;
  }

  // Flèches multi-activités sur les cartes jour (mode Réalisé)
  const isPrev = e.target.classList.contains('arrow-prev');
  const isNext = e.target.classList.contains('arrow-next');
  if (isPrev || isNext) {
    e.stopPropagation();
    const iso = e.target.dataset.iso;
    const day = appState.data.find(d => toIsoDate(d.date) === iso);
    if (!day || !day.activities || day.activities.length < 2) return;
    const dir = isNext ? 1 : -1;
    const current = dayActivityIndex[iso] || 0;
    let next = current + dir;
    if (next < 0) next = day.activities.length - 1;
    if (next >= day.activities.length) next = 0;
    dayActivityIndex[iso] = next;
    renderCalendar();
    return;
  }
  // Flèches multi-items sur les cartes Prévu (compés + entraînements manuels)
  const isPrevPrevu = e.target.classList.contains('arrow-prev-prevu');
  const isNextPrevu = e.target.classList.contains('arrow-next-prevu');
  if (isPrevPrevu || isNextPrevu) {
    e.stopPropagation();
    const iso = e.target.dataset.iso;
    // On compte le nombre d'items pour ce jour (compés + manuels)
    const compsExp = (typeof loadCompetitionsExpanded === 'function') ? loadCompetitionsExpanded() : [];
    const nbComps = compsExp.filter(c => c.date === iso).length;
    const manualTr = ((typeof loadTrainings === 'function') ? loadTrainings() : []);
    const nbManual = manualTr.filter(t => t.date === iso).length;
    const total = nbComps + nbManual;
    if (total < 2) return;
    const dir = isNextPrevu ? 1 : -1;
    const current = dayPrevuIndex[iso] || 0;
    let next = current + dir;
    if (next < 0) next = total - 1;
    if (next >= total) next = 0;
    dayPrevuIndex[iso] = next;
    renderCalendar();
    return;
  }
  // Clic sur une colonne (jour multi-activites) -> ouvre l'activite ciblee
  const _mcol = e.target.closest('.day-multi-col');
  if (_mcol) {
    e.stopPropagation();
    const _ci = parseInt(_mcol.dataset.actidx, 10) || 0;
    const _csrc = _mcol.dataset.source || 'realise';
    if (_csrc === 'prevu') dayPrevuIndex[_mcol.dataset.iso] = _ci;
    else window.__openActIdx = _ci;
    openSessionModal(_mcol.dataset.iso, _csrc);
    return;
  }
  // Clic sur la carte → ouvrir la modal (sauf si c'est une carte totaux)
  const card = e.target.closest('.day-card');
  if (!card) return;
  const iso = card.dataset.iso;
  const source = card.dataset.source;
  if (!iso) return;
  // Jour de repos passé : clic → détail du jour de repos au lieu de rien.
  if (card.classList.contains('empty-past')) {
    if (card.classList.contains('rest-clickable')) openRestDayModal(iso);
    return;
  }
  openSessionModal(iso, source);
});
}
