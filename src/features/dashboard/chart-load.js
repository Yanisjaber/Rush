/* src/features/dashboard/chart-load.js — extrait de l'ancien app.js (découpage par fonctionnalité). */
import { appState } from '../../core/state.js';
import { fmtDate } from '../../core/utils.js';
import { getInputDate, getSportCategory, setInputDate, sliceByDate, toIsoDate } from './filters.js';
import { fmtDur } from '../../core/format.js';
import { activeSports } from './init.js';
import { loadTrainings } from '../training/train-modal.js';
import { compIsRealised, loadCompetitionsExpanded } from '../competitions/competitions-page.js';
import { parseTimeToMin } from '../competitions/comp-stages.js';
import { renderCalendar } from '../calendar/realise-calendar.js';
import { openSessionModal } from '../sessions/session-modal.js';

function applyLoadChartDragSelection(chart) {
  if (appState._loadDragBusy) return;
  const sub = appState.loadChart._subset || [];
  if (!sub.length) { try { chart.resetZoom(); } catch (_) {} return; }
  const x = chart.scales.x;
  let i0 = Math.round(x.min), i1 = Math.round(x.max);
  i0 = Math.max(0, Math.min(sub.length - 1, i0));
  i1 = Math.max(0, Math.min(sub.length - 1, i1));
  appState._loadDragBusy = true;
  try { chart.resetZoom(); } catch (_) {}
  if (i1 - i0 >= 1) {
    // Si la sélection démarre dans la zone projetée, on recule le début au dernier
    // jour réel : la projection a besoin de son point d'ancrage (sinon graphe vide).
    if (sub[i0] && sub[i0]._proj) {
      while (i0 > 0 && sub[i0]._proj) i0--;
    }
    const from = toIsoDate(sub[i0].date);
    const to = toIsoDate(sub[i1].date);
    setInputDate('load-from', new Date(from + 'T12:00:00'));
    setInputDate('load-to', new Date(to + 'T12:00:00'));
    document.querySelectorAll('#load-range .preset').forEach(b => b.classList.remove('active'));
    renderLoadChart(from, to);
  }
  setTimeout(() => { appState._loadDragBusy = false; }, 60);
}


function dayHasActivity(d) {
  return !!((d.activities && d.activities.length) || d.sessionType || (d.duration > 0));
}


// ===== Projection du prévu (CTL/ATL/TSB futurs depuis les séances planifiées) =====
// Séances prévues d'un jour futur : entraînements (filtrés par mode IA/Manuel)
// + compétitions non réalisées (TSS estimé = minutes cibles, fallback 120 min — même règle que le calendrier).
function plannedItemsForDay(iso) {
  const items = [];
  try {
    const tr = ((typeof loadTrainings === 'function') ? loadTrainings() : [])
      .filter(t => !window.coachModeKeep || window.coachModeKeep(t.ia))
      .filter(t => t.date === iso);
    for (const t of tr) items.push({ name: t.name || 'Séance prévue', tss: +t.tss || 0, duration: +t.duration || 0, sport: t.sport || 'Ride' });
  } catch (_) {}
  try {
    const comps = (typeof loadCompetitionsExpanded === 'function') ? loadCompetitionsExpanded() : [];
    for (const c of comps) {
      if (!c.dateObj || toIsoDate(c.dateObj) !== iso) continue;
      if (typeof compIsRealised === 'function' && compIsRealised(c)) continue;
      const mins = (typeof parseTimeToMin === 'function') ? parseTimeToMin(c.target) : null;
      items.push({ name: c.name || 'Compétition', tss: (+c.tss > 0 ? Math.round(+c.tss) : Math.round(mins || 120)), duration: mins || 0, isRace: true, sport: c.sport || 'Ride' });
    }
  } catch (_) {}
  // Filtre sport actif : même règle que le calendrier (cohérent avec la courbe réelle filtrée)
  if (typeof activeSports !== 'undefined' && !activeSports.has('tout') && activeSports.size > 0 && typeof getSportCategory === 'function') {
    return items.filter(it => activeSports.has(getSportCategory(it.sport)));
  }
  return items;
}


