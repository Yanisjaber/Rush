/* src/features/gpx/gpx-render.js — extrait de l'ancien app.js (découpage par fonctionnalité). */
import { appState } from '../../core/state.js';
import { _resizeOverlay, _scheduleSmoothDraw } from '../streams/stream-overlay.js';
import { REST_COUCH_SVG, compPrio, fmtDur } from '../../core/format.js';
import { getSportCategory, toIsoDate } from '../dashboard/filters.js';
import { getActivityEdit, setActivityEdit } from '../calendar/overrides.js';
import { compIsRealised, loadCompetitions, loadCompetitionsExpanded, renderCompList } from '../competitions/competitions-page.js';
import { populateSportSelect } from '../competitions/comp-modal-ui.js';
import { renderCalendar } from '../calendar/realise-calendar.js';
import { openSessionModal } from '../sessions/session-modal.js';
import { isStravaIgnored } from '../sessions/session-actions.js';
import { loadRealisedTrainings } from '../training/train-modal.js';
import { parseTimeToMin } from '../competitions/comp-stages.js';


// ========= MODAL DÉTAIL SÉANCE =========
// === Rendu du profil d'altitude d'un GPX en SVG (distance vs élévation) ===
function renderGpxElevation(gpxContent, svgId) {
  const svg = document.getElementById(svgId);
  if (!svg || !gpxContent) return;
  try {
    const parser = new DOMParser();
    const doc = parser.parseFromString(gpxContent, 'application/xml');
    const trkpts = doc.getElementsByTagName('trkpt');
    const pts = trkpts.length ? trkpts : (doc.getElementsByTagName('rtept').length ? doc.getElementsByTagName('rtept') : doc.getElementsByTagName('wpt'));
    if (!pts.length) {
      svg.innerHTML = '<text x="50%" y="50%" text-anchor="middle" fill="#9ca3af" font-size="12">Pas de points GPS</text>';
      return;
    }
    // Haversine distance helper (km)
    function dist(lat1, lon1, lat2, lon2) {
      const R = 6371;
      const toRad = d => d * Math.PI / 180;
      const dLat = toRad(lat2 - lat1);
      const dLon = toRad(lon2 - lon1);
      const a = Math.sin(dLat/2) ** 2 + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon/2) ** 2;
      return 2 * R * Math.asin(Math.sqrt(a));
    }
    // Construit la série (cumKm, ele)
    const series = [];
    let cumKm = 0, prevLat = null, prevLon = null;
    let hasEle = false;
    for (let i = 0; i < pts.length; i++) {
      const lat = parseFloat(pts[i].getAttribute('lat'));
      const lon = parseFloat(pts[i].getAttribute('lon'));
      if (isNaN(lat) || isNaN(lon)) continue;
      if (prevLat !== null) cumKm += dist(prevLat, prevLon, lat, lon);
      prevLat = lat; prevLon = lon;
      const eleEl = pts[i].getElementsByTagName('ele')[0];
      const ele = eleEl ? parseFloat(eleEl.textContent) : NaN;
      if (!isNaN(ele)) hasEle = true;
      series.push({ km: cumKm, ele: isNaN(ele) ? null : ele });
    }
    if (!hasEle) {
      svg.innerHTML = '<text x="50%" y="50%" text-anchor="middle" fill="#9ca3af" font-size="12">Pas de données d\'altitude dans le GPX</text>';
      return;
    }
    // Bounds
    const elevs = series.map(p => p.ele).filter(e => e != null);
    let minEle = Math.min(...elevs);
    let maxEle = Math.max(...elevs);
    const totalKm = series[series.length - 1].km;
    if (totalKm <= 0) {
      svg.innerHTML = '<text x="50%" y="50%" text-anchor="middle" fill="#9ca3af" font-size="12">Distance nulle</text>';
      return;
    }
    // Marge pour que la courbe ne touche pas les bords
    const eleRange = Math.max(maxEle - minEle, 10);
    const elePad = eleRange * 0.1;
    minEle -= elePad;
    maxEle += elePad;
    // Calcul D+ total (positive elevation gain)
    let elevGain = 0;
    for (let i = 1; i < series.length; i++) {
      const d = (series[i].ele || 0) - (series[i-1].ele || 0);
      if (d > 0) elevGain += d;
    }

    const W = 900, H = 180, padL = 40, padR = 16, padT = 16, padB = 28;
    const drawW = W - padL - padR;
    const drawH = H - padT - padB;
    // Path area (du bas vers le haut)
    let path = '';
    for (let i = 0; i < series.length; i++) {
      const p = series[i];
      if (p.ele == null) continue;
      const x = padL + (p.km / totalKm) * drawW;
      const y = padT + drawH - ((p.ele - minEle) / (maxEle - minEle)) * drawH;
      path += (i === 0 ? 'M' : 'L') + x.toFixed(1) + ' ' + y.toFixed(1) + ' ';
    }
    // Fermer l'area pour fill
    const lastX = padL + drawW;
    const baseY = padT + drawH;
    const area = path + `L${lastX.toFixed(1)} ${baseY.toFixed(1)} L${padL} ${baseY.toFixed(1)} Z`;

    // Axes labels (3 ticks Y, distance min/mid/max)
    const ticks = [];
    for (let t = 0; t <= 3; t++) {
      const eleT = minEle + (maxEle - minEle) * (1 - t / 3);
      const yT = padT + (drawH * t / 3);
      ticks.push({ y: yT, label: Math.round(eleT) + ' m' });
    }
    const xTicks = [];
    for (let t = 0; t <= 4; t++) {
      const kmT = (totalKm * t) / 4;
      const xT = padL + (drawW * t / 4);
      xTicks.push({ x: xT, label: kmT.toFixed(0) + ' km' });
    }

    svg.setAttribute('viewBox', `0 0 ${W} ${H}`);
    svg.innerHTML = `
      <defs>
        <linearGradient id="elevGrad-${svgId}" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stop-color="rgba(74,222,128,0.7)"/>
          <stop offset="100%" stop-color="rgba(74,222,128,0.05)"/>
        </linearGradient>
      </defs>
      <rect x="0" y="0" width="${W}" height="${H}" fill="rgba(74,222,128,0.03)" rx="8"/>
      ${ticks.map(t => `
        <line x1="${padL}" y1="${t.y}" x2="${W - padR}" y2="${t.y}" stroke="rgba(255,255,255,0.05)" stroke-width="1"/>
        <text x="${padL - 6}" y="${t.y + 4}" text-anchor="end" fill="#64748b" font-size="11">${t.label}</text>
      `).join('')}
      ${xTicks.map(t => `
        <text x="${t.x}" y="${H - 8}" text-anchor="middle" fill="#64748b" font-size="11">${t.label}</text>
      `).join('')}
      <path d="${area}" fill="url(#elevGrad-${svgId})" stroke="none"/>
      <path d="${path}" stroke="#4ade80" stroke-width="2" fill="none" stroke-linejoin="round"/>
      <text x="${W - padR - 8}" y="${padT + 14}" text-anchor="end" fill="#4ade80" font-size="11" font-weight="700">D+ ${Math.round(elevGain)} m</text>
      <line class="cursor-line" id="${svgId}-cursor-line" x1="0" y1="${padT}" x2="0" y2="${baseY}" stroke="#fff" stroke-width="1" stroke-dasharray="3 3" opacity="0" pointer-events="none"/>
      <circle class="cursor-dot" id="${svgId}-cursor-dot" cx="0" cy="0" r="5" fill="#4ade80" stroke="#062017" stroke-width="2" opacity="0" pointer-events="none"/>
    `;

    // ====== Interactivité curseur (crosshair + tooltip) ======
    const wrap = svg.parentNode;
    const tooltip = wrap ? wrap.querySelector('.gpx-elev-tooltip') : null;
    const cursorLine = svg.querySelector('.cursor-line');
    const cursorDot = svg.querySelector('.cursor-dot');
    if (!wrap || !tooltip || !cursorLine || !cursorDot) return;

    // Trouve l'altitude interpolée à un km donné
    function eleAtKm(km) {
      if (km <= 0) return series[0].ele;
      if (km >= totalKm) return series[series.length - 1].ele;
      // Binary search
      let lo = 0, hi = series.length - 1;
      while (lo < hi - 1) {
        const mid = (lo + hi) >> 1;
        if (series[mid].km < km) lo = mid; else hi = mid;
      }
      const a = series[lo], b = series[hi];
      const t = (km - a.km) / (b.km - a.km || 1);
      return (a.ele || 0) + ((b.ele || 0) - (a.ele || 0)) * t;
    }

    // Pente locale sur fenêtre +/- 100m
    function slopeAtKm(km) {
      const window = 0.1; // km
      const km1 = Math.max(0, km - window);
      const km2 = Math.min(totalKm, km + window);
      const e1 = eleAtKm(km1);
      const e2 = eleAtKm(km2);
      const dx = (km2 - km1) * 1000; // m
      if (dx === 0) return 0;
      return ((e2 - e1) / dx) * 100; // %
    }

    function onMove(e) {
      const rect = wrap.getBoundingClientRect();
      const xPx = e.clientX - rect.left;
      // Mappe xPx (en pixels conteneur) → x SVG (viewBox)
      const xSvg = (xPx / rect.width) * W;
      if (xSvg < padL || xSvg > W - padR) { onLeave(); return; }
      const km = ((xSvg - padL) / drawW) * totalKm;
      const ele = eleAtKm(km);
      const slope = slopeAtKm(km);
      const ySvg = padT + drawH - ((ele - minEle) / (maxEle - minEle)) * drawH;
      cursorLine.setAttribute('x1', xSvg);
      cursorLine.setAttribute('x2', xSvg);
      cursorLine.setAttribute('opacity', '0.5');
      cursorDot.setAttribute('cx', xSvg);
      cursorDot.setAttribute('cy', ySvg);
      cursorDot.setAttribute('opacity', '1');
      // Tooltip en HTML, positionné en pixels conteneur
      tooltip.style.display = 'block';
      tooltip.innerHTML = `
        <div class="t-km">${km.toFixed(2)} km</div>
        <div class="t-ele">Altitude : ${Math.round(ele)} m · pente ${slope >= 0 ? '+' : ''}${slope.toFixed(1)}%</div>
      `;
      // Positionnement : à droite du curseur sauf si trop près du bord
      const tipW = 170;
      let left = xPx + 12;
      if (left + tipW > rect.width) left = xPx - tipW - 12;
      tooltip.style.left = left + 'px';
      tooltip.style.top = '8px';
    }
    function onLeave() {
      cursorLine.setAttribute('opacity', '0');
      cursorDot.setAttribute('opacity', '0');
      tooltip.style.display = 'none';
    }
    // Nettoie d'éventuels listeners précédents
    if (wrap._gpxElevMove) wrap.removeEventListener('mousemove', wrap._gpxElevMove);
    if (wrap._gpxElevLeave) wrap.removeEventListener('mouseleave', wrap._gpxElevLeave);
    wrap._gpxElevMove = onMove;
    wrap._gpxElevLeave = onLeave;
    wrap.addEventListener('mousemove', onMove);
    wrap.addEventListener('mouseleave', onLeave);
  } catch (e) {
    console.warn('[renderGpxElevation]', e);
    svg.innerHTML = '<text x="50%" y="50%" text-anchor="middle" fill="#9ca3af" font-size="12">Erreur de lecture de l\'altitude</text>';
  }
}


