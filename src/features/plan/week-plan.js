/* src/features/plan/week-plan.js — extrait de l'ancien app.js (découpage par fonctionnalité). */
import { appState } from '../../core/state.js';
import { compIsRealised, dowFr, loadCompetitionsExpanded } from '../competitions/competitions-page.js';
import { getMondayOfWeek } from '../dashboard/chart-weekly.js';
import { fmtShortDate, getSportCategory, toIsoDate } from '../dashboard/filters.js';
import { enforceWtLabels } from '../calendar/week-summary.js';
import { REST_MOON_SVG, compPrio, fmtDur, trophySvg } from '../../core/format.js';
import { loadRealisedTrainings, loadTrainings } from '../training/train-modal.js';
import { _WT_IC } from '../calendar/week-icons.js';
import { activeSports } from '../dashboard/init.js';
import { dayPrevuIndex } from '../calendar/realise-calendar.js';
import { parseTimeToMin } from '../competitions/comp-stages.js';
import { isRestDayForMode } from '../sessions/session-actions.js';


// ========= GÉNÉRATION DU PLAN 7 JOURS =========
function determinePhase(comps, currentTSB) {
  // TSB très bas → forcer décharge avant tout objectif
  if (currentTSB < -30) return { phase: 'recovery', daysUntil: null, comp: null };
  const futureComps = comps.filter(c => c.dateObj >= appState.today).sort((a,b) => a.dateObj - b.dateObj);
  if (futureComps.length === 0) return { phase: 'build', daysUntil: null, comp: null };
  const next = futureComps[0];
  const daysUntil = Math.ceil((next.dateObj - appState.today) / 86400000);
  let phase;
  if (daysUntil <= 7) phase = 'race';
  else if (daysUntil <= 28) phase = 'taper';
  else if (daysUntil <= 56) phase = 'peak';
  else phase = 'build';
  return { phase, daysUntil, comp: next };
}


