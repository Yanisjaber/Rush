/* src/features/dashboard/chart-hours.js — extrait de l'ancien app.js (découpage par fonctionnalité). */
import { appState } from '../../core/state.js';
import { getInputDate, setInputDate, toIsoDate } from './filters.js';
import { computeWeeksByDate, getMondayOfWeek } from './chart-weekly.js';


// Bandeau de stats au-dessus du graphe Volume : durée, km, D+, TSS de la semaine.
function formatWeekStats(week) {
  if (!week) return '';
  let mins = 0, km = 0, dplus = 0;
  for (const d of (week.days || [])) {
    mins += d.duration || 0;
    for (const a of (d.activities || [])) { km += a.distance_km || 0; dplus += a.elevation_gain || 0; }
  }
  const h = Math.floor(mins / 60), m = Math.round(mins % 60);
  const durStr = h > 0 ? `${h}h${m ? String(m).padStart(2, '0') : ''}` : `${m} min`;
  const ic = {
    dur: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>',
    km: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="6" cy="19" r="2.4"/><circle cx="18" cy="5" r="2.4"/><path d="M8.4 19H15a3.5 3.5 0 0 0 0-7H9a3.5 3.5 0 0 1 0-7h6.6"/></svg>',
    dplus: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 20 9 9 13 15 16 10 21 20"/></svg>',
    tss: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/></svg>',
  };
  const chip = (icon, val, lbl) => `<div class="vol-stat">${icon}<div><span class="vs-val">${val}</span><span class="vs-lbl">${lbl}</span></div></div>`;
  const chips = [chip(ic.dur, durStr, 'Durée')];
  if (km > 0) chips.push(chip(ic.km, window.fmtKm(km) + ' km', 'Distance'));
  if (dplus > 0) chips.push(chip(ic.dplus, Math.round(dplus) + ' m', 'D+'));
  chips.push(chip(ic.tss, Math.round(week.tss || 0), 'TSS'));
  return `<div class="vol-stats-week">${week.label}</div><div class="vol-stats-grid">${chips.join('')}</div>`;
}

export function setVolStats(week) {
  const el = document.getElementById('vol-stats');
  if (el) el.innerHTML = formatWeekStats(week);
}


export function renderHoursChart(fromIso, toIso) {
  appState.currentHoursWeeks = computeWeeksByDate(fromIso, toIso);
  const labels = appState.currentHoursWeeks.map(w => {
    const d = w.days && w.days[0] && w.days[0].date;
    return d ? String(d.getDate()).padStart(2, '0') + '/' + String(d.getMonth() + 1).padStart(2, '0') : w.label;
  });
  const hoursArr = appState.currentHoursWeeks.map(w => +(w.days.reduce((s, d) => s + (d.duration || 0), 0) / 60).toFixed(1));
  const colors = hoursArr.map(h => {
    if (h === 0) return '#2a3142';
    if (h > 12) return '#f87171';
    if (h > 8) return '#fbbf24';
    return '#4ade80';
  });
  appState.hoursChart.data.labels = labels;
  appState.hoursChart.data.datasets[0].data = hoursArr;
  appState.hoursChart.data.datasets[0].pointBackgroundColor = '#4ade80';
  appState.hoursChart.update();
  setVolStats(appState.currentHoursWeeks[appState.currentHoursWeeks.length - 1]);
  hideHoursDetail();
}


function showHoursDetail(week) {
  if (!week) return;
  document.getElementById('hours-detail').style.display = 'block';
  document.getElementById('hours-detail-title').textContent =
    `Détail jour par jour · semaine du ${week.label}`;

  const dowFr = ['Dim','Lun','Mar','Mer','Jeu','Ven','Sam'];
  const dayLabels = week.days.map(d => `${dowFr[d.date.getDay()]} ${d.date.getDate()}`);
  const dayHours = week.days.map(d => +((d.duration || 0) / 60).toFixed(1));
  const dayColors = dayHours.map(h => {
    if (h === 0) return '#2a3142';
    if (h > 3) return '#f87171';
    if (h > 1.5) return '#fbbf24';
    return '#4ade80';
  });
  const daySessionNames = week.days.map(d => d.sessionName || 'Repos');

  if (appState.hoursDailyChart) {
    appState.hoursDailyChart.data.labels = dayLabels;
    appState.hoursDailyChart.data.datasets[0].data = dayHours;
    appState.hoursDailyChart.data.datasets[0].backgroundColor = dayColors;
    appState.hoursDailyChart.$daySessionNames = daySessionNames;
    appState.hoursDailyChart.update();
  } else {
    const canvas = document.getElementById('chart-hours-daily');
    appState.hoursDailyChart = new Chart(canvas, {
      type: 'bar',
      data: { labels: dayLabels, datasets: [{ data: dayHours, backgroundColor: dayColors, borderRadius: 4 }] },
      options: {
        responsive: true, maintainAspectRatio: false,
        plugins: {
          legend: { display: false },
          tooltip: {
            callbacks: {
              title: (items) => items[0].label,
              label: (ctx) => {
                const name = ctx.chart.$daySessionNames?.[ctx.dataIndex] || '';
                return name ? `${name} · ${ctx.parsed.y} h` : `${ctx.parsed.y} h`;
              }
            }
          }
        },
        scales: {
          y: { beginAtZero: true, ticks: { callback: (v) => v + 'h' } },
          x: { grid: { display: false }, ticks: { font: { size: 11 } } }
        }
      }
    });
    appState.hoursDailyChart.$daySessionNames = daySessionNames;
  }
}