// === Extraction des MONTÉES significatives (>= minGain m) depuis le GPX ===
// Détecte les portions de montée continue, en ignorant les petites descentes (< 5m)
function extractGpxClimbs(gpxContent, minGain = 30) {
  if (!gpxContent) return [];
  try {
    const parser = new DOMParser();
    const doc = parser.parseFromString(gpxContent, 'application/xml');
    const trkpts = doc.getElementsByTagName('trkpt');
    const pts = trkpts.length ? trkpts : (doc.getElementsByTagName('rtept').length ? doc.getElementsByTagName('rtept') : doc.getElementsByTagName('wpt'));
    if (!pts.length) return [];
    function _d(lat1, lon1, lat2, lon2) {
      const R = 6371;
      const toRad = d => d * Math.PI / 180;
      const dLat = toRad(lat2 - lat1);
      const dLon = toRad(lon2 - lon1);
      const a = Math.sin(dLat/2) ** 2 + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon/2) ** 2;
      return 2 * R * Math.asin(Math.sqrt(a));
    }
    // Construit la série (km cumulé, altitude)
    const series = [];
    let cumKm = 0, prevLat = null, prevLon = null;
    for (let i = 0; i < pts.length; i++) {
      const lat = parseFloat(pts[i].getAttribute('lat'));
      const lon = parseFloat(pts[i].getAttribute('lon'));
      if (isNaN(lat) || isNaN(lon)) continue;
      if (prevLat !== null) cumKm += _d(prevLat, prevLon, lat, lon);
      prevLat = lat; prevLon = lon;
      const eleEl = pts[i].getElementsByTagName('ele')[0];
      const ele = eleEl ? parseFloat(eleEl.textContent) : NaN;
      if (!isNaN(ele)) series.push({ km: cumKm, ele });
    }
    if (series.length < 2) return [];

    // Helper : pente locale en % sur fenêtre 300m autour de l'index
    function localSlope(idx, halfWin = 0.15) {
      let j1 = idx, j2 = idx;
      while (j1 > 0 && series[idx].km - series[j1-1].km < halfWin) j1--;
      while (j2 < series.length - 1 && series[j2+1].km - series[idx].km < halfWin) j2++;
      const dx = (series[j2].km - series[j1].km) * 1000;
      if (dx <= 0) return 0;
      return ((series[j2].ele - series[j1].ele) / dx) * 100;
    }

    // === NOUVELLE APPROCHE : scan slope-based + merging ===
    // 1. Pour chaque point, calculer la pente locale (300m window)
    // 2. Marquer les points "climbing" (slope >= 2%)
    // 3. Trouver les runs continus + merger ceux séparés par <300m
    // 4. Pour chaque run, calculer D+ réel et garder si >= minGain
    const SLOPE_ENTRY = 2; // % minimum pour entrer en "climbing"
    const MERGE_GAP_KM = 0.3; // on fusionne deux runs séparés de < 300m

    const slopes = series.map((_, i) => localSlope(i));

    // Trouve les runs continus où slope >= SLOPE_ENTRY
    const runs = [];
    let runStart = -1;
    for (let i = 0; i < slopes.length; i++) {
      if (slopes[i] >= SLOPE_ENTRY) {
        if (runStart < 0) runStart = i;
      } else {
        if (runStart >= 0) {
          runs.push({ s: runStart, e: i - 1 });
          runStart = -1;
        }
      }
    }
    if (runStart >= 0) runs.push({ s: runStart, e: slopes.length - 1 });

    // Merge des runs proches (gap < MERGE_GAP_KM)
    const merged = [];
    for (const r of runs) {
      const last = merged[merged.length - 1];
      if (last && series[r.s].km - series[last.e].km < MERGE_GAP_KM) {
        last.e = r.e;
      } else {
        merged.push({ s: r.s, e: r.e });
      }
    }

    // Pour chaque run mergé : calcul D+ réel + filtre par minGain
    const climbs = [];
    for (const r of merged) {
      let s = r.s, e = r.e;
      // Petite extension en amont/aval tant qu'on continue à monter doucement
      while (s > 0 && series[s].ele - series[s-1].ele > 0 && localSlope(s-1) > 0) s--;
      while (e < series.length - 1 && series[e+1].ele - series[e].ele > 0 && localSlope(e+1) > 0) e++;
      // D+ smart sur la portion [s..e]
      let lastSignif = series[s].ele;
      let gain = 0;
      const TH = 3;
      for (let i = s + 1; i <= e; i++) {
        const dd = series[i].ele - lastSignif;
        if (dd > TH) { gain += dd; lastSignif = series[i].ele; }
        else if (dd < -TH) { lastSignif = series[i].ele; }
      }
      if (gain < minGain) continue;
      const distKm = series[e].km - series[s].km;
      const avgSlope = distKm > 0 ? ((series[e].ele - series[s].ele) / (distKm * 1000)) * 100 : 0;
      // Pente max
      let maxSlope = -Infinity;
      for (let j = s; j <= e; j++) {
        const sl = localSlope(j);
        if (sl > maxSlope) maxSlope = sl;
      }
      climbs.push({
        startKm: series[s].km, endKm: series[e].km,
        startEle: series[s].ele, endEle: series[e].ele,
        distKm, gain, avgSlope,
        maxSlope: isFinite(maxSlope) ? maxSlope : avgSlope,
      });
    }
    return climbs;
  } catch (e) {
    console.warn('[extractGpxClimbs]', e);
    return [];
  }
}


// === Extraction des stats principales (km, D+, D-) depuis le contenu GPX ===
// Utilisé pour override les valeurs manuellement saisies si un GPX est uploadé
// Si laps > 1 : multiplie km/D+/D- (le parcours est répété N fois)
export function extractGpxStats(gpxContent, laps = 1) {
  if (!gpxContent) return null;
  laps = Math.max(1, parseInt(laps, 10) || 1);
  try {
    const parser = new DOMParser();
    const doc = parser.parseFromString(gpxContent, 'application/xml');
    const trkpts = doc.getElementsByTagName('trkpt');
    const pts = trkpts.length ? trkpts : (doc.getElementsByTagName('rtept').length ? doc.getElementsByTagName('rtept') : doc.getElementsByTagName('wpt'));
    if (!pts.length) return null;
    function _d(lat1, lon1, lat2, lon2) {
      const R = 6371;
      const toRad = d => d * Math.PI / 180;
      const dLat = toRad(lat2 - lat1);
      const dLon = toRad(lon2 - lon1);
      const a = Math.sin(dLat/2) ** 2 + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon/2) ** 2;
      return 2 * R * Math.asin(Math.sqrt(a));
    }
    let cumKm = 0, prevLat = null, prevLon = null;
    const elevs = [];
    for (let i = 0; i < pts.length; i++) {
      const lat = parseFloat(pts[i].getAttribute('lat'));
      const lon = parseFloat(pts[i].getAttribute('lon'));
      if (isNaN(lat) || isNaN(lon)) continue;
      if (prevLat !== null) cumKm += _d(prevLat, prevLon, lat, lon);
      prevLat = lat; prevLon = lon;
      const eleEl = pts[i].getElementsByTagName('ele')[0];
      const ele = eleEl ? parseFloat(eleEl.textContent) : NaN;
      if (!isNaN(ele)) elevs.push(ele);
    }
    // D+ smart avec threshold 3m
    let gain = 0, loss = 0;
    if (elevs.length > 1) {
      let lastSignif = elevs[0];
      const TH = 3;
      for (let i = 1; i < elevs.length; i++) {
        const dd = elevs[i] - lastSignif;
        if (dd > TH) { gain += dd; lastSignif = elevs[i]; }
        else if (dd < -TH) { loss += -dd; lastSignif = elevs[i]; }
      }
    }
    return {
      km: +(cumKm * laps).toFixed(2),
      dplus: Math.round(gain * laps),
      dminus: Math.round(loss * laps),
      laps,
      lapKm: +cumKm.toFixed(2),
      lapDplus: Math.round(gain),
    };
  } catch (e) {
    console.warn('[extractGpxStats]', e);
    return null;
  }
}

