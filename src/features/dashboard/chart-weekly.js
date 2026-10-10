/* src/features/dashboard/chart-weekly.js — extrait de l'ancien app.js (découpage par fonctionnalité). */
import { appState } from '../../core/state.js';
import { fmtShortDate, getInputDate, setInputDate, toIsoDate } from './filters.js';
import { applyHoursPreset, hideHoursDetail, renderHoursChart, setVolStats } from './chart-hours.js';


// Lundi de la semaine d'une date donnée (semaine ISO calendaire Mon-Sun)
export function getMondayOfWeek(date) {
  const d = new Date(date);
  const day = d.getDay();         // 0=Dim, 1=Lun, ..., 6=Sam
  const diff = day === 0 ? -6 : 1 - day;
  d.setDate(d.getDate() + diff);
  d.setHours(0, 0, 0, 0);
  return d;
}


export function computeWeeksByDate(fromIso, toIso) {
  // Regrouper par VRAIES semaines calendaires (Lundi -> Dimanche).
  // La semaine en cours est affichée même incomplète (les jours futurs valent 0).
  const fromDate = new Date(fromIso + 'T12:00:00');
  const toDate = new Date(toIso + 'T12:00:00');
  const firstMonday = getMondayOfWeek(fromDate);
  // Aller jusqu'au dimanche de la semaine de toDate
  const lastSunday = getMondayOfWeek(toDate);
  lastSunday.setDate(lastSunday.getDate() + 6);

  // Index data par date ISO pour lookup O(1)
  const dataByIso = {};
  appState.data.forEach(d => { dataByIso[toIsoDate(d.date)] = d; });

  const weeks = [];
  let weekStart = new Date(firstMonday);

  while (weekStart <= lastSunday) {
    const weekEnd = new Date(weekStart);
    weekEnd.setDate(weekStart.getDate() + 6);

    const weekDays = [];
    let weekHasAny = false;
    for (let i = 0; i < 7; i++) {
      const day = new Date(weekStart);
      day.setDate(weekStart.getDate() + i);
      const iso = toIsoDate(day);
      if (dataByIso[iso]) {
        weekDays.push(dataByIso[iso]);
        weekHasAny = true;
      } else {
        // Jour futur ou absent : barre vide / grise
        weekDays.push({
          date: day,
          tss: 0,
          sessionName: null,
          duration: 0
        });
      }
    }

    // Si la semaine entière est en dehors de l'historique (très ancien), on skip
    if (weekHasAny) {
      const tss = weekDays.reduce((s, d) => s + (d.tss || 0), 0);
      weeks.push({
        label: `${fmtShortDate(weekStart)} - ${fmtShortDate(weekEnd)}`,
        tss,
        days: weekDays
      });
    }

    // Avancer d'une semaine
    weekStart = new Date(weekStart);
    weekStart.setDate(weekStart.getDate() + 7);
  }

  return weeks;
}


export function renderWeeklyChart(fromIso, toIso) {
  appState.currentWeeks = computeWeeksByDate(fromIso, toIso);
  appState.weeklyChart.data.labels = appState.currentWeeks.map(w => {
    const d = w.days && w.days[0] && w.days[0].date;
    return d ? String(d.getDate()).padStart(2, '0') + '/' + String(d.getMonth() + 1).padStart(2, '0') : w.label;
  });
  appState.weeklyChart.data.datasets[0].data = appState.currentWeeks.map(w => w.tss);
  appState.weeklyChart.data.datasets[0].pointBackgroundColor = '#4ade80';
  appState.weeklyChart.update();
  setVolStats(appState.currentWeeks[appState.currentWeeks.length - 1]);
  hideWeekDetail();
}


