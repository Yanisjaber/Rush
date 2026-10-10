/* src/features/dashboard/long-term-panel.js — extrait de l'ancien app.js (découpage par fonctionnalité). */
import { appState } from '../../core/state.js';
import { fmtDate } from '../../core/utils.js';


// ========= PANEL 3: LONG TERME (robuste aux nulls Whoop) =========
// Rolling average qui ignore les nulls (renvoie null si aucun point dans la fenêtre)
const rolling = (arr, n) => arr.map((_, i, a) => {
  const s = a.slice(Math.max(0, i-n+1), i+1).filter(v => v != null);
  if (s.length === 0) return null;
  return +(s.reduce((x,y)=>x+y,0)/s.length).toFixed(1);
});


// Alertes long-terme — calculées sur les vraies données
const alerts = [];

export function bootLongTermPanel() {

appState.hrv7 = rolling(appState.data.map(d=>d.hrv), 7);


new Chart(document.getElementById('chart-hrv'), {
  type: 'line',
  data: { labels: appState.labels, datasets: [{ data: appState.hrv7, borderColor: '#a78bfa', backgroundColor: 'rgba(167,139,250,0.15)', tension: 0.3, pointRadius: 0, fill: true, spanGaps: false }] },
  options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false } }, scales: { x: { ticks: { maxTicksLimit: 6 }, grid: { display: false } }, y: { title: { display: true, text: 'ms' } } } }
});


// Sommeil : 30 derniers jours, nulls → barre vide
appState.sleepSlice = appState.data.slice(-30);

new Chart(document.getElementById('chart-sleep'), {
  type: 'bar',
  data: {
    labels: appState.sleepSlice.map(d => fmtDate(d.date)),
    datasets: [{
      data: appState.sleepSlice.map(d => d.sleepH),
      backgroundColor: appState.sleepSlice.map(d => d.sleepH == null ? '#2a3142' : d.sleepH < 6.5 ? '#f87171' : d.sleepH < 7 ? '#fbbf24' : '#4ade80'),
      borderRadius: 2
    }]
  },
  options: {
    responsive: true, maintainAspectRatio: false,
    plugins: {
      legend: { display: false },
      tooltip: { callbacks: { label: (ctx) => ctx.parsed.y == null ? 'Pas de donnée Whoop' : ctx.parsed.y + ' h' } }
    },
    scales: { x: { ticks: { maxTicksLimit: 6 }, grid: { display: false } }, y: { min: 0, ticks: { callback: (v) => v + 'h' } } }
  }
});


appState.ratio = appState.data.map(d => d.ctl > 0 ? +(d.atl / d.ctl).toFixed(2) : 1);

new Chart(document.getElementById('chart-ratio'), {
  type: 'line',
  data: { labels: appState.labels, datasets: [
    { data: appState.ratio, borderColor: '#fbbf24', backgroundColor: 'transparent', tension: 0.3, pointRadius: 0 },
    { data: appState.data.map(()=>1.3), borderColor: 'rgba(248,113,113,0.5)', borderDash: [3,3], pointRadius: 0 },
    { data: appState.data.map(()=>0.8), borderColor: 'rgba(74,222,128,0.5)', borderDash: [3,3], pointRadius: 0 }
  ] },
  options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false } }, scales: { x: { ticks: { maxTicksLimit: 6 }, grid: { display: false } }, y: { title: { display: true, text: 'ATL/CTL' }, min: 0.5, max: 1.6 } } }
});


new Chart(document.getElementById('chart-ctl-trend'), {
  type: 'line',
  data: {
    labels: appState.labels,
    datasets: [{ label: 'CTL', data: appState.data.map(d=>d.ctl), borderColor: '#60a5fa', backgroundColor: 'rgba(96,165,250,0.2)', tension: 0.3, pointRadius: 0, fill: true }]
  },
  options: {
    responsive: true, maintainAspectRatio: false,
    plugins: { legend: { display: false } },
    scales: { x: { ticks: { maxTicksLimit: 10 }, grid: { display: false } }, y: { title: { display: true, text: 'CTL (fitness)' } } }
  }
});


// 1. Évolution CTL sur 90j
appState.last90 = appState.data.slice(-90);

