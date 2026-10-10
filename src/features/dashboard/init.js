/* src/features/dashboard/init.js — extrait de l'ancien app.js (découpage par fonctionnalité). */
import { appState } from '../../core/state.js';
import { loadData } from '../../core/data-loader.js';
import { renderCalendar } from '../calendar/realise-calendar.js';
import { renderCompList } from '../competitions/competitions-page.js';
import { activatePanel } from '../../routing/tabs.js';
import { applyActivityEditsToDays } from '../calendar/overrides.js';
import { renderHeroKpi } from './hero-kpi.js';
import { getInputDate, rerenderFilteredCharts } from './filters.js';
import { renderLoadChart } from './chart-load.js';

// today = vraie date du jour (système), à minuit local. Réassignable pour refresh à minuit.
function getRealToday() {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d;
}

// Filtre sports actif (Set : 'tout' OU sous-ensemble de cyclisme/course/musculation)
export const activeSports = new Set(['tout']);


// Programmation du refresh automatique à minuit
function scheduleMidnightRefresh() {
  const now = new Date();
  const nextMidnight = new Date(now);
  nextMidnight.setHours(24, 0, 5, 0); // 5 secondes après minuit pour éviter les edge-cases
  const msUntilMidnight = nextMidnight - now;
  setTimeout(() => {
    appState.today = getRealToday();
    // Refresh des vues qui dépendent de "today"
    if (typeof renderCalendar === 'function') renderCalendar();
    if (typeof renderCompList === 'function') renderCompList();
    // Met à jour le timestamp affiché en header si présent
    const tsEl = document.getElementById('header-date');
    if (tsEl) tsEl.textContent = appState.today.toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
    // Reprogramme pour la prochaine minuit
    scheduleMidnightRefresh();
  }, msUntilMidnight);
}


// Re-render complet quand le data loader Supabase remplace window.DASHBOARD_DATA
// (après login + chargement depuis BDD)
// Reconstruit _allData depuis window.DASHBOARD_DATA (clone profond des activités
// pour ne pas muter la source), applique le calque d'overrides, puis re-render.
function rebuildFromDashboard() {
  if (!window.DASHBOARD_DATA || !window.DASHBOARD_DATA.days) return;
  appState._allData = window.DASHBOARD_DATA.days.map(d => ({
    ...d,
    date: new Date(d.date + 'T12:00:00'),
    activities: (d.activities || []).map(a => ({ ...a })),
  }));
  applyActivityEditsToDays(appState._allData);
  appState.data = appState._allData;
  appState.todayData = appState._allData[appState._allData.length - 1];
  if (typeof renderHeroKpi === 'function') renderHeroKpi();
  if (typeof rerenderFilteredCharts === 'function') rerenderFilteredCharts();
  if (typeof renderCalendar === 'function') renderCalendar();
  const f = getInputDate('load-from'), t = getInputDate('load-to');
  if (f && t && typeof renderLoadChart === 'function') renderLoadChart(f, t);
}

export async function bootInit() {

appState._allData = await loadData();

appState.data = appState._allData;

appState.todayData = appState._allData[appState._allData.length - 1];

appState.today = getRealToday();

// Exposé pour les modules externes (bilan.js etc.) qui doivent respecter le filtre.
window.activeSports = activeSports;

scheduleMidnightRefresh();


// Re-render des vues qui dépendent du mode IA/Manuel quand on bascule le toggle.
// L'event 'appModeChange' est dispatché par js/app-mode.js à chaque applyAppMode().
window.addEventListener('appModeChange', (e) => {
  if (typeof renderCalendar === 'function') renderCalendar();
  // La projection de la courbe de charge filtre les prévus par mode IA/Manuel
  if (window.refreshLoadChart) window.refreshLoadChart();
  // L'onglet IA (p7) n'existe qu'en mode IA : si on repasse en Manuel dessus, on rebascule au tableau de bord.
  const mode = e && e.detail && e.detail.mode;
  if (mode === 'manual') {
    const p7 = document.getElementById('p7');
    if (p7 && p7.classList.contains('active') && typeof activatePanel === 'function') activatePanel('p1', true);
  }
});


// Filtre planif selon le mode : Manuel => éléments non-IA ; IA => éléments IA.
// (les activités RÉALISÉES ne passent jamais par ce filtre — toujours visibles)
window.coachModeKeep = function (ia) {
  return (window.APP_MODE === 'ia') ? (ia === true) : (ia !== true);
};

window.__applyOverridesAndRerender = rebuildFromDashboard;


window.addEventListener('dashboardDataReplaced', () => {
  try {
    rebuildFromDashboard();
    console.log('[main] Vues re-rendues avec données Supabase');
  } catch (e) {
    console.error('[main] Erreur re-render après load Supabase:', e);
  }
});


// Sécurité : si la machine sort de veille / change de timezone, re-vérifier au focus
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'visible') {
    const real = getRealToday();
    if (real.getTime() !== appState.today.getTime()) {
      appState.today = real;
      if (typeof renderCalendar === 'function') renderCalendar();
      if (typeof renderCompList === 'function') renderCompList();
    }
  }
});
}
