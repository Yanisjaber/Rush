/* src/features/calendar/realise-calendar.js — extrait de l'ancien app.js (découpage par fonctionnalité). */
import { appState } from '../../core/state.js';
import { loadRealisedTrainings, openTrainModal } from '../training/train-modal.js';
import { openCompModal } from '../competitions/comp-form.js';
import { compIsRealised, dowFr, loadCompetitionsExpanded, renderCompList } from '../competitions/competitions-page.js';
import { fmtShortDate, getSportCategory, toIsoDate } from '../dashboard/filters.js';
import { REST_MOON_SVG, compPrio, fmtDur, trophySvg } from '../../core/format.js';
import { renderWeekPlan } from '../plan/week-plan.js';
import { enforceWtLabels } from './week-summary.js';
import { getMondayOfWeek } from '../dashboard/chart-weekly.js';
import { _WT_IC } from './week-icons.js';
import { isRestDayForMode, isStravaIgnored } from '../sessions/session-actions.js';
import { parseTimeToMin } from '../competitions/comp-stages.js';

// Index de l'activité affichée par jour (pour les jours multi-activités). Clé = ISO date.
export const dayActivityIndex = {};

// Index de l'item Prévu affiché par jour (pour jours avec plusieurs compés/entraînements)
export const dayPrevuIndex = {};


function getDisplayedActivity(realDay) {
  // Renvoie l'activité actuellement à afficher pour ce jour (selon dayActivityIndex)
  const iso = toIsoDate(realDay.date);
  const acts = realDay.activities;
  if (!acts || acts.length === 0) return null;
  const idx = dayActivityIndex[iso] || 0;
  return { activity: acts[Math.min(idx, acts.length - 1)], idx: Math.min(idx, acts.length - 1), total: acts.length, iso };
}


