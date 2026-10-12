/* src/features/sessions/activity-edit.js — modale d'édition d'une activité réalisée, changement de
   catégorie (entraînement / compétition), modale d'un jour de repos.
   Déplacé tel quel depuis gpx-render.js (aucun changement de comportement). */
import { appState } from '../../core/state.js';
import { REST_COUCH_SVG, compPrio } from '../../core/format.js';
import { toIsoDate } from '../dashboard/filters.js';
import { getActivityEdit, setActivityEdit } from '../calendar/overrides.js';
import { loadCompetitions, renderCompList } from '../competitions/competitions-page.js';
import { populateSportSelect } from '../competitions/comp-modal-ui.js';
import { renderCalendar } from '../calendar/realise-calendar.js';
import { dissociateFromStageRace, openStageRaceBuilder } from './stage-race.js';

// Détail d'un jour de repos passé : message simple.
export function openRestDayModal(iso) {
  const date = new Date(iso + 'T12:00:00');
  if (isNaN(date.getTime())) return;
  // Mobile : date compacte ("mer. 1 juil. 2026") pour que l'heure + le sport tiennent sur la même ligne
  const dateStr = (window.innerWidth < 860)
    ? date.toLocaleDateString('fr-FR', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' })
    : date.toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
  const titleEl = document.getElementById('modal-title');
  const metaEl = document.getElementById('modal-meta');
  const bodyEl = document.getElementById('modal-body');
  const _e = document.getElementById('modal-edit-btn'); if (_e) _e.hidden = true;
  const _d = document.getElementById('modal-delete-btn'); if (_d) _d.hidden = true;

  titleEl.innerHTML = 'Repos';
  metaEl.textContent = dateStr;

  const couchBlock = `<div class="rest-modal-couch">${REST_COUCH_SVG}</div>`;
  bodyEl.innerHTML = `${couchBlock}<div class="modal-placeholder">Jour de repos.</div>`;
  document.getElementById('session-modal').classList.add('active');
}

// Modale d'édition d'une activité (calque d'overrides) + transformer en compétition.
export function openActivityEditModal(activityId, iso) {
  const day = appState.data.find(d => toIsoDate(d.date) === iso);
  const act = day && day.activities ? day.activities.find(a => String(a.id) === String(activityId)) : null;
  if (!act) return;
  const ov = getActivityEdit(activityId) || {};
  let exclPower = !!ov.excludePower, exclHr = !!ov.excludeHr, exclDist = !!ov.excludeDistance;

  // Course à étapes parente (si cette activité est une étape d'une course multi-activités)
  const _comps = (typeof loadCompetitions === 'function') ? loadCompetitions() : [];
  const _race = act._sbId ? _comps.find(c => Array.isArray(c.activityIds) && c.activityIds.map(String).includes(String(act._sbId)) && c.activityIds.length > 1) : null;
  const _singleComp = act._sbId ? _comps.find(c => String(c.id) === 'act-' + String(act._sbId)) : null;
  const _curPrioKey = compPrio((_race ? _race.priority : (_singleComp ? _singleComp.priority : null))).key;
  let _aePrio = _curPrioKey;

  document.getElementById('_act-edit-modal')?.remove();
  const overlay = document.createElement('div');
  overlay.className = 'day-modal-overlay active';
  overlay.id = '_act-edit-modal';
  overlay.innerHTML = `
    <div class="day-modal day-modal-note" style="width:880px;max-width:calc(100vw - 32px);">
      <div class="day-modal-header">
        <h3>Modifier l'activité</h3>
        <button class="day-modal-close" type="button" title="Fermer">×</button>
      </div>
      <div class="day-modal-body">
        <div class="add-form-grid">
          <label class="form-field form-col-2">
            <span>Nom</span>
            <input type="text" id="_ae-name">
          </label>
          <div class="form-field form-col-2 add-sec">
            <div class="add-sec-h plan">Détails</div>
            <div class="add-sec-grid g3">
              <label class="form-field"><span>Type</span><input type="text" id="_ae-type" placeholder="endurance, seuil…"></label>
              <label class="form-field"><span>Sport</span><select id="_ae-sport"></select></label>
            </div>
          </div>
          <div class="form-field form-col-2 add-sec">
            <div class="add-sec-h charge">Charge</div>
            <div class="add-sec-grid g3">
              <label class="form-field"><span>Durée (min)</span><input type="number" id="_ae-dur" min="0" placeholder="minutes"></label>
              <label class="form-field"><span>TSS</span><input type="number" id="_ae-tss" min="0" placeholder="TSS"></label>
              <label class="form-field"><span>RPE ressenti (1-10)</span><input type="number" id="_ae-rpe" min="0" max="10" step="0.5" placeholder="1 à 10"></label>
            </div>
          </div>
          <div class="form-field form-col-2 add-sec">
            <div class="add-sec-h parc">Parcours</div>
            <div class="add-sec-grid g3">
              <label class="form-field"><span>Distance (km)</span><input type="number" step="0.1" id="_ae-dist" min="0" placeholder="km"></label>
              <label class="form-field"><span>Dénivelé D+ (m)</span><input type="number" id="_ae-dplus" min="0" placeholder="mètres"></label>
              <label class="form-field"><span>Nombre de tours</span><input type="number" id="_ae-laps" min="0" placeholder="tours"></label>
            </div>
          </div>
          <label class="form-field form-col-2">
            <span>Notes</span>
            <textarea id="_ae-notes" rows="2" placeholder="Commentaire…"></textarea>
          </label>
          <div class="form-field form-col-2 add-sec">
            <div class="add-sec-h charge">Retirer des records &amp; statistiques</div>
            <div class="ae-field-hint">La donnée reste sur l'activité, mais n'est plus comptée dans les records / stats.</div>
            <div class="ae-metric-btns">
              <button type="button" class="ae-metric-btn${exclPower ? ' active' : ''}" data-m="power">Puissance</button>
              <button type="button" class="ae-metric-btn${exclHr ? ' active' : ''}" data-m="hr">Cardio</button>
              <button type="button" class="ae-metric-btn${exclDist ? ' active' : ''}" data-m="dist">Distance</button>
            </div>
            <div id="_ae-event-wrap" style="${act.category === 'competition' ? 'margin-top:12px' : 'display:none;'}">
              <label class="note-field-label">Priorité</label>
              <div class="note-type-chips" id="_ae-prio">
                <button type="button" class="note-type-chip${_curPrioKey === 'principal' ? ' active' : ''}" data-prio="principal">Objectif</button>
                <button type="button" class="note-type-chip${_curPrioKey === 'secondaire' ? ' active' : ''}" data-prio="secondaire">Préparation</button>
              </div>
              ${_race
                ? `<button type="button" class="ae-stagerace-btn" id="_ae-dissociate">Dissocier de « ${window._confirmEscape ? window._confirmEscape(_race.name) : _race.name} »</button>`
                : `<button type="button" class="ae-stagerace-btn" id="_ae-stagerace">+ Ajouter à une course à étapes</button>`}
            </div>
          </div>
        </div>
      </div>
      <div class="day-modal-footer">
        <button class="btn-trash" type="button" id="_ae-reset" title="Réinitialiser : annuler les modifications et revenir aux données d'origine">
          <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6M14 11v6"/><path d="M9 6V4a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2v2"/></svg>
        </button>
        <button type="button" class="btn-secondary" id="_ae-transform">${act.category === 'competition' ? '→ Entraînement' : '→ Compétition'}</button>
        <div style="flex:1;"></div>
        <button class="day-modal-cancel" type="button">Annuler</button>
        <button class="day-modal-save" type="button">Enregistrer</button>
      </div>
    </div>`;
  document.body.appendChild(overlay);

  // Pré-remplissage (via .value pour éviter les soucis d'échappement)
  document.getElementById('_ae-name').value = act.name || '';
  document.getElementById('_ae-type').value = act.type || '';
  if (typeof populateSportSelect === 'function') populateSportSelect('_ae-sport', act.raw_type || act.sport_raw || act.sport || 'Ride');
  document.getElementById('_ae-dur').value = act.duration || 0;
  document.getElementById('_ae-dist').value = act.distance_km != null ? act.distance_km : '';
  document.getElementById('_ae-tss').value = act.tss || 0;
  document.getElementById('_ae-rpe').value = act.rpe != null ? act.rpe : '';
  document.getElementById('_ae-dplus').value = (act.elevation_gain != null ? act.elevation_gain : (act.total_elevation_gain != null ? act.total_elevation_gain : ''));
  document.getElementById('_ae-laps').value = act.laps != null ? act.laps : '';
  document.getElementById('_ae-notes').value = act.notes || ov.notes || '';
  overlay.querySelector('#_ae-stagerace')?.addEventListener('click', () => {
    close();
    openStageRaceBuilder(activityId);
  });
  overlay.querySelector('#_ae-dissociate')?.addEventListener('click', async () => {
    close();
    await dissociateFromStageRace(act, _race, iso);
  });

  overlay.querySelectorAll('.ae-metric-btn').forEach(b => b.addEventListener('click', () => {
    b.classList.toggle('active');
    const on = b.classList.contains('active');
    if (b.dataset.m === 'power') exclPower = on;
    if (b.dataset.m === 'hr') exclHr = on;
    if (b.dataset.m === 'dist') exclDist = on;
  }));
  overlay.querySelectorAll('#_ae-prio .note-type-chip').forEach(chip => chip.addEventListener('click', () => {
    overlay.querySelectorAll('#_ae-prio .note-type-chip').forEach(c => c.classList.remove('active'));
    chip.classList.add('active');
    _aePrio = chip.dataset.prio;
  }));

  const close = () => overlay.remove();
  overlay.querySelector('.day-modal-close').addEventListener('click', close);
  overlay.querySelector('.day-modal-cancel').addEventListener('click', close);
  overlay.addEventListener('click', e => { if (e.target === overlay) close(); });

  overlay.querySelector('.day-modal-save').addEventListener('click', () => {
    const newOv = {};
    const nameV = document.getElementById('_ae-name').value.trim();
    const typeV = document.getElementById('_ae-type').value.trim();
    const sportV = document.getElementById('_ae-sport').value.trim();
    const durV = parseInt(document.getElementById('_ae-dur').value, 10);
    const distV = parseFloat(document.getElementById('_ae-dist').value);
    const tssV = parseInt(document.getElementById('_ae-tss').value, 10);
    const notesV = document.getElementById('_ae-notes').value.trim();
    const rpeV = parseFloat(document.getElementById('_ae-rpe').value);
    const dplusV = parseInt(document.getElementById('_ae-dplus').value, 10);
    const lapsV = parseInt(document.getElementById('_ae-laps').value, 10);
    if (nameV) newOv.name = nameV;
    if (typeV) newOv.type = typeV;
    if (sportV) newOv.sport = sportV;
    if (!isNaN(durV)) newOv.duration = durV;
    if (!isNaN(distV)) newOv.distance_km = distV;
    if (!isNaN(tssV)) newOv.tss = tssV;
    if (!isNaN(rpeV)) newOv.rpe = rpeV;
    if (!isNaN(dplusV)) newOv.elevation_gain = dplusV;
    if (!isNaN(lapsV)) newOv.laps = lapsV;
    if (notesV) newOv.notes = notesV;
    if (exclPower) newOv.excludePower = true;
    if (exclHr) newOv.excludeHr = true;
    if (exclDist) newOv.excludeDistance = true;
    setActivityEdit(activityId, newOv);
    // Priorité de la compétition (course à étapes → la course ; sinon la compét d'un jour)
    if (act.category === 'competition' && window.sb && _aePrio !== _curPrioKey) {
      // Modele unifie : la priorite est sur la ligne activities (la compet EST l'activite).
      window.sb.from('activities').update({ priority: _aePrio }).eq('id', act._sbId).then(() => {
        if (window.cloudSync && window.cloudSync.pullAllFromCloud) window.cloudSync.pullAllFromCloud().then(() => {
          if (typeof renderCalendar === 'function') renderCalendar();
          if (typeof renderCompList === 'function') renderCompList();
        });
      });
    }
    close();
  });
  overlay.querySelector('#_ae-reset').addEventListener('click', async () => {
    const ok = await appConfirm({ title: 'Réinitialiser', html: "Annuler toutes les modifications de cette activité et revenir aux données Strava ?", confirmLabel: 'Réinitialiser', danger: true });
    if (ok) { setActivityEdit(activityId, null); close(); }
  });
  overlay.querySelector('#_ae-transform').addEventListener('click', async () => {
    const target = (act.category === 'competition') ? 'entrainement' : 'competition';
    close();
    await setActivityCategory(act, target, iso);
  });
}

// Bascule la catégorie d'une activité (entrainement ↔ competition) directement
// en base, sans formulaire. Re-pull + re-render pour refléter le changement.
export async function setActivityCategory(act, category, iso) {
  if (!act || !act._sbId || !window.sb) return;
  try {
    // category_set_by_user : la synchro Strava ne reclassera plus jamais cette ligne
    const { error } = await window.sb.from('activities').update({ category, category_set_by_user: true }).eq('id', act._sbId);
    if (error) throw error;
    act.category = category;
    // Refléter dans DASHBOARD_DATA (source des reconstructions) sinon l'affichage
    // repasse en compétition au prochain rebuild.
    if (window.DASHBOARD_DATA && window.DASHBOARD_DATA.days) {
      for (const d of window.DASHBOARD_DATA.days) {
        for (const a of (d.activities || [])) {
          if (String(a._sbId) === String(act._sbId)) a.category = category;
        }
      }
    }
// Modele unifie : changer category sur l'activite SUFFIT (la compet EST l'activite).
    // Rien d'autre a faire (plus de registre competitions separe -> plus de doublon).
        if (window.cloudSync && window.cloudSync.pullAllFromCloud) await window.cloudSync.pullAllFromCloud();
    if (window.__applyOverridesAndRerender) window.__applyOverridesAndRerender(); // rebuild data depuis DASHBOARD_DATA mis à jour
    if (typeof renderCompList === 'function') renderCompList();
  } catch (e) {
    console.warn('[setActivityCategory]', e.message || e);
  }
}