function showWeekDetail(week) {
  const detailDiv = document.getElementById('weekly-detail');
  detailDiv.style.display = 'block';
  document.getElementById('weekly-detail-title').textContent =
    `Détail jour par jour · semaine du ${week.label}`;

  const dowFr = ['Dim','Lun','Mar','Mer','Jeu','Ven','Sam'];
  const dayLabels = week.days.map(d => `${dowFr[d.date.getDay()]} ${d.date.getDate()}`);
  const dayTss = week.days.map(d => d.tss);
  const dayColors = week.days.map(d => {
    if (!d.tss) return '#2a3142';      // jour de repos / pas de séance
    if (d.tss > 150) return '#f87171'; // grosse séance
    if (d.tss > 80) return '#fbbf24';  // séance moyenne
    return '#4ade80';                   // séance légère
  });
  const daySessionNames = week.days.map(d => d.sessionName || 'Repos');

  if (appState.dailyChart) {
    appState.dailyChart.data.labels = dayLabels;
    appState.dailyChart.data.datasets[0].data = dayTss;
    appState.dailyChart.data.datasets[0].backgroundColor = dayColors;
    appState.dailyChart.$daySessionNames = daySessionNames;
    appState.dailyChart.update();
  } else {
    const canvas = document.getElementById('chart-weekly-daily');
    appState.dailyChart = new Chart(canvas, {
      type: 'bar',
      data: {
        labels: dayLabels,
        datasets: [{ data: dayTss, backgroundColor: dayColors, borderRadius: 4 }]
      },
      options: {
        responsive: true, maintainAspectRatio: false,
        plugins: {
          legend: { display: false },
          tooltip: {
            callbacks: {
              title: (items) => items[0].label,
              label: (ctx) => {
                const name = ctx.chart.$daySessionNames?.[ctx.dataIndex] || '';
                return name ? `${name} · ${ctx.parsed.y} TSS` : `${ctx.parsed.y} TSS`;
              }
            }
          }
        },
        scales: {
          y: { title: { display: true, text: 'TSS' }, beginAtZero: true },
          x: { grid: { display: false }, ticks: { font: { size: 11 } } }
        }
      }
    });
    appState.dailyChart.$daySessionNames = daySessionNames;
  }
}


function hideWeekDetail() {
  document.getElementById('weekly-detail').style.display = 'none';
  appState.selectedWeekIndex = null;
}


// Helper preset : N semaines calendaires (semaine courante + N-1 semaines passées)
function applyWeeklyPreset(numWeeks) {
  const end = new Date(appState.today);
  const currentMonday = getMondayOfWeek(end);
  const start = new Date(currentMonday);
  start.setDate(currentMonday.getDate() - (numWeeks - 1) * 7);
  setInputDate('weekly-from', start);
  setInputDate('weekly-to', end);
  renderWeeklyChart(toIsoDate(start), toIsoDate(end));
}

