/* src/features/sessions/stage-race.js — courses à étapes réalisées : onglets d'étapes dans la
   modale de séance, dissociation d'une étape, assistant de création.
   Déplacé tel quel depuis gpx-render.js (aucun changement de comportement). */
import { appState } from '../../core/state.js';
import { toIsoDate } from '../dashboard/filters.js';
import { loadCompetitions, renderCompList } from '../competitions/competitions-page.js';
import { renderCalendar } from '../calendar/realise-calendar.js';
import { openSessionModal } from './session-modal.js';

// Sélecteur d'étapes dans le détail réalisé : si l'activité du jour appartient à
// une course à étapes (competitions.activity_ids > 1), affiche « Étape 1 / 2 … »
// pour naviguer entre les activités-étapes (ordre chronologique).
export function _injectRealisedStageTabs(iso, acts) {
  const comps = (typeof loadCompetitions === 'function') ? loadCompetitions() : [];
  const sbIds = (acts || []).map(a => String(a._sbId)).filter(Boolean);
  const race = comps.find(c => Array.isArray(c.activityIds) && c.activityIds.length > 1
    && c.activityIds.map(String).some(id => sbIds.includes(id)));
  if (!race) return;
  const stages = race.activityIds.map(id => _findActBySbId(id)).filter(Boolean)
    .sort((a, b) => (a.iso < b.iso ? -1 : 1));
  if (stages.length < 2) return;
  const curIdx = stages.findIndex(s => s.iso === iso);
  // Le titre garde le vrai nom de l'activité (posé par renderModalActivity).
  // Switcher d'étapes EN HAUT DU CORPS, style identique au prévu (.modal-activity-switch),
  // précédé à gauche par le nom de la course à étapes.
  const body = document.getElementById('modal-body');
  if (!body) return;
  body.querySelector('.rst-switch')?.remove();
  const raceName = window._confirmEscape ? window._confirmEscape(race.name) : race.name;
  const sw = document.createElement('div');
  sw.className = 'rst-switch';
  // Le nom de la course est HORS du carré gris ; seules les pastilles sont dans le carré.
  sw.innerHTML = `<span class="rst-race-label">${raceName}</span>`
    + `<div class="modal-activity-switch">`
    + stages.map((s, i) => `<button type="button" class="${i === curIdx ? 'active' : ''}" data-stageiso="${s.iso}">Étape ${i + 1}</button>`).join('')
    + `</div>`;
  body.prepend(sw);
  sw.querySelectorAll('button').forEach(b => b.addEventListener('click', () => {
    const di = b.dataset.stageiso;
    if (di && di !== iso) openSessionModal(di, 'realise');
  }));
}

// Cherche une activité (chargée) par son id Supabase → { act, iso }.
export function _findActBySbId(sbId) {
  for (const d of appState.data) {
    if (!d.activities) continue;
    for (const a of d.activities) {
      if (String(a._sbId) === String(sbId)) return { act: a, iso: toIsoDate(d.date) };
    }
  }
  return null;
}

// Retire une activité d'une course à étapes : elle redevient une compét d'un jour.
export async function dissociateFromStageRace(act, race, iso) {
  if (!act || !act._sbId || !race || !window.sb) return;
  try {
    const remaining = (race.activityIds || []).map(String).filter(id => id !== String(act._sbId));
    if (remaining.length >= 2) {
      // La course garde les autres étapes
      await window.sb.from('competitions').update({ activity_ids: remaining }).eq('id', race._sbId);
    } else {
      // Plus assez d'étapes → on supprime la course ; l'étape restante redevient compét d'un jour
      await window.sb.from('competitions').delete().eq('id', race._sbId);
      if (remaining.length === 1) {
        const found = _findActBySbId(remaining[0]);
        if (found && window.cloudSync.pushCompetitionRegistry) {
          await window.cloudSync.pushCompetitionRegistry({
            id: 'act-' + remaining[0], name: found.act.name || 'Compétition',
            date: found.iso, sport: found.act.sport || null, activityIds: [remaining[0]],
          });
        }
      }
    }
    // Cette activité redevient une compét d'un jour autonome
    if (window.cloudSync.pushCompetitionRegistry) {
      await window.cloudSync.pushCompetitionRegistry({
        id: 'act-' + act._sbId, name: act.name || 'Compétition',
        date: iso, sport: act.sport || null, activityIds: [act._sbId],
      });
    }
    if (window.cloudSync.pullAllFromCloud) await window.cloudSync.pullAllFromCloud();
    if (typeof renderCalendar === 'function') renderCalendar();
    if (typeof renderCompList === 'function') renderCompList();
  } catch (e) { console.warn('[dissociate]', e.message || e); }
}

