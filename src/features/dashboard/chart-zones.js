/* src/features/dashboard/chart-zones.js — extrait de l'ancien app.js (découpage par fonctionnalité). */
import { appState } from '../../core/state.js';
import { getInputDate, setInputDate, toIsoDate } from './filters.js';
import { loadStreamsFromSupabase } from '../streams/streams-cache.js';
import { fmtDur } from '../../core/format.js';


// ========= CHART ZONES (avec sélecteur de période) =========
const zoneLabels = ['Z1 récup', 'Z2 endurance', 'Z3 tempo', 'Z4 seuil', 'Z5 VO2max'];

const zoneColors = ['#bbf7d0','#86efac','#4ade80','#16a34a','#14532d'];


function getZonesForDay(d) {
  // Renvoie le tableau de zones approprié selon le toggle, avec fallback
  if (appState.currentZoneType === 'power') return d.zones_power || null;
  return d.zones_hr || d.zones || null;
}


// Repartition 5 zones a partir d'un stream (FC ou puissance) -> [%...5].
function __zones5Hr(hr, hrMax) {
  const z = [0, 0, 0, 0, 0]; let n = 0;
  for (let i = 0; i < hr.length; i++) { const h = hr[i]; if (h == null) continue; const p = h / hrMax * 100; const k = p < 60 ? 0 : p < 70 ? 1 : p < 82 ? 2 : p < 93 ? 3 : 4; z[k]++; n++; }
  if (!n) return null; return z.map(s => +(s * 100 / n).toFixed(1));
}

function __zones5Pow(w, ftp) {
  const z = [0, 0, 0, 0, 0]; let n = 0;
  for (let i = 0; i < w.length; i++) { const x = w[i]; if (x == null) continue; const p = x / ftp * 100; const k = p < 55 ? 0 : p < 76 ? 1 : p < 91 ? 2 : p < 106 ? 3 : 4; z[k]++; n++; }
  if (!n) return null; return z.map(s => +(s * 100 / n).toFixed(1));
}

// Charge les streams des activites de la periode qui n'ont pas encore de zones,
// calcule FC + puissance, et met en cache sur l'activite (_zhr / _zpow).
async function ensureZonesForRange(fromIso, toIso) {
  const ath = (window.DASHBOARD_DATA && window.DASHBOARD_DATA.athlete) || {};
  const ftp = +ath.ftp || 250, hrMax = +ath.hr_max || +ath.hrMax || 190;
  const todo = [];
  appState.data.forEach(d => {
    const iso = toIsoDate(d.date);
    if (iso < fromIso || iso > toIso) return;
    (d.activities || []).forEach(a => {
      if (!a || !(a.id || a.activityId)) return;
      const hasHr = a._zhr || a.zones_hr, hasPow = a._zpow || a.zones_power;
      if (a._zonesDone || (hasHr && hasPow)) return;
      todo.push(a);
    });
  });
  for (let i = 0; i < todo.length; i++) {
    const a = todo[i];
    try {
      const streams = await loadStreamsFromSupabase(a.id || a.activityId);
      a._zonesDone = true; // ne pas reessayer cette session meme si pas de streams
      if (!streams) continue;
      const watts = Array.isArray(streams) ? ((streams.find(x => x && x.type === 'watts') || {}).data) : streams.watts;
      const hr = Array.isArray(streams) ? ((streams.find(x => x && x.type === 'heartrate') || {}).data) : streams.heartrate;
      if (hr && hr.length && !a._zhr && !a.zones_hr) a._zhr = __zones5Hr(hr, hrMax);
      if (watts && watts.length && !a._zpow && !a.zones_power) a._zpow = __zones5Pow(watts, ftp);
    } catch (e) { a._zonesDone = true; }
    if ((i & 7) === 0) await new Promise(r => setTimeout(r, 0));
  }
}

function computeZonesByDate(fromIso, toIso) {
  // Pondere par la duree de CHAQUE activite (zones calculees depuis les streams, sinon intervals)
  const totals = [0, 0, 0, 0, 0];
  let totalTime = 0, sessions = 0;
  appState.data.forEach(d => {
    const iso = toIsoDate(d.date);
    if (iso < fromIso || iso > toIso) return;
    (d.activities || []).forEach(a => {
      if (!a) return;
      const dur = a.duration || (a.moving_time ? a.moving_time / 60 : 0);
      if (!dur) return;
      const zones = (appState.currentZoneType === 'power') ? (a._zpow || a.zones_power) : (a._zhr || a.zones_hr || a.zones);
      if (!zones || !zones.length) return;
      sessions++;
      for (let i = 0; i < 5; i++) { const pct = +zones[i] || 0; const m = (pct / 100) * dur; totals[i] += m; totalTime += m; }
    });
  });
  if (totalTime === 0) return { pct: [0, 0, 0, 0, 0], totalMin: 0, sessions: 0 };
  return {
    pct: totals.map(m => +(m * 100 / totalTime).toFixed(1)),
    totalMin: Math.round(totalTime),
    sessions
  };
}