// Templates par phase × jour de semaine (dow : 1=Lun, 0=Dim)
const PLAN_TEMPLATES = {
  build: {
    1: { type: 'rest', name: 'Repos', dur: 0, tss: 0, why: 'Récup post-week-end, repos complet recommandé' },
    2: { type: 'tempo', name: 'Tempo / Sweet Spot', dur: 75, tss: 80, why: 'Volume d\'intensité modérée pour densifier le CTL' },
    3: { type: 'endurance', name: 'Endurance Z2', dur: 90, tss: 60, why: 'Base aérobie, fait grimper le CTL sans coût en fatigue' },
    4: { type: 'seuil', name: 'Seuil 4×8min', dur: 80, tss: 95, why: 'Bloc de seuil pour repousser le FTP' },
    5: { type: 'recup', name: 'Récup active', dur: 45, tss: 25, why: 'Évacuer la fatigue avant le week-end' },
    6: { type: 'vo2', name: 'VO2max 5×4min', dur: 90, tss: 110, why: 'Travail capacité aérobie maximale' },
    0: { type: 'endurance', name: 'Sortie longue Z2', dur: 180, tss: 160, why: 'Construire l\'endurance et la résistance, brique principale du build' }
  },
  peak: {
    1: { type: 'rest', name: 'Repos', dur: 0, tss: 0, why: 'Récup totale' },
    2: { type: 'seuil', name: 'Seuil 3×12min', dur: 85, tss: 110, why: 'Renforcer le FTP en phase peak' },
    3: { type: 'endurance', name: 'Endurance Z2', dur: 75, tss: 55, why: 'Récupération active entre les blocs intensifs' },
    4: { type: 'vo2', name: 'VO2max 6×3min', dur: 80, tss: 115, why: 'Pic d\'intensité, le bloc clé du peak' },
    5: { type: 'recup', name: 'Récup active', dur: 40, tss: 20, why: 'Vidange complète avant le simulateur du week-end' },
    6: { type: 'tempo', name: 'Simulation course (sweet spot + sprints)', dur: 100, tss: 120, why: 'Reproduire les efforts de course pour préparer le corps' },
    0: { type: 'endurance', name: 'Sortie longue + 3×8min seuil', dur: 180, tss: 170, why: 'Maintenir l\'endurance avec un peu d\'intensité' }
  },
  taper: {
    1: { type: 'rest', name: 'Repos', dur: 0, tss: 0, why: 'Affûtage' },
    2: { type: 'tempo', name: 'Tempo court 2×10min', dur: 50, tss: 50, why: 'Maintenir le tonus sans creuser la fatigue' },
    3: { type: 'endurance', name: 'Endurance Z2 courte', dur: 60, tss: 40, why: 'Volume réduit, faire chuter l\'ATL' },
    4: { type: 'vo2', name: 'VO2max 4×3min', dur: 60, tss: 70, why: 'Petite dose d\'intensité pour rester réactif' },
    5: { type: 'recup', name: 'Récup active', dur: 30, tss: 15, why: 'Décrassage' },
    6: { type: 'tempo', name: 'Openers : 3×30sec sprint', dur: 45, tss: 35, why: 'Activer le système neuromusculaire' },
    0: { type: 'endurance', name: 'Endurance Z2', dur: 90, tss: 60, why: 'Sortie de plaisir, sentir la forme arriver' }
  },
  race: {
    1: { type: 'rest', name: 'Repos complet', dur: 0, tss: 0, why: 'Semaine de course : zéro charge' },
    2: { type: 'recup', name: 'Récup active 30min', dur: 30, tss: 15, why: 'Décrasser sans fatiguer' },
    3: { type: 'tempo', name: 'Openers : 5×30sec sprint', dur: 40, tss: 30, why: 'Réveiller le corps' },
    4: { type: 'rest', name: 'Repos', dur: 0, tss: 0, why: 'Veille de veille de course' },
    5: { type: 'tempo', name: 'Openers courts', dur: 30, tss: 25, why: 'Activation neuromusculaire' },
    6: { type: 'rest', name: 'Repos', dur: 0, tss: 0, why: 'Repos avant course' },
    0: { type: 'vo2', name: 'Course', dur: 120, tss: 200, why: 'Jour J — donne tout' }
  },
  recovery: {
    1: { type: 'rest', name: 'Repos', dur: 0, tss: 0, why: 'Décharge : récupération maximale' },
    2: { type: 'recup', name: 'Récup active', dur: 45, tss: 25, why: 'Décharge active douce' },
    3: { type: 'endurance', name: 'Endurance Z2 courte', dur: 60, tss: 40, why: 'Volume très bas, juste pour bouger' },
    4: { type: 'rest', name: 'Repos', dur: 0, tss: 0, why: 'Récupération continue' },
    5: { type: 'recup', name: 'Récup active', dur: 40, tss: 20, why: 'Maintenir l\'élan sans charger' },
    6: { type: 'endurance', name: 'Endurance courte', dur: 75, tss: 55, why: 'Reprise progressive' },
    0: { type: 'endurance', name: 'Endurance Z2', dur: 90, tss: 60, why: 'Sortie facile pour finir la décharge' }
  }
};


export const PHASE_LABELS = {
  build: 'Build',
  peak: 'Peak',
  taper: 'Taper',
  race: 'Race week',
  recovery: 'Décharge'
};


function determinePhaseForDate(comps, fromDate, currentTSB) {
  if (currentTSB < -30) return 'recovery';
  const futureComps = comps.filter(c => c.dateObj >= fromDate).sort((a,b) => a.dateObj - b.dateObj);
  if (futureComps.length === 0) return 'build';
  const daysUntil = Math.ceil((futureComps[0].dateObj - fromDate) / 86400000);
  if (daysUntil <= 7) return 'race';
  if (daysUntil <= 28) return 'taper';
  if (daysUntil <= 56) return 'peak';
  return 'build';
}