export function bootChartWeekly() {


// ========= CHART WEEKLY (filtrable par nombre de semaines + drill-down jour) =========

appState.currentWeeks = [];

appState.selectedWeekIndex = null;

appState.dailyChart = null;


appState.weeklyChart = new Chart(document.getElementById('chart-weekly'), {
  type: 'line',
  data: {
    labels: [],
    datasets: [{
      data: [],
      borderColor: '#4ade80', borderWidth: 2.5,
      backgroundColor: (c) => { const ch = c.chart, a = ch.chartArea; if (!a) return 'rgba(74,222,128,0.10)'; const g = ch.ctx.createLinearGradient(0, a.top, 0, a.bottom); g.addColorStop(0, 'rgba(74,222,128,0.28)'); g.addColorStop(1, 'rgba(74,222,128,0.02)'); return g; },
      fill: 'origin', cubicInterpolationMode: 'monotone', tension: 0.35,
      pointRadius: 4, pointHoverRadius: 6, pointBackgroundColor: [], pointBorderColor: '#0b0e14', pointBorderWidth: 1.5,
    }]
  },
  options: {
    responsive: true, maintainAspectRatio: false,
    interaction: { mode: 'index', intersect: false },
    onClick: (event, elements) => {
      if (elements.length === 0) return;
      const idx = elements[0].index;
      if (appState.selectedWeekIndex === idx) {
        // Re-clic sur la même barre → on ferme
        hideWeekDetail();
      } else {
        appState.selectedWeekIndex = idx;
        showWeekDetail(appState.currentWeeks[idx]);
      }
    },
    onHover: (event, elements) => {
      event.native.target.style.cursor = elements.length ? 'pointer' : 'default';
      if (elements.length) setVolStats(appState.currentWeeks[elements[0].index]);
    },
    plugins: {
      legend: { display: false },
      tooltip: { enabled: false }
    },
    scales: {
      y: { title: { display: true, text: 'TSS hebdo', color: '#6b7488' }, beginAtZero: true, ticks: { color: '#6b7488' }, grid: { color: 'rgba(255,255,255,0.045)', drawBorder: false }, border: { display: false } },
      x: { grid: { display: false }, border: { display: false }, ticks: { color: '#6b7488', font: { size: 10 }, maxRotation: 0, autoSkip: true, maxTicksLimit: 14 } }
    }
  }
});


document.getElementById('weekly-detail-close').addEventListener('click', hideWeekDetail);


// Init : 12 semaines calendaires (semaine courante + 11 précédentes)
document.getElementById('weekly-from').min = toIsoDate(appState.data[0].date);

document.getElementById('weekly-from').max = toIsoDate(appState.data[appState.data.length-1].date);

document.getElementById('weekly-to').min = toIsoDate(appState.data[0].date);

document.getElementById('weekly-to').max = toIsoDate(appState.data[appState.data.length-1].date);

applyWeeklyPreset(12);


// Presets : 4 sem / 12 sem (pilotent Heures ET TSS pour rester en phase)
document.querySelectorAll('#weekly-range .preset').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('#weekly-range .preset').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    applyWeeklyPreset(+btn.dataset.weeks);
    if (typeof applyHoursPreset === 'function') applyHoursPreset(+btn.dataset.weeks);
  });
});


// Date inputs manuels : déselectionne les presets + synchronise les deux graphes
['weekly-from', 'weekly-to'].forEach(id => {
  document.getElementById(id).addEventListener('change', () => {
    document.querySelectorAll('#weekly-range .preset').forEach(b => b.classList.remove('active'));
    const f = getInputDate('weekly-from'), t = getInputDate('weekly-to');
    renderWeeklyChart(f, t);
    setInputDate('hours-from', new Date(f + 'T12:00:00'));
    setInputDate('hours-to', new Date(t + 'T12:00:00'));
    renderHoursChart(f, t);
  });
});


// Bascule métrique de la carte Volume (Heures / TSS) : montre le bon graphe.
(function setupVolumeToggle() {
  const toggle = document.getElementById('vol-toggle');
  if (!toggle) return;
  const hoursWrap = document.getElementById('vol-hours-wrap');
  const tssWrap = document.getElementById('vol-tss-wrap');
  toggle.querySelectorAll('.ztoggle-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      toggle.querySelectorAll('.ztoggle-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      const showHours = btn.dataset.metric === 'hours';
      if (hoursWrap) hoursWrap.style.display = showHours ? '' : 'none';
      if (tssWrap) tssWrap.style.display = showHours ? 'none' : '';
      if (typeof hideHoursDetail === 'function') hideHoursDetail();
      if (typeof hideWeekDetail === 'function') hideWeekDetail();
      // Un graphe caché a une taille nulle → resize quand il réapparaît.
      try { if (showHours) appState.hoursChart.resize(); else appState.weeklyChart.resize(); } catch (_) {}
      // Rafraîchit le bandeau de stats selon le graphe affiché (dernière semaine).
      const arr = showHours ? appState.currentHoursWeeks : appState.currentWeeks;
      setVolStats(arr[arr.length - 1]);
    });
  });
})();
}
