/* src/features/competitions/competitions-page.js — extrait de l'ancien app.js (découpage par fonctionnalité). */
import { appState } from '../../core/state.js';
import { getSportCategory, toIsoDate } from '../dashboard/filters.js';
import { renderCalendar } from '../calendar/realise-calendar.js';
import { compPrio, fmtDur, trophySvg } from '../../core/format.js';
import { fmtMinToTime } from './comp-stages.js';
import { FEDERATIONS_BY_CAT, enhanceSelect } from './comp-modal-ui.js';
import { PHASE_LABELS } from '../plan/week-plan.js';
import { openSessionModal } from '../sessions/session-modal.js';
import { openCompModalForEdit } from '../sessions/session-actions.js';
import { setActivityCategory } from '../gpx/gpx-render.js';
import { removeCompFromDashboard } from './comp-form.js';
import { escapeHtml } from '../../core/utils.js';


// ========= PANEL 2: ENTRAÎNEUR (compétitions + plan 7j) =========
export const dowFr = ['Dim','Lun','Mar','Mer','Jeu','Ven','Sam'];

const COMP_KEY = 'coach_ia_competitions_v1';


export function loadCompetitions() {
  try {
    const raw = localStorage.getItem(COMP_KEY);
    if (!raw) return [];
    return JSON.parse(raw).filter(c => c.date && c.name);
  } catch (e) { return []; }
}


// Une competition appartient-elle au calendrier REALISE (vs prevu) ?
// Ancre sur le drapeau realised (calendrier d'origine) ; repli sur la table/date pour l'existant.
export function compIsRealised(c) {
  if (!c) return false;
  if (c.realised === true) return true;
  if (c.realised === false) return false;
  if (c._table === 'competition' || c._table === 'activity') return true;
  if (c._table === 'planned') return false;
  try { return (c.date || '') <= toIsoDate(appState.today); } catch (e) { return false; }
}


// Renvoie la liste des compés "à plat" : chaque course par étapes est expansée
// en une entrée par étape (avec date/sport/km/etc de l'étape).
// Les compés simples restent telles quelles. Sert au calendrier.
export function loadCompetitionsExpanded() {
  const out = [];
  for (const c of loadCompetitions()) {
    if (c.stages && Array.isArray(c.stagesList) && c.stagesList.length > 0) {
      c.stagesList.forEach((st, idx) => {
        if (!st.date) return; // ignore les étapes sans date
        out.push({
          id: `${c.id}-stage-${idx}`,
          parentId: c.id,
          _table: c._table,
          name: `${c.name} — Étape ${idx + 1}`,
          date: st.date,
          time: st.time || null,
          // Priority et sport sont GLOBAUX (depuis la compé), pas par étape
          priority: c.priority || 'principal',
          sport: c.sport || 'Ride',
          type: st.type || null,
          km: st.km || null,
          dplus: st.dplus || null,
          target: st.target || null,
          laps: st.laps || null,
          notes: st.notes || null,
          gpxName: st.gpxName || null,
          gpxContent: st.gpxContent || null,
          stageIdx: idx,
          totalStages: c.stagesList.length,
          stages: false, // pour les render, on traite chaque étape comme une compé simple
        });
      });
    } else {
      out.push(c);
    }
  }
  return out;
}


export function saveCompetitions(comps) {
  // Diff avec l'ancien array pour détecter les suppressions
  let previous = [];
  try { previous = JSON.parse(localStorage.getItem(COMP_KEY) || '[]'); } catch {}
  const currentIds = new Set(comps.map(c => c.id));
  const deleted = previous.filter(p => !currentIds.has(p.id));

  localStorage.setItem(COMP_KEY, JSON.stringify(comps));
  // La projection de la courbe de charge inclut les compétitions → refresh
  if (window.refreshLoadChart) window.refreshLoadChart();

  // Mirror cloud
  if (window.cloudSync) {
    // Push (upsert) chaque compé courante
    for (const c of comps) {
      window.cloudSync.pushCompetition(c).then(sbId => {
        if (sbId && !c._sbId) {
          c._sbId = sbId;
          // Re-save silencieux pour persister le _sbId
          try {
            const cur = JSON.parse(localStorage.getItem(COMP_KEY) || '[]');
            const idx = cur.findIndex(x => x.id === c.id);
            if (idx >= 0) { cur[idx]._sbId = sbId; localStorage.setItem(COMP_KEY, JSON.stringify(cur)); }
          } catch {}
        }
      });
    }
    // Delete les supprimées
    for (const d of deleted) window.cloudSync.deleteCompetition(d);
  }

  // Re-render automatique : "Compétitions à venir" + calendrier + page Compétitions
  if (typeof renderCompList === 'function') renderCompList();
  if (typeof renderCompetitionsPage === 'function') renderCompetitionsPage();
  if (typeof renderCalendar === 'function') renderCalendar();
}


export function renderCompList() {
  // Helpers de format
  const fmtFullDate = d => d.toLocaleDateString('fr-FR', { weekday: 'short', day: 'numeric', month: 'long', year: 'numeric' });
  const fmtShortDayMonth = d => d.toLocaleDateString('fr-FR', { weekday: 'short', day: 'numeric', month: 'short' });
  const fmtYear = d => d.getFullYear();

  const comps = loadCompetitions()
    .map(c => {
      // Pour les courses par étapes : start = première étape, end = dernière étape
      let startDate = c.date, endDate = c.date;
      if (c.stages && Array.isArray(c.stagesList) && c.stagesList.length) {
        const dates = c.stagesList.map(s => s.date).filter(Boolean).sort();
        if (dates.length) { startDate = dates[0]; endDate = dates[dates.length - 1]; }
      }
      return {
        ...c,
        dateObj: new Date(startDate + 'T12:00:00'),
        endDateObj: new Date(endDate + 'T12:00:00'),
      };
    })
    .filter(c => c.endDateObj >= appState.today) // affiche tant que la dernière étape n'est pas passée
    .sort((a, b) => a.dateObj - b.dateObj);

  const list = document.getElementById('comp-list');
  if (comps.length === 0) {
    list.innerHTML = `<div class="comp-empty">Aucune compétition enregistrée. Ajoute ton prochain objectif pour structurer ton plan.</div>`;
    return;
  }
  list.innerHTML = comps.map(c => {
    const daysUntil = Math.ceil((c.dateObj - appState.today) / 86400000);
    let dateStr;
    if (c.stages && c.endDateObj.getTime() !== c.dateObj.getTime()) {
      // Course par étapes : start → end
      // Si même année, on ne répète pas l'année
      const sameYear = c.dateObj.getFullYear() === c.endDateObj.getFullYear();
      if (sameYear) {
        dateStr = `${fmtShortDayMonth(c.dateObj)} → ${fmtShortDayMonth(c.endDateObj)} ${fmtYear(c.endDateObj)}`;
      } else {
        dateStr = `${fmtShortDayMonth(c.dateObj)} ${fmtYear(c.dateObj)} → ${fmtShortDayMonth(c.endDateObj)} ${fmtYear(c.endDateObj)}`;
      }
      // Ajoute un petit indicateur du nb d'étapes
      const nbStages = c.stagesList.length;
      dateStr += ` <span class="comp-stages-badge" title="${nbStages} étapes">· ${nbStages} étapes</span>`;
    } else {
      dateStr = fmtFullDate(c.dateObj);
    }
    const _pi = compPrio(c.priority);
    // Progression de la jauge : temps écoulé depuis le début de saison
    // (1er janvier de l'année de la course) jusqu'au jour de course.
    const seasonStart = new Date(c.dateObj.getFullYear(), 0, 1);
    const totalMs = c.dateObj - seasonStart;
    let fillPct = totalMs > 0 ? ((appState.today - seasonStart) / totalMs) * 100 : 100;
    fillPct = Math.max(0, Math.min(100, fillPct));
    return `<div class="comp-item" data-prio="${_pi.key}" data-comp-id="${c.id}" title="Voir le détail de la compétition">
      <div class="comp-row">
        <span class="comp-name">${trophySvg(_pi.color)}<span class="comp-name-text">${escapeHtml(c.name)}</span>${(window.SportProfiles && window.SportProfiles.sportIconHTML) ? window.SportProfiles.sportIconHTML(c.sport) : ''}${window.compFedBadges ? window.compFedBadges(c) : ''}</span>
        <span class="comp-date">${dateStr}</span>
        <span class="comp-countdown">${daysUntil <= 0 ? 'en cours' : 'J‑' + daysUntil}</span>
        <button class="comp-more" data-id="${c.id}" title="Actions">⋯</button>
        <button class="comp-del" data-id="${c.id}" title="Supprimer">×</button>
      </div>
      ${window.compDistLabel(c) ? `<div class="comp-tri-mini"><span class="ctm-dist">${window.compDistLabel(c)}</span>${c.target ? `<span class="ctm-obj">Objectif · ${fmtMinToTime(c.target)}</span>` : ''}</div>` : ''}
      <div class="comp-phase-track"><div class="comp-phase-fill" style="width:${fillPct.toFixed(1)}%"></div></div>
    </div>`;
  }).join('');
}