// Jours projetés après le dernier jour réel, jusqu'à endIso inclus.
// Mêmes constantes PMC que le réel (CTL 42 j / ATL 7 j), TSB = forme avant la séance du jour.
function buildProjection(lastRealDay, endIso) {
  const out = [];
  if (!lastRealDay) return out;
  let ctl = +lastRealDay.ctl || 0, atl = +lastRealDay.atl || 0;
  const d = new Date(lastRealDay.date);
  d.setHours(12, 0, 0, 0);
  for (let guard = 0; guard < 120; guard++) {
    d.setDate(d.getDate() + 1);
    const iso = toIsoDate(d);
    if (iso > endIso) break;
    const items = plannedItemsForDay(iso);
    const tss = items.reduce((s, it) => s + (it.tss || 0), 0);
    const prevCtl = ctl, prevAtl = atl;
    ctl = prevCtl + (tss - prevCtl) / 42;
    atl = prevAtl + (tss - prevAtl) / 7;
    out.push({ date: new Date(d), ctl: +ctl.toFixed(1), atl: +atl.toFixed(1), tsb: +(prevCtl - prevAtl).toFixed(1), tss, planned: items, _proj: true });
  }
  return out;
}


// Horizon de projection par défaut quand la plage s'arrête à aujourd'hui
const LOAD_PROJ_DAYS = 14;


export function renderLoadChart(fromIso, toIso) {
  const subset = sliceByDate(appState.data, fromIso, toIso);
  const todayIso = toIsoDate(appState.today);
  const lastReal = appState.data.length ? appState.data[appState.data.length - 1] : null;
  // Projection uniquement si la plage couvre aujourd'hui (dernier jour réel inclus)
  let proj = [];
  if (subset.length && lastReal && toIso >= todayIso && subset[subset.length - 1] === lastReal) {
    let endIso = toIso;
    if (toIso <= todayIso) {
      const e = new Date(appState.today);
      e.setDate(e.getDate() + LOAD_PROJ_DAYS);
      endIso = toIsoDate(e);
    }
    proj = buildProjection(lastReal, endIso);
  }
  appState.loadChart._subset = subset.concat(proj); // pour le tooltip + le clic
  appState.loadChart._realCount = subset.length;    // pour le séparateur « Aujourd'hui » + filtre tooltip
  const projNulls = proj.map(() => null);
  appState.loadChart.data.labels = subset.map(d => fmtDate(d.date)).concat(proj.map(d => fmtDate(d.date)));
  appState.loadChart.data.datasets[0].data = subset.map(d => d.ctl).concat(projNulls);
  appState.loadChart.data.datasets[1].data = subset.map(d => d.atl).concat(projNulls);
  appState.loadChart.data.datasets[2].data = subset.map(d => d.tsb).concat(projNulls);
  // Datasets projetés : null sur le réel sauf le dernier jour (jonction), puis valeurs projetées
  const mkProj = (key) => {
    if (!proj.length) return [];
    const arr = new Array(subset.length - 1).fill(null);
    arr.push(subset[subset.length - 1][key]);
    return arr.concat(proj.map(p => p[key]));
  };
  appState.loadChart.data.datasets[3].data = mkProj('ctl');
  appState.loadChart.data.datasets[4].data = mkProj('atl');
  appState.loadChart.data.datasets[5].data = mkProj('tsb');
  // Point sur la courbe de forme (CTL) uniquement les jours avec activité
  appState.loadChart.data.datasets[0].pointRadius = subset.map(d => dayHasActivity(d) ? 3.5 : 0).concat(proj.map(() => 0));
  appState.loadChart.data.datasets[0].pointHoverRadius = subset.map(d => dayHasActivity(d) ? 6 : 0).concat(proj.map(() => 0));
  appState.loadChart.data.datasets[0].pointBackgroundColor = '#60a5fa';
  appState.loadChart.data.datasets[0].pointBorderColor = '#0b0e14';
  appState.loadChart.data.datasets[0].pointBorderWidth = 1.5;
  // Points creux sur la projection CTL les jours avec séance prévue (cliquables → calendrier Prévu)
  if (proj.length) {
    const pr = new Array(subset.length).fill(0).concat(proj.map(p => (p.planned && p.planned.length) ? 3 : 0));
    appState.loadChart.data.datasets[3].pointRadius = pr;
    appState.loadChart.data.datasets[3].pointHoverRadius = pr.map(r => (r ? 5.5 : 0));
    appState.loadChart.data.datasets[3].pointBackgroundColor = '#0b0e14';
    appState.loadChart.data.datasets[3].pointBorderColor = 'rgba(96,165,250,0.85)';
    appState.loadChart.data.datasets[3].pointBorderWidth = 1.5;
  } else {
    appState.loadChart.data.datasets[3].pointRadius = 0;
    appState.loadChart.data.datasets[3].pointHoverRadius = 0;
  }
  appState.loadChart.update();
}


