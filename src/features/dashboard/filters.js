/* src/features/dashboard/filters.js — extrait de l'ancien app.js (découpage par fonctionnalité). */
import { appState } from '../../core/state.js';
import { dayActivityIndex, renderCalendar } from '../calendar/realise-calendar.js';
import { activeSports } from './init.js';
import { renderHeroKpi } from './hero-kpi.js';
import { renderLoadChart } from './chart-load.js';
import { renderHoursChart } from './chart-hours.js';
import { renderWeeklyChart } from './chart-weekly.js';
import { renderZones } from './chart-zones.js';
import { renderSessionsTable } from '../sessions/sessions-panel.js';


// ========= FILTRE SPORTS =========
function getSportFromDay(d) {
  // Prefer d.sport (nouveau format), fallback sur d.sessionType (ancien data.js)
  if (d.sport) return d.sport;
  if (!d.sessionType) return null;
  if (d.sessionType === 'force') return 'musculation';
  if (d.sessionType === 'mobilite') return 'mobilite';
  if (d.sessionType === 'natation') return 'natation';
  return 'cyclisme'; // par défaut, sessions cycling-like
}


// Helper : convertit un sport (catégorie minuscule OU format Strava 'Ride'/'Run'/...)
// en catégorie de filtre ('cyclisme'/'course'/'musculation'/'natation'/'autre').
// Utilisé partout où on doit comparer un sport à activeSports.
export function getSportCategory(sport) {
  if (!sport) return 'cyclisme'; // par défaut (templates AI sans sport = cyclisme)
  const s = String(sport);
  const lower = s.toLowerCase();
  if (['cyclisme', 'course', 'musculation', 'natation', 'triathlon', 'autre', 'mobilite'].includes(lower)) return lower;
  const entry = window.SPORTS_CATALOG && window.SPORTS_CATALOG[s];
  return entry ? entry.category : 'autre';
}


export function applySportFilter() {
  // Reset des index activité par jour (les arrays changent selon le filtre)
  Object.keys(dayActivityIndex).forEach(k => delete dayActivityIndex[k]);

  if (activeSports.has('tout') || activeSports.size === 0) {
    appState.data = appState._allData;
  } else {
    // 1. Construire la vue filtrée : filtre par ACTIVITÉ (granularité fine)
    const filtered = appState._allData.map(d => {
      // Pas d'activités du tout → jour de repos, on garde
      if (!d.activities || d.activities.length === 0) {
        // Fallback : si pas d'array activities mais sessionType présent, utiliser sport racine
        if (d.sessionType) {
          const sport = getSportFromDay(d);
          if (sport && !activeSports.has(sport)) {
            return {
              ...d,
              tss: 0, duration: 0, zones: null, zones_hr: null, zones_power: null,
              sessionType: null, sessionName: null,
              np: 0, avgW: 0, hr: 0, ftpPct: 0, compliance: null, intensity: 0,
              activities: []
            };
          }
        }
        return { ...d };
      }

      // Filtrer les activités qui matchent les sports actifs
      const matchingActs = d.activities.filter(a => activeSports.has(a.sport));

      if (matchingActs.length === 0) {
        // Aucune activité ne correspond → jour vidé
        return {
          ...d,
          tss: 0, duration: 0, zones: null, zones_hr: null, zones_power: null,
          sessionType: null, sessionName: null,
          np: 0, avgW: 0, hr: 0, ftpPct: 0, compliance: null, intensity: 0,
          activities: []
        };
      }

      // Au moins une activité matche : recomposer le jour avec les activités filtrées
      const main = matchingActs[0]; // déjà triées par TSS desc côté Python
      const totalTss = matchingActs.reduce((s, a) => s + (a.tss || 0), 0);
      const totalDur = matchingActs.reduce((s, a) => s + (a.duration || 0), 0);

      return {
        ...d,
        tss: totalTss,
        duration: totalDur,
        sessionName: main.name,
        sessionType: main.type,
        sport: main.sport,
        np: main.np || 0,
        hr: main.hr || 0,
        ftpPct: main.ftpPct || 0,
        zones: main.zones_hr || main.zones_power || null,
        zones_hr: main.zones_hr || null,
        zones_power: main.zones_power || null,
        activities: matchingActs
      };
    });

    // 2. Recalculer CTL/ATL/TSB sur les TSS filtrés (EWMA : 42j pour CTL, 7j pour ATL)
    let ctl = 0, atl = 0;
    filtered.forEach(d => {
      const t = d.tss || 0;
      ctl = ctl + (t - ctl) / 42;
      atl = atl + (t - atl) / 7;
      d.ctl = +ctl.toFixed(1);
      d.atl = +atl.toFixed(1);
      d.tsb = +(ctl - atl).toFixed(1);
    });

    appState.data = filtered;
  }
  // Mettre à jour todayData (pointe sur le dernier jour de la vue filtrée)
  appState.todayData = appState.data[appState.data.length - 1];
  rerenderFilteredCharts();
}