// Page "Compétitions" (onglet dédié) : hero prochain objectif + frise de saison
// + à venir (jauge) + passées enrichies (résultats réels).
const _PHASE_COLORS = { build: '#60a5fa', peak: '#fbbf24', taper: '#a78bfa', race: '#f87171', recovery: '#4ade80' };

function _formInfo(tsb) {
  if (tsb == null) return { t: '—', c: 'var(--text-mute)' };
  if (tsb >= 10) return { t: 'très frais', c: 'var(--accent)' };
  if (tsb >= 0) return { t: 'frais', c: 'var(--accent)' };
  if (tsb >= -10) return { t: 'équilibré', c: 'var(--warn)' };
  if (tsb >= -20) return { t: 'fatigué', c: 'var(--warn)' };
  return { t: 'très fatigué', c: 'var(--danger)' };
}

function _prepReco(phaseKey, tsb) {
  if (tsb != null && tsb < -20) return "Fatigue marquée — priorité à la récupération avant d'affûter.";
  switch (phaseKey) {
    case 'race': return 'Semaine de course : repos et activations courtes, garde la fraîcheur.';
    case 'taper': return 'Affûtage en cours — réduis le volume, conserve un peu d\'intensité.';
    case 'peak': return 'Pic de charge : intensité spécifique, surveille bien la récupération.';
    case 'build': return 'Construis le foncier et le CTL. L\'affûtage viendra plus tard.';
    case 'recovery': return 'Phase de décharge : récupère pour mieux rebondir.';
    default: return 'Continue ta préparation régulière.';
  }
}