export async function renderZones(fromIso, toIso) {
  const emptyEl0 = document.getElementById('zones-empty');
  const wrapEl0 = document.getElementById('zones-chart-wrap');
  // 1er rendu immediat avec ce qu'on a deja
  let r = computeZonesByDate(fromIso, toIso);
  // Si rien (zones pas encore calculees), on les calcule depuis les streams
  const seq = ++appState._zonesRenderSeq;
  if (r.pct.reduce((x, y) => x + (y || 0), 0) === 0) {
    if (emptyEl0) { emptyEl0.hidden = false; emptyEl0.innerHTML = '<div style="color:var(--text-dim)">Calcul des zones depuis les streams…</div>'; }
    if (wrapEl0) wrapEl0.style.display = 'none';
    try { await ensureZonesForRange(fromIso, toIso); } catch (e) {}
    if (seq !== appState._zonesRenderSeq) return; // une autre periode a ete demandee entre-temps
    r = computeZonesByDate(fromIso, toIso);
    if (emptyEl0) emptyEl0.innerHTML = 'Aucune donnée de zones sur cette période.<br><span style="font-size:12px;opacity:.7">Les zones nécessitent les streams FC / puissance des activités.</span>';
  }
  _renderZonesView(fromIso, toIso, r);
}

function _renderZonesView(fromIso, toIso, precomputed) {
  const { pct, totalMin, sessions } = precomputed || computeZonesByDate(fromIso, toIso);
  const total = pct.reduce((a, b) => a + (b || 0), 0);
  const emptyEl = document.getElementById('zones-empty');
  const wrapEl = document.getElementById('zones-chart-wrap');
  if (total === 0) {
    // Aucune donnée : message au lieu d'un anneau vide.
    if (wrapEl) wrapEl.style.display = 'none';
    if (emptyEl) emptyEl.hidden = false;
    const zs = document.getElementById('zone-summary');
    if (zs) zs.innerHTML = '';
    return;
  }
  if (wrapEl) wrapEl.style.display = '';
  if (emptyEl) emptyEl.hidden = true;
  appState.zonesChart.data.labels = zoneLabels;
  appState.zonesChart.data.datasets[0].data = pct;
  appState.zonesChart.data.datasets[0].backgroundColor = zoneColors;
  appState.zonesChart.update();
  const rows = zoneLabels.map((label, i) =>
    `<div class="zone-summary-row"><span class="zname"><span class="legend-dot" style="background:${zoneColors[i]};"></span>${label}</span><span class="zpct">${pct[i]}%</span></div>`
  ).join('');
  document.getElementById('zone-summary').innerHTML = `
    <div style="margin-bottom:8px;color:var(--text-dim);">
      <strong style="color:var(--text);">${sessions}</strong> séance${sessions>1?'s':''} · <strong style="color:var(--text);">${fmtDur(totalMin)}</strong> de pratique
    </div>
    ${rows}
  `;
}

export function bootChartZones() {


// État : 'hr' (FC) ou 'power' (Watts)
appState.currentZoneType = 'hr';


appState.zonesChart = new Chart(document.getElementById('chart-zones'), {
  type: 'doughnut',
  data: {
    labels: zoneLabels,
    datasets: [{ data: [0,0,0,0,0], backgroundColor: zoneColors, borderWidth: 0, borderRadius: 4, spacing: 2, hoverOffset: 6 }]
  },
  options: {
    responsive: true, maintainAspectRatio: false,
    cutout: '70%',
    plugins: {
      legend: { display: false },
      tooltip: { callbacks: { label: (ctx) => ctx.label + ' : ' + ctx.parsed + '%' } }
    }
  }
});


appState._zonesRenderSeq = 0;


// Init avec 30 derniers jours par défaut
{
  const end = new Date(appState.today);
  const start = new Date(appState.today);
  start.setDate(end.getDate() - 29);
  setInputDate('zones-from', start);
  setInputDate('zones-to', end);
  document.getElementById('zones-from').min = toIsoDate(appState.data[0].date);
  document.getElementById('zones-from').max = toIsoDate(appState.data[appState.data.length-1].date);
  document.getElementById('zones-to').min = toIsoDate(appState.data[0].date);
  document.getElementById('zones-to').max = toIsoDate(appState.data[appState.data.length-1].date);
  renderZones(toIsoDate(start), toIsoDate(end));
}


// Presets
document.querySelectorAll('#zones-range .preset').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('#zones-range .preset').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    const days = +btn.dataset.days;
    const end = new Date(appState.today);
    const start = new Date(appState.today);
    start.setDate(end.getDate() - (days - 1));
    setInputDate('zones-from', start);
    setInputDate('zones-to', end);
    renderZones(toIsoDate(start), toIsoDate(end));
  });
});


// Date inputs manuels
['zones-from', 'zones-to'].forEach(id => {
  document.getElementById(id).addEventListener('change', () => {
    document.querySelectorAll('#zones-range .preset').forEach(b => b.classList.remove('active'));
    renderZones(getInputDate('zones-from'), getInputDate('zones-to'));
  });
});


// Toggle FC / Watts
document.querySelectorAll('#zones-type-toggle .ztoggle-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('#zones-type-toggle .ztoggle-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    appState.currentZoneType = btn.dataset.type;
    renderZones(getInputDate('zones-from'), getInputDate('zones-to'));
  });
});
}