export function renderGpxElevationChart(gpxContent, canvasId, laps = 1) {
  laps = Math.max(1, parseInt(laps, 10) || 1);
  const canvas = document.getElementById(canvasId);
  if (!canvas || !gpxContent || typeof Chart === 'undefined') return;
  // Detruit le chart précédent si existant
  if (appState._gpxElevChart) {
    try { appState._gpxElevChart.destroy(); } catch (e) {}
    appState._gpxElevChart = null;
  }

  try {
    const parser = new DOMParser();
    const doc = parser.parseFromString(gpxContent, 'application/xml');
    const trkpts = doc.getElementsByTagName('trkpt');
    const pts = trkpts.length ? trkpts : (doc.getElementsByTagName('rtept').length ? doc.getElementsByTagName('rtept') : doc.getElementsByTagName('wpt'));
    if (!pts.length) {
      canvas.parentNode.innerHTML = '<div class="modal-placeholder">Pas de points GPS dans le fichier GPX</div>';
      return;
    }
    function dist(lat1, lon1, lat2, lon2) {
      const R = 6371;
      const toRad = d => d * Math.PI / 180;
      const dLat = toRad(lat2 - lat1);
      const dLon = toRad(lon2 - lon1);
      const a = Math.sin(dLat/2) ** 2 + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon/2) ** 2;
      return 2 * R * Math.asin(Math.sqrt(a));
    }
    const series = []; // [{x:km, y:ele}]
    let cumKm = 0, prevLat = null, prevLon = null;
    let hasEle = false;
    for (let i = 0; i < pts.length; i++) {
      const lat = parseFloat(pts[i].getAttribute('lat'));
      const lon = parseFloat(pts[i].getAttribute('lon'));
      if (isNaN(lat) || isNaN(lon)) continue;
      if (prevLat !== null) cumKm += dist(prevLat, prevLon, lat, lon);
      prevLat = lat; prevLon = lon;
      const eleEl = pts[i].getElementsByTagName('ele')[0];
      const ele = eleEl ? parseFloat(eleEl.textContent) : NaN;
      if (!isNaN(ele)) hasEle = true;
      series.push({ x: cumKm, y: isNaN(ele) ? null : ele });
    }
    if (!hasEle) {
      canvas.parentNode.innerHTML = '<div class="modal-placeholder">Pas de données d\'altitude dans le GPX</div>';
      return;
    }
    // Calcul D+ total : algo "smart" avec threshold 3m pour filtrer le bruit GPS
    function _smartGainTotal(arr) {
      if (!arr || arr.length < 2) return 0;
      let gain = 0;
      let lastSignif = arr[0].y;
      const TH = 3;
      for (let i = 1; i < arr.length; i++) {
        const d = arr[i].y - lastSignif;
        if (d > TH) { gain += d; lastSignif = arr[i].y; }
        else if (d < -TH) { lastSignif = arr[i].y; }
      }
      return gain;
    }
    const elevGain = _smartGainTotal(series.filter(p => p.y != null));
    // PAS de lissage pour l'affichage : on garde la finesse du GPX
    let basePlot = series.filter(p => p.y != null);
    const lapKm = basePlot.length ? basePlot[basePlot.length - 1].x : 0;

    // Répétition de la série N fois (laps) avec offset de km cumulé
    let plot = [];
    if (laps > 1 && lapKm > 0) {
      for (let L = 0; L < laps; L++) {
        const offset = L * lapKm;
        for (const p of basePlot) {
          plot.push({ x: p.x + offset, y: p.y });
        }
      }
    } else {
      plot = basePlot.slice();
    }

    // Décimation seulement si vraiment beaucoup de points (>2000)
    if (plot.length > 2000) {
      const step = Math.ceil(plot.length / 2000);
      plot = plot.filter((_, i) => i % step === 0);
    }
    const totalKm = plot.length ? plot[plot.length - 1].x : 0;

    // Pour les stats : série brute répétée N fois (laps)
    let rawSeries = series.filter(p => p.y != null);
    if (laps > 1 && lapKm > 0) {
      const baseRaw = rawSeries.slice();
      rawSeries = [];
      for (let L = 0; L < laps; L++) {
        const offset = L * lapKm;
        for (const p of baseRaw) rawSeries.push({ x: p.x + offset, y: p.y });
      }
    }

    // Calcul slope sur fenêtre glissante (~200m) pour éviter le bruit instantané
    function slopeOnWindow(arr, idx, windowKm = 0.2) {
      let i1 = idx, i2 = idx;
      while (i1 > 0 && arr[idx].x - arr[i1-1].x < windowKm/2) i1--;
      while (i2 < arr.length - 1 && arr[i2+1].x - arr[idx].x < windowKm/2) i2++;
      const dx = (arr[i2].x - arr[i1].x) * 1000;
      if (dx <= 0) return 0;
      return ((arr[i2].y - arr[i1].y) / dx) * 100;
    }

    // D+ / D- "smart" : threshold de 3m sur chaque segment monotone (filtre noise GPS)
    function smartElevation(arr) {
      if (arr.length < 2) return { gain: 0, loss: 0 };
      let gain = 0, loss = 0;
      let lastSignif = arr[0].y;
      let trend = 0; // +1 = montée, -1 = descente, 0 = aucune
      const TH = 3; // mètres
      for (let i = 1; i < arr.length; i++) {
        const d = arr[i].y - lastSignif;
        if (d > TH) {
          gain += d;
          lastSignif = arr[i].y;
          trend = 1;
        } else if (d < -TH) {
          loss += -d;
          lastSignif = arr[i].y;
          trend = -1;
        }
      }
      return { gain, loss };
    }

    function computeStats(kmMin, kmMax) {
      const filtered = rawSeries.filter(p => p.x >= kmMin && p.x <= kmMax);
      if (filtered.length < 2) return null;
      const { gain, loss } = smartElevation(filtered);
      // Pente max/min sur fenêtres ~200m
      let maxSlope = -Infinity, minSlope = Infinity;
      for (let i = 0; i < filtered.length; i++) {
        const s = slopeOnWindow(filtered, i, 0.2);
        if (s > maxSlope) maxSlope = s;
        if (s < minSlope) minSlope = s;
      }
      const startEle = filtered[0].y;
      const endEle = filtered[filtered.length - 1].y;
      const distKm = filtered[filtered.length - 1].x - filtered[0].x;
      const avgSlope = distKm > 0 ? ((endEle - startEle) / (distKm * 1000)) * 100 : 0;
      return { distKm, gain, loss, avgSlope, maxSlope, minSlope, startEle, endEle, kmMin: filtered[0].x, kmMax: filtered[filtered.length - 1].x };
    }
    function renderStats(stats, isSelection = false) {
      const row = document.getElementById('gpx-stats-row-prevu');
      if (!row) return;
      if (!stats) {
        row.innerHTML = '';
        window._gpxCurrentSelectionStats = null;
        return;
      }
      // Stocke la sélection courante en global pour que le bouton puisse la lire
      window._gpxCurrentSelectionStats = isSelection ? stats : null;
      const fmtSlope = s => (s >= 0 ? '+' : '') + s.toFixed(1) + '%';
      const addBtn = isSelection
        ? `<button class="add-segment-btn" id="add-segment-btn" title="Sauvegarder cette portion comme segment">+ Ajouter segment</button>`
        : '';
      row.innerHTML = `
        <div class="gpx-stat"><div class="g-l">Distance</div><div class="g-v">${stats.distKm.toFixed(2)} km</div></div>
        <div class="gpx-stat"><div class="g-l">D+</div><div class="g-v">${Math.round(stats.gain)} m</div></div>
        <div class="gpx-stat"><div class="g-l">D−</div><div class="g-v">${Math.round(stats.loss)} m</div></div>
        <div class="gpx-stat"><div class="g-l">Pente moy.</div><div class="g-v">${fmtSlope(stats.avgSlope)}</div></div>
        <div class="gpx-stat"><div class="g-l">Pente max</div><div class="g-v">${fmtSlope(stats.maxSlope)}</div></div>
        <div class="gpx-stat"><div class="g-l">Pente min</div><div class="g-v">${fmtSlope(stats.minSlope)}</div></div>
        ${addBtn}
      `;
      const btn = document.getElementById('add-segment-btn');
      if (btn) btn.addEventListener('click', () => {
        if (typeof window.gpxAddCurrentSelectionAsSegment === 'function') {
          window.gpxAddCurrentSelectionAsSegment();
        }
      });
    }
    // Stats initiales (parcours complet)
    renderStats(computeStats(0, totalKm));

    // Fonction pour highlighter un segment sur la carte Leaflet
    function highlightSegmentOnMap(kmMin, kmMax) {
      const linked = window._gpxLinkedData;
      if (!linked || !linked.map) return;
      // Supprime le précédent highlight
      if (linked._highlightLayer) {
        try { linked.map.removeLayer(linked._highlightLayer); } catch (e) {}
        linked._highlightLayer = null;
        try { linked.map.removeLayer(linked._highlightBg); } catch (e) {}
        linked._highlightBg = null;
      }
      if (kmMin == null || kmMax == null) return;
      // Sélectionne les coords correspondant au range km
      const segCoords = [];
      for (let i = 0; i < linked.cumKmByIdx.length; i++) {
        if (linked.cumKmByIdx[i] >= kmMin && linked.cumKmByIdx[i] <= kmMax) {
          segCoords.push(linked.coords[i]);
        }
      }
      if (segCoords.length < 2) return;
      // Double couche : contour vert épais + intérieur noir → effet "tube vert"
      linked._highlightBg = L.polyline(segCoords, {
        color: '#4ade80', weight: 11, opacity: 1, lineCap: 'round', lineJoin: 'round',
      }).addTo(linked.map);
      linked._highlightLayer = L.polyline(segCoords, {
        color: '#000', weight: 6, opacity: 1, lineCap: 'round', lineJoin: 'round',
      }).addTo(linked.map);
      // Recadrage léger
      linked.map.fitBounds(linked._highlightLayer.getBounds(), { padding: [40, 40], maxZoom: 17, animate: true });
    }

    // Chart.js area chart avec drag-select
    appState._gpxElevChart = new Chart(canvas, {
      type: 'line',
      data: {
        datasets: [{
          label: 'Altitude',
          data: plot,
          borderColor: '#4ade80',
          backgroundColor: 'rgba(74,222,128,0.20)',
          borderWidth: 1.4,
          pointRadius: 0,
          fill: true,
          tension: 0, // pas de lissage Bezier : on garde la forme exacte du GPX
          parsing: false,
          spanGaps: true,
        }],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        animation: false,
        parsing: false,
        interaction: { intersect: false, mode: 'nearest', axis: 'x' },
        elements: { point: { hoverRadius: 0 } },
        plugins: {
          legend: { display: false },
          // Tooltip Chart.js désactivé : on utilise un tooltip HTML custom interpolé
          tooltip: { enabled: false },
          // Désactive le plugin global verticalHoverLine qui dessinait une 2e ligne
          // snappée au point le plus proche
          verticalHoverLine: false,
          // Drag-select pour sélectionner une portion du parcours (zoom plugin)
          zoom: {
            zoom: {
              drag: {
                enabled: true,
                backgroundColor: 'rgba(74, 222, 128, 0.18)',
                borderColor: 'rgba(74, 222, 128, 0.6)',
                borderWidth: 1,
              },
              mode: 'x',
              onZoomComplete: ({ chart }) => {
                const xScale = chart.scales.x;
                const kmMin = xScale.min;
                const kmMax = xScale.max;
                const stats = computeStats(kmMin, kmMax);
                renderStats(stats, true); // true = c'est une sélection (affiche bouton + ajouter segment)
                if (stats) highlightSegmentOnMap(stats.kmMin, stats.kmMax);
              },
            },
            limits: { x: { min: 'original', max: 'original' } },
          },
        },
        scales: {
          x: {
            type: 'linear',
            min: 0,
            max: totalKm,
            ticks: {
              color: '#64748b',
              font: { size: 11 },
              callback: v => v.toFixed(0) + ' km',
              maxTicksLimit: 8,
            },
            grid: { display: false }, // pas de lignes de grille verticales (évite confusion avec le curseur)
            border: { display: false },
          },
          y: {
            ticks: {
              color: '#64748b',
              font: { size: 11 },
              callback: v => Math.round(v) + ' m',
              maxTicksLimit: 4,
            },
            grid: { color: 'rgba(255,255,255,0.04)', drawBorder: false },
            border: { display: false },
            title: { display: false },
          },
        },
      },
      // Lignes de départ (drapeau vert) / arrivée (drapeau damier) sur le profil.
      // Masquées automatiquement si hors de la fenêtre de zoom (drag-select).
      plugins: [{
        id: 'gpxStartFinishFlags',
        afterDatasetsDraw(chart) {
          const xs = chart.scales.x, ca = chart.chartArea;
          if (!xs || !ca || !plot.length) return;
          const ctx = chart.ctx;
          const drawFlag = (km, kind) => {
            if (km < xs.min - 1e-9 || km > xs.max + 1e-9) return;
            const x = xs.getPixelForValue(km);
            const color = kind === 'start' ? '#4ade80' : '#e5e7eb';
            ctx.save();
            // ligne verticale pointillée sur toute la hauteur
            ctx.strokeStyle = color;
            ctx.globalAlpha = 0.55;
            ctx.lineWidth = 1.5;
            ctx.setLineDash([4, 3]);
            ctx.beginPath(); ctx.moveTo(x, ca.top + 2); ctx.lineTo(x, ca.bottom); ctx.stroke();
            ctx.setLineDash([]);
            ctx.globalAlpha = 1;
            // drapeau en haut (retourné vers l'intérieur près du bord droit)
            const w = 12, h = 9, cell = 3;
            const dir = (x + w + 3 > ca.right) ? -1 : 1;
            const fx = dir === 1 ? x + 1.5 : x - w - 1.5;
            const fy = ca.top + 2;
            if (kind === 'start') {
              ctx.fillStyle = '#4ade80';
              ctx.fillRect(fx, fy, w, h);
            } else {
              for (let r = 0; r < 3; r++) for (let c = 0; c < 4; c++) {
                ctx.fillStyle = (r + c) % 2 ? '#111827' : '#e5e7eb';
                ctx.fillRect(fx + c * cell, fy + r * cell, cell, cell);
              }
            }
            // mât
            ctx.strokeStyle = color;
            ctx.lineWidth = 1.5;
            ctx.beginPath(); ctx.moveTo(x, fy); ctx.lineTo(x, fy + 15); ctx.stroke();
            ctx.restore();
          };
          drawFlag(plot[0].x, 'start');
          drawFlag(plot[plot.length - 1].x, 'finish');
        },
      }],
    });

    // Pas de badge D+ : l'info est déjà dans la barre de stats au-dessus du graphique
    const wrap = canvas.parentNode;
    const oldBadge = wrap.querySelector('.gpx-elev-dplus-badge');
    if (oldBadge) oldBadge.remove();

    // === CROSSHAIR INTERPOLÉ (DOM divs, pixel-perfect) ===
    const tooltipEl = wrap.querySelector('.gpx-elev-tooltip');
    // Cleanup AGGRESSIF : retire toutes les crosshair lines/dots/overlays existant
    // dans le document (au cas où d'anciennes instances traînent quelque part)
    document.querySelectorAll('.gpx-elev-line').forEach(n => n.remove());
    document.querySelectorAll('.gpx-elev-dot').forEach(n => n.remove());
    document.querySelectorAll('.gpx-elev-overlay').forEach(n => n.remove());
    // Crosshair vertical (div absolute) + dot — fraîchement créés
    const cursorLine = document.createElement('div');
    cursorLine.className = 'gpx-elev-line';
    wrap.appendChild(cursorLine);
    const cursorDot = document.createElement('div');
    cursorDot.className = 'gpx-elev-dot';
    wrap.appendChild(cursorDot);

    function interpolateY(km) {
      // Binary search dans plot pour interpoler l'altitude au km exact
      if (!plot.length) return null;
      if (km <= plot[0].x) return plot[0].y;
      if (km >= plot[plot.length - 1].x) return plot[plot.length - 1].y;
      let lo = 0, hi = plot.length - 1;
      while (lo < hi - 1) {
        const mid = (lo + hi) >> 1;
        if (plot[mid].x < km) lo = mid; else hi = mid;
      }
      const t = (km - plot[lo].x) / (plot[hi].x - plot[lo].x || 1);
      return plot[lo].y + (plot[hi].y - plot[lo].y) * t;
    }
    function slopeAt(km, win = 0.1) {
      const e1 = interpolateY(km - win);
      const e2 = interpolateY(km + win);
      if (e1 == null || e2 == null) return 0;
      return ((e2 - e1) / (win * 2 * 1000)) * 100;
    }

    function onChartMove(e) {
      const cRect = canvas.getBoundingClientRect();
      const wRect = wrap.getBoundingClientRect();
      const xInCanvas = e.clientX - cRect.left;   // px relatifs au canvas chart
      const yInCanvas = e.clientY - cRect.top;
      const chartArea = appState._gpxElevChart.chartArea;
      if (xInCanvas < chartArea.left || xInCanvas > chartArea.right ||
          yInCanvas < chartArea.top || yInCanvas > chartArea.bottom) {
        clearCursor();
        return;
      }
      const km = appState._gpxElevChart.scales.x.getValueForPixel(xInCanvas);
      const ele = interpolateY(km);
      if (ele == null) { clearCursor(); return; }
      const yOnLineInCanvas = appState._gpxElevChart.scales.y.getPixelForValue(ele);
      const slope = slopeAt(km);

      // Positions converties en coords relatives au WRAP (pour le DOM positioning)
      const xInWrap = (cRect.left - wRect.left) + xInCanvas;
      const yInWrap = (cRect.top - wRect.top) + yOnLineInCanvas;
      const topInWrap = (cRect.top - wRect.top) + chartArea.top;
      const bottomInWrap = (cRect.top - wRect.top) + chartArea.bottom;

      // Ligne verticale (DOM div)
      cursorLine.style.left = xInWrap + 'px';
      cursorLine.style.top = topInWrap + 'px';
      cursorLine.style.height = (bottomInWrap - topInWrap) + 'px';
      cursorLine.style.display = 'block';

      // Dot
      cursorDot.style.left = (xInWrap - 6) + 'px';
      cursorDot.style.top = (yInWrap - 6) + 'px';
      cursorDot.style.display = 'block';

      // Tooltip
      tooltipEl.style.display = 'block';
      tooltipEl.innerHTML = `
        <div class="t-km">${km.toFixed(2)} km</div>
        <div class="t-ele">Altitude : ${Math.round(ele)} m · pente ${slope >= 0 ? '+' : ''}${slope.toFixed(1)}%</div>
      `;
      const tipW = 180;
      let left = xInWrap + 14;
      if (left + tipW > wRect.width) left = xInWrap - tipW - 14;
      tooltipEl.style.left = left + 'px';
      tooltipEl.style.top = '8px';

      // Bike marker sur la carte (interpolation pixel-perfect)
      // Si laps > 1 : on prend km modulo lapKm pour retrouver la position sur la boucle
      const linked = window._gpxLinkedData;
      if (linked && linked.bikeMarker && linked.cumKmByIdx) {
        const arr = linked.cumKmByIdx;
        const lapLen = linked.totalKm || (arr[arr.length - 1] || 0);
        let kmOnLoop = km;
        if (lapLen > 0) kmOnLoop = ((km % lapLen) + lapLen) % lapLen;
        let lo2 = 0, hi2 = arr.length - 1;
        while (lo2 < hi2 - 1) {
          const mid = (lo2 + hi2) >> 1;
          if (arr[mid] < kmOnLoop) lo2 = mid; else hi2 = mid;
        }
        const t2 = (kmOnLoop - arr[lo2]) / (arr[hi2] - arr[lo2] || 1);
        const lat = linked.coords[lo2][0] + (linked.coords[hi2][0] - linked.coords[lo2][0]) * t2;
        const lon = linked.coords[lo2][1] + (linked.coords[hi2][1] - linked.coords[lo2][1]) * t2;
        linked.bikeMarker.setLatLng([lat, lon]);
        linked.bikeMarker.setOpacity(1);
      }
    }
    function clearCursor() {
      cursorLine.style.display = 'none';
      cursorDot.style.display = 'none';
      tooltipEl.style.display = 'none';
      const linked = window._gpxLinkedData;
      if (linked && linked.bikeMarker) linked.bikeMarker.setOpacity(0);
    }
    // Cleanup old listeners
    if (canvas._gpxMove) canvas.removeEventListener('mousemove', canvas._gpxMove);
    if (canvas._gpxLeave) canvas.removeEventListener('mouseleave', canvas._gpxLeave);
    canvas._gpxMove = onChartMove;
    canvas._gpxLeave = clearCursor;
    canvas.addEventListener('mousemove', onChartMove);
    canvas.addEventListener('mouseleave', clearCursor);

    // Double-clic → reset zoom + stats + retire highlight
    canvas.addEventListener('dblclick', () => {
      try { appState._gpxElevChart.resetZoom(); } catch (e) {}
      renderStats(computeStats(0, totalKm));
      highlightSegmentOnMap(null, null);
    });
  } catch (e) {
    console.warn('[renderGpxElevationChart]', e);
    canvas.parentNode.innerHTML = '<div class="modal-placeholder">Erreur de lecture du GPX</div>';
  }
}


