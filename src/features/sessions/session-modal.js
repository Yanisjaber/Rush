/* src/features/sessions/session-modal.js — extrait de l'ancien app.js (découpage par fonctionnalité). */
import { appState } from '../../core/state.js';
import { toIsoDate } from '../dashboard/filters.js';
import { buildRealisedDay } from './realised-day.js';
import { renderRealisedSession } from './session-modal-realise.js';
import { renderPlannedSession } from './session-modal-prevu.js';
import { bootSessionModalHelpers } from './session-modal-helpers.js';

export function openSessionModal(iso, source) {
  window.__currentModalIso = iso; window.__currentModalSource = source;
  { const _lw = document.getElementById('modal-link-wrap'); if (_lw) _lw.hidden = true; }
  // Reconstruire la date depuis l'iso (les jours futurs ne sont PAS dans data)
  const date = new Date(iso + 'T12:00:00');
  if (isNaN(date.getTime())) return;
  // Mobile : date compacte pour que l'heure + le sport tiennent sur la même ligne
  const dateStr = (window.innerWidth < 860)
    ? date.toLocaleDateString('fr-FR', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' })
    : date.toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });

  // Lookup data uniquement pour le mode Réalisé (les jours futurs ne sont pas dedans).
  // En réalisé, on reconstruit le jour fusionné (manuelles + compétitions) comme la carte.
  const day = (source === 'realise')
    ? buildRealisedDay(iso)
    : (Array.isArray(appState.data) ? appState.data.find(d => toIsoDate(d.date) === iso) : null);

  const titleEl = document.getElementById('modal-title');
  const metaEl = document.getElementById('modal-meta');
  const bodyEl = document.getElementById('modal-body');

  // Cache les boutons d'action par défaut (seront ré-affichés au besoin)
  const _editBtn = document.getElementById('modal-edit-btn');
  const _delBtn = document.getElementById('modal-delete-btn');
  if (_editBtn) {
    _editBtn.hidden = true;
    // Reset des datasets (évite de garder l'état du précédent appel)
    delete _editBtn.dataset.compId;
    delete _editBtn.dataset.trainingId;
    delete _editBtn.dataset.trainingMode;
    delete _editBtn.dataset.templateIso;
    delete _editBtn.dataset.kind;
  }
  if (_delBtn) {
    _delBtn.hidden = true;
    delete _delBtn.dataset.compId;
    delete _delBtn.dataset.trainingId;
    delete _delBtn.dataset.trainingMode;
    delete _delBtn.dataset.activityId;
    delete _delBtn.dataset.sbId;
    delete _delBtn.dataset.kind;
  }

  const ctx = { iso, source, date, dateStr, day, titleEl, metaEl, bodyEl };
  if (source === 'realise') {
    renderRealisedSession(ctx);
  } else {
    renderPlannedSession(ctx);
  }
  document.getElementById('session-modal').classList.add('active');
}


export function closeSessionModal() {
  document.getElementById('session-modal').classList.remove('active');
}

export function bootSessionModal() {

bootSessionModalHelpers();


window.openSessionModal = openSessionModal; // accessible hors module (hoisting)


document.getElementById('modal-close').addEventListener('click', closeSessionModal);
}