export function hideHoursDetail() {
  document.getElementById('hours-detail').style.display = 'none';
  appState.selectedHoursIndex = null;
}


export function applyHoursPreset(numWeeks) {
  const end = new Date(appState.today);
  const currentMonday = getMondayOfWeek(end);
  const start = new Date(currentMonday);
  start.setDate(currentMonday.getDate() - (numWeeks - 1) * 7);
  setInputDate('hours-from', start);
  setInputDate('hours-to', end);
  renderHoursChart(toIsoDate(start), toIsoDate(end));
}

export function bootChartHours() {


// (Corrélations supprimées du dashboard — bloc retiré sur demande)

// ========= CHART HOURS (heures hebdomadaires, semaines calendaires, drill-down jour) =========
appState.currentHoursWeeks = [];

appState.selectedHoursIndex = null;

appState.hoursDailyChart = null;


appState.hoursChart = new Chart(document.getElementById('chart-hours'), {
  type: 'line',
  data: { labels: [], datasets: [{
    data: [],
    borderColor: '#4ade80', borderWidth: 2.5,
    backgroundColor: (c) => { const ch = c.chart, a = ch.chartArea; if (!a) return 'rgba(74,222,128,0.10)'; const g = ch.ctx.createLinearGradient(0, a.top, 0, a.bottom); g.addColorStop(0, 'rgba(74,222,128,0.28)'); g.addColorStop(1, 'rgba(74,222,128,0.02)'); return g; },
    fill: 'origin', cubicInterpolationMode: 'monotone', tension: 0.35,
    pointRadius: 4, pointHoverRadius: 6, pointBackgroundColor: [], pointBorderColor: '#0b0e14', pointBorderWidth: 1.5,
  }] },
  options: {
    responsive: true, maintainAspectRatio: false,
    interaction: { mode: 'index', intersect: false },
    onClick: (event, elements) => {
      if (elements.length === 0) return;
      const idx = elements[0].index;
      if (appState.selectedHoursIndex === idx) {
        hideHoursDetail();
      } else {
        appState.selectedHoursIndex = idx;
        showHoursDetail(appState.currentHoursWeeks[idx]);
      }
    },
    onHover: (event, elements) => {
      event.native.target.style.cursor = elements.length ? 'pointer' : 'default';
      if (elements.length) setVolStats(appState.currentHoursWeeks[elements[0].index]);
    },
    plugins: {
      legend: { display: false },
      tooltip: { enabled: false }
    },
    scales: {
      y: { beginAtZero: true, ticks: { color: '#6b7488', callback: (v) => v + 'h' }, grid: { color: 'rgba(255,255,255,0.045)', drawBorder: false }, border: { display: false } },
      x: { grid: { display: false }, border: { display: false }, ticks: { color: '#6b7488', font: { size: 10 }, maxRotation: 0, autoSkip: true, maxTicksLimit: 14 } }
    }
  }
});


document.getElementById('hours-detail-close').addEventListener('click', hideHoursDetail);


// Init avec 12 semaines calendaires par défaut
document.getElementById('hours-from').min = toIsoDate(appState.data[0].date);

document.getElementById('hours-from').max = toIsoDate(appState.data[appState.data.length-1].date);

document.getElementById('hours-to').min = toIsoDate(appState.data[0].date);

document.getElementById('hours-to').max = toIsoDate(appState.data[appState.data.length-1].date);

applyHoursPreset(12);


document.querySelectorAll('#hours-range .preset').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('#hours-range .preset').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    applyHoursPreset(+btn.dataset.weeks);
  });
});


['hours-from', 'hours-to'].forEach(id => {
  document.getElementById(id).addEventListener('change', () => {
    document.querySelectorAll('#hours-range .preset').forEach(b => b.classList.remove('active'));
    renderHoursChart(getInputDate('hours-from'), getInputDate('hours-to'));
  });
});
}