// Helper qui attache le système de crosshair smooth (overlay canvas + interpolation)
// utilisé par les streams realised, sur n'importe quel chart Chart.js
function _attachSmoothCrosshair(chart) {
  if (!chart || !chart.canvas) return;
  const canvas = chart.canvas;
  const parent = canvas.parentNode;
  if (!parent) return;
  // Crée overlay si pas existant
  if (!chart._stOverlay) {
    const cs = getComputedStyle(parent);
    if (cs.position === 'static') parent.style.position = 'relative';
    const ov = document.createElement('canvas');
    ov.style.cssText = 'position:absolute;top:0;left:0;width:100%;height:100%;pointer-events:none;z-index:2;';
    parent.appendChild(ov);
    chart._stOverlay = ov;
    chart._stOverlayCtx = ov.getContext('2d');
    if (typeof _resizeOverlay === 'function') _resizeOverlay(chart);
  }
  // Réutilise _smoothMM / _smoothML déjà définis pour les streams realised
  if (!canvas._smoothMM) {
    canvas._smoothMM = (e) => {
      const rect = canvas.getBoundingClientRect();
      const x = (e.clientX - rect.left) * (canvas.width / rect.width) / (chart.currentDevicePixelRatio || window.devicePixelRatio || 1);
      const y = (e.clientY - rect.top) * (canvas.height / rect.height) / (chart.currentDevicePixelRatio || window.devicePixelRatio || 1);
      const { left, right, top, bottom } = chart.chartArea;
      if (x < left || x > right || y < top || y > bottom) {
        if (typeof appState._smoothPendingX !== 'undefined') {
          appState._smoothPendingX = null;
          if (typeof _scheduleSmoothDraw === 'function') _scheduleSmoothDraw();
        }
        return;
      }
      if (typeof appState._smoothPendingX !== 'undefined') {
        appState._smoothPendingX = chart.scales.x.getValueForPixel(x);
        if (typeof _scheduleSmoothDraw === 'function') _scheduleSmoothDraw();
      }
    };
    canvas._smoothML = () => {
      if (typeof appState._smoothPendingX !== 'undefined') {
        appState._smoothPendingX = null;
        if (typeof _scheduleSmoothDraw === 'function') _scheduleSmoothDraw();
      }
    };
    canvas.addEventListener('mousemove', canvas._smoothMM);
    canvas.addEventListener('mouseleave', canvas._smoothML);
  }
}