// Navigue vers un jour précis dans le calendrier (mode Réalisé) et le met en évidence.
export function goToCalendarDay(iso, mode) {
  const d = new Date(iso + 'T12:00:00');
  if (isNaN(d.getTime())) return;
  appState.calendarMode = (mode === 'prevu') ? 'prevu' : 'realise';
  document.querySelectorAll('#calendar-subtabs .subtab').forEach(b => b.classList.toggle('active', b.dataset.mode === appState.calendarMode));
  // Vue "4 semaines" ancrée sur la semaine de l'activité (en haut), pas le mois.
  appState.selectedMonth = null;
  appState.calendarAnchorDate = d;
  if (window.__updateMonthOverlay) window.__updateMonthOverlay();
  if (window.location.hash !== '#calendrier') window.location.hash = '#calendrier';
  if (typeof renderCalendar === 'function') renderCalendar();
  setTimeout(() => {
    // Pas de scroll : la semaine de l'activité est déjà en haut du calendrier.
    const card = document.querySelector(`#week-calendar .day-card[data-iso="${iso}"]`);
    if (card) {
      card.classList.add('day-flash');
      setTimeout(() => card.classList.remove('day-flash'), 1500);
    }
    if (typeof openSessionModal === 'function') openSessionModal(iso, appState.calendarMode);
  }, 300);
}