if (appState.last90.length >= 30) {
  const ctlStart = appState.last90[0].ctl;
  const ctlEnd = appState.last90[appState.last90.length - 1].ctl;
  const ctlPct = ctlStart > 0 ? Math.round((ctlEnd - ctlStart) / ctlStart * 100) : 0;
  alerts.push({
    class: ctlPct > 5 ? 'good' : ctlPct < -10 ? 'danger' : 'warn',
    title: `Évolution de la forme : ${ctlPct >= 0 ? '+' : ''}${ctlPct}% sur 90 jours`,
    body: `CTL passé de ${ctlStart.toFixed(0)} à ${ctlEnd.toFixed(0)}. ${ctlPct > 10 ? 'Progression saine.' : ctlPct < -10 ? 'Régression — vérifier la cause (blessure, pause, démotivation).' : ctlPct > 0 ? 'Progression légère.' : 'Forme stable.'}`
  });
}


// 2. Ratio ATL/CTL : périodes à risque
appState.riskDays = appState.data.filter(d => d.ctl > 10 && d.atl / d.ctl > 1.3).length;

if (appState.riskDays > 0) {
  alerts.push({
    class: appState.riskDays > 14 ? 'danger' : 'warn',
    title: `Ratio ATL/CTL > 1.3 sur ${appState.riskDays} jour${appState.riskDays>1?'s':''}`,
    body: appState.riskDays > 14 ? 'Plusieurs périodes de surcharge — risque de blessure majoré. Bien intercaler des semaines de décharge.' : 'Période ponctuelle de surcharge bien gérée.'
  });
} else if (appState.data.length > 30) {
  alerts.push({
    class: 'good',
    title: 'Aucune surcharge aiguë détectée',
    body: 'Ratio ATL/CTL toujours sous 1.3 → tu absorbes ta charge sans pic de risque.'
  });
}


// 3. HRV — seulement si données réelles
appState.realHrv = appState.data.filter(d => d.whoopSource === 'real' && d.hrv != null);

if (appState.realHrv.length >= 3) {
  const avgHrv = appState.realHrv.reduce((s,d)=>s+d.hrv,0) / appState.realHrv.length;
  const stdHrv = Math.sqrt(appState.realHrv.reduce((s,d)=>s+Math.pow(d.hrv-avgHrv,2),0) / appState.realHrv.length);
  alerts.push({
    class: stdHrv < 8 ? 'good' : 'warn',
    title: `HRV moyenne ${avgHrv.toFixed(0)} ms (σ ${stdHrv.toFixed(1)})`,
    body: stdHrv < 8 ? 'Variabilité faible → état de récup stable.' : 'Variabilité élevée → état fluctuant. Surveiller les soirs avant séance dure.'
  });
} else {
  alerts.push({
    class: 'warn',
    title: 'HRV : pas assez de données Whoop',
    body: `Seulement ${appState.realHrv.length} jour${appState.realHrv.length>1?'s':''} de mesures HRV réelles. Les analyses long-terme demandent 14j+.`
  });
}


// 4. Sommeil — seulement si données réelles
appState.realSleep = appState.data.filter(d => d.whoopSource === 'real' && d.sleepH != null);

if (appState.realSleep.length >= 3) {
  const avgSleep = appState.realSleep.reduce((s,d)=>s+d.sleepH,0) / appState.realSleep.length;
  const shortNights = appState.realSleep.filter(d => d.sleepH < 7).length;
  alerts.push({
    class: avgSleep >= 7.5 && shortNights < appState.realSleep.length * 0.3 ? 'good' : 'warn',
    title: `Sommeil moyen ${avgSleep.toFixed(1)}h · ${shortNights}/${appState.realSleep.length} nuit${appState.realSleep.length>1?'s':''} < 7h`,
    body: avgSleep >= 7.5 ? 'Volume correct. Les jours après une nuit courte sont à modérer en intensité.' : 'Volume insuffisant — priorité au sommeil pour récupérer.'
  });
}


document.getElementById('alerts-list').innerHTML = alerts.map(a => `
  <div class="insight ${a.class}">
    <div class="insight-title">${a.title}</div>
    <div class="insight-body">${a.body}</div>
  </div>`).join('');
}