export function renderGpxLeafletMap(gpxContent, divId) {
  const el = document.getElementById(divId);
  if (!el || !gpxContent || typeof L === 'undefined') return;
  // Cleanup map précédente
  if (appState._gpxLeafletMap) {
    try { appState._gpxLeafletMap.remove(); } catch (e) {}
    appState._gpxLeafletMap = null;
  }
  el.innerHTML = '';
  try {
    const parser = new DOMParser();
    const doc = parser.parseFromString(gpxContent, 'application/xml');
    const trkpts = doc.getElementsByTagName('trkpt');
    const pts = trkpts.length ? trkpts : (doc.getElementsByTagName('rtept').length ? doc.getElementsByTagName('rtept') : doc.getElementsByTagName('wpt'));
    if (!pts.length) {
      el.innerHTML = '<div class="modal-placeholder">Pas de points GPS dans le fichier GPX</div>';
      return;
    }
    const coords = [];
    for (let i = 0; i < pts.length; i++) {
      const lat = parseFloat(pts[i].getAttribute('lat'));
      const lon = parseFloat(pts[i].getAttribute('lon'));
      if (isNaN(lat) || isNaN(lon)) continue;
      coords.push([lat, lon]);
    }
    if (!coords.length) {
      el.innerHTML = '<div class="modal-placeholder">Trace illisible</div>';
      return;
    }

    // Init la carte
    appState._gpxLeafletMap = L.map(el, {
      zoomControl: true,
      attributionControl: false,
    });

    // 1) Couche de base : hillshade ESRI subtil pour donner du relief
    L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/Elevation/World_Hillshade/MapServer/tile/{z}/{y}/{x}', {
      maxZoom: 16,
      opacity: 0.6,
    }).addTo(appState._gpxLeafletMap);

    // 2) Couche principale : OSM standard quasi opaque → look propre, lisible
    L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19,
      opacity: 0.88,
    }).addTo(appState._gpxLeafletMap);

    // Attribution discrète en bas à droite
    L.control.attribution({
      prefix: false,
      position: 'bottomright',
    }).addAttribution('© <a href="https://www.openstreetmap.org/copyright" target="_blank">OpenStreetMap</a> · Relief © <a href="https://www.esri.com/" target="_blank">Esri</a>').addTo(appState._gpxLeafletMap);

    // Trace en double couche : contour noir épais en dessous + vert accent au-dessus
    L.polyline(coords, {
      color: '#000',
      weight: 8,
      opacity: 0.55,
      lineCap: 'round',
      lineJoin: 'round',
    }).addTo(appState._gpxLeafletMap);
    const trace = L.polyline(coords, {
      color: '#4ade80',
      weight: 5,
      opacity: 1,
      lineCap: 'round',
      lineJoin: 'round',
    }).addTo(appState._gpxLeafletMap);

    // === Flèches indiquant le sens du parcours ===
    // On en place une tous les ~N points (ajusté pour avoir 8-12 flèches au total)
    const arrowEvery = Math.max(20, Math.floor(coords.length / 10));
    function bearing(lat1, lon1, lat2, lon2) {
      const toRad = d => d * Math.PI / 180;
      const toDeg = r => r * 180 / Math.PI;
      const φ1 = toRad(lat1), φ2 = toRad(lat2);
      const Δλ = toRad(lon2 - lon1);
      const y = Math.sin(Δλ) * Math.cos(φ2);
      const x = Math.cos(φ1) * Math.sin(φ2) - Math.sin(φ1) * Math.cos(φ2) * Math.cos(Δλ);
      return (toDeg(Math.atan2(y, x)) + 360) % 360;
    }
    // SVG d'une vraie flèche (tige + pointe), pointant vers le HAUT par défaut
    // Tige + tête → direction sans ambiguïté possible
    const arrowSvg = `<svg viewBox="0 0 24 24" width="20" height="20" xmlns="http://www.w3.org/2000/svg">
      <path d="M12 2 L18 11 L14 11 L14 22 L10 22 L10 11 L6 11 Z"
            fill="#fff" stroke="#000" stroke-width="1.4" stroke-linejoin="round"/>
    </svg>`;
    for (let i = arrowEvery; i < coords.length - 1; i += arrowEvery) {
      let prevIdx = i - 1, nextIdx = i + 1;
      while (prevIdx > 0 && Math.abs(coords[prevIdx][0] - coords[i][0]) < 0.0001 && Math.abs(coords[prevIdx][1] - coords[i][1]) < 0.0001) prevIdx--;
      while (nextIdx < coords.length - 1 && Math.abs(coords[nextIdx][0] - coords[i][0]) < 0.0001 && Math.abs(coords[nextIdx][1] - coords[i][1]) < 0.0001) nextIdx++;
      const angle = bearing(coords[prevIdx][0], coords[prevIdx][1], coords[nextIdx][0], coords[nextIdx][1]);
      const arrowIcon = L.divIcon({
        className: 'gpx-arrow',
        html: `<div class="gpx-arrow-wrap" style="transform:rotate(${angle}deg);">${arrowSvg}</div>`,
        iconSize: [20, 20],
        iconAnchor: [10, 10],
      });
      L.marker(coords[i], { icon: arrowIcon, interactive: false, keyboard: false }).addTo(appState._gpxLeafletMap);
    }

    // === Référence globale pour le curseur du profil → marker mobile sur la carte ===
    // Calcul du cumul de distance par point pour pouvoir mapper km → lat/lon
    const cumKmByIdx = [0];
    for (let i = 1; i < coords.length; i++) {
      cumKmByIdx.push(cumKmByIdx[i-1] + dist(coords[i-1][0], coords[i-1][1], coords[i][0], coords[i][1]));
    }
    const totalKm = cumKmByIdx[cumKmByIdx.length - 1];
    window._gpxLinkedData = { coords, cumKmByIdx, totalKm, map: appState._gpxLeafletMap };
    // Marker bike (caché par défaut)
    const bikeIcon = L.divIcon({
      className: 'gpx-bike-marker',
      html: `<div class="gpx-bike-dot"></div>`,
      iconSize: [20, 20],
      iconAnchor: [10, 10],
    });
    const bikeMarker = L.marker(coords[0], { icon: bikeIcon, interactive: false, keyboard: false, opacity: 0 }).addTo(appState._gpxLeafletMap);
    window._gpxLinkedData.bikeMarker = bikeMarker;
    // Helper distance pour le linkage
    function dist(lat1, lon1, lat2, lon2) {
      const R = 6371;
      const toRad = d => d * Math.PI / 180;
      const dLat = toRad(lat2 - lat1);
      const dLon = toRad(lon2 - lon1);
      const a = Math.sin(dLat/2) ** 2 + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon/2) ** 2;
      return 2 * R * Math.asin(Math.sqrt(a));
    }

    // Markers départ + arrivée (avec gestion boucle)
    const start = coords[0];
    const end = coords[coords.length - 1];
    const isLoop = Math.abs(start[0] - end[0]) < 0.0002 && Math.abs(start[1] - end[1]) < 0.0002;

    // Icônes custom : cercles colorés via DivIcon
    function makeIcon(color, label) {
      return L.divIcon({
        className: 'gpx-marker',
        html: `<div class="gpx-marker-dot" style="background:${color};"></div><div class="gpx-marker-label" style="color:${color};">${label}</div>`,
        iconSize: [16, 16],
        iconAnchor: [8, 8],
      });
    }
    // === Lignes de départ / arrivée perpendiculaires au tracé (style vraie course) ===
    // Ligne verte au départ, damier noir/blanc à l'arrivée (dash sur fond clair).
    function perpLinePts(anchor, toward, halfM) {
      const cosLat = Math.cos(anchor[0] * Math.PI / 180) || 1;
      let dx = (toward[1] - anchor[1]) * cosLat, dy = toward[0] - anchor[0];
      const n = Math.hypot(dx, dy) || 1;
      const px = -dy / n, py = dx / n;            // perpendiculaire normalisée
      return [
        [anchor[0] + (py * halfM) / 111111, anchor[1] + (px * halfM) / (111111 * cosLat)],
        [anchor[0] - (py * halfM) / 111111, anchor[1] - (px * halfM) / (111111 * cosLat)],
      ];
    }
    function addRaceLine(pts, kind) {
      const base = kind === 'start' ? '#4ade80' : '#f8fafc';
      const dash = kind === 'start' ? '#166534' : '#111827';
      L.polyline(pts, { color: base, weight: 6, opacity: 1, lineCap: 'butt', interactive: false }).addTo(appState._gpxLeafletMap);
      L.polyline(pts, { color: dash, weight: 6, opacity: 1, dashArray: '5 5', lineCap: 'butt', interactive: false }).addTo(appState._gpxLeafletMap);
    }
    // Direction prise quelques points plus loin pour une perpendiculaire stable
    const _dirStart = coords[Math.min(5, coords.length - 1)];
    const _dirEnd = coords[Math.max(coords.length - 6, 0)];
    if (isLoop) {
      addRaceLine(perpLinePts(start, _dirStart, 20), 'finish');
      L.marker(start, { icon: makeIcon('#fbbf24', 'DÉPART / ARRIVÉE') }).addTo(appState._gpxLeafletMap);
    } else {
      addRaceLine(perpLinePts(start, _dirStart, 20), 'start');
      addRaceLine(perpLinePts(end, _dirEnd, 20), 'finish');
      L.marker(start, { icon: makeIcon('#4ade80', 'DÉPART') }).addTo(appState._gpxLeafletMap);
      L.marker(end, { icon: makeIcon('#ef4444', 'ARRIVÉE') }).addTo(appState._gpxLeafletMap);
    }

    // Cadre la vue sur la trace avec un peu de padding
    const bounds = trace.getBounds();
    appState._gpxLeafletMap.fitBounds(bounds, { padding: [30, 30], maxZoom: 15 });

    // Plusieurs invalidateSize + refit pour gérer le rendu différé de la modal
    // (la modal peut prendre du temps à atteindre sa taille finale après animation)
    const refit = () => {
      if (!appState._gpxLeafletMap) return;
      appState._gpxLeafletMap.invalidateSize(true);
      appState._gpxLeafletMap.fitBounds(bounds, { padding: [30, 30], maxZoom: 15 });
    };
    requestAnimationFrame(refit);
    setTimeout(refit, 150);
    setTimeout(refit, 400);
    setTimeout(refit, 800);
  } catch (e) {
    console.warn('[renderGpxLeafletMap]', e);
    el.innerHTML = '<div class="modal-placeholder">Erreur de lecture du GPX</div>';
  }
}


