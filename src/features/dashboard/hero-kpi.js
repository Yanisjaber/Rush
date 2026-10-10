/* src/features/dashboard/hero-kpi.js — extrait de l'ancien app.js (découpage par fonctionnalité). */
import { appState } from '../../core/state.js';
import { fmtDur } from '../../core/format.js';
import { goToCalendarDay } from './chart-load.js';
import { toIsoDate } from './filters.js';


// Carte ACWR (Acute:Chronic Workload Ratio). ACWR ≈ charge aiguë (ATL) / charge chronique (CTL),
// cohérent avec les CTL/ATL affichés dans la carte Forme (TSB).
function renderAcwrCard() {
  const card = document.getElementById('acwr-card');
  if (!card) return;
  const ctl = appState.todayData.ctl || 0;
  const atl = appState.todayData.atl || 0;
  const acwr = ctl > 0 ? atl / ctl : 0;
  let color, state;
  // État ACWR : label court + détail dans .state-detail (masqué sur mobile via CSS)
  if (ctl <= 0) { color = 'var(--text-mute)'; state = 'Pas assez de données'; }
  else if (acwr < 0.8) { color = 'var(--warn)'; state = 'Sous-charge <span class="state-detail">· désentraînement</span>'; }
  else if (acwr <= 1.3) { color = 'var(--accent)'; state = 'Zone optimale'; }
  else if (acwr <= 1.5) { color = 'var(--warn)'; state = 'Charge élevée <span class="state-detail">· vigilance</span>'; }
  else { color = 'var(--danger)'; state = 'Risque de blessure'; }
  const ringDash = 213.6;
  const frac = Math.max(0, Math.min(1, acwr / 2)); // 2.0 = anneau plein
  const off = ctl > 0 ? ringDash * (1 - frac) : ringDash;
  card.dataset.mode = 'acwr';
  // Spans .label-detail (suffixe "ACWR") + .acwr-detail (libellés longs)
  // sont masqués sur mobile via mobile-home.css pour un rendu épuré.
  // Pour mobile : on remplace le donut SVG par une barre horizontale qui se
  // remplit en proportion du frac (0..1, où 1.0 = ACWR = 2.0).
  // CSS détecte ce layout via .ratio-bar et masque le SVG sur mobile.
  const pct = Math.round(frac * 100);
  card.innerHTML = `
    <div class="kpi-label">Ratio de charge<span class="label-detail"> (ACWR)</span></div>
    <div class="ring-container">
      <div class="ring">
        <div class="ratio-bar">
          <div class="ratio-bar-fill" style="width:${pct}%;background:${color};"></div>
        </div>
        <svg width="80" height="80"><circle cx="40" cy="40" r="34" fill="none" stroke="var(--border)" stroke-width="8"/><circle cx="40" cy="40" r="34" fill="none" stroke="${color}" stroke-width="8" stroke-dasharray="${ringDash}" stroke-dashoffset="${off}" stroke-linecap="round"/></svg>
        <div class="ring-text">${ctl > 0 ? acwr.toFixed(2) : '—'}</div>
      </div>
      <div>
        <div style="font-size:12.5px;font-weight:600;color:${color};margin-bottom:8px;">${state}</div>
        <div class="acwr-detail" style="font-size:11px;color:var(--text-dim);">Charge aiguë 7j</div>
        <div class="acwr-detail" style="font-size:17px;font-weight:600;">${atl.toFixed(0)}<span style="font-size:11px;font-weight:500;color:var(--text-dim);"> /j</span></div>
        <div class="acwr-detail" style="font-size:11px;color:var(--text-dim);margin-top:4px;">Charge chronique 42j</div>
        <div class="acwr-detail" style="font-size:13px;">${ctl.toFixed(0)}<span style="font-size:11px;color:var(--text-dim);"> /j</span></div>
        <div class="acwr-compact" hidden>7j <b style="color:var(--text);">${atl.toFixed(0)}</b> · 42j <b style="color:var(--text);">${ctl.toFixed(0)}</b></div>
      </div>
    </div>`;
}