// Constructeur de course à étapes : choisis les activités qui sont les étapes,
// nomme la course → elles deviennent des compétitions partageant la même "épreuve".
// L'ordre des étapes est chronologique (étape 1 = la plus ancienne).
export function openStageRaceBuilder(currentActivityId) {
  // Rassemble toutes les activités (réalisées) avec leur date
  const allActs = [];
  for (const d of appState.data) {
    if (!d.activities) continue;
    const iso = toIsoDate(d.date);
    for (const a of d.activities) {
      if (!a._sbId) continue; // seulement les lignes en base
      allActs.push({ sbId: a._sbId, iso, name: a.name || 'Séance', sport: a.sport || '', category: a.category, event: a.event || null });
    }
  }
  allActs.sort((x, y) => (x.iso < y.iso ? 1 : x.iso > y.iso ? -1 : 0)); // récent en haut

  const current = allActs.find(a => a.sbId === currentActivityId);
  const presetEvent = current && current.event ? current.event : '';
  const preChecked = new Set();
  if (current) preChecked.add(current.sbId);
  if (presetEvent) allActs.filter(a => a.event === presetEvent).forEach(a => preChecked.add(a.sbId));

  document.getElementById('_act-edit-modal')?.remove();
  document.getElementById('_stagerace-modal')?.remove();
  const overlay = document.createElement('div');
  overlay.className = 'day-modal-overlay active';
  overlay.id = '_stagerace-modal';
  const fmtD = (iso) => new Date(iso + 'T12:00:00').toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', year: 'numeric' });
  const rows = allActs.map(a => `
    <label class="sr-row">
      <input type="checkbox" data-sbid="${a.sbId}" ${preChecked.has(a.sbId) ? 'checked' : ''}>
      <span class="sr-date">${fmtD(a.iso)}</span>
      <span class="sr-name">${window._confirmEscape ? window._confirmEscape(a.name) : a.name}</span>
      ${a.category === 'competition' ? '<span class="sr-tag">compét</span>' : ''}
    </label>`).join('');

  overlay.innerHTML = `
    <div class="day-modal day-modal-note">
      <div class="day-modal-header">
        <h3>Course à étapes</h3>
        <button class="day-modal-close" type="button" title="Fermer">×</button>
      </div>
      <div class="day-modal-body">
        <label class="note-field-label">Nom de la course</label>
        <input type="text" id="_sr-name" placeholder="Ex : Tour de la Région">
        <label class="note-field-label">Priorité</label>
        <div class="note-type-chips" id="_sr-prio">
          <button type="button" class="note-type-chip active" data-prio="principal">Objectif</button>
          <button type="button" class="note-type-chip" data-prio="secondaire">Préparation</button>
        </div>
        <label class="note-field-label">Étapes (coche les activités)</label>
        <div class="ae-field-hint">Les activités cochées deviennent des compétitions de cette course. L'ordre des étapes suit la date (étape 1 = la plus ancienne).</div>
        <div class="sr-list">${rows || '<div class="modal-placeholder">Aucune activité.</div>'}</div>
        <label class="note-field-label">Aperçu des étapes</label>
        <div class="sr-preview" id="_sr-preview"></div>
      </div>
      <div class="day-modal-footer">
        <div style="flex:1;"></div>
        <button class="day-modal-cancel" type="button">Annuler</button>
        <button class="day-modal-save" type="button">Valider</button>
      </div>
    </div>`;
  document.body.appendChild(overlay);
  document.getElementById('_sr-name').value = presetEvent;

  let srPrio = 'principal';
  overlay.querySelectorAll('#_sr-prio .note-type-chip').forEach(chip => chip.addEventListener('click', () => {
    overlay.querySelectorAll('#_sr-prio .note-type-chip').forEach(c => c.classList.remove('active'));
    chip.classList.add('active');
    srPrio = chip.dataset.prio;
  }));

  const close = () => overlay.remove();
  const refreshPreview = () => {
    const checked = [...overlay.querySelectorAll('.sr-list input:checked')]
      .map(c => allActs.find(a => a.sbId === c.dataset.sbid))
      .filter(Boolean)
      .sort((x, y) => (x.iso < y.iso ? -1 : 1)); // chronologique
    const prev = document.getElementById('_sr-preview');
    prev.innerHTML = checked.length
      ? checked.map((a, i) => `<div class="sr-stage"><strong>Étape ${i + 1}</strong> · ${fmtD(a.iso)} — ${window._confirmEscape ? window._confirmEscape(a.name) : a.name}</div>`).join('')
      : '<div class="modal-placeholder">Coche au moins 2 activités.</div>';
  };
  overlay.querySelectorAll('.sr-list input').forEach(c => c.addEventListener('change', refreshPreview));
  refreshPreview();

  overlay.querySelector('.day-modal-close').addEventListener('click', close);
  overlay.querySelector('.day-modal-cancel').addEventListener('click', close);
  overlay.addEventListener('click', e => { if (e.target === overlay) close(); });

  overlay.querySelector('.day-modal-save').addEventListener('click', async () => {
    const name = document.getElementById('_sr-name').value.trim();
    if (!name) { if (window.appAlert) await window.appAlert({ title: 'Nom requis', message: 'Donne un nom à la course.' }); return; }
    const selected = [...overlay.querySelectorAll('.sr-list input:checked')].map(c => c.dataset.sbid);
    if (selected.length < 1 || !window.sb) { close(); return; }
    try {
      // Étapes sélectionnées (ordre chronologique) → activités en catégorie compétition
      const selActs = allActs.filter(a => selected.includes(a.sbId)).sort((x, y) => (x.iso < y.iso ? -1 : 1));
      await Promise.all(selActs.map(a => window.sb.from('activities').update({ category: 'competition', category_set_by_user: true }).eq('id', a.sbId)));
      // Supprime les compét "1 jour" (act-…) des activités qui deviennent des étapes
      await Promise.all(selActs.map(a => window.sb.from('competitions').delete().eq('client_id', 'act-' + a.sbId)));
      // UNE ligne dans le registre competitions reliant ces activités
      if (window.cloudSync && window.cloudSync.pushCompetitionRegistry) {
        await window.cloudSync.pushCompetitionRegistry({
          id: 'race-' + selActs[0].sbId,
          name,
          date: selActs[0].iso,                 // date = 1ʳᵉ étape
          sport: selActs[0].sport || null,
          priority: srPrio,
          activityIds: selActs.map(a => a.sbId),
        });
      }
      // Refléter category=competition dans DASHBOARD_DATA (source des rebuilds)
      const selSet = new Set(selActs.map(a => String(a.sbId)));
      if (window.DASHBOARD_DATA && window.DASHBOARD_DATA.days) {
        for (const d of window.DASHBOARD_DATA.days) {
          for (const a of (d.activities || [])) if (selSet.has(String(a._sbId))) a.category = 'competition';
        }
      }
      if (window.cloudSync && window.cloudSync.pullAllFromCloud) await window.cloudSync.pullAllFromCloud();
      if (window.__applyOverridesAndRerender) window.__applyOverridesAndRerender();
      if (typeof renderCompList === 'function') renderCompList();
    } catch (e) { console.warn('[stage race]', e.message || e); }
    close();
  });
}