export function rerenderFilteredCharts() {
  if (typeof renderHeroKpi === 'function') renderHeroKpi();
  if (typeof renderLoadChart === 'function') renderLoadChart(getInputDate('load-from'), getInputDate('load-to'));
  if (typeof renderHoursChart === 'function') renderHoursChart(getInputDate('hours-from'), getInputDate('hours-to'));
  if (typeof renderWeeklyChart === 'function') renderWeeklyChart(getInputDate('weekly-from'), getInputDate('weekly-to'));
  if (typeof renderZones === 'function') renderZones(getInputDate('zones-from'), getInputDate('zones-to'));
  if (typeof renderSessionsTable === 'function') renderSessionsTable();
  if (typeof renderCalendar === 'function') renderCalendar();
  // Page Bilan : KPIs annuels, records, chart cumul → filtrés par sport actif
  if (typeof window.renderBilan === 'function') window.renderBilan();
  // Graphe Power Profile : suit aussi le sport actif (records par sport)
  if (typeof window.renderPowerProfile === 'function') window.renderPowerProfile();
}


// ========= HELPERS DATE RANGE =========
// Important : utiliser les composantes LOCALES (pas UTC) pour éviter
// le décalage de fuseau horaire (ex: minuit local CEST → veille UTC).
export const toIsoDate = (d) => {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
};

export const fmtShortDate = (d) => d.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' }).replace('.', '');

export function sliceByDate(arr, fromIso, toIso) {
  return arr.filter(d => {
    const iso = toIsoDate(d.date);
    return iso >= fromIso && iso <= toIso;
  });
}

export function setInputDate(id, d) {
  const el = document.getElementById(id);
  el.value = toIsoDate(d);
  syncCompactDateLabel(el);
  // Si flatpickr est attaché à cet input (cas mobile), on synchronise aussi
  // sa valeur visible (sinon l'altInput continue d'afficher "Sélectionner une date")
  if (el._flatpickr) {
    try { el._flatpickr.setDate(d, false); } catch (_) {}
  }
}

// Met à jour l'overlay .date-compact-display (format DD/MM) depuis la value
// d'un <input type="date">. Appelé par setInputDate + sur l'event 'change' du
// picker natif (utilisateur qui choisit lui-même une date).
function syncCompactDateLabel(input) {
  const wrap = input.closest && input.closest('.date-compact');
  if (!wrap) return;
  const span = wrap.querySelector('.date-compact-display');
  if (!span) return;
  const v = input.value;
  if (!v) { span.textContent = ''; return; }
  const [, m, d] = v.split('-');
  span.textContent = `${d}/${m}`;
}

export function getInputDate(id) {
  return document.getElementById(id).value;
}

export function bootFilters() {

window.getSportCategory = getSportCategory;

// Auto-sync au change : couvre le cas où l'utilisateur ouvre le picker natif
document.addEventListener('change', (e) => {
  if (e.target && e.target.matches && e.target.matches('.date-compact input[type="date"]')) {
    syncCompactDateLabel(e.target);
  }
});
}