export function renderHeroKpi() {
renderAcwrCard();

document.getElementById('tsb-val').textContent = (appState.todayData.tsb >= 0 ? '+' : '') + appState.todayData.tsb.toFixed(0);
// État TSB : on garde le label court en clair, le détail dans un span qu'on
// peut masquer en mobile via mobile-home.css (.state-detail { display: none }).
const tsbState = appState.todayData.tsb > 5 ? 'Frais <span class="state-detail">· prêt à performer</span>'
               : appState.todayData.tsb > -10 ? 'Optimal <span class="state-detail">· zone de progression</span>'
               : appState.todayData.tsb > -25 ? 'Fatigué <span class="state-detail">· vigilance</span>'
               : 'Surchargé <span class="state-detail">· décharge recommandée</span>';
const tsbClass = appState.todayData.tsb > 5 ? 'up' : appState.todayData.tsb < -20 ? 'down' : '';
const tsbEl = document.getElementById('tsb-state');
tsbEl.innerHTML = tsbState;
tsbEl.className = 'kpi-trend ' + tsbClass;
document.getElementById('ctl-val').textContent = appState.todayData.ctl.toFixed(0);
document.getElementById('atl-val').textContent = appState.todayData.atl.toFixed(0);

const last7 = appState.data.slice(-7);
const weeklyTSS = last7.reduce((s,d)=>s+d.tss,0);
const prev7 = appState.data.slice(-14,-7);
const prevTSS = prev7.reduce((s,d)=>s+d.tss,0);
document.getElementById('weekly-tss').textContent = weeklyTSS;
// Sparkline 7 jours : injecté en CSS-only via spans dans la card Charge 7 jours.
// Visible uniquement sur mobile via mobile-home.css.
{
  const card = document.querySelector('.hero .card:has(#weekly-tss)') || document.getElementById('weekly-tss')?.closest('.card');
  if (card) {
    let spark = card.querySelector('.weekly-spark');
    if (!spark) {
      spark = document.createElement('div');
      spark.className = 'weekly-spark';
      card.appendChild(spark);
    }
    const maxT = Math.max(1, ...last7.map(d => d.tss || 0));
    spark.innerHTML = last7.map(d => {
      const h = Math.max(2, Math.round((d.tss || 0) / maxT * 100));
      return `<span style="height:${h}%;" title="${d.tss || 0} TSS"></span>`;
    }).join('');
  }
}
const trendEl = document.getElementById('weekly-trend');
// Si prevTSS = 0, on évite la division par zéro (qui donnait "+Infinity%")
// et on affiche un texte explicite à la place du pourcentage.
if (prevTSS <= 0) {
  trendEl.textContent = weeklyTSS > 0 ? 'Nouvelle activité cette semaine' : 'Pas d\'activité';
  trendEl.className = 'kpi-trend ' + (weeklyTSS > 0 ? 'up' : '');
} else {
  const trendPct = Math.round((weeklyTSS - prevTSS) / prevTSS * 100);
  trendEl.textContent = (trendPct > 0 ? '↑ +' : trendPct < 0 ? '↓ ' : '') + trendPct + '% vs semaine précédente';
  trendEl.className = 'kpi-trend ' + (trendPct > 5 ? 'up' : trendPct < -5 ? 'down' : '');
}
document.getElementById('weekly-sessions').textContent = last7.filter(d => d.tss > 0).length;
{
  const _wkMin = last7.reduce((s,d)=>s+(d.duration||0),0);
  document.getElementById('weekly-hours').textContent = _wkMin < 60 ? Math.round(_wkMin) + ' min' : (_wkMin/60).toFixed(1) + ' h';
}

// Dernière séance — bloc en haut à gauche du hero
// (on repère un jour avec activité réelle via sessionName, car le type a été retiré)
const lastSession = [...appState.data].reverse().find(d => d.sessionName || (d.activities && d.activities.length > 0));
const dateEl = document.getElementById('last-session-date');
const nameEl = document.getElementById('last-session-name');
const metricsEl = document.getElementById('last-session-metrics');
const lsCardEl = document.getElementById('last-session-card');
if (!lastSession) {
  dateEl.textContent = '';
  nameEl.innerHTML = '<span class="ls-empty">Aucune séance dans la période</span>';
  metricsEl.innerHTML = '';
  if (lsCardEl) { lsCardEl.style.cursor = ''; lsCardEl.onclick = null; lsCardEl.title = ''; }
} else {
  // Clic → va à la semaine de la séance dans le calendrier + ouvre l'activité.
  if (lsCardEl) {
    lsCardEl.style.cursor = 'pointer';
    lsCardEl.title = 'Voir cette séance dans le calendrier';
    lsCardEl.onclick = () => {
      if (typeof goToCalendarDay === 'function') goToCalendarDay(toIsoDate(lastSession.date));
    };
  }
  const daysSince = Math.round((appState.today - lastSession.date) / 86400000);
  const dateStr = daysSince === 0 ? "Aujourd'hui"
                : daysSince === 1 ? "Hier"
                : `Il y a ${daysSince} jours`;
  dateEl.textContent = `${dateStr} · ${lastSession.date.toLocaleDateString('fr-FR', { weekday: 'short', day: 'numeric', month: 'short' })}`;
  nameEl.textContent = lastSession.sessionName || 'Séance';

  const dur = lastSession.duration || 0;
  const metrics = [];
  if (lastSession.tss) metrics.push(`<div class="ls-metric"><div class="ls-val">${lastSession.tss}</div><div class="ls-lbl">TSS</div></div>`);
  if (dur) metrics.push(`<div class="ls-metric"><div class="ls-val">${fmtDur(dur)}</div><div class="ls-lbl">Durée</div></div>`);
  if (lastSession.np) metrics.push(`<div class="ls-metric"><div class="ls-val">${lastSession.np}<span style="font-size:13px;font-weight:500;">W</span></div><div class="ls-lbl">NP</div></div>`);
  if (lastSession.hr) metrics.push(`<div class="ls-metric"><div class="ls-val">${lastSession.hr}<span style="font-size:13px;font-weight:500;">bpm</span></div><div class="ls-lbl">FC moy</div></div>`);
  metricsEl.innerHTML = metrics.join('');
}
}

export function bootHeroKpi() {


// ========= DATA GENERATION (fallback simulé, code mort) =========
// Sorti dans js/data-generation.js. Importer { generateData } depuis là si besoin.

// ========= HERO KPI =========
{
  const _dateEl = document.getElementById('today-date');
  if (_dateEl) _dateEl.textContent = appState.today.toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
}



window.renderHeroKpi = renderHeroKpi;

renderHeroKpi();
}