// === Rendu d'une trace GPX en SVG (parse le XML + projette lat/lon en path SVG) — legacy, conservé pour compat ===
function renderGpxTrack(gpxContent, svgId) {
  const svg = document.getElementById(svgId);
  if (!svg || !gpxContent) return;
  try {
    const parser = new DOMParser();
    const doc = parser.parseFromString(gpxContent, 'application/xml');
    const trkpts = doc.getElementsByTagName('trkpt');
    if (!trkpts.length) {
      // Fallback : essaye les routes (rtept) ou waypoints (wpt)
      const alts = doc.getElementsByTagName('rtept').length ? doc.getElementsByTagName('rtept') : doc.getElementsByTagName('wpt');
      if (!alts.length) {
        svg.innerHTML = '<text x="50%" y="50%" text-anchor="middle" fill="#9ca3af" font-size="12">Aucun point GPS dans le fichier GPX</text>';
        return;
      }
    }
    const pts = trkpts.length ? trkpts : (doc.getElementsByTagName('rtept').length ? doc.getElementsByTagName('rtept') : doc.getElementsByTagName('wpt'));
    let minLat = Infinity, maxLat = -Infinity, minLon = Infinity, maxLon = -Infinity;
    const coords = [];
    for (let i = 0; i < pts.length; i++) {
      const lat = parseFloat(pts[i].getAttribute('lat'));
      const lon = parseFloat(pts[i].getAttribute('lon'));
      if (isNaN(lat) || isNaN(lon)) continue;
      coords.push([lat, lon]);
      if (lat < minLat) minLat = lat;
      if (lat > maxLat) maxLat = lat;
      if (lon < minLon) minLon = lon;
      if (lon > maxLon) maxLon = lon;
    }
    if (!coords.length) {
      svg.innerHTML = '<text x="50%" y="50%" text-anchor="middle" fill="#9ca3af" font-size="12">Trace illisible</text>';
      return;
    }

    // Projection simple Mercator-like sur la bounding box
    const W = 900, H = 400, pad = 16;
    const lonRange = maxLon - minLon || 0.0001;
    const latRange = maxLat - minLat || 0.0001;
    const aspect = lonRange / latRange * Math.cos(((minLat + maxLat) / 2) * Math.PI / 180);
    let drawW, drawH;
    if (aspect * (H - 2 * pad) >= (W - 2 * pad)) {
      drawW = W - 2 * pad;
      drawH = drawW / aspect;
    } else {
      drawH = H - 2 * pad;
      drawW = drawH * aspect;
    }
    const offX = (W - drawW) / 2;
    const offY = (H - drawH) / 2;

    const path = coords.map((c, i) => {
      const x = offX + ((c[1] - minLon) / lonRange) * drawW;
      // y inversé (lat croissante vers le haut)
      const y = offY + (1 - (c[0] - minLat) / latRange) * drawH;
      return (i === 0 ? 'M' : 'L') + x.toFixed(1) + ' ' + y.toFixed(1);
    }).join(' ');

    const startX = offX + ((coords[0][1] - minLon) / lonRange) * drawW;
    const startY = offY + (1 - (coords[0][0] - minLat) / latRange) * drawH;
    const endX = offX + ((coords[coords.length-1][1] - minLon) / lonRange) * drawW;
    const endY = offY + (1 - (coords[coords.length-1][0] - minLat) / latRange) * drawH;

    // Détection de superposition (boucle) : si départ et arrivée sont proches (< 30px)
    const distPx = Math.hypot(endX - startX, endY - startY);
    const isLoop = distPx < 30;

    // Helper pour placer le label DÉPART/ARRIVÉE en évitant les bords
    function placeLabel(cx, cy, text, color, prefer = 'right') {
      const padX = 12, padY = 4;
      const approxW = text.length * 6.5 + 4; // largeur estimée
      let lx = cx + padX, ly = cy + padY;
      let anchor = 'start';
      // Si trop près du bord droit, place à gauche
      if (lx + approxW > W - 8) { lx = cx - padX; anchor = 'end'; }
      // Si trop près du bord haut, descend
      if (ly < 14) ly = cy + 16;
      // Si trop près du bord bas
      if (ly > H - 8) ly = cy - 10;
      return `<text x="${lx}" y="${ly}" text-anchor="${anchor}" fill="${color}" font-size="11" font-weight="700" stroke="#062017" stroke-width="3" paint-order="stroke" stroke-linejoin="round">${text}</text>`;
    }

    let markersSvg;
    if (isLoop) {
      // Cercle unique mi-vert mi-rouge + label combiné
      markersSvg = `
        <circle cx="${startX}" cy="${startY}" r="7" fill="#4ade80" stroke="#062017" stroke-width="2"/>
        <path d="M ${startX - 7} ${startY} A 7 7 0 0 1 ${startX + 7} ${startY} Z" fill="#ef4444" stroke="#062017" stroke-width="0"/>
        <circle cx="${startX}" cy="${startY}" r="7" fill="none" stroke="#062017" stroke-width="2"/>
        ${placeLabel(startX, startY, 'DÉPART / ARRIVÉE', '#fbbf24')}
      `;
    } else {
      markersSvg = `
        <circle cx="${startX}" cy="${startY}" r="6" fill="#4ade80" stroke="#062017" stroke-width="2"/>
        ${placeLabel(startX, startY, 'DÉPART', '#4ade80')}
        <circle cx="${endX}" cy="${endY}" r="6" fill="#ef4444" stroke="#062017" stroke-width="2"/>
        ${placeLabel(endX, endY, 'ARRIVÉE', '#ef4444')}
      `;
    }

    svg.setAttribute('viewBox', `0 0 ${W} ${H}`);
    svg.innerHTML = `
      <defs>
        <linearGradient id="gpxGrad-${svgId}" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0%" stop-color="#4ade80"/>
          <stop offset="100%" stop-color="#22c55e"/>
        </linearGradient>
      </defs>
      <rect width="${W}" height="${H}" fill="rgba(74,222,128,0.03)" rx="8"/>
      <path d="${path}" stroke="url(#gpxGrad-${svgId})" stroke-width="3" fill="none" stroke-linecap="round" stroke-linejoin="round"/>
      ${markersSvg}
    `;
  } catch (e) {
    console.warn('[renderGpxTrack] erreur de parsing :', e);
    svg.innerHTML = '<text x="50%" y="50%" text-anchor="middle" fill="#9ca3af" font-size="12">Erreur de lecture du GPX</text>';
  }
}