export function renderWeekPlan() {
  // En Prévu : seulement les compétitions PLANIFIÉES (futures). Les compés
  // réalisées/passées (_table='activity') s'affichent dans le Réalisé.
  const comps = loadCompetitionsExpanded()
    .filter(c => c._table !== 'activity')
    .map(c => ({ ...c, dateObj: new Date(c.date + 'T12:00:00') }));
  const { phase, daysUntil, comp } = determinePhase(comps, appState.todayData.tsb);

  // Pill de phase supprimée — l'info est dans le sous-titre

  // Sous-titre supprimé
  const subEl = { textContent: '' };
  if (comp) {
    subEl.textContent = `Prochain objectif : ${comp.name} (${compPrio(comp.priority).label}) dans ${daysUntil} jours · phase actuelle ${PHASE_LABELS[phase]}`;
  } else if (phase === 'recovery') {
    subEl.textContent = `TSB actuel ${appState.todayData.tsb.toFixed(0)} : décharge prioritaire avant tout objectif`;
  } else {
    subEl.textContent = `Aucune compétition planifiée · phase ${PHASE_LABELS[phase]} (entretien général)`;
  }

  // Lundi de la semaine courante = première semaine affichée
  const thisMonday = getMondayOfWeek(appState.today);
  const todayIso = toIsoDate(appState.today);

  // Index data par date ISO pour les jours passés
  const dataByIso = {};
  appState.data.forEach(d => { dataByIso[toIsoDate(d.date)] = d; });

  // Dedoublonnage prevu/realise : une seance presente dans les DEUX stocks (meme id /
  // _sbId) ne doit pas apparaitre aussi en prevu -> on masque la copie prevu (le realise prime).
  const _realisedKeySet = new Set();
  try {
    (typeof loadRealisedTrainings === 'function' ? loadRealisedTrainings() : []).forEach(t => {
      if (t && t.id != null) _realisedKeySet.add(String(t.id));
      if (t && t._sbId) _realisedKeySet.add(String(t._sbId));
    });
  } catch (e) {}

  // Mode Prévu : TOUJOURS 4 semaines glissantes en ORDRE CHRONOLOGIQUE
  // (semaine courante / 1ère du mois en haut, semaines suivantes vers le bas)
  let weeksStarts = [];
  const startMonday = appState.selectedMonth
    ? getMondayOfWeek(new Date(appState.selectedMonth.getFullYear(), appState.selectedMonth.getMonth(), 1))
    : thisMonday;
  for (let w = 0; w < 4; w++) {
    const ws = new Date(startMonday);
    ws.setDate(startMonday.getDate() + w * 7);
    weeksStarts.push(ws);
  }

  const weeksHtml = [];
  for (let w = 0; w < weeksStarts.length; w++) {
    const weekStart = weeksStarts[w];
    const weekEnd = new Date(weekStart);
    weekEnd.setDate(weekStart.getDate() + 6);
    const weekLabel = `Semaine du ${fmtShortDate(weekStart)} au ${fmtShortDate(weekEnd)}`;

    const dayCards = [];
    let weekTotalDur = 0;
    let weekTotalTss = 0;
    let weekTotalSessions = 0;
    let weekTotalKm = 0;
    let weekKind = 'past'; // 'past' = entièrement passée, 'current' = en cours, 'future' = à venir

    for (let i = 0; i < 7; i++) {
      const d = new Date(weekStart);
      d.setDate(weekStart.getDate() + i);
      const iso = toIsoDate(d);
      const dow = d.getDay();
      const isPast = iso < todayIso;
      const isToday = iso === todayIso;

      let cardHTML;
      let proposal;
      let items = [];

      // 1) Compétitions réelles de ce jour (étapes incluses) — passé / aujourd'hui / futur.
      //    Les jours passés lisent désormais la VRAIE compét depuis la base
      //    (et non plus un snapshot figé), donc les étapes restent correctes.
        const compsForToday = comps.filter(c => toIsoDate(c.dateObj) === iso && !compIsRealised(c));
        for (const c of compsForToday) {
          // Si pas de temps cible saisi → on n'affiche PAS de durée par défaut
          // (on garde un fallback de 120 min en interne pour le calcul TSS)
          let raceDur = null;
          let raceDurForTss = 120;
          {
            const _rm = parseTimeToMin(c.target);
            if (_rm) { raceDur = _rm; raceDurForTss = _rm; }
          }
          const raceTss = Math.round(raceDurForTss * 1.0);
          let raceName, stageInfo = '';
          if (c.stageIdx !== undefined && c.totalStages) {
            raceName = c.name.replace(/ — Étape \d+$/, '');
            stageInfo = `Étape ${c.stageIdx + 1}/${c.totalStages}`;
          } else {
            raceName = c.name;
          }
          items.push({
            type: 'vo2',
            name: raceName,
            stageInfo,
            isRace: true,
            _id: c.id,
            _isStage: c.stageIdx !== undefined,
            dur: raceDur,
            tss: raceTss,
            sport: c.sport || 'Ride',
            km: c.km || null,
            dplus: c.dplus || null,
            priority: c.priority,
            why: `Compétition · ${compPrio(c.priority).label}${c.km ? ' · ' + window.fmtKm(c.km) + ' km' : ''}`,
          });
        }

        // 2) Tous les entraînements prévus manuels pour ce jour
        const manualTrainings = ((typeof loadTrainings === 'function') ? loadTrainings() : []).filter(t => !window.coachModeKeep || window.coachModeKeep(t.ia));
        const manualForToday = manualTrainings.filter(t => t.date === iso && !_realisedKeySet.has(String(t.id)) && !(t._sbId && _realisedKeySet.has(String(t._sbId))));
        for (const m of manualForToday) {
          items.push({
            type: m.type || 'endurance',
            name: m.name,
            dur: m.duration || 0,
            tss: m.tss || 0,
            sport: m.sport || 'Ride',
            why: m.notes || 'Séance ajoutée manuellement',
            structure: m.structure || null,
            km: m.km || null,
            dplus: m.dplus || null,
            rpe: (m.rpe != null ? m.rpe : null),
            _manual: true,
            _id: m.id,
          });
        }

        // 3) Aucun item réel pour ce jour → uniquement un repos forcé éventuel.
        //    (Plus de séance auto-générée : la planification IA passe par le chat.)
        if (items.length === 0 && !isPast) {
          const _isForcedRest = (typeof isRestDayForMode === 'function') && isRestDayForMode(iso);
          if (_isForcedRest) {
            items.push({ type: 'rest', name: 'Repos', dur: 0, tss: 0, why: 'Repos forcé (override utilisateur)' });
          }
        }

        // 4) Filtre sport : ne garder que les items dont la catégorie match les sports actifs.
        // Les repos passent toujours (ils n'ont pas de sport propre).
        if (!activeSports.has('tout') && activeSports.size > 0) {
          items = items.filter(it => it.type === 'rest' || activeSports.has(getSportCategory(it.sport)));
        }

        // 5) Si aucun item ne passe le filtre → jour vide, on saute le rendu de la card normale
        if (items.length === 0) {
          cardHTML = `
            <div class="day-card empty-past${isToday ? ' today' : ''}" data-iso="${iso}" data-source="prevu">
              <div class="day-card-dow">${dowFr[dow]}${isToday ? '<span class="dow-suffix"> · auj.</span>' : ''}</div>
              <div class="day-card-date">${d.getDate()}</div>
            </div>
          `;
          dayCards.push(cardHTML);
          continue;
        }

        // Index de l'item actuellement affiché (pour multi-items)
        const curIdx = Math.min(dayPrevuIndex[iso] || 0, items.length - 1);
        proposal = items[curIdx];
        proposal._totalItems = items.length;
        proposal._itemIdx = curIdx;

      // Une séance est "rest" uniquement si son TYPE est 'rest'
      // (un entraînement manuel sans TSS reste un vrai entraînement, pas un repos)
      const isRest = proposal.type === 'rest';
      const todayClass = isToday ? ' today' : '';
      const pastClass = isPast ? ' prevu-past' : '';
      // Totaux : TOUTES les séances du jour (pas seulement celle affichée quand
      // il y en a plusieurs), aujourd'hui + futur uniquement, hors repos.
      if (!isPast) {
        for (const it of items) {
          if (it.type === 'rest') continue;
          weekTotalDur += it.dur || 0;
          weekTotalTss += it.tss || 0;
          weekTotalSessions += 1;
          weekTotalKm += it.km || 0;
        }
      }
      // L'item actuellement affiché peut être une compé ou un entraînement manuel
      const isRace = !!proposal.isRace;
      const raceClass = isRace ? ' race' : '';
      const raceAttr = isRace ? ` data-prio="${compPrio(proposal.priority).key}"` : '';
      // Sport label
      let sportLabel = '';
      let sportCat = 'autre';
      if (!isRest) {
        sportLabel = window.sportFr(proposal.sport || 'cyclisme');
        sportCat = window.activitySportColorKey({ sport: proposal.sport || 'cyclisme' }) || 'autre';
      }
      const kmStr = proposal.km ? window.fmtDist(proposal.km, proposal.sport, '100m') : '';
      const durStr = proposal.dur ? fmtDur(proposal.dur) : '';
      const dplusStr = proposal.dplus ? Math.round(proposal.dplus) + ' m D+' : '';
      const rpeStr = (proposal.rpe != null && proposal.rpe !== '') ? 'RPE ' + proposal.rpe : '';
      const metaLine = [durStr, kmStr, dplusStr, rpeStr]
        .filter(Boolean)
        .map(p => `<span class="dst-meta-item">${p}</span>`)
        .join('');
      const sportBlock = sportLabel
        ? `<div class="day-card-sport"><span class="sport-pill" data-sport-cat="${sportCat}">${sportLabel}</span></div>`
        : '';
      const dowSuffix = isToday ? '<span class="dow-suffix"> · auj.</span>'
                       : (isPast ? '<span class="dow-suffix"> · passé</span>' : '');
      const stageInfoLine = (proposal.stageInfo)
        ? `<div class="day-card-stage">${proposal.stageInfo}</div>`
        : '';
      // Meme langage visuel que le Realise : tuile mono / colonnes multi / repos.
      const totalItems = proposal._totalItems || 1;
      const hasMulti = totalItems > 1;
      const _dow = `<div class="day-card-dow">${dowFr[dow]}${dowSuffix}</div>`;
      const _date = `<div class="day-card-date">${d.getDate()}</div>`;

      if (hasMulti) {
        let _list = items.map((it, i) => ({ it, i }));
        if (_list.length > 3) {
          _list = _list.slice().sort((x, y) => (y.it.dur || 0) - (x.it.dur || 0)).slice(0, 3).sort((x, y) => x.i - y.i);
        }
        const cols = _list.map(({ it, i }) => {
          const _r = !!it.isRace;
          const hex = _r ? compPrio(it.priority).color : (window.sportColor ? window.sportColor(it.sport) : '#9ca3af');
          const g = _r ? trophySvg(hex, 16) : (window.sportGlyph ? window.sportGlyph(it.sport, 22) : '');
          // Format compact pour colonnes étroites : "42m" au lieu de "42 min"
          // (évite que "min" parte sur une 2e ligne quand 4-5 activités en parallèle)
          const tRaw = it.dur ? fmtDur(it.dur) : (it.km ? window.fmtDist(it.km, it.sport, '100m') : '');
          const t = tRaw.replace(' min', 'm');
          const nm = it.name || 'Séance';
          // Chaque colonne d'un jour multi est déplaçable individuellement
          const _mv = it._id && (it._manual || (it.isRace && !it._isStage));
          const _mvAttr = _mv ? ` data-move-kind="${it._manual ? 'training' : 'comp'}" data-move-id="${String(it._id).replace(/"/g, '&quot;')}"` : '';
          return `<div class="day-multi-col" data-iso="${iso}" data-source="prevu" data-actidx="${i}"${_mvAttr} title="${String(nm).replace(/\"/g, '&quot;')}" style="background:${hex}1a">`
            + `<div class="dmc-bar" style="background:${hex}"></div>`
            + `<div class="dmc-body">${g ? `<span class="dmc-glyph" style="line-height:0">${g}</span>` : ''}${t ? `<span class="dmc-time">${t}</span>` : ''}</div>`
            + `</div>`;
        }).join('');
        cardHTML = `
        <div class="day-card${todayClass}${pastClass} day-card--multi" data-iso="${iso}" data-source="prevu">
          ${_dow}
          ${_date}
          <div class="day-multi-grid">${cols}</div>
        </div>`;
      } else if (isRest) {
        cardHTML = `
        <div class="day-card rest${todayClass}${pastClass}" data-iso="${iso}" data-source="prevu">
          ${_dow}
          ${_date}
          <div class="rest-b">${REST_MOON_SVG}<span>Récupération</span></div>
        </div>`;
      } else {
        const _hex = isRace ? compPrio(proposal.priority).color : (window.sportColor ? window.sportColor(proposal.sport) : '#9ca3af');
        const _headGlyph = isRace ? trophySvg(_hex, 18) : (window.sportGlyph ? window.sportGlyph(proposal.sport, 20) : '');
        const _fullProfile = (proposal && Array.isArray(proposal.structure) && proposal.structure.length && window.renderWorkoutProfileHTML)
          ? `<div class="dst-profile">${window.renderWorkoutProfileHTML(proposal.structure, { height: 30, labels: false, padding: 0, bg: 'transparent', border: 'none', radius: 0, sport: proposal.sport })}</div>`
          : '';
        const _nm = proposal.name || 'Séance';
        // Déplaçable par glisser-déposer : entraînement manuel ou compétition
        // simple (pas les étapes d'une course à étapes, liées entre elles).
        const _movable = proposal._id && (proposal._manual || (proposal.isRace && !proposal._isStage));
        const _moveAttr = _movable ? ` data-move-kind="${proposal._manual ? 'training' : 'comp'}" data-move-id="${String(proposal._id).replace(/"/g, '&quot;')}"` : '';
        cardHTML = `
        <div class="day-card${todayClass}${pastClass}${raceClass} day-card--single" data-iso="${iso}" data-source="prevu"${raceAttr}${_moveAttr}>
          ${_dow}
          ${_date}
          <div class="day-single-tile" style="background:${_hex}1a" title="${String(_nm).replace(/\"/g, '&quot;')}">
            <div class="dmc-bar" style="background:${_hex}"></div>
            <div class="dst-body">
              <div class="dst-head">
                ${_headGlyph ? `<span class="dst-glyph" style="line-height:0">${_headGlyph}</span>` : ''}
                <div class="dst-text">
                  <span class="dst-name">${_nm}</span>
                  ${metaLine ? `<span class="dst-meta">${metaLine}</span>` : ''}
                </div>
              </div>
              ${stageInfoLine}
              ${_fullProfile}
            </div>
          </div>
        </div>`;
      }
      dayCards.push(cardHTML);

      // Détermine si la semaine est passée, en cours ou future
      if (isToday) weekKind = 'current';
      else if (!isPast && weekKind === 'past') weekKind = 'current';
    }
    if (weekStart > appState.today) weekKind = 'future';

    // Carte des totaux (réalisé pour passé/courant, prévu pour future)
    const _wh = Math.floor(weekTotalDur / 60);
    const _wm = Math.round(weekTotalDur % 60);
    const totalHours = weekTotalDur < 60
      ? `${Math.round(weekTotalDur)}<span style="font-size:11px;font-weight:500;"> min</span>`
      : `${_wh}<span style="font-size:11px;font-weight:500;">h</span>${_wm.toString().padStart(2, '0')}`;
    const totalsLabel = weekKind === 'future' ? 'Prévu' : (weekKind === 'current' ? 'En cours' : 'Bilan');
    // Km prévus : somme des distances renseignées (compés + manuels). 0 si aucune (comme Réalisé).
    const _kmPrevu = Math.round(weekTotalKm);
    const kmVal = `${_kmPrevu}<span style="font-size:11px;font-weight:500;">km</span>`;
    // Prévu : pas de CTL/ATL projetés (complexe)
    const totalsCard = `
      <div class="week-totals" data-view="volume">
        <div class="wt-header">
          <button class="wt-arrow wt-prev" title="Vue précédente">‹</button>
          <span class="wt-label">${totalsLabel}</span>
          <button class="wt-arrow wt-next" title="Vue suivante">›</button>
        </div>
        <div class="wt-view wt-view-volume">
          <div class="wt-row"><span class="wt-ic">${_WT_IC.vol}</span><span class="wt-val">${totalHours}</span><span class="wt-lbl">Volume</span></div>
          <div class="wt-row"><span class="wt-ic">${_WT_IC.km}</span><span class="wt-val">${kmVal}</span><span class="wt-lbl">Distance</span></div>
          <div class="wt-row"><span class="wt-ic">${_WT_IC.sea}</span><span class="wt-val">${weekTotalSessions}</span><span class="wt-lbl">Séances</span></div>
        </div>
        <div class="wt-view wt-view-charge">
          <div class="wt-row"><span class="wt-ic">${_WT_IC.tss}</span><span class="wt-val">${weekTotalTss}</span><span class="wt-lbl">TSS</span></div>
          <div class="wt-row"><span class="wt-ic">${_WT_IC.ctl}</span><span class="wt-val">0</span><span class="wt-lbl">CTL</span></div>
          <div class="wt-row"><span class="wt-ic">${_WT_IC.atl}</span><span class="wt-val">0</span><span class="wt-lbl">ATL</span></div>
        </div>
        <div class="wt-dots">
          <span class="wt-dot d-volume"></span>
          <span class="wt-dot d-charge"></span>
        </div>
      </div>
    `;
    dayCards.push(totalsCard);

    const _wsumDur = weekTotalDur <= 0 ? '' : (weekTotalDur < 60 ? `${Math.round(weekTotalDur)}min` : `${Math.floor(weekTotalDur/60)}h${Math.round(weekTotalDur%60).toString().padStart(2,'0')}`);
    const _wsumKm = _kmPrevu > 0 ? ` \u00b7 ${_kmPrevu} km` : '';
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