export function bootChartLoad() {


// ========= CHART 1: CTL/ATL/TSB + Recovery (filtrable par dates) =========
appState.loadChart = new Chart(document.getElementById('chart-load'), {
  type: 'line',
  data: {
    labels: [],
    datasets: [
      { label: 'CTL', data: [], borderColor: '#60a5fa', backgroundColor: (c) => { const ch = c.chart, a = ch.chartArea; if (!a) return 'rgba(96,165,250,0.12)'; const g = ch.ctx.createLinearGradient(0, a.top, 0, a.bottom); g.addColorStop(0, 'rgba(96,165,250,0.30)'); g.addColorStop(1, 'rgba(96,165,250,0.02)'); return g; }, borderWidth: 2.5, cubicInterpolationMode: 'monotone', pointRadius: 0, pointHoverRadius: 5, pointHoverBorderWidth: 0, pointHoverBackgroundColor: '#60a5fa', fill: 'origin', order: 3, yAxisID: 'y' },
      { label: 'ATL', data: [], borderColor: '#fbbf24', backgroundColor: 'transparent', borderWidth: 2, cubicInterpolationMode: 'monotone', pointRadius: 0, pointHoverRadius: 5, pointHoverBorderWidth: 0, pointHoverBackgroundColor: '#fbbf24', fill: false, order: 2, yAxisID: 'y' },
      { label: 'TSB', data: [], borderColor: '#a78bfa', borderWidth: 2, cubicInterpolationMode: 'monotone', pointRadius: 0, pointHoverRadius: 5, pointHoverBorderWidth: 0, pointHoverBackgroundColor: '#a78bfa', fill: { target: { value: 0 }, above: 'rgba(167,139,250,0.22)', below: 'rgba(83,74,183,0.30)' }, order: 1, yAxisID: 'y' },
      // Projection (séances prévues) : mêmes couleurs, atténuées + pointillés
      { label: 'CTL prévu', data: [], borderColor: 'rgba(96,165,250,0.55)', backgroundColor: 'transparent', borderWidth: 2, borderDash: [6, 5], cubicInterpolationMode: 'monotone', pointRadius: 0, pointHoverRadius: 5, pointHoverBorderWidth: 0, pointHoverBackgroundColor: '#60a5fa', fill: false, order: 3, yAxisID: 'y', spanGaps: false },
      { label: 'ATL prévu', data: [], borderColor: 'rgba(251,191,36,0.5)', backgroundColor: 'transparent', borderWidth: 1.5, borderDash: [6, 5], cubicInterpolationMode: 'monotone', pointRadius: 0, pointHoverRadius: 5, pointHoverBorderWidth: 0, pointHoverBackgroundColor: '#fbbf24', fill: false, order: 2, yAxisID: 'y', spanGaps: false },
      { label: 'TSB prévu', data: [], borderColor: 'rgba(167,139,250,0.5)', backgroundColor: 'transparent', borderWidth: 1.5, borderDash: [6, 5], cubicInterpolationMode: 'monotone', pointRadius: 0, pointHoverRadius: 5, pointHoverBorderWidth: 0, pointHoverBackgroundColor: '#a78bfa', fill: false, order: 1, yAxisID: 'y', spanGaps: false }
    ]
  },
  plugins: [{
    // Séparateur vertical « Aujourd'hui » quand la projection est affichée
    id: 'todayLine',
    afterDatasetsDraw(chart) {
      const rc = chart._realCount;
      if (!rc || rc >= chart.data.labels.length) return;
      const x = chart.scales.x.getPixelForValue(rc - 1);
      if (!isFinite(x)) return;
      const { top, bottom } = chart.chartArea;
      const ctx = chart.ctx;
      ctx.save();
      ctx.strokeStyle = 'rgba(255,255,255,0.22)';
      ctx.setLineDash([4, 4]);
      ctx.lineWidth = 1;
      ctx.beginPath(); ctx.moveTo(x, top); ctx.lineTo(x, bottom); ctx.stroke();
      ctx.setLineDash([]);
      ctx.fillStyle = '#6b7488';
      ctx.font = '10px system-ui, sans-serif';
      ctx.textAlign = 'left';
      ctx.fillText("Aujourd'hui", x + 5, top + 11);
      ctx.restore();
    }
  }],
  options: {
    responsive: true, maintainAspectRatio: false,
    interaction: { mode: 'index', intersect: false },
    onClick: (evt) => {
      // N'ouvre le calendrier QUE si on clique réellement sur un rond d'activité
      // (les jours sans activité ont un point de rayon 0 → non cliquables).
      const els = appState.loadChart.getElementsAtEventForMode(evt, 'nearest', { intersect: true }, false);
      if (!els || !els.length) return;
      const d = appState.loadChart._subset && appState.loadChart._subset[els[0].index];
      if (!d) return;
      // Jour projeté : ouvre le calendrier côté Prévu sur ce jour
      if (d._proj) {
        if (d.planned && d.planned.length && typeof goToCalendarDay === 'function') goToCalendarDay(toIsoDate(d.date), 'prevu');
        return;
      }
      if (!dayHasActivity(d)) return;
      if (typeof goToCalendarDay === 'function') goToCalendarDay(toIsoDate(d.date));
    },
    onHover: (evt) => {
      const el = evt.native && evt.native.target;
      if (!el) return;
      const hit = appState.loadChart.getElementsAtEventForMode(evt, 'nearest', { intersect: true }, false);
      el.style.cursor = (hit && hit.length) ? 'pointer' : 'default';
    },
    plugins: {
      legend: { display: false },
      tooltip: {
        // Au point de jonction (dernier jour réel), les datasets projetés dupliquent
        // la valeur réelle pour la continuité du trait : on masque ces doublons.
        filter: (item) => !(item.datasetIndex >= 3 && appState.loadChart._realCount && item.dataIndex === appState.loadChart._realCount - 1),
        callbacks: {
          // Ajoute le(s) nom(s) de sortie + durée/km sous les valeurs CTL/ATL/TSB.
          afterBody: (items) => {
            if (!items || !items.length) return '';
            const d = appState.loadChart._subset && appState.loadChart._subset[items[0].dataIndex];
            if (!d) return '';
            // Jour projeté : liste les séances prévues du jour
            if (d._proj) {
              const pl = d.planned || [];
              if (!pl.length) return '';
              return pl.map(p => {
                const dur = p.duration ? fmtDur(p.duration) : '';
                const meta = [dur, p.tss ? Math.round(p.tss) + ' TSS' : ''].filter(Boolean).join(' · ');
                return `• ${p.isRace ? '🏁 ' : ''}${p.name} (prévu)${meta ? ' — ' + meta : ''}`;
              });
            }
            const acts = (d.activities && d.activities.length) ? d.activities : (d.sessionType ? [d] : []);
            if (!acts.length) return '';
            return acts.map(a => {
              const name = a.name || a.sessionName || 'Séance';
              const dur = a.duration ? fmtDur(a.duration) : '';
              const km = a.distance_km ? window.fmtDist(a.distance_km, a.raw_type || a.sport) : '';
              const meta = [dur, km].filter(Boolean).join(' · ');
              return meta ? `• ${name} — ${meta}` : `• ${name}`;
            });
          }
        }
      },
      // Sélection à la souris (drag) → met à jour la plage de dates.
      zoom: {
        zoom: {
          drag: { enabled: true, backgroundColor: 'rgba(74,222,128,0.12)', borderColor: 'rgba(74,222,128,0.55)', borderWidth: 1 },
          mode: 'x',
          onZoomComplete: ({ chart }) => { applyLoadChartDragSelection(chart); },
        }
      }
    },
    scales: {
      x: {
        // Mobile : moins de ticks (4) + police plus petite ; desktop : 8 ticks normaux.
        ticks: {
          maxTicksLimit: window.innerWidth < 860 ? 4 : 8,
          color: '#6b7488',
          font: { size: window.innerWidth < 860 ? 9 : 11 },
          maxRotation: 0,
        },
        grid: { display: false },
        border: { display: false },
      },
      y: {
        position: 'left',
        title: {
          display: window.innerWidth >= 860,  // pas de titre "TSS / TSB" sur mobile (gain de place)
          text: 'TSS / TSB',
          color: '#6b7488',
        },
        ticks: {
          color: '#6b7488',
          stepSize: 20,
          font: { size: window.innerWidth < 860 ? 9 : 11 },
        },
        grid: { color: 'rgba(255,255,255,0.045)', drawBorder: false },
        border: { display: false },
      },
    }
  }
});


// Drag souris sur le graphe → convertit la sélection en plage de dates + re-render.
appState._loadDragBusy = false;


// Refresh de la courbe de charge sur la plage courante (appelé quand les
// prévus/compétitions changent : ajout, modif, suppression, pull cloud, bascule IA/Manuel).
window.refreshLoadChart = function () {
  try { renderLoadChart(getInputDate('load-from'), getInputDate('load-to')); } catch (_) {}
};

window.goToCalendarDay = goToCalendarDay;


// Init : 30 derniers jours par défaut
{
  const end = new Date(appState.today);
  const start = new Date(appState.today);
  start.setDate(end.getDate() - 29);
  setInputDate('load-from', start);
  setInputDate('load-to', end);
  // bornes min/max sur les inputs
  // max étendu dans le futur : permet de sélectionner une plage incluant la projection du prévu
  const _futureMax = new Date(appState.today);
  _futureMax.setDate(_futureMax.getDate() + 56);
  document.getElementById('load-from').min = toIsoDate(appState.data[0].date);
  document.getElementById('load-from').max = toIsoDate(_futureMax);
  document.getElementById('load-to').min = toIsoDate(appState.data[0].date);
  document.getElementById('load-to').max = toIsoDate(_futureMax);
  renderLoadChart(toIsoDate(start), toIsoDate(end));

  // Sur mobile : convertit TOUS les date inputs en flatpickr custom pour virer
  // la chrome native iOS (chevron) qui prend de la place et ne s'enlève pas en CSS.
  if (window.innerWidth < 860 && window.flatpickr) {
    document.querySelectorAll('.date-range input[type="date"]').forEach(el => {
      if (el._flatpickr) return;
      const currentVal = el.value;
      el.type = 'text';
      el.setAttribute('readonly', 'readonly');
      window.flatpickr(el, {
        dateFormat: 'Y-m-d',
        altInput: true,
        altFormat: 'd/m',
        locale: window.flatpickr?.l10ns?.fr || 'fr',
        defaultDate: currentVal || undefined,
        onChange: (sel, dateStr, fp) => {
          fp.input.value = dateStr;
          fp.input.dispatchEvent(new Event('change', { bubbles: true }));
        },
      });
    });
  }
}


// Event handlers
document.querySelectorAll('#load-range .preset').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('#load-range .preset').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    const days = +btn.dataset.days;
    const end = new Date(appState.today);
    const start = new Date(appState.today);
    start.setDate(end.getDate() - (days - 1));
    setInputDate('load-from', start);
    setInputDate('load-to', end);
    renderLoadChart(toIsoDate(start), toIsoDate(end));
  });
});

['load-from', 'load-to'].forEach(id => {
  document.getElementById(id).addEventListener('change', () => {
    // Désactiver les boutons preset si la sélection est manuelle
    document.querySelectorAll('#load-range .preset').forEach(b => b.classList.remove('active'));
    renderLoadChart(getInputDate('load-from'), getInputDate('load-to'));
  });
});

// Bouton « Réinitialiser » : revient à la plage par défaut (30 jours).
document.getElementById('load-reset')?.addEventListener('click', () => {
  try { if (appState.loadChart.resetZoom) appState.loadChart.resetZoom(); } catch (_) {}
  const p30 = document.querySelector('#load-range .preset[data-days="30"]');
  if (p30) p30.click();
});
}