function renderRealisedDayCard(d, dow, realDay, isToday) {
  const dispo = getDisplayedActivity(realDay);
  // Si pas de tableau activities (ancien data.js), fallback sur les champs racine du day
  let act = dispo ? dispo.activity : realDay;
  const total = dispo ? dispo.total : 1;
  const idx = dispo ? dispo.idx : 0;
  const iso = toIsoDate(d);

  let dur = act.duration || 0;

  let hasMulti = total > 1;

  // Jour multisport COMPLET (triathlon/brick...) : il se comporte comme
  // N'IMPORTE QUEL SPORT -> une seule tuile classique (pastille Triathlon,
  // durée/distance totales). Le détail par discipline vit dans la modale.
  if (hasMulti && window.SportProfiles && window.SportProfiles.detectMultisport) {
    const _g0 = window.SportProfiles.detectMultisport(realDay.activities);
    if (_g0 && _g0.legs.length === realDay.activities.length) {
      hasMulti = false;
      const _triComp = window.__triCompForDate ? window.__triCompForDate(iso) : null;
      act = {
        name: (_triComp && _triComp.name) || _g0.kind,
        raw_type: 'Triathlon', sport: 'Triathlon',
        type: 'vo2', sessionType: 'vo2',
        duration: _g0.totals.durMin,
        distance_km: +(realDay.activities.reduce((s2, a2) => s2 + (+a2.distance_km || 0), 0).toFixed(1)),
        elevation_gain: realDay.activities.reduce((s2, a2) => s2 + (+a2.elevation_gain || 0), 0),
        tss: Math.round(_g0.totals.tss),
        calories: Math.round(_g0.totals.kcal),
        category: (_triComp || realDay.activities.some(a2 => a2.category === 'competition')) ? 'competition' : undefined,
        priority: (_triComp && _triComp.priority) || (realDay.activities.find(a2 => a2.category === 'competition') || {}).priority,
        structure: null,
      };
      dur = act.duration;
    }
  }

  // Jour multi-activites : on divise la 2e partie de la case en colonnes pleine
  // hauteur (1 par activite : liisere couleur du sport + glyph + duree). Clic = ouvre l'activite.
  if (hasMulti) {
    const _acts = (realDay && realDay.activities && realDay.activities.length) ? realDay.activities : [act];
    // Pas la place d'afficher toutes les activites -> on garde les 3 plus longues
    // (evite les icones coupees en bas de case). Le tap ouvre le detail complet.
    // Ordre d'affichage : CHRONOLOGIQUE (heure de depart) — un triathlon se lit
    // natation -> velo -> course, pas par TSS decroissant.
    const _startMin = (a) => { const m = a.start_date_local && String(a.start_date_local).match(/T(\d{2}):(\d{2})/); return m ? (+m[1]) * 60 + (+m[2]) : 9999; };
    let _list = _acts.map((a, i) => ({ a, i, t: _startMin(a) }));
    if (_list.length > 3) {
      _list = _list.slice().sort((x, y) => (y.a.duration || 0) - (x.a.duration || 0)).slice(0, 3);
    }
    _list.sort((x, y) => (x.t - y.t) || (x.i - y.i));
    const cols = _list.map(({ a, i }) => {
      const isComp = a.category === 'competition';
      const hex = isComp ? compPrio(a.priority).color : (window.sportColor ? window.sportColor(a.raw_type || a.sport) : '#9ca3af');
      const g = isComp ? trophySvg(hex, 16) : (window.sportGlyph ? window.sportGlyph(a.raw_type || a.sport, 22) : '');
      // Format compact pour colonnes étroites : "42m" au lieu de "42 min"
      const _tRaw = a.duration ? fmtDur(a.duration) : (a.distance_km ? window.fmtDist(a.distance_km, a.raw_type || a.sport, '100m') : '');
      const t = _tRaw.replace(' min', 'm');
      const _nm = a.name || a.sessionName || 'Séance';
      return `<div class="day-multi-col" data-iso="${iso}" data-source="realise" data-actidx="${i}" title="${String(_nm).replace(/"/g, '&quot;')}" style="background:${hex}1a">`
        + `<div class="dmc-bar" style="background:${hex}"></div>`
        + `<div class="dmc-body">${g ? `<span class="dmc-glyph" style="line-height:0">${g}</span>` : ''}${t ? `<span class="dmc-time">${t}</span>` : ''}</div>`
        + `</div>`;
    }).join('');
    // Jour multisport (triathlon/brick...) : badge + attribut pour la couleur dédiée
    let _msAttr = '', _msBadge = '';
    if (window.SportProfiles && window.SportProfiles.detectMultisport) {
      const _g = window.SportProfiles.detectMultisport(_acts);
      if (_g && _g.legs.length === _acts.length) {
        _msAttr = ' data-sport-cat="triathlon"';
        _msBadge = `<span class="day-ms-badge">${_g.kind === 'Triathlon' ? 'TRI' : _g.kind.split(' ')[0].toUpperCase()}</span>`;
      }
    }
    return `
    <div class="day-card past${isToday ? ' today' : ''} day-card--multi"${_msAttr} data-iso="${iso}" data-source="realise">
      <div class="day-card-dow">${dowFr[dow]}${isToday ? '<span class="dow-suffix"> · auj.</span>' : ''}</div>
      <div class="day-card-date">${d.getDate()}${_msBadge}</div>
      <div class="day-multi-grid">${cols}</div>
    </div>
  `;
  }

  const dateRow = hasMulti ? `
    <div class="day-card-date-row">
      <div class="day-card-date">${d.getDate()}</div>
      <div class="day-card-arrows-wrapper">
        <button class="day-card-arrow-inline arrow-prev" data-iso="${iso}" title="Activité précédente">‹</button>
        <button class="day-card-arrow-inline arrow-next" data-iso="${iso}" title="Activité suivante">›</button>
      </div>
    </div>
  ` : `<div class="day-card-date">${d.getDate()}</div>`;

  const counter = hasMulti ? `<div class="day-card-counter">${idx + 1}/${total}</div>` : '';

  // Fallbacks robustes pour data.js ancien format (champs day-level)
  const aType = act.type || act.sessionType || '';
  const aName = act.name || act.sessionName || 'Séance';
  const km = act.distance_km ? window.fmtDist(act.distance_km, act.raw_type || act.sport, '100m') : '';
  // Nom de sport Strava exact + clé couleur pour la pill
  let sportLabel = window.activitySportLabel ? window.activitySportLabel(act) : '';
  let sportCat = window.activitySportColorKey ? window.activitySportColorKey(act) : 'autre';
  // Jour multisport détecté (enchaînement nat/vélo/course) : le jour EST un
  // triathlon/brick — pastille et couleur du sport Triathlon sur la tuile.
  if (realDay && Array.isArray(realDay.activities) && realDay.activities.length > 1
      && window.SportProfiles && window.SportProfiles.detectMultisport) {
    const _g = window.SportProfiles.detectMultisport(realDay.activities);
    if (_g && _g.legs.length === realDay.activities.length) { sportLabel = _g.kind; sportCat = 'triathlon'; }
  }

  // Jour de compétition : détecté par la CATÉGORIE de l'activité (fiable pour
  // toutes les étapes), avec repli sur la liste compétitions par date.
  const comps = (typeof loadCompetitionsExpanded === 'function') ? loadCompetitionsExpanded() : [];
  const compToday = comps.find(c => c.date === iso);
  const isCompAct = act.category === 'competition';
  const raceClass = isCompAct ? ' race' : '';
  const raceAttr = isCompAct ? ` data-prio="${compPrio(compToday ? compToday.priority : null).key}"` : '';

  // Meta : pilotée par le profil du sport (course → allure, natation → m, muscu → TSS...)
  let metaParts = [];
  if (window.SportProfiles) {
    metaParts = window.SportProfiles.shortMeta(act);
  } else {
    if (dur) metaParts.push(fmtDur(dur));
    if (km) metaParts.push(km);
    else if (act.tss) metaParts.push(act.tss + ' TSS');
    if (act.elevation_gain) metaParts.push(Math.round(act.elevation_gain) + ' m D+');
    if (act.rpe != null && act.rpe !== '') metaParts.push('RPE ' + act.rpe);
  }
  // Chaque item dans son propre span → CSS peut stacker en colonne sur petits écrans
  // sans wrap moche au milieu de "36 km".
  const metaLine = metaParts.map(p => `<span class="dst-meta-item">${p}</span>`).join('');

  // Marqueur si TOUTES les activités du jour sont manuelles (= pas tracké par Strava)
  const allManual = realDay && realDay.activities && realDay.activities.length
    && realDay.activities.every(a => a._manual);
  const manualClass = allManual ? ' manual' : '';

  // Sport block : ne rendre QUE si on a un label (sinon = ligne dashed orpheline qui fait croire à un jour de repos)
  const sportBlock = sportLabel
    ? `<div class="day-card-sport"><span class="sport-pill" data-sport-cat="${sportCat}">${sportLabel}</span></div>`
    : '';

  // Mini-profil d'intervalles dans la carte (si la seance a une structure).
  const _miniProfile = (act && Array.isArray(act.structure) && act.structure.length && window.renderWorkoutProfileHTML)
    ? `<div class="day-card-profile" style="margin-top:8px;">${window.renderWorkoutProfileHTML(act.structure, { height: 30, labels: false, padding: 0, bg: 'transparent', border: 'none', radius: 0, sport: act.raw_type || act.sport })}</div>`
    : '';

  // Mono-activite : meme look "tuile" que le multi, mais une seule tuile pleine largeur.
  // Glyph en debut de ligne (gagne de la hauteur) + profil d'intervalles toute largeur.
  const _hex = isCompAct
    ? compPrio(compToday ? compToday.priority : null).color
    : (window.sportColor ? window.sportColor(act.raw_type || act.sport) : '#9ca3af');
  const _headGlyph = isCompAct
    ? trophySvg(_hex, 18)
    : (window.sportGlyph ? window.sportGlyph(act.raw_type || act.sport, 20) : '');
  const _fullProfile = (act && Array.isArray(act.structure) && act.structure.length && window.renderWorkoutProfileHTML)
    ? `<div class="dst-profile">${window.renderWorkoutProfileHTML(act.structure, { height: 30, labels: false, padding: 0, bg: 'transparent', border: 'none', radius: 0, sport: act.raw_type || act.sport })}</div>`
    : '';
  return `
    <div class="day-card past${isToday ? ' today' : ''}${raceClass}${manualClass} day-card--single" data-iso="${iso}" data-source="realise"${raceAttr}>
      <div class="day-card-dow">${dowFr[dow]}${isToday ? '<span class="dow-suffix"> · auj.</span>' : ''}</div>
      <div class="day-card-date">${d.getDate()}</div>
      <div class="day-single-tile" style="background:${_hex}1a" title="${String(aName).replace(/"/g, '&quot;')}">
        <div class="dmc-bar" style="background:${_hex}"></div>
        <div class="dst-body">
          <div class="dst-head">
            ${_headGlyph ? `<span class="dst-glyph" style="line-height:0">${_headGlyph}</span>` : ''}
            <div class="dst-text">
              <span class="dst-name">${aName}</span>
              ${metaLine ? `<span class="dst-meta">${metaLine}</span>` : ''}
            </div>
          </div>
          ${_fullProfile}
        </div>
      </div>
    </div>
  `;
}


