/* src/features/sessions/realised-day.js — construction de l'objet « jour réalisé » (activités Strava,
   séances manuelles, compétitions) pour la modale de séance et le calendrier.
   Déplacé tel quel depuis gpx-render.js (aucun changement de comportement). */
import { appState } from '../../core/state.js';
import { getSportCategory, toIsoDate } from '../dashboard/filters.js';
import { compIsRealised, loadCompetitionsExpanded } from '../competitions/competitions-page.js';
import { isStravaIgnored } from './session-actions.js';
import { loadRealisedTrainings } from '../training/train-modal.js';
import { parseTimeToMin } from '../competitions/comp-stages.js';

// Construit le jour REALISE fusionne (data Strava + masquage + seances manuelles +
// competitions realisees), identique a ce qu'affiche le calendrier realise. Permet au
// clic sur un jour d'ouvrir exactement les memes activites que la carte.
export function buildRealisedDay(iso) {
  let realDay = (Array.isArray(appState.data) ? appState.data.find(d => toIsoDate(d.date) === iso) : null) || null;
  if (realDay && realDay.activities && typeof isStravaIgnored === 'function') {
    const filtered = realDay.activities.filter(a => {
      if (a._manual) return true;
      const aid = a.id || a.activityId;
      return !aid || !isStravaIgnored(aid);
    });
    if (filtered.length !== realDay.activities.length) realDay = filtered.length ? { ...realDay, activities: filtered } : null;
  }
  const manualRealised = (typeof loadRealisedTrainings === 'function') ? loadRealisedTrainings().filter(t => t.date === iso) : [];
  if (manualRealised.length > 0) {
    if (!realDay) realDay = { date: iso, activities: [], sessionType: 'autre' };
    else realDay = { ...realDay, activities: [...(realDay.activities || [])] };
    for (const m of manualRealised) {
      const _dbTwin = realDay.activities.some(x => (
        (m._sbId && String(x._sbId) === String(m._sbId)) ||
        (m.id && String(x.client_id) === String(m.id))
      ));
      if (_dbTwin) continue;
      const sportVal = m.sport || 'autre';
      realDay.activities.push({
        name: m.name, sport: sportVal, raw_type: sportVal,
        type: m.type || 'endurance', sessionType: m.type || 'endurance', sessionName: m.name,
        duration: m.duration || 0, tss: m.tss || 0,
        distance_km: m.km || null, elevation_gain: m.dplus || null,
        rpe: (m.rpe != null ? m.rpe : null), laps: (m.laps != null ? m.laps : null),
        gpxName: m.gpxName || null, gpxContent: m.gpxContent || null, structure: m.structure || null,
        _manual: true, _manualId: m.id, notes: m.notes || '',
      });
    }
  }
  const realisedComps = (typeof loadCompetitionsExpanded === 'function') ? loadCompetitionsExpanded().filter(compIsRealised) : [];
  const compsToday = realisedComps.filter(c => c.date === iso);
  if (compsToday.length > 0) {
    if (!realDay) realDay = { date: iso, activities: [], sessionType: 'vo2' };
    else realDay = { ...realDay, activities: [...(realDay.activities || [])] };
    for (const c of compsToday) {
      // Une vraie activité 'competition' existe déjà ce jour : le registre n'est
      // qu'un miroir -> ne JAMAIS ajouter de pseudo-entrée (durée 0) en plus.
      if (realDay.activities.some(x => x.category === 'competition' && !x._comp)) continue;
      // Compétition TRIATHLON dont l'enchaînement réalisé couvre le jour :
      // les 3 activités SONT la compétition -> pas de pseudo-entrée non plus.
      if (typeof getSportCategory === 'function' && getSportCategory(c.sport) === 'triathlon'
          && window.SportProfiles && window.SportProfiles.detectMultisport) {
        const _gg = window.SportProfiles.detectMultisport(realDay.activities.filter(x => !x._comp));
        if (_gg && _gg.legs.length >= 2) continue;
      }
      if (realDay.activities.some(x =>
        (x._sbId && ((c._sbId && String(x._sbId) === String(c._sbId)) || (c.id && String(x.client_id) === String(c.id)))) ||
        (x.name && c.name && String(x.name).trim() === String(c.name).trim())
      )) continue;
      const cDur = (typeof parseTimeToMin === 'function' ? parseTimeToMin(c.target) : 0) || 0;
      realDay.activities.push({
        name: c.name, sport: c.sport || 'Ride', raw_type: c.sport || 'Ride',
        type: 'vo2', sessionType: 'vo2', sessionName: c.name,
        duration: cDur, tss: cDur ? Math.round(cDur) : 0,
        distance_km: c.km || null, elevation_gain: c.dplus || null, laps: c.laps || null,
        category: 'competition', priority: c.priority || null,
        _comp: true, _compId: c.id, notes: c.notes || '',
      });
    }
  }
  return realDay;
}