// Détail d'un jour de repos passé : message simple.
export function openRestDayModal(iso) {
  const date = new Date(iso + 'T12:00:00');
  if (isNaN(date.getTime())) return;
  // Mobile : date compacte ("mer. 1 juil. 2026") pour que l'heure + le sport tiennent sur la même ligne
  const dateStr = (window.innerWidth < 860)
    ? date.toLocaleDateString('fr-FR', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' })
    : date.toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
  const titleEl = document.getElementById('modal-title');
  const metaEl = document.getElementById('modal-meta');
  const bodyEl = document.getElementById('modal-body');
  const _e = document.getElementById('modal-edit-btn'); if (_e) _e.hidden = true;
  const _d = document.getElementById('modal-delete-btn'); if (_d) _d.hidden = true;

  titleEl.innerHTML = 'Repos';
  metaEl.textContent = dateStr;

  const couchBlock = `<div class="rest-modal-couch">${REST_COUCH_SVG}</div>`;
  bodyEl.innerHTML = `${couchBlock}<div class="modal-placeholder">Jour de repos.</div>`;
  document.getElementById('session-modal').classList.add('active');
}


// Modale d'édition d'une activité (calque d'overrides) + transformer en compétition.
export function openActivityEditModal(activityId, iso) {
  const day = appState.data.find(d => toIsoDate(d.date) === iso);
  const act = day && day.activities ? day.activities.find(a => String(a.id) === String(activityId)) : null;
  if (!act) return;
  const ov = getActivityEdit(activityId) || {};
  let exclPower = !!ov.excludePower, exclHr = !!ov.excludeHr, exclDist = !!ov.excludeDistance;

  // Course à étapes parente (si cette activité est une étape d'une course multi-activités)
  const _comps = (typeof loadCompetitions === 'function') ? loadCompetitions() : [];
  const _race = act._sbId ? _comps.find(c => Array.isArray(c.activityIds) && c.activityIds.map(String).includes(String(act._sbId)) && c.activityIds.length > 1) : null;
  const _singleComp = act._sbId ? _comps.find(c => String(c.id) === 'act-' + String(act._sbId)) : null;
  const _curPrioKey = compPrio((_race ? _race.priority : (_singleComp ? _singleComp.priority : null))).key;
  let _aePrio = _curPrioKey;

  document.getElementById('_act-edit-modal')?.remove();
  const overlay = document.createElement('div');
  overlay.className = 'day-modal-overlay active';
  overlay.id = '_act-edit-modal';
  overlay.innerHTML = `
    <div class="day-modal day-modal-note" style="width:880px;max-width:calc(100vw - 32px);">
      <div class="day-modal-header">
        <h3>Modifier l'activité</h3>
        <button class="day-modal-close" type="button" title="Fermer">×</button>
      </div>
      <div class="day-modal-body">
        <div class="add-form-grid">
          <label class="form-field form-col-2">
            <span>Nom</span>
            <input type="text" id="_ae-name">
          </label>
          <div class="form-field form-col-2 add-sec">
            <div class="add-sec-h plan">Détails</div>
            <div class="add-sec-grid g3">
              <label class="form-field"><span>Type</span><input type="text" id="_ae-type" placeholder="endurance, seuil…"></label>
              <label class="form-field"><span>Sport</span><select id="_ae-sport"></select></label>
            </div>
          </div>
          <div class="form-field form-col-2 add-sec">
            <div class="add-sec-h charge">Charge</div>
            <div class="add-sec-grid g3">
              <label class="form-field"><span>Durée (min)</span><input type="number" id="_ae-dur" min="0" placeholder="minutes"></label>
              <label class="form-field"><span>TSS</span><input type="number" id="_ae-tss" min="0" placeholder="TSS"></label>
              <label class="form-field"><span>RPE ressenti (1-10)</span><input type="number" id="_ae-rpe" min="0" max="10" step="0.5" placeholder="1 à 10"></label>
            </div>
          </div>
          <div class="form-field form-col-2 add-sec">
            <div class="add-sec-h parc">Parcours</div>
            <div class="add-sec-grid g3">
              <label class="form-field"><span>Distance (km)</span><input type="number" step="0.1" id="_ae-dist" min="0" placeholder="km"></label>
              <label class="form-field"><span>Dénivelé D+ (m)</span><input type="number" id="_ae-dplus" min="0" placeholder="mètres"></label>
              <label class="form-field"><span>Nombre de tours</span><input type="number" id="_ae-laps" min="0" placeholder="tours"></label>
            </div>
          </div>
          <label class="form-field form-col-2">
            <span>Notes</span>
            <textarea id="_ae-notes" rows="2" placeholder="Commentaire…"></textarea>
          </label>
          <div class="form-field form-col-2 add-sec">
            <div class="add-sec-h charge">Retirer des records &amp; statistiques</div>
            <div class="ae-field-hint">La donnée reste sur l'activité, mais n'est plus comptée dans les records / stats.</div>
            <div class="ae-metric-btns">
              <button type="button" class="ae-metric-btn${exclPower ? ' active' : ''}" data-m="power">Puissance</button>
              <button type="button" class="ae-metric-btn${exclHr ? ' active' : ''}" data-m="hr">Cardio</button>
              <button type="button" class="ae-metric-btn${exclDist ? ' active' : ''}" data-m="dist">Distance</button>
            </div>
            <div id="_ae-event-wrap" style="${act.category === 'competition' ? 'margin-top:12px' : 'display:none;'}">
              <label class="note-field-label">Priorité</label>
              <div class="note-type-chips" id="_ae-prio">
                <button type="button" class="note-type-chip${_curPrioKey === 'principal' ? ' active' : ''}" data-prio="principal">Objectif</button>
                <button type="button" class="note-type-chip${_curPrioKey === 'secondaire' ? ' active' : ''}" data-prio="secondaire">Préparation</button>
              </div>
              ${_race
                ? `<button type="button" class="ae-stagerace-btn" id="_ae-dissociate">Dissocier de « ${window._confirmEscape ? window._confirmEscape(_race.name) : _race.name} »</button>`
                : `<button type="button" class="ae-stagerace-btn" id="_ae-stagerace">+ Ajouter à une course à étapes</button>`}
            </div>
          </div>
        </div>
      </div>
      <div class="day-modal-footer">
        <button class="btn-trash" type="button" id="_ae-reset" title="Réinitialiser : annuler les modifications et revenir aux données d'origine">
          <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6M14 11v6"/><path d="M9 6V4a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2v2"/></svg>
        </button>
        <button type="button" class="btn-secondary" id="_ae-transform">${act.category === 'competition' ? '→ Entraînement' : '→ Compétition'}</button>
        <div style="flex:1;"></div>
        <button class="day-modal-cancel" type="button">Annuler</button>
        <button class="day-modal-save" type="button">Enregistrer</button>
      </div>
    </div>`;
  document.body.appendChild(overlay);

  // Pré-remplissage (via .value pour éviter les soucis d'échappement)
  document.getElementById('_ae-name').value = act.name || '';
  document.getElementById('_ae-type').value = act.type || '';
  if (typeof populateSportSelect === 'function') populateSportSelect('_ae-sport', act.raw_type || act.sport_raw || act.sport || 'Ride');
  document.getElementById('_ae-dur').value = act.duration || 0;
  document.getElementById('_ae-dist').value = act.distance_km != null ? act.distance_km : '';
  document.getElementById('_ae-tss').value = act.tss || 0;
  document.getElementById('_ae-rpe').value = act.rpe != null ? act.rpe : '';
  document.getElementById('_ae-dplus').value = (act.elevation_gain != null ? act.elevation_gain : (act.total_elevation_gain != null ? act.total_elevation_gain : ''));
  document.getElementById('_ae-laps').value = act.laps != null ? act.laps : '';
  document.getElementById('_ae-notes').value = act.notes || ov.notes || '';
  overlay.querySelector('#_ae-stagerace')?.addEventListener('click', () => {
    close();
    openStageRaceBuilder(activityId);
  });
  overlay.querySelector('#_ae-dissociate')?.addEventListener('click', async () => {
    close();
    await dissociateFromStageRace(act, _race, iso);
  });

  overlay.querySelectorAll('.ae-metric-btn').forEach(b => b.addEventListener('click', () => {
    b.classList.toggle('active');
    const on = b.classList.contains('active');
    if (b.dataset.m === 'power') exclPower = on;
    if (b.dataset.m === 'hr') exclHr = on;
    if (b.dataset.m === 'dist') exclDist = on;
  }));
  overlay.querySelectorAll('#_ae-prio .note-type-chip').forEach(chip => chip.addEventListener('click', () => {
    overlay.querySelectorAll('#_ae-prio .note-type-chip').forEach(c => c.classList.remove('active'));
    chip.classList.add('active');
    _aePrio = chip.dataset.prio;
  }));

  const close = () => overlay.remove();
  overlay.querySelector('.day-modal-close').addEventListener('click', close);
  overlay.querySelector('.day-modal-cancel').addEventListener('click', close);
  overlay.addEventListener('click', e => { if (e.target === overlay) close(); });

  overlay.querySelector('.day-modal-save').addEventListener('click', () => {
    const newOv = {};
    const nameV = document.getElementById('_ae-name').value.trim();
    const typeV = document.getElementById('_ae-type').value.trim();
    const sportV = document.getElementById('_ae-sport').value.trim();
    const durV = parseInt(document.getElementById('_ae-dur').value, 10);
    const distV = parseFloat(document.getElementById('_ae-dist').value);
    const tssV = parseInt(document.getElementById('_ae-tss').value, 10);
    const notesV = document.getElementById('_ae-notes').value.trim();
    const rpeV = parseFloat(document.getElementById('_ae-rpe').value);
    const dplusV = parseInt(document.getElementById('_ae-dplus').value, 10);
    const lapsV = parseInt(document.getElementById('_ae-laps').value, 10);
    if (nameV) newOv.name = nameV;
    if (typeV) newOv.type = typeV;
    if (sportV) newOv.sport = sportV;
    if (!isNaN(durV)) newOv.duration = durV;
    if (!isNaN(distV)) newOv.distance_km = distV;
    if (!isNaN(tssV)) newOv.tss = tssV;
    if (!isNaN(rpeV)) newOv.rpe = rpeV;
    if (!isNaN(dplusV)) newOv.elevation_gain = dplusV;
    if (!isNaN(lapsV)) newOv.laps = lapsV;
    if (notesV) newOv.notes = notesV;
    if (exclPower) newOv.excludePower = true;
    if (exclHr) newOv.excludeHr = true;
    if (exclDist) newOv.excludeDistance = true;
    setActivityEdit(activityId, newOv);
    // Priorité de la compétition (course à étapes → la course ; sinon la compét d'un jour)
    if (act.category === 'competition' && window.sb && _aePrio !== _curPrioKey) {
      // Modele unifie : la priorite est sur la ligne activities (la compet EST l'activite).
      window.sb.from('activities').update({ priority: _aePrio }).eq('id', act._sbId).then(() => {
        if (window.cloudSync && window.cloudSync.pullAllFromCloud) window.cloudSync.pullAllFromCloud().then(() => {
          if (typeof renderCalendar === 'function') renderCalendar();
          if (typeof renderCompList === 'function') renderCompList();
        });
      });
    }
    close();
  });
  overlay.querySelector('#_ae-reset').addEventListener('click', async () => {
    const ok = await appConfirm({ title: 'Réinitialiser', html: "Annuler toutes les modifications de cette activité et revenir aux données Strava ?", confirmLabel: 'Réinitialiser', danger: true });
    if (ok) { setActivityEdit(activityId, null); close(); }
  });
  overlay.querySelector('#_ae-transform').addEventListener('click', async () => {
    const target = (act.category === 'competition') ? 'entrainement' : 'competition';
    close();
    await setActivityCategory(act, target, iso);
  });
}


// Bascule la catégorie d'une activité (entrainement ↔ competition) directement
// en base, sans formulaire. Re-pull + re-render pour refléter le changement.
export async function setActivityCategory(act, category, iso) {
  if (!act || !act._sbId || !window.sb) return;
  try {
    // category_set_by_user : la synchro Strava ne reclassera plus jamais cette ligne
    const { error } = await window.sb.from('activities').update({ category, category_set_by_user: true }).eq('id', act._sbId);
    if (error) throw error;
    act.category = category;
    // Refléter dans DASHBOARD_DATA (source des reconstructions) sinon l'affichage
    // repasse en compétition au prochain rebuild.
    if (window.DASHBOARD_DATA && window.DASHBOARD_DATA.days) {
      for (const d of window.DASHBOARD_DATA.days) {
        for (const a of (d.activities || [])) {
          if (String(a._sbId) === String(act._sbId)) a.category = category;
        }
      }
    }
// Modele unifie : changer category sur l'activite SUFFIT (la compet EST l'activite).
    // Rien d'autre a faire (plus de registre competitions separe -> plus de doublon).
        if (window.cloudSync && window.cloudSync.pullAllFromCloud) await window.cloudSync.pullAllFromCloud();
    if (window.__applyOverridesAndRerender) window.__applyOverridesAndRerender(); // rebuild data depuis DASHBOARD_DATA mis à jour
    if (typeof renderCompList === 'function') renderCompList();
  } catch (e) {
    console.warn('[setActivityCategory]', e.message || e);
  }
}


// Sélecteur d'étapes dans le détail réalisé : si l'activité du jour appartient à
// une course à étapes (competitions.activity_ids > 1), affiche « Étape 1 / 2 … »
// pour naviguer entre les activités-étapes (ordre chronologique).
export function _injectRealisedStageTabs(iso, acts) {
  const comps = (typeof loadCompetitions === 'function') ? loadCompetitions() : [];
  const sbIds = (acts || []).map(a => String(a._sbId)).filter(Boolean);
  const race = comps.find(c => Array.isArray(c.activityIds) && c.activityIds.length > 1
    && c.activityIds.map(String).some(id => sbIds.includes(id)));
  if (!race) return;
  const stages = race.activityIds.map(id => _findActBySbId(id)).filter(Boolean)
    .sort((a, b) => (a.iso < b.iso ? -1 : 1));
  if (stages.length < 2) return;
  const curIdx = stages.findIndex(s => s.iso === iso);
  // Le titre garde le vrai nom de l'activité (posé par renderModalActivity).
  // Switcher d'étapes EN HAUT DU CORPS, style identique au prévu (.modal-activity-switch),
  // précédé à gauche par le nom de la course à étapes.
  const body = document.getElementById('modal-body');
  if (!body) return;
  body.querySelector('.rst-switch')?.remove();
  const raceName = window._confirmEscape ? window._confirmEscape(race.name) : race.name;
  const sw = document.createElement('div');
  sw.className = 'rst-switch';
  // Le nom de la course est HORS du carré gris ; seules les pastilles sont dans le carré.
  sw.innerHTML = `<span class="rst-race-label">${raceName}</span>`
    + `<div class="modal-activity-switch">`
    + stages.map((s, i) => `<button type="button" class="${i === curIdx ? 'active' : ''}" data-stageiso="${s.iso}">Étape ${i + 1}</button>`).join('')
    + `</div>`;
  body.prepend(sw);
  sw.querySelectorAll('button').forEach(b => b.addEventListener('click', () => {
    const di = b.dataset.stageiso;
    if (di && di !== iso) openSessionModal(di, 'realise');
  }));
}


// Cherche une activité (chargée) par son id Supabase → { act, iso }.
export function _findActBySbId(sbId) {
  for (const d of appState.data) {
    if (!d.activities) continue;
    for (const a of d.activities) {
      if (String(a._sbId) === String(sbId)) return { act: a, iso: toIsoDate(d.date) };
    }
  }
  return null;
}


// Retire une activité d'une course à étapes : elle redevient une compét d'un jour.
async function dissociateFromStageRace(act, race, iso) {
  if (!act || !act._sbId || !race || !window.sb) return;
  try {
    const remaining = (race.activityIds || []).map(String).filter(id => id !== String(act._sbId));
    if (remaining.length >= 2) {
      // La course garde les autres étapes
      await window.sb.from('competitions').update({ activity_ids: remaining }).eq('id', race._sbId);
    } else {
      // Plus assez d'étapes → on supprime la course ; l'étape restante redevient compét d'un jour
      await window.sb.from('competitions').delete().eq('id', race._sbId);
      if (remaining.length === 1) {
        const found = _findActBySbId(remaining[0]);
        if (found && window.cloudSync.pushCompetitionRegistry) {
          await window.cloudSync.pushCompetitionRegistry({
            id: 'act-' + remaining[0], name: found.act.name || 'Compétition',
            date: found.iso, sport: found.act.sport || null, activityIds: [remaining[0]],
          });
        }
      }
    }
    // Cette activité redevient une compét d'un jour autonome
    if (window.cloudSync.pushCompetitionRegistry) {
      await window.cloudSync.pushCompetitionRegistry({
        id: 'act-' + act._sbId, name: act.name || 'Compétition',
        date: iso, sport: act.sport || null, activityIds: [act._sbId],
      });
    }
    if (window.cloudSync.pullAllFromCloud) await window.cloudSync.pullAllFromCloud();
    if (typeof renderCalendar === 'function') renderCalendar();
    if (typeof renderCompList === 'function') renderCompList();
  } catch (e) { console.warn('[dissociate]', e.message || e); }
}


// Constructeur de course à étapes : choisis les activités qui sont les étapes,
// nomme la course → elles deviennent des compétitions partageant la même "épreuve".
// L'ordre des étapes est chronologique (étape 1 = la plus ancienne).
function openStageRaceBuilder(currentActivityId) {
  // Rassemble toutes les activités (réalisées) avec leur date
  const allActs = [];
  for (const d of appState.data) {
    if (!d.activities) continue;
    const iso = toIsoDate(d.date);
    for (const a of d.activities) {
      if (!a._sbId) continue; // seulement les lignes en base
      allActs.push({ sbId: a._sbId, iso, name: a.name || 'Séance', sport: a.sport || '', category: a.category, event: a.event || null });
    }
  }
  allActs.sort((x, y) => (x.iso < y.iso ? 1 : x.iso > y.iso ? -1 : 0)); // récent en haut

  const current = allActs.find(a => a.sbId === currentActivityId);
  const presetEvent = current && current.event ? current.event : '';
  const preChecked = new Set();
  if (current) preChecked.add(current.sbId);
  if (presetEvent) allActs.filter(a => a.event === presetEvent).forEach(a => preChecked.add(a.sbId));

  document.getElementById('_act-edit-modal')?.remove();
  document.getElementById('_stagerace-modal')?.remove();
  const overlay = document.createElement('div');
  overlay.className = 'day-modal-overlay active';
  overlay.id = '_stagerace-modal';
  const fmtD = (iso) => new Date(iso + 'T12:00:00').toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', year: 'numeric' });
  const rows = allActs.map(a => `
    <label class="sr-row">
      <input type="checkbox" data-sbid="${a.sbId}" ${preChecked.has(a.sbId) ? 'checked' : ''}>
      <span class="sr-date">${fmtD(a.iso)}</span>
      <span class="sr-name">${window._confirmEscape ? window._confirmEscape(a.name) : a.name}</span>
      ${a.category === 'competition' ? '<span class="sr-tag">compét</span>' : ''}
    </label>`).join('');

  overlay.innerHTML = `
    <div class="day-modal day-modal-note">
      <div class="day-modal-header">
        <h3>Course à étapes</h3>
        <button class="day-modal-close" type="button" title="Fermer">×</button>
      </div>
      <div class="day-modal-body">
        <label class="note-field-label">Nom de la course</label>
        <input type="text" id="_sr-name" placeholder="Ex : Tour de la Région">
        <label class="note-field-label">Priorité</label>
        <div class="note-type-chips" id="_sr-prio">
          <button type="button" class="note-type-chip active" data-prio="principal">Objectif</button>
          <button type="button" class="note-type-chip" data-prio="secondaire">Préparation</button>
        </div>
        <label class="note-field-label">Étapes (coche les activités)</label>
        <div class="ae-field-hint">Les activités cochées deviennent des compétitions de cette course. L'ordre des étapes suit la date (étape 1 = la plus ancienne).</div>
        <div class="sr-list">${rows || '<div class="modal-placeholder">Aucune activité.</div>'}</div>
        <label class="note-field-label">Aperçu des étapes</label>
        <div class="sr-preview" id="_sr-preview"></div>
      </div>
      <div class="day-modal-footer">
        <div style="flex:1;"></div>
        <button class="day-modal-cancel" type="button">Annuler</button>
        <button class="day-modal-save" type="button">Valider</button>
      </div>
    </div>`;
  document.body.appendChild(overlay);
  document.getElementById('_sr-name').value = presetEvent;

  let srPrio = 'principal';
  overlay.querySelectorAll('#_sr-prio .note-type-chip').forEach(chip => chip.addEventListener('click', () => {
    overlay.querySelectorAll('#_sr-prio .note-type-chip').forEach(c => c.classList.remove('active'));
    chip.classList.add('active');
    srPrio = chip.dataset.prio;
  }));

  const close = () => overlay.remove();
  const refreshPreview = () => {
    const checked = [...overlay.querySelectorAll('.sr-list input:checked')]
      .map(c => allActs.find(a => a.sbId === c.dataset.sbid))
      .filter(Boolean)
      .sort((x, y) => (x.iso < y.iso ? -1 : 1)); // chronologique
    const prev = document.getElementById('_sr-preview');
    prev.innerHTML = checked.length
      ? checked.map((a, i) => `<div class="sr-stage"><strong>Étape ${i + 1}</strong> · ${fmtD(a.iso)} — ${window._confirmEscape ? window._confirmEscape(a.name) : a.name}</div>`).join('')
      : '<div class="modal-placeholder">Coche au moins 2 activités.</div>';
  };
  overlay.querySelectorAll('.sr-list input').forEach(c => c.addEventListener('change', refreshPreview));
  refreshPreview();

  overlay.querySelector('.day-modal-close').addEventListener('click', close);
  overlay.querySelector('.day-modal-cancel').addEventListener('click', close);
  overlay.addEventListener('click', e => { if (e.target === overlay) close(); });

  overlay.querySelector('.day-modal-save').addEventListener('click', async () => {
    const name = document.getElementById('_sr-name').value.trim();
    if (!name) { if (window.appAlert) await window.appAlert({ title: 'Nom requis', message: 'Donne un nom à la course.' }); return; }
    const selected = [...overlay.querySelectorAll('.sr-list input:checked')].map(c => c.dataset.sbid);
    if (selected.length < 1 || !window.sb) { close(); return; }
    try {
      // Étapes sélectionnées (ordre chronologique) → activités en catégorie compétition
      const selActs = allActs.filter(a => selected.includes(a.sbId)).sort((x, y) => (x.iso < y.iso ? -1 : 1));
      await Promise.all(selActs.map(a => window.sb.from('activities').update({ category: 'competition', category_set_by_user: true }).eq('id', a.sbId)));
      // Supprime les compét "1 jour" (act-…) des activités qui deviennent des étapes
      await Promise.all(selActs.map(a => window.sb.from('competitions').delete().eq('client_id', 'act-' + a.sbId)));
      // UNE ligne dans le registre competitions reliant ces activités
      if (window.cloudSync && window.cloudSync.pushCompetitionRegistry) {
        await window.cloudSync.pushCompetitionRegistry({
          id: 'race-' + selActs[0].sbId,
          name,
          date: selActs[0].iso,                 // date = 1ʳᵉ étape
          sport: selActs[0].sport || null,
          priority: srPrio,
          activityIds: selActs.map(a => a.sbId),
        });
      }
      // Refléter category=competition dans DASHBOARD_DATA (source des rebuilds)
      const selSet = new Set(selActs.map(a => String(a.sbId)));
      if (window.DASHBOARD_DATA && window.DASHBOARD_DATA.days) {
        for (const d of window.DASHBOARD_DATA.days) {
          for (const a of (d.activities || [])) if (selSet.has(String(a._sbId))) a.category = 'competition';
        }
      }
      if (window.cloudSync && window.cloudSync.pullAllFromCloud) await window.cloudSync.pullAllFromCloud();
      if (window.__applyOverridesAndRerender) window.__applyOverridesAndRerender();
      if (typeof renderCompList === 'function') renderCompList();
    } catch (e) { console.warn('[stage race]', e.message || e); }
    close();
  });
}


// Construit le jour REALISE fusionne (data Strava + masquage + seances manuelles +
// competitions realisees), identique a ce qu'affiche le calendrier realise. Permet au
// clic sur un jour d'ouvrir exactement les memes activites que la carte.
export function buildRealisedDay(iso) {
  let realDay = (Array.isArray(appState.data) ? appState.data.find(d => toIsoDate(d.date) === iso) : null) || null;
  if (realDay && realDay.activities && typeof isStravaIgnored === 'function') {
    const filtered = realDay.activities.filter(a => {
      if (a._manual) return true;
      const aid = a.id || a.activityId;
      return !aid || !isStravaIgnored(aid);
    });
    if (filtered.length !== realDay.activities.length) realDay = filtered.length ? { ...realDay, activities: filtered } : null;
  }
  const manualRealised = (typeof loadRealisedTrainings === 'function') ? loadRealisedTrainings().filter(t => t.date === iso) : [];
  if (manualRealised.length > 0) {
    if (!realDay) realDay = { date: iso, activities: [], sessionType: 'autre' };
    else realDay = { ...realDay, activities: [...(realDay.activities || [])] };
    for (const m of manualRealised) {
      const _dbTwin = realDay.activities.some(x => (
        (m._sbId && String(x._sbId) === String(m._sbId)) ||
        (m.id && String(x.client_id) === String(m.id))
      ));
      if (_dbTwin) continue;
      const sportVal = m.sport || 'autre';
      realDay.activities.push({
        name: m.name, sport: sportVal, raw_type: sportVal,
        type: m.type || 'endurance', sessionType: m.type || 'endurance', sessionName: m.name,
        duration: m.duration || 0, tss: m.tss || 0,
        distance_km: m.km || null, elevation_gain: m.dplus || null,
        rpe: (m.rpe != null ? m.rpe : null), laps: (m.laps != null ? m.laps : null),
        gpxName: m.gpxName || null, gpxContent: m.gpxContent || null, structure: m.structure || null,
        _manual: true, _manualId: m.id, notes: m.notes || '',
      });
    }
  }
  const realisedComps = (typeof loadCompetitionsExpanded === 'function') ? loadCompetitionsExpanded().filter(compIsRealised) : [];
  const compsToday = realisedComps.filter(c => c.date === iso);
  if (compsToday.length > 0) {
    if (!realDay) realDay = { date: iso, activities: [], sessionType: 'vo2' };
    else realDay = { ...realDay, activities: [...(realDay.activities || [])] };
    for (const c of compsToday) {
      // Une vraie activité 'competition' existe déjà ce jour : le registre n'est
      // qu'un miroir -> ne JAMAIS ajouter de pseudo-entrée (durée 0) en plus.
      if (realDay.activities.some(x => x.category === 'competition' && !x._comp)) continue;
      // Compétition TRIATHLON dont l'enchaînement réalisé couvre le jour :
      // les 3 activités SONT la compétition -> pas de pseudo-entrée non plus.
      if (typeof getSportCategory === 'function' && getSportCategory(c.sport) === 'triathlon'
          && window.SportProfiles && window.SportProfiles.detectMultisport) {
        const _gg = window.SportProfiles.detectMultisport(realDay.activities.filter(x => !x._comp));
        if (_gg && _gg.legs.length >= 2) continue;
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
  }
  return realDay;
}

export function bootGpxRender() {


// === Rendu du profil d'altitude GPX via Chart.js (même look que les streams réalisés) ===
appState._gpxElevChart = null;


// === Rendu d'une trace GPX sur une vraie carte Leaflet (OpenStreetMap) ===
appState._gpxLeafletMap = null;
}