export function renderCalendar() {
  // Filtre mois visible dans les deux modes
  document.getElementById('month-filter').style.display = 'flex';
  // Reset button label selon le mode
  const resetBtn = document.getElementById('month-reset');
  if (resetBtn) {
    resetBtn.textContent = appState.calendarMode === 'prevu' ? '4 sem. à venir' : '4 dern. sem.';
  }
  if (window.__updateMonthOverlay) window.__updateMonthOverlay();
  if (appState.calendarMode === 'prevu') {
    renderWeekPlan();
  } else {
    renderRealiseCalendar();
  }
}


function renderRealiseCalendar() {
  // Sous-titre supprimé
  const subEl = { textContent: '' };

  // Index data par ISO
  const dataByIso = {};
  appState.data.forEach(d => { dataByIso[toIsoDate(d.date)] = d; });
  // Competitions RÉALISÉES (créées depuis le calendrier réalisé) à injecter dans les jours.
  const realisedComps = (typeof loadCompetitionsExpanded === 'function')
    ? loadCompetitionsExpanded().filter(compIsRealised) : [];

  // Déterminer les semaines à afficher
  let weeksStarts = [];
  if (appState.selectedMonth) {
    // Mois sélectionné : juste les semaines de ce mois, sans injection de semaine courante
    const firstDay = new Date(appState.selectedMonth.getFullYear(), appState.selectedMonth.getMonth(), 1);
    const lastDay = new Date(appState.selectedMonth.getFullYear(), appState.selectedMonth.getMonth() + 1, 0);
    const firstMonday = getMondayOfWeek(firstDay);
    let cursor = new Date(firstMonday);
    while (cursor <= lastDay) {
      weeksStarts.push(new Date(cursor));
      cursor.setDate(cursor.getDate() + 7);
    }
    const monthLabel = appState.selectedMonth.toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' });
    subEl.textContent = `Réalisé · ${monthLabel}`;
  } else {
    // 4 semaines se terminant par la semaine d'ancrage (par défaut : aujourd'hui).
    // Si on vient d'un clic sur le graphe, l'ancre = la date de l'activité → sa
    // semaine se retrouve tout en haut après l'inversion.
    const anchor = appState.calendarAnchorDate || appState.today;
    const thisMonday = getMondayOfWeek(anchor);
    for (let i = 3; i >= 0; i--) {
      const w = new Date(thisMonday);
      w.setDate(thisMonday.getDate() - i * 7);
      weeksStarts.push(w);
    }
    subEl.textContent = `Réalisé · 4 dernières semaines`;
  }
  // Inversion : semaine la plus récente du mois en haut
  weeksStarts.reverse();

  const todayIso = toIsoDate(appState.today);
  const weeksHtml = [];
  for (const weekStart of weeksStarts) {
    const weekEnd = new Date(weekStart);
    weekEnd.setDate(weekStart.getDate() + 6);
    const weekLabel = `Semaine du ${fmtShortDate(weekStart)} au ${fmtShortDate(weekEnd)}`;

    const dayCards = [];
    let weekTotalDur = 0;
    let weekTotalTss = 0;
    let weekTotalSessions = 0;
    let weekTotalKm = 0;
    let lastDayWithMetrics = null; // pour récupérer CTL/ATL en fin de semaine

    for (let i = 0; i < 7; i++) {
      const d = new Date(weekStart);
      d.setDate(weekStart.getDate() + i);
      const iso = toIsoDate(d);
      const dow = d.getDay();
      const isFuture = iso > todayIso;
      const isToday = iso === todayIso;

      let cardHTML;
      if (isFuture) {
        // Jour futur : on n'affiche rien (mode réalisé)
        cardHTML = `
          <div class="day-card empty-past" data-iso="${iso}" data-source="realise" style="opacity:0.3;">
            <div class="day-card-dow">${dowFr[dow]}</div>
            <div class="day-card-date">${d.getDate()}</div>
            <div class="day-card-name" style="color:var(--text-mute);font-weight:500;">À venir</div>
          </div>
        `;
      } else {
        let realDay = dataByIso[iso];
        // Filtre les activités Strava masquées par l'utilisateur (suppression locale)
        if (realDay && realDay.activities && typeof isStravaIgnored === 'function') {
          const filtered = realDay.activities.filter(a => {
            if (a._manual) return true;
            const aid = a.id || a.activityId;
            return !aid || !isStravaIgnored(aid);
          });
          if (filtered.length !== realDay.activities.length) {
            realDay = { ...realDay, activities: filtered };
            // Si plus aucune activité après filtrage, on traite comme un jour sans data
            if (filtered.length === 0) realDay = null;
          }
        }
        // Récupère les entraînements MANUELS réalisés (ex: muscu, yoga ajoutés à la main)
        const manualRealised = (typeof loadRealisedTrainings === 'function') ? loadRealisedTrainings().filter(t => t.date === iso) : [];
        // Si on a des manuels et pas de realDay Strava, on en crée un virtuel
        // Si on a déjà un realDay Strava, on merge les activités manuelles dedans
        if (manualRealised.length > 0) {
          // Clone pour NE PAS muter l'objet partage de `data` (sinon les seances
          // manuelles s'accumulent a chaque rendu -> doublons).
          if (!realDay) realDay = { date: iso, activities: [], sessionType: 'autre' };
          else realDay = { ...realDay, activities: [...(realDay.activities || [])] };
          for (const m of manualRealised) {
            // Dedoublonnage : si la meme seance est deja presente via DASHBOARD_DATA (DB),
            // on retire la version DB et on garde la version locale (valeurs a jour).
            // Source unique = base : si la version DB de cette seance est deja la,
            // on l'affiche (la version localStorage ne sert que de tampon non-synchronise).
            const _dbTwin = realDay.activities.some(x => (
              (m._sbId && String(x._sbId) === String(m._sbId)) ||
              (m.id && String(x.client_id) === String(m.id))
            ));
            if (_dbTwin) continue;
            const sportVal = m.sport || 'autre';
            realDay.activities.push({
              name: m.name,
              sport: sportVal,
              raw_type: sportVal, // utilisé par activitySportLabel / Color pour le pill
              type: m.type || 'endurance',
              sessionType: m.type || 'endurance',
              sessionName: m.name,
              duration: m.duration || 0,
              tss: m.tss || 0,
              distance_km: m.km || null,
              elevation_gain: m.dplus || null,
              rpe: (m.rpe != null ? m.rpe : null),
              laps: (m.laps != null ? m.laps : null),
              gpxName: m.gpxName || null,
              gpxContent: m.gpxContent || null,
              structure: m.structure || null,
              _manual: true,
              _manualId: m.id, // id pour edit/delete depuis la modal
              notes: m.notes || '',
            });
          }
          // Recalcule duration et tss au niveau jour si pas déjà set
          if (!realDay.duration) realDay.duration = realDay.activities.reduce((s, a) => s + (a.duration || 0), 0);
          if (!realDay.tss) realDay.tss = realDay.activities.reduce((s, a) => s + (a.tss || 0), 0);
          if (!realDay.sessionType) realDay.sessionType = realDay.activities[0].type || 'endurance';
          if (!realDay.sessionName) realDay.sessionName = realDay.activities[0].name;
        }
        // Compétitions réalisées de ce jour -> injectées comme activités "course".
        const compsRealisedToday = realisedComps.filter(c => c.date === iso);
        if (compsRealisedToday.length > 0) {
          if (!realDay) realDay = { date: iso, activities: [], sessionType: 'vo2' };
          else realDay = { ...realDay, activities: [...(realDay.activities || [])] };
          for (const c of compsRealisedToday) {
            // Mêmes garde-fous que buildRealisedDay : jamais de pseudo-entrée si
            // une vraie activité compétition existe, ni si l'enchaînement tri
            // réalisé EST la compétition ; dédup par nom en secours.
            if (realDay.activities.some(x => x.category === 'competition' && !x._comp)) continue;
            if (typeof getSportCategory === 'function' && getSportCategory(c.sport) === 'triathlon'
                && window.SportProfiles && window.SportProfiles.detectMultisport) {
              const _gg2 = window.SportProfiles.detectMultisport(realDay.activities.filter(x => !x._comp));
              if (_gg2 && _gg2.legs.length >= 2) continue;
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
          if (!realDay.sessionName && realDay.activities[0]) realDay.sessionName = realDay.activities[0].name;
          if (!realDay.sessionType) realDay.sessionType = 'vo2';
        }
        // Mémorise le dernier jour avec CTL/ATL
        if (realDay && (realDay.ctl != null || realDay.atl != null)) {
          lastDayWithMetrics = realDay;
        }
        if (realDay && (realDay.sessionType || (realDay.activities && realDay.activities.length))) {
          const dur = realDay.duration || 0;
          weekTotalDur += dur;
          weekTotalTss += realDay.tss || 0;
          weekTotalSessions += (realDay.activities && realDay.activities.length) ? realDay.activities.length : 1;
          if (realDay.activities && realDay.activities.length) {
            for (const a of realDay.activities) weekTotalKm += a.distance_km || 0;
          } else if (realDay.distance_km) {
            weekTotalKm += realDay.distance_km;
          }
          cardHTML = renderRealisedDayCard(d, dow, realDay, isToday);
        } else {
          // Lune « Récupération » UNIQUEMENT si le repos a été activé pour ce jour
          // (override utilisateur) ; sinon case basique vide.
          const _isForcedRest = (typeof isRestDayForMode === 'function') && isRestDayForMode(iso);
          cardHTML = `
            <div class="day-card empty-past${_isForcedRest ? ' rest' : ''} rest-clickable${isToday ? ' today' : ''}" data-iso="${iso}" data-source="realise">
              <div class="day-card-dow">${dowFr[dow]}${isToday ? '<span class="dow-suffix"> · auj.</span>' : ''}</div>
              <div class="day-card-date">${d.getDate()}</div>
              ${_isForcedRest ? `<div class="rest-b">${REST_MOON_SVG}<span>Récupération</span></div>` : ''}
            </div>
          `;
        }
      }
      dayCards.push(cardHTML);
    }

    const _rh = Math.floor(weekTotalDur / 60);
    const _rm = Math.round(weekTotalDur % 60);
    const totalHours = weekTotalDur < 60
      ? `${Math.round(weekTotalDur)}<span style="font-size:11px;font-weight:500;"> min</span>`
      : `${_rh}<span style="font-size:11px;font-weight:500;">h</span>${_rm.toString().padStart(2, '0')}`;
    const totalKm = Math.round(weekTotalKm);
    const lastCtl = lastDayWithMetrics && lastDayWithMetrics.ctl != null ? Math.round(lastDayWithMetrics.ctl) : 0;
    const lastAtl = lastDayWithMetrics && lastDayWithMetrics.atl != null ? Math.round(lastDayWithMetrics.atl) : 0;
    const totalsCard = `
      <div class="week-totals" data-view="volume">
        <div class="wt-header">
          <button class="wt-arrow wt-prev" title="Vue précédente">‹</button>
          <span class="wt-label">Bilan</span>
          <button class="wt-arrow wt-next" title="Vue suivante">›</button>
        </div>
        <div class="wt-view wt-view-volume">
          <div class="wt-row"><span class="wt-ic">${_WT_IC.vol}</span><span class="wt-val">${totalHours}</span><span class="wt-lbl">Volume</span></div>
          <div class="wt-row"><span class="wt-ic">${_WT_IC.km}</span><span class="wt-val">${totalKm}<span style="font-size:11px;font-weight:500;">km</span></span><span class="wt-lbl">Distance</span></div>
          <div class="wt-row"><span class="wt-ic">${_WT_IC.sea}</span><span class="wt-val">${weekTotalSessions}</span><span class="wt-lbl">Séances</span></div>
        </div>
        <div class="wt-view wt-view-charge">
          <div class="wt-row"><span class="wt-ic">${_WT_IC.tss}</span><span class="wt-val">${weekTotalTss}</span><span class="wt-lbl">TSS</span></div>
          <div class="wt-row"><span class="wt-ic">${_WT_IC.ctl}</span><span class="wt-val">${lastCtl}</span><span class="wt-lbl">CTL</span></div>
          <div class="wt-row"><span class="wt-ic">${_WT_IC.atl}</span><span class="wt-val">${lastAtl}</span><span class="wt-lbl">ATL</span></div>
        </div>
        <div class="wt-dots">
          <span class="wt-dot d-volume"></span>
          <span class="wt-dot d-charge"></span>
        </div>
      </div>
    `;
    dayCards.push(totalsCard);

    const _wsumDur = weekTotalDur <= 0 ? '' : (weekTotalDur < 60 ? `${Math.round(weekTotalDur)}min` : `${Math.floor(weekTotalDur/60)}h${Math.round(weekTotalDur%60).toString().padStart(2,'0')}`);
    const _wsumKm = (typeof totalKm !== 'undefined' && totalKm > 0) ? ` \u00b7 ${totalKm} km` : '';
    const weekSum = weekTotalSessions > 0 ? `<span class="week-row-sum">${weekTotalSessions} s\u00e9ance${weekTotalSessions>1?'s':''}${_wsumDur?` \u00b7 ${_wsumDur}`:''}${_wsumKm}</span>` : '';
    weeksHtml.push(`
      <div class="week-row">
        <div class="week-row-label">${weekLabel}${weekSum}</div>
        <div class="week-row-days">${dayCards.join('')}</div>
      </div>
    `);
  }

  const _dowHead = '<div class="week-dow-head">' + ['L','M','M','J','V','S','D'].map(function(x){return '<span>'+x+'</span>';}).join('') + '</div>';
  document.getElementById('week-calendar').innerHTML = `<div class="month-plan">${_dowHead}${weeksHtml.join('')}</div>`;
  enforceWtLabels();
}

export function bootRealiseCalendar() {


// ========= MODE PRÉVU vs RÉALISÉ =========
appState.calendarMode = (window.coachPrefs && window.coachPrefs.default_tab) || 'realise';

// Synchroniser l'onglet calendrier actif avec la préférence (Paramètres → Affichage).
document.querySelectorAll('#calendar-subtabs .subtab').forEach(b => {
  b.classList.toggle('active', b.dataset.mode === appState.calendarMode);
});

appState.selectedMonth = null;

appState.calendarAnchorDate = null;


// Expose les fonctions principales sur window pour que les modules ES6 externes
// (day-extras.js notamment) puissent les appeler.
window.renderCalendar = renderCalendar;

window.openTrainModal = openTrainModal;

window.openCompModal = openCompModal;

window.renderCompList = (typeof renderCompList === 'function') ? renderCompList : (() => {});
}
