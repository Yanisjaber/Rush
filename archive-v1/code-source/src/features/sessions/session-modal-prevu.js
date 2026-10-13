/* src/features/sessions/session-modal-prevu.js — contenu de la modale pour une séance PRÉVUE ou une
   compétition (plan, GPX, carte, étapes). Déplacé tel quel depuis session-modal.js
   (aucun changement de comportement ; indentation d'origine conservée pour ne pas toucher
   aux espaces des gabarits HTML). */
import { loadTrainings } from '../training/train-modal.js';
import { getSportCategory, toIsoDate } from '../dashboard/filters.js';
import { extractGpxStats, renderGpxElevationChart, renderGpxLeafletMap } from '../gpx/gpx-render.js';
import { compPrio, fmtDur, trophySvg } from '../../core/format.js';
import { loadCompetitionsExpanded } from '../competitions/competitions-page.js';
import { fmtMinToTime, parseTimeToMin } from '../competitions/comp-stages.js';
import { dayPrevuIndex } from '../calendar/realise-calendar.js';
import { isRestDayForMode } from './session-actions.js';
import { PHASE_LABELS } from '../plan/week-plan.js';

export function renderPlannedSession(ctx) {
  const { iso, source, date, dateStr, day, titleEl, metaEl, bodyEl } = ctx;
    // ============= Source = 'prevu' =============
    const compsAll = loadCompetitionsExpanded().map(c => ({ ...c, dateObj: new Date(c.date + 'T12:00:00') }));
    const compsForToday = compsAll.filter(c => toIsoDate(c.dateObj) === iso);
    const manualTrainings = ((typeof loadTrainings === 'function') ? loadTrainings() : []);
    const manualForToday = manualTrainings.filter(t => t.date === iso);

    // === Items affichables sur la day card (source de vérité pour la sélection clavier/flèches) ===
    // L'ordre DOIT correspondre à la day card : compsForToday + manualForToday
    const dayItems = [];
    compsForToday.forEach(c => dayItems.push({ kind: 'comp', data: c }));
    manualForToday.forEach(t => dayItems.push({ kind: 'manual', data: t }));

    // Item sélectionné par l'utilisateur via les flèches du calendrier
    let dayCurIdx = dayPrevuIndex[iso] || 0;
    if (dayCurIdx >= dayItems.length) dayCurIdx = 0;
    const selectedItem = dayItems[dayCurIdx] || null;

    // Build la liste d'items finale (avec enrichissement étapes si applicable)
    // - Si l'item sélectionné est une étape de stage race : enrichit avec TOUTES les étapes
    //   du parent pour permettre la navigation entre étapes via le switcher de la modal
    // - Sinon : la liste = items du jour
    const items = [];
    let curIdx = 0;
    if (selectedItem && selectedItem.kind === 'comp' && selectedItem.data.parentId) {
      const stageRaceItems = compsAll
        .filter(c => c.parentId === selectedItem.data.parentId)
        .sort((a, b) => (a.stageIdx || 0) - (b.stageIdx || 0));
      stageRaceItems.forEach(c => items.push({ kind: 'comp', data: c }));
      // Insère les autres items du jour (compés non-stage + manuels) qui ne sont pas déjà dedans
      dayItems.forEach(it => {
        if (it.kind !== 'comp' || it.data.parentId !== selectedItem.data.parentId) {
          items.push(it);
        }
      });
      // Trouve l'étape correspondant à l'item sélectionné
      const idx = items.findIndex(it => it.kind === 'comp' && it.data.id === selectedItem.data.id);
      curIdx = idx >= 0 ? idx : 0;
    } else if (dayItems.length > 0) {
      dayItems.forEach(it => items.push(it));
      curIdx = dayCurIdx;
    } else {
      // Rien d'explicite ce jour-là : pas de séance auto-générée (la planif IA
      // passe par le chat). On affiche un repos forcé éventuel, sinon « rien ».
      const _isForcedRest = (typeof isRestDayForMode === 'function') && isRestDayForMode(iso);
      const proposal = _isForcedRest
        ? { type: 'rest', name: 'Repos', dur: 0, tss: 0, why: 'Repos forcé (override utilisateur)' }
        : { type: 'libre', name: 'Aucune séance prévue', dur: 0, tss: 0, why: '' };
      items.push({ kind: 'template', data: proposal, phase: null });
      curIdx = 0;
    }
    if (curIdx >= items.length) curIdx = 0;

    function renderPrevuItem(idx) {
      curIdx = idx;
      const item = items[idx];
      // Mise à jour de la date affichée si l'item est une étape sur une autre date
      let effectiveDateStr = dateStr;
      if (item.kind === 'comp' && item.data.date && item.data.date !== iso) {
        const d2 = new Date(item.data.date + 'T12:00:00');
        if (!isNaN(d2.getTime())) {
          effectiveDateStr = d2.toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
        }
      }
      const switchHTML = items.length > 1 ? `
        <div class="modal-activity-switch">
          ${items.map((it, i) => {
            const label = it.kind === 'comp'
              ? (it.data.stageIdx !== undefined ? `Étape ${it.data.stageIdx + 1}` : it.data.name.split(' — ')[0])
              : (it.kind === 'manual' ? it.data.name : 'IA');
            return `<button class="${i === idx ? 'active' : ''}" data-i="${i}">${label}</button>`;
          }).join('')}
        </div>` : '';

      if (item.kind === 'comp') {
        renderCompModal(item.data, switchHTML, effectiveDateStr);
      } else if (item.kind === 'manual') {
        renderManualTrainingModal(item.data, switchHTML, effectiveDateStr);
      } else {
        renderTemplateModal(item.data, item.phase, switchHTML, effectiveDateStr);
      }
    }

    function renderCompModal(c, switchHTML, dateStrOverride) {
      const _dateStr = dateStrOverride || dateStr;
      const isStage = c.stageIdx !== undefined && c.totalStages;
      // Affiche les boutons "Modifier" et "Supprimer" pour cette compé
      const editBtn = document.getElementById('modal-edit-btn');
      const delBtn = document.getElementById('modal-delete-btn');
      if (editBtn) {
        editBtn.hidden = false;
        editBtn.dataset.kind = 'comp';
        editBtn.dataset.compId = c.parentId || c.id;
      }
      if (delBtn) {
        delBtn.hidden = false;
        delBtn.dataset.kind = 'comp';
        delBtn.dataset.compId = c.parentId || c.id;
      }
      const parentName = isStage ? c.name.replace(/ — Étape \d+$/, '') : c.name;
      const sportLabel = window.sportFr(c.sport || 'Ride');
      const sportCat = window.activitySportColorKey({ sport: c.sport }) || 'autre';
      const sportPill = `<span class="sport-pill" data-sport-cat="${sportCat}" style="margin-left:10px;vertical-align:middle;">${sportLabel}</span>`;

      // Title : juste le nom de la course (pas le numéro d'étape — déjà visible dans le switcher + section dédiée)
      titleEl.innerHTML = `${trophySvg(compPrio(c.priority).color, 18)} ${escapeHtml(parentName)}`;

      // Meta : date + heure + sport pill
      const timeStr = c.time ? ` · ${c.time.replace(':', 'h')}` : '';
      metaEl.innerHTML = `${_dateStr}${timeStr}${sportPill}`;

      // Parse target → minutes
      let raceMinutes = parseTimeToMin(c.target);

      // Calcule l'allure si km + target dispo (adapté au sport)
      let allure = null, allureLabel = 'Allure';
      if (c.km && raceMinutes) {
        const hours = raceMinutes / 60;
        const cyclingSports = ['Ride','VirtualRide','GravelRide','EBikeRide','MountainBikeRide','EMountainBikeRide','Velomobile','Handcycle'];
        const runSports = ['Run','TrailRun','VirtualRun'];
        const swimSports = ['Swim','OpenWaterSwim'];
        if (cyclingSports.includes(c.sport)) {
          allure = (c.km / hours).toFixed(1) + ' km/h';
        } else if (runSports.includes(c.sport)) {
          const minPerKm = raceMinutes / c.km;
          const mm = Math.floor(minPerKm);
          const ss = Math.round((minPerKm - mm) * 60);
          allure = `${mm}'${ss.toString().padStart(2,'0')}"/km`;
        } else if (swimSports.includes(c.sport)) {
          const minPer100m = (raceMinutes / c.km) / 10;
          const mm = Math.floor(minPer100m);
          const ss = Math.round((minPer100m - mm) * 60);
          allure = `${mm}'${ss.toString().padStart(2,'0')}"/100m`;
        } else {
          allure = (c.km / hours).toFixed(1) + ' km/h';
        }
      }

      // Si GPX présent : on override km / D+ avec les valeurs calculées depuis le fichier
      // (priorité au GPX → vérité terrain — sinon valeurs saisies manuellement)
      // Si nombre de tours défini, on multiplie km/D+/D- par le nombre de tours
      const lapsCount = parseInt(c.laps, 10) || 1;
      const gpxStats = c.gpxContent ? (typeof extractGpxStats === 'function' ? extractGpxStats(c.gpxContent, lapsCount) : null) : null;
      const effectiveKm = (gpxStats && gpxStats.km) || c.km;
      const effectiveDplus = (gpxStats && gpxStats.dplus) || c.dplus;
      // Recalcule l'allure si km vient du GPX
      if (gpxStats && gpxStats.km && raceMinutes) {
        const hours = raceMinutes / 60;
        const cyclingSports = ['Ride','VirtualRide','GravelRide','EBikeRide','MountainBikeRide','EMountainBikeRide','Velomobile','Handcycle'];
        const runSports = ['Run','TrailRun','VirtualRun'];
        const swimSports = ['Swim','OpenWaterSwim'];
        if (cyclingSports.includes(c.sport)) {
          allure = (gpxStats.km / hours).toFixed(1) + ' km/h';
        } else if (runSports.includes(c.sport)) {
          const minPerKm = raceMinutes / gpxStats.km;
          const mm = Math.floor(minPerKm);
          const ss = Math.round((minPerKm - mm) * 60);
          allure = `${mm}'${ss.toString().padStart(2,'0')}"/km`;
        } else if (swimSports.includes(c.sport)) {
          const minPer100m = (raceMinutes / gpxStats.km) / 10;
          const mm = Math.floor(minPer100m);
          const ss = Math.round((minPer100m - mm) * 60);
          allure = `${mm}'${ss.toString().padStart(2,'0')}"/100m`;
        } else {
          allure = (gpxStats.km / hours).toFixed(1) + ' km/h';
        }
      }

      // Ordre demandé : Temps cible → Distance → Dénivelé → Allure
      // Type d'épreuve en titre texte. Tours en complément.
      const cards = [];
      if (c.target != null && c.target !== '') cards.push({ label: 'Temps cible', value: fmtMinToTime(c.target), unit: '' });
      if (effectiveKm != null) cards.push({ label: 'Distance', value: effectiveKm, unit: 'km' });
      // Si GPX → D+ visible dans la barre stats du profil → on ne le montre pas en gros
      if (effectiveDplus != null && !gpxStats) cards.push({ label: 'Dénivelé +', value: effectiveDplus, unit: 'm' });
      if (allure) cards.push({ label: allureLabel, value: allure });
      if (c.laps != null) cards.push({ label: 'Tours', value: c.laps, unit: '' });
      if (c.tss != null && c.tss !== '') cards.push({ label: 'TSS estimé', value: c.tss, unit: '' });
      if (c.rpe != null && c.rpe !== '') cards.push({ label: 'RPE estimé', value: c.rpe, unit: '/10' });

      // Sections détaillées
      const sections = [];
      // Section GPX : si content présent → profil d'altitude + trace en grand
      if (c.gpxContent) {
        sections.push(`<div class="modal-section">
          <div class="modal-section-title">Profil d'altitude</div>
          <div class="gpx-stats-row" id="gpx-stats-row-prevu"></div>
          <div class="gpx-elev-wrap" id="gpx-elev-wrap-prevu" style="margin-bottom:14px;">
            <canvas id="gpx-elev-canvas-prevu"></canvas>
            <div class="gpx-elev-tooltip" id="gpx-elev-tooltip-prevu" style="display:none;"></div>
          </div>
          <div class="modal-section-title">Tracé du parcours</div>
          <div class="gpx-map-wrap"><div class="gpx-leaflet" id="gpx-leaflet-prevu"></div></div>
        </div>`);
      } else if (c.gpxName) {
        sections.push(`<div class="modal-section">
          <div class="modal-section-title">Trace GPX</div>
          <div class="modal-info-box">📍 <strong>${c.gpxName}</strong></div>
        </div>`);
      }
      if (c.notes) {
        sections.push(`<div class="modal-section">
          <div class="modal-section-title">Notes / Stratégie</div>
          <div class="modal-info-box" style="white-space:pre-wrap;">${escapeHtml(c.notes)}</div>
        </div>`);
      }
      // Section "Segments" : la liste des segments AJOUTÉS manuellement par l'utilisateur
      // (via drag-select + bouton "Ajouter segment")
      if (c.gpxContent) {
        sections.push(`<div class="modal-section gpx-segments-section">
          <div class="modal-section-title">Segments</div>
          <div class="climbs-list" id="gpx-segments-list"></div>
        </div>`);
        window._gpxClimbContent = c.gpxContent;
        window._gpxCurrentCompId = c.parentId || c.id;
      }

      // Titre "Type d'épreuve" au-dessus des cards
      const typeTitle = c.type
        ? `<div class="modal-section-title" style="margin-bottom:12px;font-size:18px;color:var(--text);text-transform:none;letter-spacing:0;">${c.type}</div>`
        : '';
      // Triathlon avec segments : timeline du déroulé de course à la place des tuiles génériques
      const triPlanHTML = (typeof getSportCategory === 'function' && getSportCategory(c.sport) === 'triathlon'
        && window.SportProfiles && window.SportProfiles.renderTriPlanHTML) ? window.SportProfiles.renderTriPlanHTML(c) : '';
      const mkCards = (arr) => `<div class="modal-metrics">
          ${arr.map(card => `<div class="modal-metric${card.accent ? ' accent' : ''}"><div class="m-label">${card.label}</div><div class="m-value" style="${card.isText ? 'font-size:16px;' : ''}">${card.value}${card.unit ? `<span style="font-size:13px;font-weight:500;margin-left:2px;">${card.unit}</span>` : ''}</div></div>`).join('')}
        </div>`;
      // Timeline tri : les tuiles generiques disparaissent, mais TSS/RPE restent affiches dessous
      const chargeCards = cards.filter(cd => cd.label === 'TSS estimé' || cd.label === 'RPE estimé');
      bodyEl.innerHTML = `
        ${switchHTML}
        ${typeTitle}
        ${triPlanHTML ? (triPlanHTML + (chargeCards.length ? mkCards(chargeCards) : '')) : mkCards(cards)}
        ${sections.join('')}
      `;
      wireSwitchButtons();
      // Rendu GPX si présent : profil altitude Chart.js + tracé Leaflet
      if (c.gpxContent) {
        renderGpxElevationChart(c.gpxContent, 'gpx-elev-canvas-prevu', lapsCount);
        renderGpxLeafletMap(c.gpxContent, 'gpx-leaflet-prevu');
        wireClimbsList();
      }
    }

    // === SEGMENTS UTILISATEUR (exposés sur window pour le bouton du chart) ===
    window._gpxSegKey = (compId) => `coach_ia_gpx_segments_${compId || 'global'}`;
    window.gpxLoadSegments = (compId) => {
      try {
        const raw = localStorage.getItem(window._gpxSegKey(compId));
        if (!raw) return [];
        return JSON.parse(raw);
      } catch (e) { return []; }
    };
    window.gpxSaveSegments = (compId, arr) => {
      localStorage.setItem(window._gpxSegKey(compId), JSON.stringify(arr));
    };
    window.gpxRenderSegmentsList = () => {
      const list = document.getElementById('gpx-segments-list');
      if (!list) return;
      const compId = window._gpxCurrentCompId;
      const segs = window.gpxLoadSegments(compId);
      if (segs.length === 0) {
        list.innerHTML = `<div class="comp-empty" style="padding:14px;">Sélectionne une portion du profil pour créer un segment.</div>`;
        return;
      }
      list.innerHTML = segs.map((s, i) => {
        const cat = s.gain >= 1000 ? 'HC' : s.gain >= 600 ? '1' : s.gain >= 300 ? '2' : s.gain >= 150 ? '3' : '4';
        return `<div class="climb-item" data-seg-idx="${i}">
          <div class="climb-row">
            <div class="climb-cat cat-${cat}">${cat}</div>
            <div class="climb-info">
              <div class="climb-range">${escapeHtml(s.name || `Segment ${i + 1}`)}</div>
              <div class="climb-meta">km ${s.startKm.toFixed(1)} → ${s.endKm.toFixed(1)} · ${s.distKm.toFixed(2)} km · D+ ${Math.round(s.gain)} m · ${s.avgSlope.toFixed(1)}% moy. · ${s.maxSlope.toFixed(1)}% max</div>
            </div>
            <button class="seg-del-btn" data-seg-del="${i}" title="Supprimer">×</button>
            <div class="climb-chevron">▼</div>
          </div>
          <div class="climb-detail" hidden></div>
        </div>`;
      }).join('');
    };
    window.gpxAddCurrentSelectionAsSegment = async () => {
      const sel = window._gpxCurrentSelectionStats;
      if (!sel) {
        await appAlert({
          title: 'Aucune sélection',
          message: 'Sélectionne d\'abord une portion du profil d\'altitude (glisse sur le graphique).',
        });
        return;
      }
      const compId = window._gpxCurrentCompId;
      const segs = window.gpxLoadSegments(compId);
      const idx = segs.length + 1;
      const name = await appPrompt({
        title: 'Nouveau segment',
        message: 'Donne un nom à ce segment du parcours.',
        defaultValue: `Segment ${idx}`,
        placeholder: `Segment ${idx}`,
        okLabel: 'Ajouter',
      });
      if (name === null) return;
      segs.push({
        startKm: sel.kmMin,
        endKm: sel.kmMax,
        distKm: sel.distKm,
        gain: sel.gain,
        loss: sel.loss,
        avgSlope: sel.avgSlope,
        maxSlope: sel.maxSlope,
        minSlope: sel.minSlope,
        name: (name && name.trim()) || `Segment ${idx}`,
        createdAt: new Date().toISOString(),
      });
      window.gpxSaveSegments(compId, segs);
      window.gpxRenderSegmentsList();
    };
    // Aliases pour compat interne (utilisés par wireClimbsList plus bas)
    const loadSegments = window.gpxLoadSegments;
    const saveSegments = window.gpxSaveSegments;
    const renderSegmentsList = window.gpxRenderSegmentsList;

    function wireClimbsList() {
      const list = document.getElementById('gpx-segments-list');
      if (!list) return;
      renderSegmentsList();
      list.addEventListener('click', (e) => {
        // Bouton suppression
        const delBtn = e.target.closest('.seg-del-btn');
        if (delBtn) {
          e.stopPropagation();
          const i = +delBtn.dataset.segDel;
          const compId = window._gpxCurrentCompId;
          const segs = loadSegments(compId);
          segs.splice(i, 1);
          saveSegments(compId, segs);
          renderSegmentsList();
          return;
        }
        const item = e.target.closest('.climb-item');
        if (!item) return;
        const idx = +item.dataset.segIdx;
        const compId = window._gpxCurrentCompId;
        const segs = loadSegments(compId);
        const gpx = window._gpxClimbContent;
        if (!segs[idx] || !gpx) return;
        const detail = item.querySelector('.climb-detail');
        const chevron = item.querySelector('.climb-chevron');
        const isOpen = !detail.hidden;
        list.querySelectorAll('.climb-item').forEach(it => {
          const d = it.querySelector('.climb-detail');
          const c = it.querySelector('.climb-chevron');
          if (d && d !== detail) { d.hidden = true; d.innerHTML = ''; }
          if (c) c.style.transform = '';
          it.classList.remove('expanded');
        });
        if (isOpen) {
          detail.hidden = true;
          detail.innerHTML = '';
          chevron.style.transform = '';
          item.classList.remove('expanded');
        } else {
          detail.innerHTML = renderClimbDetail(segs[idx], gpx);
          detail.hidden = false;
          chevron.style.transform = 'rotate(180deg)';
          item.classList.add('expanded');
        }
      });
    }

    // Rendu HTML du détail d'une bosse : profil découpé en segments coloréés par pente
    function renderClimbDetail(climb, gpxContent) {
      // Re-parse et filtre la série dans [startKm, endKm]
      const parser = new DOMParser();
      const doc = parser.parseFromString(gpxContent, 'application/xml');
      const trkpts = doc.getElementsByTagName('trkpt');
      const pts = trkpts.length ? trkpts : (doc.getElementsByTagName('rtept').length ? doc.getElementsByTagName('rtept') : []);
      function _d(lat1, lon1, lat2, lon2) {
        const R = 6371, toRad = d => d * Math.PI / 180;
        const dLat = toRad(lat2 - lat1), dLon = toRad(lon2 - lon1);
        const a = Math.sin(dLat/2)**2 + Math.cos(toRad(lat1))*Math.cos(toRad(lat2))*Math.sin(dLon/2)**2;
        return 2 * R * Math.asin(Math.sqrt(a));
      }
      let cumKm = 0, prevLat = null, prevLon = null;
      const fullSeries = [];
      for (let i = 0; i < pts.length; i++) {
        const lat = parseFloat(pts[i].getAttribute('lat'));
        const lon = parseFloat(pts[i].getAttribute('lon'));
        if (isNaN(lat) || isNaN(lon)) continue;
        if (prevLat !== null) cumKm += _d(prevLat, prevLon, lat, lon);
        prevLat = lat; prevLon = lon;
        const eleEl = pts[i].getElementsByTagName('ele')[0];
        const ele = eleEl ? parseFloat(eleEl.textContent) : NaN;
        if (!isNaN(ele)) fullSeries.push({ km: cumKm, ele });
      }
      const series = fullSeries.filter(p => p.km >= climb.startKm && p.km <= climb.endKm);
      if (series.length < 2) return '<div class="modal-placeholder">Pas assez de points</div>';

      // Découpage en segments de ~100m
      const segLen = 0.1; // km
      const segments = [];
      let segStart = series[0];
      for (let i = 1; i < series.length; i++) {
        const p = series[i];
        if (p.km - segStart.km >= segLen || i === series.length - 1) {
          const dx = (p.km - segStart.km) * 1000;
          const dy = p.ele - segStart.ele;
          const slope = dx > 0 ? (dy / dx) * 100 : 0;
          segments.push({
            startKm: segStart.km, endKm: p.km,
            startEle: segStart.ele, endEle: p.ele,
            slope,
            dist: p.km - segStart.km,
            gain: Math.max(0, dy),
          });
          segStart = p;
        }
      }

      // Couleur selon pente
      function slopeColor(s) {
        if (s < 3) return '#4ade80';
        if (s < 6) return '#fbbf24';
        if (s < 9) return '#f97316';
        if (s < 12) return '#ef4444';
        return '#b91c1c';
      }

      // SVG du profil découpé
      const W = 900, H = 240, padL = 30, padR = 16, padT = 16, padB = 30;
      const dw = W - padL - padR, dh = H - padT - padB;
      const totalSegKm = climb.endKm - climb.startKm;
      const minE = Math.min(...series.map(p => p.ele));
      const maxE = Math.max(...series.map(p => p.ele));
      const rng = Math.max(maxE - minE, 5);

      // Dessine chaque segment comme un polygone coloré
      const segmentsSvg = segments.map(s => {
        const x1 = padL + ((s.startKm - climb.startKm) / totalSegKm) * dw;
        const x2 = padL + ((s.endKm - climb.startKm) / totalSegKm) * dw;
        const y1 = padT + dh - ((s.startEle - minE) / rng) * dh;
        const y2 = padT + dh - ((s.endEle - minE) / rng) * dh;
        const baseY = padT + dh;
        const color = slopeColor(s.slope);
        return `<polygon points="${x1},${baseY} ${x1},${y1} ${x2},${y2} ${x2},${baseY}" fill="${color}" stroke="rgba(0,0,0,0.2)" stroke-width="0.5">
          <title>km ${s.startKm.toFixed(2)} → ${s.endKm.toFixed(2)} · ${s.slope.toFixed(1)}% · +${s.gain.toFixed(0)}m</title>
        </polygon>`;
      }).join('');

      // Ticks Y (altitude)
      const yTicks = [];
      for (let i = 0; i <= 3; i++) {
        const e = minE + (rng * (1 - i / 3));
        const y = padT + (dh * i / 3);
        yTicks.push(`<text x="${padL - 4}" y="${y + 4}" text-anchor="end" fill="#64748b" font-size="10">${Math.round(e)}m</text>`);
      }
      // Ticks X (km depuis début bosse)
      const xTicks = [];
      const nTicks = Math.min(5, Math.max(2, Math.round(totalSegKm)));
      for (let i = 0; i <= nTicks; i++) {
        const km = climb.startKm + (totalSegKm * i / nTicks);
        const x = padL + (dw * i / nTicks);
        xTicks.push(`<text x="${x}" y="${H - 10}" text-anchor="middle" fill="#64748b" font-size="10">${km.toFixed(1)}</text>`);
      }

      // Légende des couleurs de pente
      const legend = `
        <div class="climb-legend">
          <span><span class="dot" style="background:#4ade80;"></span>&lt; 3%</span>
          <span><span class="dot" style="background:#fbbf24;"></span>3-6%</span>
          <span><span class="dot" style="background:#f97316;"></span>6-9%</span>
          <span><span class="dot" style="background:#ef4444;"></span>9-12%</span>
          <span><span class="dot" style="background:#b91c1c;"></span>≥ 12%</span>
        </div>
      `;

      // Liste des segments raides (>= 6%)
      const steepSegs = segments.filter(s => s.slope >= 6);
      const steepList = steepSegs.length ? `
        <div class="climb-steep-list">
          <div class="climb-steep-title">Sections les plus raides</div>
          ${steepSegs.map(s => `
            <div class="climb-steep-item">
              <span class="dot" style="background:${slopeColor(s.slope)};"></span>
              <span class="ss-range">km ${s.startKm.toFixed(2)} → ${s.endKm.toFixed(2)}</span>
              <span class="ss-slope">${s.slope.toFixed(1)}%</span>
              <span class="ss-gain">+${s.gain.toFixed(0)}m</span>
            </div>
          `).join('')}
        </div>
      ` : '';

      return `
        <div class="climb-detail-inner">
          <svg class="climb-svg" viewBox="0 0 ${W} ${H}" preserveAspectRatio="none">
            <rect x="0" y="0" width="${W}" height="${H}" fill="rgba(0,0,0,0.2)" rx="6"/>
            ${segmentsSvg}
            ${yTicks.join('')}
            ${xTicks.join('')}
          </svg>
          ${legend}
          ${steepList}
        </div>
      `;
    }

    function renderManualTrainingModal(t, switchHTML, dateStrOverride) {
      const _dateStr = dateStrOverride || dateStr;
      // Affiche les boutons Modifier + Supprimer pour cet entraînement manuel prévu
      const editBtn = document.getElementById('modal-edit-btn');
      const delBtn = document.getElementById('modal-delete-btn');
      if (editBtn) {
        editBtn.hidden = false;
        editBtn.dataset.kind = 'training';
        editBtn.dataset.trainingId = t.id;
        editBtn.dataset.trainingMode = 'prevu';
      }
      if (delBtn) {
        delBtn.hidden = false;
        delBtn.dataset.kind = 'training';
        delBtn.dataset.trainingId = t.id;
        delBtn.dataset.trainingMode = 'prevu';
      }
      const sportLabel = window.sportFr(t.sport || 'Ride');
      const sportCat = window.activitySportColorKey({ sport: t.sport }) || 'autre';
      const sportPill = `<span class="sport-pill" data-sport-cat="${sportCat}" style="margin-left:8px;vertical-align:middle;">${sportLabel}</span>`;
      titleEl.textContent = t.name;
      // Heure (comme en realise) si la seance en a une ; sinon juste la date.
      let _timeStr = '';
      if (t.time) _timeStr = ' · ' + String(t.time).replace(':', 'h');
      else if (t.start_date_local) {
        const _mt = String(t.start_date_local).match(/T(\d{2}):(\d{2})/);
        if (_mt) _timeStr = ` · ${_mt[1]}h${_mt[2]}`;
      }
      metaEl.innerHTML = `${_dateStr}${_timeStr}${sportPill}`;
      const dur = t.duration || 0;
      const _S = window.__statSvg || {};
      const _heroes = [];
      if (dur) _heroes.push({ svg: _S.clock, val: (dur < 60 ? Math.round(dur) + '<span style="font-size:13px"> min</span>' : (Math.floor(dur / 60) + '<span style="font-size:13px">h</span>' + String(Math.round(dur % 60)).padStart(2, '0'))), unit: '', lab: 'Durée prévue', color: '#60a5fa' });
      if (t.km) { const _dp = window.fmtDist(t.km, t.sport).split(' '); _heroes.push({ svg: _S.route, val: _dp[0], unit: _dp[1], lab: 'Distance prévue', color: '#22d3ee' }); }
      // TOUT vient des valeurs STOCKÉES (dérivées de la structure au save).
      // Fallback unique pour les anciennes séances jamais re-sauvées : summary().
      let _est = { w: t.estWatts, bpm: t.estBpm, speedKmh: t.estSpeed, kj: t.estKj, ifr: t.estIf };
      if (_est.w == null && _est.bpm == null && _est.speedKmh == null && _est.kj == null
          && Array.isArray(t.structure) && t.structure.length && window.StructEd && window.StructEd.summary) {
        try { _est = window.StructEd.summary(t.structure, t.sport || 'Ride'); } catch (e) { /* ignore */ }
      }
      // Allure/vitesse prévue : est_speed stockée convertie selon le sport, sinon km+durée
      let _rp = _est.speedKmh ? window.speedToRate(_est.speedKmh, t.sport) : null;
      if (!_rp && t.km && dur) _rp = window.fmtRate(t.km, dur, t.sport);
      if (_rp) { const _ri = _rp.indexOf(' '); _heroes.push({ svg: _S.speed, val: _rp.slice(0, _ri), unit: _rp.slice(_ri + 1), lab: window.rateLabel(t.sport) + ' prévue', color: '#34d399' }); }
      if (t.dplus) _heroes.push({ svg: _S.mtn, val: Math.round(t.dplus), unit: 'm D+', lab: 'Dénivelé prévu', color: '#84cc16' });
      if (_heroes.length < 3 && t.tss) _heroes.push({ svg: _S.bolt, val: t.tss, unit: '', lab: 'TSS estimé', color: '#fbbf24' });
      const _tiles = [];
      if (t.tss && _heroes.every(function (h) { return h.lab !== 'TSS estimé'; })) _tiles.push({ lab: 'TSS estimé', val: '' + t.tss, color: '#fbbf24' });
      if (t.rpe != null && t.rpe !== '') _tiles.push({ lab: 'RPE estimé', val: t.rpe + '/10', color: '#f59e0b' });
      if (_est.w != null) _tiles.push({ lab: 'Watts moy estimés', val: _est.w + ' W', color: '#a5b4fc' });
      if (_est.bpm != null) _tiles.push({ lab: 'FC moy estimée', val: _est.bpm + ' bpm', color: '#a5b4fc' });
      if (_est.kj != null) _tiles.push({ lab: 'Énergie estimée', val: Math.round(_est.kj) + ' kJ', color: '#9ca3af' });
      if (_est.ifr != null && _est.ifr > 0) _tiles.push({ lab: 'IF estimé', val: (+_est.ifr).toFixed(2), color: '#f97316' });
      const statsHTML = window.renderStatsBlockHTML(_heroes, _tiles);

      const sections = [];
      if (Array.isArray(t.structure) && t.structure.length && typeof window.renderWorkoutProfileHTML === 'function') {
        const _det = (typeof window.renderWorkoutDetailHTML === 'function') ? window.renderWorkoutDetailHTML(t.structure, { sport: t.sport }) : '';
        sections.push(`<div class="modal-section"><div class="modal-section-title">Profil de séance</div>${window.renderWorkoutProfileHTML(t.structure, { sport: t.sport })}${_det}</div>`);
      }
      if (t.notes) {
        sections.push(`<div class="modal-section">
          <div class="modal-section-title">Notes / Structure</div>
          <div class="modal-info-box" style="white-space:pre-wrap;">${escapeHtml(t.notes)}</div>
        </div>`);
      }
      bodyEl.innerHTML = `
        ${switchHTML}
        ${statsHTML}
        ${sections.join('')}
      `;
      wireSwitchButtons();
    }

    function renderTemplateModal(proposal, phase, switchHTML, dateStrOverride) {
      const _dateStr = dateStrOverride || dateStr;
      const isRest = proposal.type === 'rest' || (proposal.dur === 0 && proposal.tss === 0);
      const editBtn = document.getElementById('modal-edit-btn');
      const delBtn = document.getElementById('modal-delete-btn');

      // === Jour de repos : modal ultra-épurée ===
      if (isRest) {
        // ⋯ "personnaliser" reste utile (ajouter une séance ce jour-là)
        // 🗑️ caché (déjà repos, rien à supprimer)
        if (editBtn) {
          editBtn.hidden = false;
          editBtn.dataset.kind = 'template';
          editBtn.dataset.templateIso = iso;
          editBtn.dataset.templateData = JSON.stringify({
            name: 'Nouvelle séance',
            type: 'endurance',
            duration: 60,
            tss: 50,
            sport: 'Ride',
            notes: ''
          });
        }
        if (delBtn) delBtn.hidden = true;
        titleEl.textContent = 'Jour de repos';
        metaEl.textContent = _dateStr;
        bodyEl.innerHTML = `
          ${switchHTML}
          <div class="modal-rest-state">
            <div class="modal-rest-icon">
              <svg width="44" height="44" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
                <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"></path>
              </svg>
            </div>
            <div class="modal-rest-text">Récupération complète.</div>
            <div class="modal-rest-hint">Utilise <strong>⋯</strong> pour ajouter une séance ce jour-là.</div>
          </div>
        `;
        wireSwitchButtons();
        return;
      }

      // === Suggestion IA normale ===
      if (editBtn) {
        editBtn.hidden = false;
        editBtn.dataset.kind = 'template';
        editBtn.dataset.templateIso = iso;
        editBtn.dataset.templateData = JSON.stringify({
          name: proposal.name || 'Séance IA',
          type: proposal.type || 'endurance',
          duration: proposal.dur || 0,
          tss: proposal.tss || 0,
          sport: proposal.sport || 'Ride',
          notes: proposal.why || ''
        });
      }
      if (delBtn) {
        delBtn.hidden = false;
        delBtn.dataset.kind = 'template';
        delBtn.dataset.templateIso = iso;
      }
      const dur = proposal.dur || 0;
      const h = Math.floor(dur / 60), mm = (dur % 60).toString().padStart(2, '0');
      titleEl.innerHTML = escapeHtml(proposal.name);
      metaEl.textContent = `${_dateStr} · ${fmtDur(dur)} · ${proposal.tss || 0} TSS prévus · phase ${PHASE_LABELS[phase] || phase}`;
      bodyEl.innerHTML = `
        ${switchHTML}
        <div class="modal-metrics">
          <div class="modal-metric"><div class="m-label">Durée cible</div><div class="m-value">${dur < 60 ? `${Math.round(dur)}<span style="font-size:14px;"> min</span>` : `${h}<span style="font-size:14px;">h</span>${mm}`}</div></div>
          <div class="modal-metric"><div class="m-label">TSS cible</div><div class="m-value">${proposal.tss || 0}</div></div>
          <div class="modal-metric"><div class="m-label">Phase</div><div class="m-value" style="font-size:15px;">${PHASE_LABELS[phase] || '—'}</div></div>
        </div>
        <div class="modal-section">
          <div class="modal-section-title">Pourquoi cette séance</div>
          <div class="modal-info-box">${escapeHtml(proposal.why || '—')}</div>
        </div>
      `;
      wireSwitchButtons();
    }

    function wireSwitchButtons() {
      bodyEl.querySelectorAll('.modal-activity-switch button').forEach(btn => {
        btn.addEventListener('click', () => {
          const i = +btn.dataset.i;
          dayPrevuIndex[iso] = i;
          renderPrevuItem(i);
        });
      });
    }

    function escapeHtml(s) {
      return String(s).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
    }

    renderPrevuItem(curIdx);
}