export function renderCompetitionsPage() {
  const heroWrap = document.getElementById('comp-hero');
  const seasonWrap = document.getElementById('comp-season');
  const upWrap = document.getElementById('comp-page-upcoming');
  const pastWrap = document.getElementById('comp-page-past');
  if (!heroWrap && !seasonWrap && !upWrap && !pastWrap) return;

  const fmtFullDate = d => d.toLocaleDateString('fr-FR', { weekday: 'short', day: 'numeric', month: 'long', year: 'numeric' });
  const fmtShortDayMonth = d => d.toLocaleDateString('fr-FR', { weekday: 'short', day: 'numeric', month: 'short' });
  const fmtYear = d => d.getFullYear();

  let comps = loadCompetitions().map(c => {
    let startDate = c.date, endDate = c.date;
    if (c.stages && Array.isArray(c.stagesList) && c.stagesList.length) {
      const dates = c.stagesList.map(s => s.date).filter(Boolean).sort();
      if (dates.length) { startDate = dates[0]; endDate = dates[dates.length - 1]; }
    }
    return { ...c, dateObj: new Date(startDate + 'T12:00:00'), endDateObj: new Date(endDate + 'T12:00:00') };
  });

  const dateLabel = (c) => {
    if (c.stages && c.endDateObj.getTime() !== c.dateObj.getTime()) {
      const sameYear = c.dateObj.getFullYear() === c.endDateObj.getFullYear();
      const base = sameYear
        ? `${fmtShortDayMonth(c.dateObj)} → ${fmtShortDayMonth(c.endDateObj)} ${fmtYear(c.endDateObj)}`
        : `${fmtShortDayMonth(c.dateObj)} ${fmtYear(c.dateObj)} → ${fmtShortDayMonth(c.endDateObj)} ${fmtYear(c.endDateObj)}`;
      return `${base} <span class="comp-stages-badge" title="${c.stagesList.length} étapes">· ${c.stagesList.length} étapes</span>`;
    }
    return fmtFullDate(c.dateObj);
  };

  // ---- Barre de filtres (sport + federation) ----
  window._compPageFilter = window._compPageFilter || { cat: 'tout', fed: 'tout', year: 'tout' };
  if (window._compPageFilter.year === undefined) window._compPageFilter.year = 'tout';
  const _flt = window._compPageFilter;
  const _catOfComp = (c) => (typeof getSportCategory === 'function' ? getSportCategory(c.sport || '') : 'autre');
  {
    let bar = document.getElementById('comp-filters');
    if (!bar && upWrap) {
      bar = document.createElement('div');
      bar.id = 'comp-filters';
      bar.className = 'comp-filters comp-filters-top';
      const page = document.getElementById('p6');
      if (page) page.insertBefore(bar, page.firstChild);
    }
    if (bar) {
      const cats = [...new Set(comps.map(_catOfComp))].sort();
      const feds = [...new Set(comps.map(c => c.federation).filter(Boolean))].sort();
      const years = [...new Set(comps.map(c => c.dateObj.getFullYear()))].sort((a, b) => b - a);
      const catLab = { cyclisme: 'Vélo', course: 'CAP', triathlon: 'Tri', natation: 'Natation', musculation: 'Muscu', autre: 'Autre' };
      // 3 selecteurs compacts (les chips en vrac debordaient sur 3 lignes mobile)
      const sel = (grp, opts, cur) => `<select class="comp-flt-sel${String(cur) !== 'tout' ? ' on' : ''}" id="comp-flt-${grp}" data-grp="${grp}">${opts.map(([v, lab]) => `<option value="${v}"${String(cur) === String(v) ? ' selected' : ''}>${lab}</option>`).join('')}</select>`;
      bar.innerHTML =
        sel('cat', [['tout', 'Tous sports']].concat(cats.map(c2 => [c2, catLab[c2] || c2])), _flt.cat)
        + sel('fed', [['tout', 'Toutes fédés']].concat(feds.map(f => [f, f])), _flt.fed)
        + sel('year', [['tout', 'Toutes années']].concat(years.map(y => [y, y])), _flt.year);
      // Dropdowns custom (le menu natif des <select> n'est pas stylable)
      ['cat', 'fed', 'year'].forEach(g => {
        if (typeof enhanceSelect === 'function') enhanceSelect('comp-flt-' + g);
        const el = document.getElementById('comp-flt-' + g);
        const wrap = el && el.nextElementSibling;
        if (wrap && wrap.classList.contains('custom-select') && String(_flt[g]) !== 'tout') wrap.classList.add('on');
      });
      if (!bar._wired) {
        bar._wired = true;
        bar.addEventListener('change', (e) => {
          const el = e.target.closest('.comp-flt-sel');
          if (!el) return;
          window._compPageFilter[el.dataset.grp] = el.value;
          renderCompetitionsPage();
        });
      }
    }
  }
  const _match = (c) => (_flt.cat === 'tout' || _catOfComp(c) === _flt.cat)
    && (_flt.fed === 'tout' || (c.federation || null) === _flt.fed)
    && (String(_flt.year) === 'tout' || c.dateObj.getFullYear() === +_flt.year);
  // Filtre GLOBAL : hero, frise de saison et listes travaillent sur le sous-ensemble
  comps = comps.filter(_match);
  if (window.odRecapRefresh) window.odRecapRefresh(); // le palmares suit le filtre
  const upcoming = comps.filter(c => c.endDateObj >= appState.today).sort((a, b) => a.dateObj - b.dateObj);
  const past = comps.filter(c => c.endDateObj < appState.today).sort((a, b) => b.dateObj - a.dateObj);

  // Métriques de forme les plus récentes
  const last = (Array.isArray(appState.data) && appState.data.length) ? appState.data[appState.data.length - 1] : null;
  const tsb = last && Number.isFinite(last.tsb) ? Math.round(last.tsb) : null;
  const ctl = last && Number.isFinite(last.ctl) ? Math.round(last.ctl) : null;
  const atl = last && Number.isFinite(last.atl) ? Math.round(last.atl) : null;

  // ---- HERO : prochain objectif ----
  if (heroWrap) {
    const next = upcoming[0];
    if (!next) {
      heroWrap.innerHTML = '';
    } else {
      const daysUntil = Math.max(0, Math.ceil((next.dateObj - appState.today) / 86400000));
      const _pi = compPrio(next.priority);
      const phKey = daysUntil <= 7 ? 'race' : daysUntil <= 28 ? 'taper' : daysUntil <= 56 ? 'peak' : 'build';
      const phColor = _PHASE_COLORS[phKey];
      const phLabel = (typeof PHASE_LABELS !== 'undefined' && PHASE_LABELS[phKey]) || phKey;
      const seasonStart = new Date(next.dateObj.getFullYear(), 0, 1);
      const totalMs = next.dateObj - seasonStart;
      const frac = totalMs > 0 ? Math.max(0, Math.min(1, (appState.today - seasonStart) / totalMs)) : 1;
      const C = 301; const off = (C * (1 - frac)).toFixed(0);
      const form = _formInfo(tsb);
      const prioLabel = _pi.key === 'principal' ? 'Objectif principal' : 'Préparation';
      heroWrap.innerHTML = `
        <div class="comp-hero" data-comp-id="${next.id}" style="--pc:${_pi.color};" title="Voir le détail">
          <div class="comp-hero-lbl">Prochain objectif</div>
          <div class="comp-hero-body">
            <div class="comp-hero-ring">
              <svg viewBox="0 0 108 108">
                <circle cx="54" cy="54" r="48" fill="none" stroke="var(--border)" stroke-width="8"/>
                <circle cx="54" cy="54" r="48" fill="none" stroke="${_pi.color}" stroke-width="8" stroke-linecap="round" stroke-dasharray="${C}" stroke-dashoffset="${off}" transform="rotate(-90 54 54)"/>
              </svg>
              <div class="comp-hero-ring-txt">
                <div class="comp-hero-jx" style="color:${_pi.color};">${daysUntil <= 0 ? 'Jour J' : 'J‑' + daysUntil}</div>
                <div class="comp-hero-jdate">${fmtShortDayMonth(next.dateObj)}</div>
              </div>
            </div>
            <div class="comp-hero-main">
              <div class="comp-hero-name">${trophySvg(_pi.color)}<span style="color:${_pi.color};">${escapeHtml(next.name)}</span>
                <span class="comp-pill" style="background:${_pi.color}28;color:${_pi.color};">${prioLabel}</span>
              </div>
              <div class="comp-hero-sub">${dateLabel(next)}</div>
              <div class="comp-hero-tags">
                ${window.triDistLabel(next) ? `<span class="comp-pill" style="background:rgba(244,63,94,0.18);color:#f43f5e;">${window.triDistLabel(next)}</span>` : ''}
                <span class="comp-pill" style="background:${phColor}28;color:${phColor};">Phase : ${phLabel}</span>
                <span class="comp-pill" style="background:color-mix(in srgb, ${form.c} 22%, transparent);color:${form.c};">Forme ${tsb == null ? '—' : (tsb >= 0 ? '+' : '') + tsb} · ${form.t}</span>
              </div>
            </div>
            <div class="comp-hero-prep">
              <div class="comp-hero-lbl">État de préparation</div>
              <div class="comp-prep-grid">
                <div><div class="comp-prep-val">${ctl == null ? '—' : ctl}</div><div class="comp-prep-k">CTL</div></div>
                <div><div class="comp-prep-val">${atl == null ? '—' : atl}</div><div class="comp-prep-k">ATL</div></div>
                <div><div class="comp-prep-val" style="color:${form.c};">${tsb == null ? '—' : (tsb >= 0 ? '+' : '') + tsb}</div><div class="comp-prep-k">TSB</div></div>
              </div>
              <div class="comp-prep-reco">${_prepReco(phKey, tsb)}</div>
            </div>
          </div>
        </div>`;
    }
  }

  // ---- FRISE DE SAISON + chiffres ----
  if (seasonWrap) {
    const yr = (String(_flt.year) !== 'tout') ? +_flt.year : appState.today.getFullYear();
    const yearComps = comps.filter(c => c.dateObj.getFullYear() === yr).sort((a, b) => a.dateObj - b.dateObj);
    const _fmtLab = (c) => `${c.name} · ${c.dateObj.getDate()}/${c.dateObj.getMonth() + 1}`;
    // Mobile : DEUX demi-frises (janv-juin / juil-dec) -> 2x plus de place
    // par mois ; desktop : une seule ligne.
    const halves = (window.innerWidth <= 860)
      ? [{ s: new Date(yr, 0, 1), e: new Date(yr, 5, 30, 23, 59, 59), m0: 0, n: 6 },
         { s: new Date(yr, 6, 1), e: new Date(yr, 11, 31, 23, 59, 59), m0: 6, n: 6 }]
      : [{ s: new Date(yr, 0, 1), e: new Date(yr, 11, 31, 23, 59, 59), m0: 0, n: 12 }];
    // Superposition : le point monte d'un etage avec une petite tige vers
    // sa vraie position sur l'axe (pas de regroupement).
    const _tlW = Math.max(200, (seasonWrap.getBoundingClientRect().width || 360) - 44);
    const _laneGapPct = (13 / _tlW) * 100;
    const _LANE_PX = 13;
    const tlHTML = halves.map(h => {
      const posH = d => Math.max(0, Math.min(100, ((d - h.s) / (h.e - h.s)) * 100));
      const items = yearComps.filter(c => c.dateObj >= h.s && c.dateObj <= h.e)
        .map(c => ({ c, p: posH(c.dateObj) })).sort((a, b) => a.p - b.p);
      const laneLast = [];
      items.forEach(m => {
        let lane = 0;
        while (laneLast[lane] != null && (m.p - laneLast[lane]) < _laneGapPct) lane++;
        laneLast[lane] = m.p;
        m.lane = lane;
      });
      const maxLane = Math.max(0, laneLast.length - 1);
      const markers = items.map(m => {
        const c = m.c;
        const _pi = compPrio(c.priority);
        const isPast = c.endDateObj < appState.today;
        const color = _pi.key === 'principal' ? _pi.color : '#9ca3af';
        const big = _pi.key === 'principal';
        const payload = encodeURIComponent(JSON.stringify([{ id: c.id, lab: _fmtLab(c) }]));
        const rise = m.lane > 0 ? `<span class="comp-tl-rise" style="height:${m.lane * _LANE_PX - 2}px;background:${color};"></span>` : '';
        return `<button type="button" class="comp-tl-marker${isPast ? ' past' : ''}" style="left:${m.p.toFixed(2)}%;${m.lane > 0 ? `top:${18 - m.lane * _LANE_PX}px;` : ''}" data-tl-items="${payload}" data-tl-color="${color}" data-tl-comp="${c.id}">
          <span class="comp-tl-dot${big ? ' big' : ''}" style="background:${color};${big ? `box-shadow:0 0 0 2px ${color};` : ''}"></span>
          ${rise}
        </button>`;
      }).join('');
      const months = [...Array(h.n)].map((_, i) => `<span class="comp-tl-month" data-mi="${h.m0 + i}" style="left:${((i + 0.5) / h.n * 100).toFixed(2)}%"></span>`).join('')
        + [...Array(h.n + 1)].map((_, i) => `<span class="comp-tl-tick" style="left:${(i / h.n * 100).toFixed(2)}%"></span>`).join('');
      const todayHTML = (appState.today >= h.s && appState.today <= h.e)
        ? `<div class="comp-tl-today" style="left:${posH(appState.today).toFixed(1)}%;"><span>auj.</span></div>` : '';
      return `<div class="comp-timeline v2" data-months="${h.n}" style="--tl-rise:${Math.max(0, maxLane) * _LANE_PX}px;">
        <div class="comp-tl-axis"></div>
        ${months}
        ${todayHTML}
        ${markers}
        <div class="comp-tl-tip" hidden></div>
      </div>`;
    }).join('');
    const nPrincipal = yearComps.filter(c => compPrio(c.priority).key === 'principal').length;
    const nPast = yearComps.filter(c => c.endDateObj < appState.today).length;
    seasonWrap.innerHTML = `
      <div class="grid-1 card">
        <div class="section-title">Saison ${yr}</div>
        ${yearComps.length === 0 ? '<div class="comp-empty">Aucune compétition cette saison.</div>' : tlHTML + `
        <div class="comp-season-stats">
          <div><span class="comp-ss-val">${yearComps.length}</span> <span class="comp-ss-k">compétition${yearComps.length > 1 ? 's' : ''}</span></div>
          <div><span class="comp-ss-val" style="color:#fbbf24;">${nPrincipal}</span> <span class="comp-ss-k">objectif${nPrincipal > 1 ? 's' : ''} ${nPrincipal > 1 ? 'principaux' : 'principal'}</span></div>
          <div><span class="comp-ss-val">${yearComps.length - nPrincipal}</span> <span class="comp-ss-k">préparation</span></div>
          <div><span class="comp-ss-val">${nPast}</span> <span class="comp-ss-k">déjà courue${nPast > 1 ? 's' : ''}</span></div>
        </div>`}
      </div>`;
    // Libelles de mois selon la place reelle (nom complet / abrege / initiale)
    const _updateTlMonths = (retry) => {
      const tls = seasonWrap.querySelectorAll('.comp-timeline.v2');
      if (!tls.length) return;
      const FULL = ['Janvier', 'Février', 'Mars', 'Avril', 'Mai', 'Juin', 'Juillet', 'Août', 'Septembre', 'Octobre', 'Novembre', 'Décembre'];
      const ABBR = ['Jan', 'Fév', 'Mar', 'Avr', 'Mai', 'Juin', 'Juil', 'Août', 'Sep', 'Oct', 'Nov', 'Déc'];
      const MINI = ['J', 'F', 'M', 'A', 'M', 'J', 'J', 'A', 'S', 'O', 'N', 'D'];
      let anyZero = false;
      tls.forEach(tl2 => {
        const w = tl2.getBoundingClientRect().width;
        if (!w) { anyZero = true; return; }
        const slot = w / (+tl2.dataset.months || 12);
        const set = slot >= 78 ? FULL : slot >= 36 ? ABBR : MINI;
        tl2.querySelectorAll('.comp-tl-month').forEach(m => { m.textContent = set[+m.dataset.mi] || ''; });
      });
      if (anyZero && (retry || 0) < 40) setTimeout(() => _updateTlMonths((retry || 0) + 1), 250);
    };
    _updateTlMonths();
    window._tlUpdateMonths = _updateTlMonths;
    if (!window._tlMonthsResizeWired) {
      window._tlMonthsResizeWired = true;
      window.addEventListener('resize', () => {
        clearTimeout(window._tlMonthsRzT);
        window._tlMonthsRzT = setTimeout(() => { if (window._tlUpdateMonths) window._tlUpdateMonths(); }, 150);
      });
    }
    // Info-bulle par demi-frise : 1er tap = bulle, 2e = detail ; ligne cliquable
    seasonWrap.querySelectorAll('.comp-timeline.v2').forEach(_tl => {
      const _tip = _tl.querySelector('.comp-tl-tip');
      if (!_tip) return;
      const _show = (b) => {
        let items = [];
        try { items = JSON.parse(decodeURIComponent(b.dataset.tlItems || '[]')); } catch (_) {}
        _tip.innerHTML = items.map(it => `<button type="button" class="tl-tip-line" data-comp="${it.id}">${it.lab}</button>`).join('');
        _tip.style.color = b.dataset.tlColor;
        _tip.style.left = Math.max(10, Math.min(90, parseFloat(b.style.left))) + '%';
        _tip.hidden = false;
        _tip.dataset.for = b.dataset.tlComp || '';
      };
      _tip.addEventListener('click', (e) => {
        const ln = e.target.closest('.tl-tip-line');
        if (!ln) return;
        e.stopPropagation();
        const comp = loadCompetitions().find(c2 => c2.id === ln.dataset.comp);
        if (comp && comp.date && typeof openSessionModal === 'function') {
          _tip.hidden = true;
          const isPast3 = new Date(comp.date + 'T12:00:00') < appState.today;
          openSessionModal(comp.date, isPast3 ? 'realise' : 'prevu');
        }
      });
      _tl.addEventListener('mouseover', (e) => { const b = e.target.closest('.comp-tl-marker'); if (b) _show(b); });
      _tl.addEventListener('mouseleave', () => { _tip.hidden = true; _tip.dataset.for = ''; });
      _tl.addEventListener('click', (e) => {
        const b = e.target.closest('.comp-tl-marker');
        if (!b) { _tip.hidden = true; _tip.dataset.for = ''; return; }
        e.stopPropagation();
        const key = b.dataset.tlComp;
        if (_tip.hidden || _tip.dataset.for !== key) { _show(b); return; }
        const comp = loadCompetitions().find(c2 => c2.id === key);
        if (comp && comp.date && typeof openSessionModal === 'function') {
          const isPast2 = new Date(comp.date + 'T12:00:00') < appState.today;
          openSessionModal(comp.date, isPast2 ? 'realise' : 'prevu');
        }
      });
    });
  }

  // ---- À venir (avec jauge de prépa) ----
  if (upWrap) {
    upWrap.innerHTML = upcoming.length ? upcoming.map(c => {
      const daysUntil = Math.ceil((c.dateObj - appState.today) / 86400000);
      const _pi = compPrio(c.priority);
      const seasonStart = new Date(c.dateObj.getFullYear(), 0, 1);
      const totalMs = c.dateObj - seasonStart;
      let fillPct = totalMs > 0 ? ((appState.today - seasonStart) / totalMs) * 100 : 100;
      fillPct = Math.max(0, Math.min(100, fillPct));
      return `<div class="comp-item" data-prio="${_pi.key}" data-comp-id="${c.id}" title="Voir le détail">
        <div class="comp-row">
          <span class="comp-name">${trophySvg(_pi.color)}<span class="comp-name-text">${escapeHtml(c.name)}</span>${(window.SportProfiles && window.SportProfiles.sportIconHTML) ? window.SportProfiles.sportIconHTML(c.sport) : ''}${window.compFedBadges ? window.compFedBadges(c) : ''}</span>
          <span class="comp-date">${dateLabel(c)}</span>
          <span class="comp-countdown">${daysUntil <= 0 ? 'en cours' : 'J‑' + daysUntil}</span>
          <button class="comp-more" data-id="${c.id}" title="Actions">⋯</button>
          <button class="comp-del" data-id="${c.id}" title="Supprimer">×</button>
        </div>
        ${window.compDistLabel(c) ? `<div class="comp-tri-mini"><span class="ctm-dist">${window.compDistLabel(c)}</span>${c.target ? `<span class="ctm-obj">Objectif · ${fmtMinToTime(c.target)}</span>` : ''}</div>` : ''}
        <div class="comp-phase-track"><div class="comp-phase-fill" style="width:${fillPct.toFixed(1)}%"></div></div>
      </div>`;
    }).join('') : '<div class="comp-empty">Aucune compétition à venir.</div>';
  }

  // ---- Passées enrichies (résultats réels) ----
  if (pastWrap) {
    // 1) Chaque compet -> ses activites liees + heure de depart
    const _items = past.map(c => {
      const iso = toIsoDate(c.dateObj);
      const day = Array.isArray(appState.data) ? appState.data.find(d => toIsoDate(d.date) === iso) : null;
      const acts = (day && day.activities) ? day.activities : [];
      const _wanted = new Set([c._sbId].concat(Array.isArray(c.activityIds) ? c.activityIds : []).filter(Boolean).map(String));
      let raceActs = acts.filter(a => _wanted.has(String(a._sbId)) || String(a.client_id) === String(c.id));
      let dayFallback = false;
      if (!raceActs.length) raceActs = acts.filter(a => a.category === 'competition');
      if (!raceActs.length && c.name) {
        const _n = c.name.trim().toLowerCase();
        raceActs = acts.filter(a => (a.name || '').trim().toLowerCase() === _n);
      }
      if (!raceActs.length) { raceActs = acts; dayFallback = true; }
      let startMs = null;
      for (const a of raceActs) {
        const t = a.start_date_local ? new Date(String(a.start_date_local).replace(' ', 'T')).getTime() : NaN;
        if (isFinite(t) && (startMs == null || t < startMs)) startMs = t;
      }
      return { c, iso, day, raceActs, dayFallback, startMs, od: null };
    });

    // 2) Resultats OD apparies par proximite HORAIRE (od.date porte l'heure).
    //    Un resultat par carte ; les resultats sans activite (ex: classement
    //    General, epreuve non enregistree) deviennent des cartes a part.
    const _byIso = new Map();
    _items.forEach(it => { (_byIso.get(it.iso) || _byIso.set(it.iso, []).get(it.iso)).push(it); });
    const _leftovers = new Map(); // iso -> [od results sans activite]
    window.__odAssignedByComp = {};
    const _odOv = _odOverridesLoad();
    const _odHid = _odHiddenLoad();
    for (const [iso, its] of _byIso) {
      const odAll = ((window.__odByDate && window.__odByDate[iso]) || []).filter(r => !_odHid.has(String(r.id)));
      if (!odAll.length) continue;
      // 1) Overrides MANUELS (menu "Associer a une epreuve...") : prioritaires.
      //    null = dissocie de tout resultat ; un id = ce resultat precis.
      const usedIds = new Set();
      const freeIts = [];
      for (const it of its) {
        const o = _odOv[String(it.c.id)];
        if (o === null) { it._odLocked = true; continue; }
        if (o !== undefined) {
          const r = odAll.find(x => String(x.id) === String(o));
          if (r) { it.od = r; it._odLocked = true; usedIds.add(String(r.id)); continue; }
        }
        freeIts.push(it);
      }
      // 2) Les classements GENERAUX n'ont jamais d'activite propre : jamais
      //    apparies automatiquement, toujours en carte dediee.
      const odGeneral = odAll.filter(r => /g[ée]n[ée]ral/i.test(r.competitionName || '') && !usedIds.has(String(r.id)));
      const odList = odAll.filter(r => !/g[ée]n[ée]ral/i.test(r.competitionName || '') && !usedIds.has(String(r.id)));
      if (odGeneral.length) _leftovers.set(iso, odGeneral.slice());
      if (odList.length === 1 && freeIts.length) {
        freeIts.forEach(it => { it.od = odList[0]; });
      } else if (odList.length > 1) {
        // appariement glouton par ecart de temps minimal
        const pairs = [];
        freeIts.forEach((it, ii) => odList.forEach((r, ri) => {
          const rt = r.date ? new Date(r.date).getTime() : NaN;
          const d = (isFinite(rt) && it.startMs != null) ? Math.abs(rt - it.startMs) : 1e15;
          pairs.push({ ii, ri, d });
        }));
        pairs.sort((a, b) => a.d - b.d);
        const usedI = new Set(), usedR = new Set();
        for (const pr of pairs) {
          if (usedI.has(pr.ii) || usedR.has(pr.ri)) continue;
          usedI.add(pr.ii); usedR.add(pr.ri);
          freeIts[pr.ii].od = odList[pr.ri];
        }
        const rest = odList.filter((r, ri) => !usedR.has(ri));
        if (rest.length) _leftovers.set(iso, (_leftovers.get(iso) || []).concat(rest));
      }
      its.forEach(it => { if (it.od) window.__odAssignedByComp[String(it.c.id)] = it.od.id; });
    }
    // Auto-remplissage federation + categorie de course depuis Open Dossard :
    // fede via la table competitionId->fede, niveau via raceCode ("1/2/3").
    // Persiste en base UNE fois, sans jamais ecraser une valeur existante
    // (guard .is(null) cote serveur).
    {
      // suivis SEPARES : on ne marque "pousse" que ce qu'on a reellement pousse
      // (au premier rendu la table fede n'est souvent pas encore prete)
      const _pushedFed = window._odFedePush = window._odFedePush || new Set();
      const _pushedLvl = window._odLvlPush = window._odLvlPush || new Set();
      const _fedLab = (f) => (f === 'FFVELO' ? 'FFVélo' : f);
      for (const it of _items) {
        if (!it.od || it.od._manual) continue;
        const c = it.c;
        const fed = (window.odFedeForCompetition && it.od.competitionId != null)
          ? _fedLab(window.odFedeForCompetition(it.od.competitionId)) : null;
        // categorie = catev du resultat (celle affichee sur la medaille : 3, 4, Juniors...)
        const lvl = it.od.catev || null;
        if (!c.federation && fed) c.federation = fed;
        if (!c.raceLevel && lvl) c.raceLevel = lvl;
        if (c._sbId && c._table === 'activity' && window.sb) {
          const k = String(c.id);
          if (fed && !_pushedFed.has(k)) {
            _pushedFed.add(k);
            window.sb.from('activities').update({ federation: fed }).eq('id', c._sbId).is('federation', null)
              .then(r => { if (r.error) { _pushedFed.delete(k); console.warn('[fede fill]', r.error.message); } });
          }
          if (lvl && !_pushedLvl.has(k)) {
            _pushedLvl.add(k);
            window.sb.from('activities').update({ race_level: lvl }).eq('id', c._sbId).is('race_level', null)
              .then(r => { if (r.error) { _pushedLvl.delete(k); console.warn('[lvl fill]', r.error.message); } });
          }
        }
      }
    }
    // Resultats saisis manuellement : uniquement la ou aucun resultat OD n'est associe
    {
      const _mr = _manualResLoad();
      for (const it of _items) {
        if (it.od) continue;
        const r = (it.c.result && it.c.result.place != null) ? it.c.result : _mr[String(it.c.id)];
        if (r && r.place != null) {
          it.od = { rankingScratch: r.place, rankingInCategory: r.place, totalInCategory: r.total || null, catev: r.catev || null, url: r.url || null, _manual: true };
        }
      }
    }

    // 3) Filet de securite : deux cartes memes jour + meme nom -> fusion
    const _groups = new Map();
    for (const it of _items) {
      const disp = (it.od && it.od.competitionName) ? it.od.competitionName : (it.c.name || '');
      const key = it.iso + '|' + disp.trim().toLowerCase();
      if (!_groups.has(key)) _groups.set(key, { ...it, disp, all: [it.c] });
      else {
        const g = _groups.get(key);
        const seen = new Set(g.raceActs.map(a => String(a._sbId)));
        it.raceActs.forEach(a => { if (!seen.has(String(a._sbId))) g.raceActs.push(a); });
        g.all.push(it.c);
      }
    }

    const _medalHTML = (od, color) => {
      if (od && od.rankingScratch != null) {
        const podium = od.rankingScratch === 1 ? ' gold' : (od.rankingScratch <= 3 ? ' podium' : '');
        const cat = (od.rankingInCategory != null && od.totalInCategory != null)
          ? `${od.rankingInCategory}/${od.totalInCategory}${od.catev ? ' · ' + od.catev : ''}`
          : (od.catev ? od.catev : 'scratch');
        return `<div class="comp-res-medal${podium}" title="Résultat officiel Open Dossard">
          <div class="comp-res-medal-rank">${od.rankingScratch}<sup>${od.rankingScratch === 1 ? 'er' : 'e'}</sup></div>
          <div class="comp-res-medal-cat">${cat}</div>
        </div>`;
      }
      return `<div class="comp-res-medal none">${trophySvg(color, 22)}</div>`;
    };
    const _fmtIsoDate = (iso) => { try { return new Date(iso + 'T12:00:00').toLocaleDateString('fr-FR', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' }); } catch { return iso; } };

    const _emittedIso = new Set();
    pastWrap.innerHTML = past.length ? [..._groups.values()].map(g => {
      const c = g.c;
      const _pi = compPrio(c.priority);
      let dist = 0, dur = 0, elev = 0, tssV = 0, hrSum = 0, hrN = 0;
      for (const a of g.raceActs) {
        dist += a.distance_km || 0; dur += a.duration || 0; elev += a.elevation_gain || 0;
        tssV += a.tss || 0; if (a.hr) { hrSum += a.hr; hrN++; }
      }
      if (!tssV && g.day && g.dayFallback) tssV = g.day.tss || 0;
      const metrics = [];
      if (dist) metrics.push(window.fmtDist(dist, (g.raceActs[0] && (g.raceActs[0].raw_type || g.raceActs[0].sport)) || ''));
      if (dur) metrics.push(fmtDur(dur));
      if (elev) metrics.push(Math.round(elev) + ' m D+');
      if (tssV) metrics.push(Math.round(tssV) + ' TSS');
      if (hrN) metrics.push(Math.round(hrSum / hrN) + ' bpm');
      let metricsHtml = metrics.length
        ? `<div class="comp-res-metrics">${metrics.map(m => `<span class="comp-res-m">${m}</span>`).join('<span class="comp-res-sep">·</span>')}</div>`
        : '<div class="comp-res-metrics comp-res-nodata">Pas de données d\'activité</div>';
      // Lien vers la page des resultats officiels (saisi avec le resultat manuel)
      if (g.od && g.od._manual && g.od.url) {
        const _u = String(g.od.url).replace(/"/g, '&quot;');
        metricsHtml = metricsHtml.replace('</div>',
          `${metrics.length ? '<span class="comp-res-sep">·</span>' : ''}<a class="comp-res-link" href="${_u}" target="_blank" rel="noopener" title="${_u}">Résultats ↗</a></div>`);
      }
      const _dispName = g.disp || c.name;
      const _tooltipNames = g.all.map(cc => cc.name).filter(Boolean).join(' + ');
      let html = `<div class="comp-result-card" data-prio="${_pi.key}" data-comp-id="${c.id}" style="--pc:${_pi.color};" title="Voir le détail">
        ${_medalHTML(g.od, _pi.color)}
        <div class="comp-res-content">
          <div class="comp-res-top">
            <span class="comp-res-name" title="${escapeHtml(_tooltipNames || '')}"><span style="color:${_pi.color};">${escapeHtml(_dispName)}</span>${window.compFedBadges ? window.compFedBadges(c) : ''}</span>
            <span class="comp-res-date">${dateLabel(c)}</span>
            <button class="comp-more" data-id="${c.id}" title="Actions">⋯</button>
            <button class="comp-del" data-id="${c.id}" title="Supprimer">×</button>
          </div>
          ${metricsHtml}
        </div>
      </div>`;
      // Resultats OD du jour SANS activite (classement General, epreuve non
      // enregistree) : cartes dediees, une seule fois par date.
      if (!_emittedIso.has(g.iso) && _leftovers.has(g.iso)) {
        _emittedIso.add(g.iso);
        html += _leftovers.get(g.iso).map(r => `<div class="comp-result-card od-only" data-prio="${_pi.key}" style="--pc:${_pi.color};" title="Résultat officiel Open Dossard">
          ${_medalHTML(r, _pi.color)}
          <div class="comp-res-content">
            <div class="comp-res-top">
              <span class="comp-res-name"><span style="color:${_pi.color};">${escapeHtml(r.competitionName || 'Résultat officiel')}</span></span>
              <span class="comp-res-date">${_fmtIsoDate(g.iso)}</span>
              <button class="comp-more od-more" data-od-id="${r.id}" data-iso="${g.iso}" title="Actions">⋯</button>
              <button class="comp-del od-del" data-od-id="${r.id}" title="Masquer ce résultat">×</button>
            </div>
            <div class="comp-res-metrics comp-res-nodata">Résultat officiel (pas d'activité liée)</div>
          </div>
        </div>`).join('');
      }
      return html;
    }).join('') : '<div class="comp-empty">Aucune compétition passée.</div>';
  }
}


// Associations manuelles compet <-> resultat Open Dossard (priment sur
// l'appariement automatique par heure). { [compId]: odResultId | null }
function _odOverridesLoad() {
  try { return JSON.parse(localStorage.getItem('coach_ia_od_overrides_v1') || '{}'); } catch { return {}; }
}

function _odOverridesSave(m) {
  localStorage.setItem('coach_ia_od_overrides_v1', JSON.stringify(m || {}));
  _odPrefsPush();
}

// Resultats saisis MANUELLEMENT (compets sans resultat Open Dossard)
// { [compId]: { place, total, catev, url } } — cache local ; la VERITE est en base
// (colonnes result_place/result_total/result_catev/result_url de activities ;
// la federation est poussee sur la colonne federation de la compet elle-meme).
function _manualResLoad() {
  try { return JSON.parse(localStorage.getItem('coach_ia_manual_results_v1') || '{}'); } catch { return {}; }
}

function _manualResSave(m) {
  localStorage.setItem('coach_ia_manual_results_v1', JSON.stringify(m || {}));
}

// Pousse le resultat manuel sur la ligne activities (fire-and-forget)
async function _manualResPush(comp, r, fede) {
  if (!window.sb || !comp || !comp._sbId) return;
  try {
    const upd = {
      result_place: r ? r.place : null,
      result_total: r ? (r.total || null) : null,
      result_catev: r ? (r.catev || null) : null,
      result_url: r ? (r.url || null) : null,
    };
    // Federation saisie dans le formulaire resultat -> colonne federation de la compet
    if (fede !== undefined) upd.federation = fede || null;
    await window.sb.from('activities').update(upd).eq('id', comp._sbId);
  } catch (e) { console.warn('[result push]', e.message || e); }
}

// Pousse les prefs Open Dossard (associations + masques) — 1 ligne par user
async function _odPrefsPush() {
  if (!window.sb) return;
  try {
    const { data: { user } } = await window.sb.auth.getUser();
    if (!user) return;
    await window.sb.from('od_prefs').upsert({
      user_id: user.id,
      overrides: _odOverridesLoad(),
      hidden: [..._odHiddenLoad()],
      updated_at: new Date().toISOString(),
    });
  } catch (e) { console.warn('[od prefs push]', e.message || e); }
}

// Resultats OD masques par l'utilisateur (cartes 'resultat officiel' supprimees)
function _odHiddenLoad() {
  try { return new Set(JSON.parse(localStorage.getItem('coach_ia_od_hidden_v1') || '[]').map(String)); } catch { return new Set(); }
}

function _odHiddenAdd(id) {
  const a = [..._odHiddenLoad()];
  if (!a.includes(String(id))) a.push(String(id));
  localStorage.setItem('coach_ia_od_hidden_v1', JSON.stringify(a));
  _odPrefsPush();
}


// Mini-formulaire flottant : saisir/modifier un resultat manuel
// (place, partants, federation, categorie, lien vers les resultats officiels)
function _openManualResultForm(btn, comp) {
  _closeCompActionsMenu();
  const cur = (comp.result && comp.result.place != null) ? comp.result : (_manualResLoad()[String(comp.id)] || {});
  const _esc = v => String(v == null ? '' : v).replace(/"/g, '&quot;').replace(/</g, '&lt;');
  // Federations proposees selon le sport de la compet (memes listes que le modal compet)
  const _cat = (typeof getSportCategory === 'function') ? getSportCategory(comp.sport) : null;
  const _feds = ((typeof FEDERATIONS_BY_CAT !== 'undefined' && FEDERATIONS_BY_CAT[_cat]) || []).concat('Autre');
  const _curFed = comp.federation || '';
  const menu = document.createElement('div');
  menu.className = 'comp-actions-menu comp-res-form';
  menu.innerHTML = `
    <div class="crf-title">Résultat — ${_esc(comp.name)}</div>
    <div class="crf-row2">
      <label>Place<input type="number" id="crf-place" min="1" step="1" value="${cur.place != null ? cur.place : ''}" placeholder="ex : 7"></label>
      <label>Partants<input type="number" id="crf-total" min="1" step="1" value="${cur.total != null ? cur.total : ''}" placeholder="ex : 62"></label>
    </div>
    <div class="crf-row2">
      <label>Fédération<select id="crf-fede">
        <option value=""${!_curFed ? ' selected' : ''}>—</option>
        ${_feds.map(f => `<option value="${_esc(f)}"${_curFed === f ? ' selected' : ''}>${_esc(f)}</option>`).join('')}
        ${_curFed && !_feds.includes(_curFed) ? `<option value="${_esc(_curFed)}" selected>${_esc(_curFed)}</option>` : ''}
      </select></label>
      <label>Catégorie<input type="text" id="crf-catev" value="${_esc(cur.catev)}" placeholder="ex : 3 / Open 2"></label>
    </div>
    <label>Lien résultats<input type="url" id="crf-url" value="${_esc(cur.url)}" placeholder="https://…"></label>
    <div class="crf-btns">
      <button type="button" id="crf-cancel">Annuler</button>
      <button type="button" id="crf-save">Enregistrer</button>
    </div>`;
  document.body.appendChild(menu);
  window._compMenuEl = menu;
  const r = btn.getBoundingClientRect();
  const mw = menu.offsetWidth || 240;
  menu.style.left = Math.max(8, Math.min(window.innerWidth - mw - 8, r.right - mw)) + 'px';
  menu.style.top = Math.min(window.innerHeight - menu.offsetHeight - 8, r.bottom + 6) + 'px';
  menu.querySelector('#crf-cancel').addEventListener('click', _closeCompActionsMenu);
  menu.querySelector('#crf-save').addEventListener('click', () => {
    const place = parseInt(menu.querySelector('#crf-place').value, 10) || null;
    const total = parseInt(menu.querySelector('#crf-total').value, 10) || null;
    const catev = menu.querySelector('#crf-catev').value.trim() || null;
    let url = menu.querySelector('#crf-url').value.trim() || null;
    if (url && !/^https?:\/\//i.test(url)) url = 'https://' + url;
    const fede = menu.querySelector('#crf-fede').value || null;
    const m = _manualResLoad();
    if (place) m[String(comp.id)] = { place, total, catev, url };
    else delete m[String(comp.id)];
    _manualResSave(m);
    _manualResPush(comp, place ? { place, total, catev, url } : null, fede);
    // Reflete la federation en local sans attendre la re-synchro
    if (fede !== (comp.federation || null)) {
      try {
        const all = loadCompetitions();
        const i = all.findIndex(x => x.id === comp.id);
        if (i >= 0) { all[i].federation = fede; localStorage.setItem(COMP_KEY, JSON.stringify(all)); }
      } catch (e) { /* ignore */ }
    }
    _closeCompActionsMenu();
    renderCompetitionsPage();
  });
  setTimeout(() => document.addEventListener('click', _compMenuOutside, true), 0);
  menu.querySelector('#crf-place').focus();
}


// Menu d'actions (⋯) d'une carte compet : Modifier / Transformer / Supprimer.
function _compMenuOutside(ev) {
  if (window._compMenuEl && window._compMenuEl.contains(ev.target)) return;
  _closeCompActionsMenu();
}

function _closeCompActionsMenu() {
  if (window._compMenuEl) { window._compMenuEl.remove(); window._compMenuEl = null; }
  document.removeEventListener('click', _compMenuOutside, true);
}

function _openCompActionsMenu(btn, id) {
  _closeCompActionsMenu();
  const comp = loadCompetitions().find(c => c.id === id);
  if (!comp) return;
  const isRealised = comp.realised === true || comp._table === 'activity' || comp._table === 'competition';
  const items = [];
  items.push({ lab: 'Modifier', fn: () => openCompModalForEdit(comp) });
  // Association manuelle a un resultat Open Dossard du meme jour
  const _odAll = (window.__odByDate && comp.date && window.__odByDate[comp.date]) || [];
  if (isRealised && _odAll.length) {
    items.push({ lab: 'Associer à une épreuve…', keepOpen: true, fn: () => {
      const cur = (_odOverridesLoad()[String(comp.id)] !== undefined)
        ? _odOverridesLoad()[String(comp.id)]
        : ((window.__odAssignedByComp || {})[String(comp.id)] ?? undefined);
      const menu = document.createElement('div');
      menu.className = 'comp-actions-menu';
      const addOpt = (label, apply, checked) => {
        const b = document.createElement('button');
        b.type = 'button';
        b.textContent = (checked ? '✓ ' : '') + label;
        b.addEventListener('click', (ev) => {
          ev.stopPropagation();
          _closeCompActionsMenu();
          const m = _odOverridesLoad();
          apply(m);
          _odOverridesSave(m);
          renderCompetitionsPage();
        });
        menu.appendChild(b);
      };
      addOpt('Automatique (par heure)', (m) => { delete m[String(comp.id)]; }, cur === undefined);
      for (const r of _odAll) {
        const rk = r.rankingScratch != null ? ` · ${r.rankingScratch}e` : '';
        addOpt((r.competitionName || 'Épreuve') + rk, (m) => { m[String(comp.id)] = r.id; }, cur != null && String(cur) === String(r.id));
      }
      addOpt('Dissocier de tout résultat', (m) => { m[String(comp.id)] = null; }, cur === null);
      _closeCompActionsMenu();
      document.body.appendChild(menu);
      window._compMenuEl = menu;
      const r2 = btn.getBoundingClientRect();
      const mw = menu.offsetWidth || 240;
      menu.style.left = Math.max(8, Math.min(window.innerWidth - mw - 8, r2.right - mw)) + 'px';
      menu.style.top = Math.min(window.innerHeight - menu.offsetHeight - 8, r2.bottom + 6) + 'px';
      setTimeout(() => document.addEventListener('click', _compMenuOutside, true), 0);
    } });
  }
  // Resultat manuel (si aucun resultat OD n'est deja associe)
  if (isRealised) {
    const _hasOd = (window.__odAssignedByComp || {})[String(comp.id)] != null;
    // verite = base (comp.result, pulle depuis activities) ; cache local en repli
    const _mr = (comp.result && comp.result.place != null) ? comp.result : _manualResLoad()[String(comp.id)];
    if (_mr) {
      items.push({ lab: 'Modifier le résultat…', keepOpen: true, fn: () => _openManualResultForm(btn, comp) });
      items.push({ lab: 'Retirer le résultat', fn: () => {
        const m = _manualResLoad();
        delete m[String(comp.id)];
        _manualResSave(m);
        _manualResPush(comp, null);
        renderCompetitionsPage();
      } });
    } else if (!_hasOd) {
      items.push({ lab: 'Ajouter un résultat…', keepOpen: true, fn: () => _openManualResultForm(btn, comp) });
    }
  }
  if (isRealised && comp._sbId) {
    items.push({ lab: 'Transformer en entraînement', fn: async () => {
      // Dissocie l'epreuve : l'activite redevient un entrainement
      // (category_set_by_user=true -> la synchro ne la remettra pas en compet)
      await setActivityCategory({ _sbId: comp._sbId }, 'entrainement', comp.date);
      const rest = loadCompetitions().filter(c => c.id !== id);
      saveCompetitions(rest);
      renderCompList(); renderCompetitionsPage(); renderCalendar();
    } });
  } else if (!isRealised) {
    // compét PRÉVUE : redevient une séance planifiée (mêmes données)
    items.push({ lab: 'Transformer en entraînement', fn: () => window.convertPlannedCompToTraining(id) });
  }
  items.push({ lab: 'Supprimer', danger: true, fn: () => {
    const rest = loadCompetitions().filter(c => c.id !== id);
    saveCompetitions(rest);
    if (comp) removeCompFromDashboard(comp);
    renderCompList(); renderCompetitionsPage(); renderCalendar();
  } });
  const menu = document.createElement('div');
  menu.className = 'comp-actions-menu';
  items.forEach(it => {
    const b = document.createElement('button');
    b.type = 'button';
    b.textContent = it.lab;
    if (it.danger) b.classList.add('danger');
    b.addEventListener('click', (ev) => { ev.stopPropagation(); if (!it.keepOpen) _closeCompActionsMenu(); it.fn(); });
    menu.appendChild(b);
  });
  document.body.appendChild(menu);
  window._compMenuEl = menu;
  const r = btn.getBoundingClientRect();
  const mw = menu.offsetWidth || 200;
  menu.style.left = Math.max(8, Math.min(window.innerWidth - mw - 8, r.right - mw)) + 'px';
  menu.style.top = Math.min(window.innerHeight - menu.offsetHeight - 8, r.bottom + 6) + 'px';
  setTimeout(() => document.addEventListener('click', _compMenuOutside, true), 0);
}


// Menu d'actions d'une carte 'resultat officiel' OD sans activite :
// associer a une activite/compet du jour, ou masquer le resultat.
function _openOdOnlyMenu(btn, odId, iso) {
  _closeCompActionsMenu();
  const menu = document.createElement('div');
  menu.className = 'comp-actions-menu';
  const dayComps = loadCompetitions().filter(c => c.date === iso && (c.realised === true || c._table === 'activity' || c._table === 'competition'));
  const addOpt = (label, fn, danger) => {
    const b = document.createElement('button');
    b.type = 'button';
    b.textContent = label;
    if (danger) b.classList.add('danger');
    b.addEventListener('click', (ev) => { ev.stopPropagation(); _closeCompActionsMenu(); fn(); });
    menu.appendChild(b);
  };
  for (const c of dayComps) {
    addOpt('Associer à « ' + (c.name || 'Activité') + ' »', () => {
      const m = _odOverridesLoad();
      m[String(c.id)] = odId;
      _odOverridesSave(m);
      renderCompetitionsPage();
    });
  }
  addOpt('Masquer ce résultat', () => { _odHiddenAdd(odId); renderCompetitionsPage(); }, true);
  document.body.appendChild(menu);
  window._compMenuEl = menu;
  const r = btn.getBoundingClientRect();
  const mw = menu.offsetWidth || 220;
  menu.style.left = Math.max(8, Math.min(window.innerWidth - mw - 8, r.right - mw)) + 'px';
  menu.style.top = Math.min(window.innerHeight - menu.offsetHeight - 8, r.bottom + 6) + 'px';
  setTimeout(() => document.addEventListener('click', _compMenuOutside, true), 0);
}


// Handler de clic partagé entre la carte du calendrier (#comp-list) et la page Compétitions.
function _handleCompClick(e) {
  // Cartes 'resultat officiel' OD (sans activite)
  if (e.target.classList.contains('od-more')) {
    e.stopPropagation();
    e.preventDefault();
    _openOdOnlyMenu(e.target, e.target.dataset.odId, e.target.dataset.iso);
    return;
  }
  if (e.target.classList.contains('od-del')) {
    e.stopPropagation();
    _odHiddenAdd(e.target.dataset.odId);
    renderCompetitionsPage();
    return;
  }
  // Menu d'actions
  if (e.target.classList.contains('comp-more')) {
    e.stopPropagation();
    e.preventDefault();
    _openCompActionsMenu(e.target, e.target.dataset.id);
    return;
  }
  // Clic sur la croix de suppression
  if (e.target.classList.contains('comp-del')) {
    e.stopPropagation();
    const id = e.target.dataset.id;
    const comps = loadCompetitions().filter(c => c.id !== id);
    saveCompetitions(comps);
    renderCompList();
    renderCompetitionsPage();
    renderCalendar();
    return;
  }
  // Lien « Résultats » : navigation normale, ne pas ouvrir le détail
  if (e.target.closest && e.target.closest('.comp-res-link')) { e.stopPropagation(); return; }
  // Clic sur une carte de compé (ligne, hero, carte résultat) → ouvre le détail
  const item = e.target.closest('[data-comp-id]');
  if (!item) return;
  const compId = item.dataset.compId;
  if (!compId) return;
  const comp = loadCompetitions().find(c => c.id === compId);
  if (!comp) return;
  // Pour course par étapes : ouvrir la 1ère étape ; sinon la date principale
  let openDate = comp.date;
  if (comp.stages && Array.isArray(comp.stagesList) && comp.stagesList.length) {
    const dates = comp.stagesList.map(s => s.date).filter(Boolean).sort();
    if (dates.length) openDate = dates[0];
  }
  if (openDate && typeof openSessionModal === 'function') {
    const isPast = new Date(openDate + 'T12:00:00') < appState.today;
    openSessionModal(openDate, isPast ? 'realise' : 'prevu');
  }
}

export function bootCompetitionsPage() {


// (Les snapshots de plan ont été supprimés : les jours passés lisent désormais
//  uniquement les vraies données depuis la base.)

// Compétition TRIATHLON planifiée pour une date donnée (rapprochement du réalisé)
window.__triCompForDate = function (iso) {
  try {
    const comps = (typeof loadCompetitionsExpanded === 'function') ? loadCompetitionsExpanded() : [];
    return comps.find(c => c.date === iso && typeof getSportCategory === 'function' && getSportCategory(c.sport) === 'triathlon') || null;
  } catch (e) { return null; }
};


// Libellé compact des distances triathlon d'une compétition : "750m · 20km · 5km"
window.triDistLabel = function (c) {
  const t = c && c.tri;
  if (!t || (!t.swim_m && !t.bike_km && !t.run_km)) return '';
  const parts = [];
  if (t.swim_m) parts.push(Math.round(t.swim_m) + 'm');
  if (t.bike_km) parts.push((+t.bike_km) + 'km');
  if (t.run_km) parts.push((+t.run_km) + 'km');
  return parts.join(' · ');
};


// Ligne distance des cartes compet : tri -> distances par segment ;
// CLM velo et course a pied -> distance simple (l'objectif de temps y a du sens).
window.compDistLabel = function (c) {
  const triL = window.triDistLabel(c);
  if (triL) return triL;
  if (!c || !c.km) return '';
  const cat = (typeof window.getSportCategory === 'function') ? window.getSportCategory(c.sport || '') : '';
  const isClm = cat === 'cyclisme' && (/contre|clm/i.test(c.type || '') || /\bclm\b|contre[- ]la[- ]montre/i.test(c.name || ''));
  const isRun = cat === 'course';
  return (isClm || isRun) ? ((+c.km) + ' km') : '';
};


// Badges federation / format tri / niveau d'une compet (cartes + filtres)
window.compFedBadges = function (c) {
  if (!c) return '';
  let h = '';
  if (c.federation) h += `<span class="comp-fed-badge">${c.federation}</span>`;
  if (c.triFormat) h += `<span class="comp-fed-badge fmt">${c.triFormat}</span>`;
  if (c.raceLevel) h += `<span class="comp-fed-badge lvl">${c.raceLevel}</span>`;
  return h;
};

window.renderCompetitionsPage = renderCompetitionsPage;


// Contexte pour la génération de plan IA (prochaine compétition, forme, volume récent).
window.coachGetPlanContext = function () {
  const comps = loadCompetitions().map(c => {
    let startDate = c.date;
    if (c.stages && Array.isArray(c.stagesList) && c.stagesList.length) {
      const ds = c.stagesList.map(s => s.date).filter(Boolean).sort();
      if (ds.length) startDate = ds[0];
    }
    return { ...c, dateObj: new Date(startDate + 'T12:00:00'), startDate };
  }).filter(c => c.dateObj >= appState.today).sort((a, b) => a.dateObj - b.dateObj);
  const next = comps[0] || null;

  const last = (Array.isArray(appState.data) && appState.data.length) ? appState.data[appState.data.length - 1] : null;
  const forme = {
    ctl: last && Number.isFinite(last.ctl) ? Math.round(last.ctl) : null,
    atl: last && Number.isFinite(last.atl) ? Math.round(last.atl) : null,
    tsb: last && Number.isFinite(last.tsb) ? Math.round(last.tsb) : null,
  };

  // Volume des 28 derniers jours
  const from = new Date(appState.today); from.setDate(from.getDate() - 28);
  let mins = 0, sessions = 0;
  const sportCount = {};
  for (const d of (appState.data || [])) {
    if (!(d.date >= from && d.date <= appState.today)) continue;
    mins += d.duration || 0;
    const acts = d.activities || [];
    if (acts.length || d.sessionName) sessions++;
    for (const a of acts) {
      const k = window.activitySportColorKey ? window.activitySportColorKey(a) : (a.sport || 'autre');
      sportCount[k] = (sportCount[k] || 0) + 1;
    }
  }
  const sportPrincipal = Object.keys(sportCount).sort((a, b) => sportCount[b] - sportCount[a])[0] || 'cyclisme';

  return {
    today: toIsoDate(appState.today),
    competition: next ? (() => {
      const stagesList = Array.isArray(next.stagesList) ? next.stagesList : [];
      const gpxPresent = !!(next.gpxContent || next.gpxName) || stagesList.some(s => s.gpxContent || s.gpxName);
      const sumKm = stagesList.reduce((a, s) => a + (Number(s.km) || 0), 0);
      const sumDplus = stagesList.reduce((a, s) => a + (Number(s.dplus) || 0), 0);
      const km = Number(next.km) || sumKm || null;
      const dplus = Number(next.dplus) || Number(next.course_dplus) || sumDplus || null;
      return {
        nom: next.name,
        date: toIsoDate(next.dateObj),
        joursAvant: Math.ceil((next.dateObj - appState.today) / 86400000),
        priorite: compPrio(next.priority).key,
        parcours: {
          gpx_present: gpxPresent,            // si false → ne PAS inventer le profil du parcours
          distance_km: km,
          denivele_m: dplus,
          type: fmtMinToTime(next.target) || null,
        },
      };
    })() : null,
    forme,
    volume_recent: {
      heures_par_semaine: Math.round((mins / 60 / 4) * 10) / 10,
      seances_par_semaine: Math.round((sessions / 4) * 10) / 10,
    },
    sport_principal: sportPrincipal,
  };
};


document.getElementById('comp-add').addEventListener('click', async () => {
  const name = document.getElementById('comp-name').value.trim();
  const date = document.getElementById('comp-date').value;
  const priority = document.getElementById('comp-priority').value;
  if (!name || !date) {
    await appAlert({
      title: 'Champs manquants',
      message: 'Renseigne au moins le nom et la date.',
    });
    return;
  }
  const comps = loadCompetitions();
  comps.push({ id: Date.now().toString(), name, date, priority });
  saveCompetitions(comps);
  document.getElementById('comp-name').value = '';
  document.getElementById('comp-date').value = '';
  renderCompList();
  renderCompetitionsPage();
  renderCalendar();
});

// Resultats de course saisis manuellement, a plat, pour le palmares agrege
// (opendossard.js). Exclut les compets deja couvertes par un resultat OD associe
// pour ne pas compter deux fois la meme course.
window.getManualRaceResults = function () {
  try {
    const out = [];
    const mr = _manualResLoad();
    const assigned = window.__odAssignedByComp || {};
    for (const c of loadCompetitions()) {
      if (typeof compIsRealised === 'function' && !compIsRealised(c)) continue;
      const r = (c.result && c.result.place != null) ? c.result : mr[String(c.id)];
      if (!r || r.place == null) continue;
      if (assigned[String(c.id)] != null) continue;
      out.push({
        date: c.date, place: +r.place, total: r.total || null, catev: r.catev || null,
        name: c.name || '', federation: c.federation || null, sport: c.sport || null,
      });
    }
    return out;
  } catch (e) { return []; }
};

document.getElementById('comp-list')?.addEventListener('click', _handleCompClick);

document.getElementById('comp-hero')?.addEventListener('click', _handleCompClick);

document.getElementById('comp-page-upcoming')?.addEventListener('click', _handleCompClick);

document.getElementById('comp-page-past')?.addEventListener('click', _handleCompClick);
}
