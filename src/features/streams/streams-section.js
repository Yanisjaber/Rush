/* src/features/streams/streams-section.js — extrait de l'ancien app.js (découpage par fonctionnalité). */
import { appState } from '../../core/state.js';
import { bootSportDisplay } from '../sport/sport-display.js';
import { formatHMS, loadStreams, loadStreamsFromLS, streamsCache } from './streams-cache.js';
import { destroyModalCharts, smoothTooltipPlugin, wbalNegStripesPlugin } from './stream-overlay.js';



export async function renderStreamsSection(container, activityId) {
  destroyModalCharts();
  const cached = streamsCache[activityId] !== undefined || loadStreamsFromLS(activityId);
  container.innerHTML = `<div class="modal-placeholder">${cached ? '📊 Rendu depuis le cache local...' : '⏳ Téléchargement des streams depuis Strava...'}</div>`;

  const streams = await loadStreams(activityId);
  if (!streams) {
    container.innerHTML = '<div class="modal-placeholder">Pas de streams disponibles pour cette activité (ou erreur de chargement).</div>';
    return;
  }
  // Yield to browser pour afficher le message "Rendu..." avant de bloquer sur le render
  container.innerHTML = '<div class="modal-placeholder">📊 Rendu des graphiques...</div>';
  await new Promise(r => requestAnimationFrame(r));

  // intervals.icu peut renvoyer les streams sous 2 formats : array de {type,data} ou objet {watts:[], ...}
  const findStream = (type) => {
    if (Array.isArray(streams)) {
      const s = streams.find(x => x && x.type === type);
      return s ? s.data : null;
    }
    return streams[type] || null;
  };

  let watts = findStream('watts');
  let hr = findStream('heartrate');
  let cadence = findStream('cadence');
  const altitude = findStream('altitude');
  const distance = findStream('distance');
  const time = findStream('time');

  // Lissage 3 s (moyenne glissante centrée ±1 s = 3 points) sur Puissance, FC, Cadence
  // Pour adoucir le bruit instantané sans perdre les variations réelles.
  function smooth3s(arr) {
    if (!arr) return arr;
    const n = arr.length;
    const out = new Array(n);
    const win = 1;
    let sum = 0, count = 0;
    for (let i = 0; i <= win && i < n; i++) {
      if (arr[i] != null && !isNaN(arr[i])) { sum += arr[i]; count++; }
    }
    for (let i = 0; i < n; i++) {
      if (i > 0 && i + win < n && arr[i + win] != null && !isNaN(arr[i + win])) {
        sum += arr[i + win]; count++;
      }
      if (i - win - 1 >= 0 && arr[i - win - 1] != null && !isNaN(arr[i - win - 1])) {
        sum -= arr[i - win - 1]; count--;
      }
      out[i] = count > 0 ? sum / count : null;
    }
    return out;
  }
  // Lissage paramétré : 3s pour watts/FC, 9s pour cadence (plus stable visuellement)
  function smoothWin(arr, win) {
    if (!arr) return arr;
    const n = arr.length;
    const out = new Array(n);
    let sum = 0, count = 0;
    for (let i = 0; i <= win && i < n; i++) {
      if (arr[i] != null && !isNaN(arr[i])) { sum += arr[i]; count++; }
    }
    for (let i = 0; i < n; i++) {
      if (i > 0 && i + win < n && arr[i + win] != null && !isNaN(arr[i + win])) {
        sum += arr[i + win]; count++;
      }
      if (i - win - 1 >= 0 && arr[i - win - 1] != null && !isNaN(arr[i - win - 1])) {
        sum -= arr[i - win - 1]; count--;
      }
      out[i] = count > 0 ? sum / count : null;
    }
    return out;
  }
  var _wattsRaw = watts ? watts.slice() : null;   // brut
  // Watts NON lisses : affichage seconde par seconde (comme records/metriques).
  if (hr) hr = smoothWin(hr, 1);                // ±1 s = 3 s
  if (cadence) cadence = smoothWin(cadence, 4); // ±4 s = 9 s (plus stable)
  try {
    var _hrMaxA = (window.DASHBOARD_DATA && window.DASHBOARD_DATA.athlete && (+window.DASHBOARD_DATA.athlete.hr_max || +window.DASHBOARD_DATA.athlete.hrMax)) || 190;
    var _ftpA = (window.DASHBOARD_DATA && window.DASHBOARD_DATA.athlete && +window.DASHBOARD_DATA.athlete.ftp) || 250;
    window.__lastStreams = { watts: watts ? watts.slice() : null, wattsRaw: _wattsRaw, hr: hr ? hr.slice() : null, cadence: cadence ? cadence.slice() : null, altitude: altitude ? altitude.slice() : null, distance: distance ? distance.slice() : null, time: time ? time.slice() : null, ftp: _ftpA, hrMax: _hrMaxA };
    // Adhérence par intervalle (Prévu vs Réalisé V2) : les streams viennent d'arriver
    if (window.fillAdherenceSlot) setTimeout(window.fillAdherenceSlot, 50);
  } catch (e) { }

  const length = (watts && watts.length) || (hr && hr.length) || (cadence && cadence.length) || 0;
  if (length === 0) {
    container.innerHTML = '<div class="modal-placeholder">Aucun stream haute résolution n\'est disponible pour cette activité (séance peut-être sans capteur).</div>';
    return;
  }

  // Choix de l'axe X : distance (km) si dispo, sinon temps (h/m/s).
  const useDistance = distance && distance.length === length && distance[distance.length - 1] > 0;
  const fullTime = Array.from({ length }, (_, i) => i);
  const fullX = useDistance ? distance : fullTime;

  // PAS de downsampling manuel : on garde la résolution complète seconde par seconde.
  // Chart.js avec le plugin decimation (LTTB) gérera l'affichage : décime à ~1500 points
  // pour la performance, mais redécime à la résolution réelle au zoom in.

  // Formatter de l'axe X : ticks SANS unite (le 'km' est le titre de l'axe,
  // affiche une seule fois sous le graphe)
  const fmtXTick = useDistance
    ? (val) => (val / 1000).toFixed(2)
    : (val) => formatHMS(val);
  const fmtXTooltip = useDistance
    ? (val) => (val / 1000).toFixed(2) + ' km'
    : (val) => formatHMS(val);
  const fmtX = fmtXTick;
  // Expose au plugin smoothTooltip pour formater le titre du tooltip
  window._streamsFmtXTooltip = fmtXTooltip;
  // Expose pour le calcul de la pente (% uniquement si X est la distance)
  window._streamsUseDistance = useDistance;

  // Pairs {x,y} pour Chart.js (à connaître avant le template innerHTML)
  const pairs = (yArr) => {
    if (!yArr) return [];
    const out = [];
    for (let i = 0; i < fullX.length; i++) {
      if (yArr[i] != null && !isNaN(yArr[i])) out.push({ x: fullX[i], y: yArr[i] });
    }
    return out;
  };
  // === W'bal (modèle Skiba 2012) : réserve anaérobie au cours de l'effort ===
  // CP ≈ FTP, W' = 20 kJ par défaut (réserve typique cycliste entraîné).
  const cp = (window._athleteMeta && window._athleteMeta.ftp) || 250;
  const wPrime = 20000; // J
  function computeWbal(wattsArr) {
    if (!wattsArr || !cp || cp < 50) return null;
    const n = wattsArr.length;
    const out = new Array(n);
    let wbal = wPrime;
    for (let i = 0; i < n; i++) {
      const p = wattsArr[i] || 0;
      if (p > cp) {
        wbal -= (p - cp);
      } else {
        // Recovery : tau = 546·e^(-0.01·ΔCP) + 316 (Skiba)
        const deltaCP = cp - p;
        const tau = 546 * Math.exp(-0.01 * deltaCP) + 316;
        wbal = wPrime - (wPrime - wbal) * Math.exp(-1 / tau);
      }
      // On ne clampe plus à 0 : si le rider creuse dans la réserve au-delà de W',
      // le W'bal devient négatif (signe qu'il est "dans le rouge" selon le modèle).
      // Plafond max conservé pour pas dépasser W' physiologiquement.
      wbal = Math.min(wPrime, wbal);
      out[i] = wbal;
    }
    return out;
  }

  // === Vitesse instantanée (km/h) doublement lissée pour absorber le bruit GPS ===
  // Pass 1 : moyenne glissante ±15s (smooth les pics GPS courts)
  // Pass 2 : moyenne glissante ±15s sur la sortie du pass 1 (lissage 2nd ordre)
  // → Équivalent à un filtre gaussien plus stable qu'une grosse fenêtre simple
  function computeSpeed(distArr) {
    if (!distArr || distArr.length !== length) return null;
    const raw = new Array(length);
    for (let i = 1; i < length; i++) {
      raw[i] = Math.max(0, (distArr[i] - distArr[i - 1])); // m/s
    }
    raw[0] = raw[1] || 0;

    function smoothPass(arr, win) {
      const n = arr.length;
      const out = new Array(n);
      let sum = 0, count = 0;
      for (let i = 0; i <= win && i < n; i++) { sum += arr[i]; count++; }
      for (let i = 0; i < n; i++) {
        if (i > 0 && i + win < n) { sum += arr[i + win]; count++; }
        if (i - win - 1 >= 0) { sum -= arr[i - win - 1]; count--; }
        out[i] = count > 0 ? sum / count : 0;
      }
      return out;
    }

    const pass1 = smoothPass(raw, 15);
    const pass2 = smoothPass(pass1, 15);
    return pass2.map(v => v * 3.6); // m/s → km/h
  }

  const wbal = computeWbal(watts);
  const speed = computeSpeed(distance);

  const wattsPts = pairs(watts);
  const hrPts = pairs(hr);
  const cadencePts = pairs(cadence);
  const altPts = pairs(altitude);
  const wbalPts = pairs(wbal);
  const speedPts = pairs(speed);

  const _ftp = (window.DASHBOARD_DATA && window.DASHBOARD_DATA.athlete && +window.DASHBOARD_DATA.athlete.ftp) || 250;
  const _detected = (watts && watts.length && window.detectRideSequences) ? window.detectRideSequences(watts, _ftp) : [];
  const _profHTML = (_detected.length && window.renderWorkoutProfileHTML)
    ? '<div class="modal-section"><div class="modal-section-title">Profil de séance</div>'
      + window.renderWorkoutProfileHTML(_detected, { minFlex: 0.004, labels: false, readout: true, sport: window.__lastActSport })
      + '</div>'
    : '';
  // Bouton TOUJOURS présent dès qu'il y a des streams (avant : seulement si un
  // profil de puissance existait -> natation/course n'avaient AUCUN accès à l'analyse).
  const _toggleHTML = '<button id="toggle-detailed" type="button" style="width:100%;background:var(--bg-elev2);border:1px solid var(--border);color:var(--text-dim);border-radius:9px;padding:11px;font-size:13px;font-weight:600;cursor:pointer;font-family:inherit;margin:6px 0 14px;display:inline-flex;align-items:center;justify-content:center;gap:8px;">Voir l\'analyse détaillée</button>';
  try { var _stray = document.getElementById('detailed-charts'); if (_stray) _stray.remove(); } catch (e) { }
  container.innerHTML = _profHTML + _toggleHTML + '<div id="detailed-charts">' + `
    <div style="display:flex;gap:22px;flex-wrap:wrap;align-items:center;margin-bottom:14px;font-size:12px;color:var(--text-dim);">
      <div style="display:inline-flex;gap:6px;align-items:baseline;">Temps : <strong id="stat-temps" style="color:var(--text);font-size:14px;min-width:70px;text-align:left;display:inline-block;">—</strong></div>
      <div style="display:inline-flex;gap:6px;align-items:baseline;">Distance : <strong id="stat-dist" style="color:var(--text);font-size:14px;min-width:80px;text-align:left;display:inline-block;">—</strong></div>
      <button id="streams-zoom-reset" style="margin-left:auto;visibility:hidden;background:var(--bg-elev2);border:1px solid var(--border);color:var(--text-dim);padding:4px 10px;border-radius:5px;font-size:11px;cursor:pointer;font-family:inherit;">Réinitialiser le zoom</button>
    </div>
    ${(wattsPts.length || hrPts.length) ? `
      <div id="power-hr-header" style="display:grid;grid-template-columns:1fr auto 1fr;align-items:center;font-size:10px;margin-bottom:6px;padding-left:55px;padding-right:60px;gap:8px;overflow:hidden;">
        <div style="display:flex;gap:6px;align-items:center;flex-wrap:nowrap;color:var(--text-dim);min-width:0;">
          <span style="white-space:nowrap;display:inline-flex;gap:4px;align-items:baseline;"><span style="color:#fbbf24;">moy</span> <strong id="stat-wmoy" style="color:var(--text);font-size:11px;min-width:44px;text-align:left;display:inline-block;">—</strong></span>
          <span style="white-space:nowrap;display:inline-flex;gap:4px;align-items:baseline;"><span style="color:#fbbf24;">max</span> <strong id="stat-wmaxx" style="color:var(--text);font-size:11px;min-width:44px;text-align:left;display:inline-block;">—</strong></span>
        </div>
        <div id="custom-legend-powerhr" style="display:flex;gap:10px;align-items:center;flex-shrink:0;">
          ${wattsPts.length ? `<button class="cl-btn-phr" data-idx="0" data-yax="y" data-color="#fbbf24" style="background:transparent;border:none;color:var(--text);font-size:13px;font-weight:600;cursor:pointer;display:inline-flex;align-items:center;gap:6px;font-family:inherit;padding:0;white-space:nowrap;">
            <span class="cl-box" style="width:9px;height:9px;background:#fbbf24;border:1.5px solid #fbbf24;border-radius:2px;display:inline-block;"></span>Puissance
          </button>` : ''}
          ${hrPts.length ? `<button class="cl-btn-phr" data-idx="${wattsPts.length ? 1 : 0}" data-yax="y1" data-color="#f87171" style="background:transparent;border:none;color:var(--text);font-size:13px;font-weight:600;cursor:pointer;display:inline-flex;align-items:center;gap:6px;font-family:inherit;padding:0;white-space:nowrap;">
            <span class="cl-box" style="width:9px;height:9px;background:#f87171;border:1.5px solid #f87171;border-radius:2px;display:inline-block;"></span>FC
          </button>` : ''}
        </div>
        <div style="display:flex;gap:9px;align-items:center;flex-wrap:nowrap;color:var(--text-dim);justify-self:end;">
          <span style="white-space:nowrap;"><span style="color:#f87171;">moy</span> <strong id="stat-fcmoy" style="color:var(--text);font-size:11px;">—</strong></span>
          <span style="white-space:nowrap;"><span style="color:#f87171;">max</span> <strong id="stat-fcmaxx" style="color:var(--text);font-size:11px;">—</strong></span>
        </div>
      </div>
      <div class="chart-wrap" style="height:180px;margin-bottom:14px;"><canvas id="streams-power-hr"></canvas></div>` : ''}
    ${wbalPts.length ? `
      <div id="wbal-header" style="display:grid;grid-template-columns:1fr auto 1fr;align-items:center;font-size:10px;margin-bottom:6px;padding-left:55px;padding-right:60px;gap:8px;overflow:hidden;">
        <div style="display:flex;gap:6px;align-items:center;flex-wrap:nowrap;color:var(--text-dim);min-width:0;">
          <span style="white-space:nowrap;display:inline-flex;gap:4px;align-items:baseline;"><span style="color:#60a5fa;">moy</span> <strong id="stat-wbalmoy" style="color:var(--text);font-size:11px;min-width:44px;text-align:left;display:inline-block;">—</strong></span>
          <span style="white-space:nowrap;display:inline-flex;gap:4px;align-items:baseline;"><span style="color:#60a5fa;">min</span> <strong id="stat-wbalmin" style="color:var(--text);font-size:11px;min-width:44px;text-align:left;display:inline-block;">—</strong></span>
        </div>
        <div id="custom-legend-wbal" style="display:flex;gap:10px;align-items:center;flex-shrink:0;">
          <button class="cl-btn-wbal" data-idx="0" data-yax="y" data-color="#60a5fa" style="background:transparent;border:none;color:var(--text);font-size:13px;font-weight:600;cursor:pointer;display:inline-flex;align-items:center;gap:6px;font-family:inherit;padding:0;white-space:nowrap;">
            <span class="cl-box" style="width:9px;height:9px;background:#60a5fa;border:1.5px solid #60a5fa;border-radius:2px;display:inline-block;"></span>W'bal
          </button>
        </div>
        <div style="justify-self:end;"></div>
      </div>
      <div class="chart-wrap" style="height:180px;margin-bottom:14px;"><canvas id="streams-wbal"></canvas></div>` : ''}
    ${cadencePts.length ? `
      <div id="cadence-header" style="display:grid;grid-template-columns:1fr auto 1fr;align-items:center;font-size:10px;margin-bottom:6px;padding-left:55px;padding-right:60px;gap:8px;overflow:hidden;">
        <div style="display:flex;gap:6px;align-items:center;flex-wrap:nowrap;color:var(--text-dim);min-width:0;">
          <span style="white-space:nowrap;display:inline-flex;gap:4px;align-items:baseline;"><span style="color:#a78bfa;">moy</span> <strong id="stat-cmoy" style="color:var(--text);font-size:11px;min-width:44px;text-align:left;display:inline-block;">—</strong></span>
          <span style="white-space:nowrap;display:inline-flex;gap:4px;align-items:baseline;"><span style="color:#a78bfa;">max</span> <strong id="stat-cmaxx" style="color:var(--text);font-size:11px;min-width:44px;text-align:left;display:inline-block;">—</strong></span>
        </div>
        <div id="custom-legend-cadence" style="display:flex;gap:10px;align-items:center;flex-shrink:0;">
          <button class="cl-btn-cad" data-idx="0" data-yax="y" data-color="#a78bfa" style="background:transparent;border:none;color:var(--text);font-size:13px;font-weight:600;cursor:pointer;display:inline-flex;align-items:center;gap:6px;font-family:inherit;padding:0;white-space:nowrap;">
            <span class="cl-box" style="width:9px;height:9px;background:#a78bfa;border:1.5px solid #a78bfa;border-radius:2px;display:inline-block;"></span>Cadence
          </button>
        </div>
        <div style="justify-self:end;"></div>
      </div>
      <div class="chart-wrap" style="height:180px;margin-bottom:14px;"><canvas id="streams-cadence"></canvas></div>` : ''}
    ${(speedPts.length || altPts.length) ? `
      <div id="speed-alt-header" style="display:grid;grid-template-columns:1fr auto 1fr;align-items:center;font-size:10px;margin-bottom:6px;padding-left:55px;padding-right:60px;gap:8px;overflow:hidden;">
        <div style="display:flex;gap:6px;align-items:center;flex-wrap:nowrap;color:var(--text-dim);min-width:0;">
          <span style="white-space:nowrap;display:inline-flex;gap:4px;align-items:baseline;"><span style="color:#4ade80;">D+</span> <strong id="stat-dplus" style="color:var(--text);font-size:11px;min-width:44px;text-align:left;display:inline-block;">—</strong></span>
          <span style="white-space:nowrap;display:inline-flex;gap:4px;align-items:baseline;"><span style="color:#4ade80;">D-</span> <strong id="stat-dminus" style="color:var(--text);font-size:11px;min-width:44px;text-align:left;display:inline-block;">—</strong></span>
          <span id="stat-slope-wrap" style="display:none;white-space:nowrap;gap:6px;align-items:center;">
            <span style="display:inline-flex;gap:4px;align-items:baseline;"><span style="color:#4ade80;">moy</span> <strong id="stat-slopeavg" style="color:var(--text);font-size:11px;min-width:38px;text-align:left;display:inline-block;">—</strong></span>
            <span style="display:inline-flex;gap:4px;align-items:baseline;"><span style="color:#4ade80;">max</span> <strong id="stat-slopemax" style="color:var(--text);font-size:11px;min-width:38px;text-align:left;display:inline-block;">—</strong></span>
          </span>
        </div>
        <div id="custom-legend-altspeed" style="display:flex;gap:10px;align-items:center;flex-shrink:0;">
          ${altPts.length ? `<button class="cl-btn" data-idx="0" data-yax="y1" data-color="#4ade80" style="background:transparent;border:none;color:var(--text);font-size:13px;font-weight:600;cursor:pointer;display:inline-flex;align-items:center;gap:6px;font-family:inherit;padding:0;white-space:nowrap;">
            <span class="cl-box" style="width:9px;height:9px;background:#4ade80;border:1.5px solid #4ade80;border-radius:2px;display:inline-block;"></span>Altitude
          </button>` : ''}
          ${speedPts.length ? `<button class="cl-btn" data-idx="${altPts.length ? 1 : 0}" data-yax="y" data-color="#22d3ee" style="background:transparent;border:none;color:var(--text);font-size:13px;font-weight:600;cursor:pointer;display:inline-flex;align-items:center;gap:6px;font-family:inherit;padding:0;white-space:nowrap;">
            <span class="cl-box" style="width:9px;height:9px;background:#22d3ee;border:1.5px solid #22d3ee;border-radius:2px;display:inline-block;"></span>Vitesse
          </button>` : ''}
        </div>
        <div style="display:flex;gap:9px;align-items:center;flex-wrap:nowrap;color:var(--text-dim);justify-self:end;">
          <span style="white-space:nowrap;"><span style="color:#22d3ee;">moy</span> <strong id="stat-vmoy" style="color:var(--text);font-size:11px;">—</strong></span>
          <span style="white-space:nowrap;"><span style="color:#22d3ee;">max</span> <strong id="stat-vmax" style="color:var(--text);font-size:11px;">—</strong></span>
        </div>
      </div>
      <div class="chart-wrap" style="height:180px;"><canvas id="streams-speed-alt"></canvas></div>` : ''}
  ` + '</div>';

  // Compute stats sur la plage [minX, maxX] (en m si distance, en s si temps)
  // Utilise les FULL streams (pas downsampled) pour la précision.
  function computeStats(minX, maxX) {
    // Trouver les indices borne
    let firstIdx = -1, lastIdx = -1;
    for (let i = 0; i < fullX.length; i++) {
      if (firstIdx === -1 && fullX[i] >= minX) firstIdx = i;
      if (fullX[i] <= maxX) lastIdx = i;
    }
    if (firstIdx === -1 || lastIdx < firstIdx) return null;

    // Temps écoulé : vrai flux time si dispo (les streams ne sont PAS toujours
    // échantillonnés à 1 Hz — smart recording Garmin, résolution réduite Strava…),
    // sinon repli 1 sample = 1 s.
    const timeElapsed = (time && time.length > lastIdx && time[lastIdx] != null && time[firstIdx] != null)
      ? (time[lastIdx] - time[firstIdx])
      : (lastIdx - firstIdx);

    // Distance parcourue
    let distCov = null;
    if (distance && distance.length === length) {
      distCov = (distance[lastIdx] - distance[firstIdx]) / 1000;
    }

    // Avg watts
    let wSum = 0, wCount = 0;
    if (watts) {
      for (let i = firstIdx; i <= lastIdx; i++) {
        const v = watts[i];
        if (v != null && !isNaN(v)) { wSum += v; wCount++; }
      }
    }
    const avgW = wCount > 0 ? Math.round(wSum / wCount) : null;

    // Avg HR
    let hSum = 0, hCount = 0;
    if (hr) {
      for (let i = firstIdx; i <= lastIdx; i++) {
        const v = hr[i];
        if (v != null && !isNaN(v)) { hSum += v; hCount++; }
      }
    }
    const avgH = hCount > 0 ? Math.round(hSum / hCount) : null;

    return { timeElapsed, distCov, avgW, avgH };
  }

  function renderStats(stats) {
    const tEl = document.getElementById('stat-temps');
    const dEl = document.getElementById('stat-dist');
    if (tEl) tEl.textContent = stats && stats.timeElapsed != null ? formatHMS(stats.timeElapsed) : '—';
    if (dEl) {
      if (stats && stats.distCov != null) {
        dEl.textContent = stats.distCov < 1
          ? Math.round(stats.distCov * 1000) + ' m'
          : stats.distCov.toFixed(2) + ' km';
      } else {
        dEl.textContent = '—';
      }
    }
  }

  // === Stats Altitude + Vitesse (au-dessus du chart speed-alt) ===
  function computeAltSpeedStats(minX, maxX) {
    if (!fullX || !fullX.length) return null;
    let firstIdx = -1, lastIdx = -1;
    for (let i = 0; i < fullX.length; i++) {
      if (firstIdx === -1 && fullX[i] >= minX) firstIdx = i;
      if (fullX[i] <= maxX) lastIdx = i;
    }
    if (firstIdx === -1 || lastIdx < firstIdx) return null;

    let dPlus = 0, dMinus = 0, altMax = null;
    let vSum = 0, vCount = 0, vMax = 0;
    let prevAlt = null;
    for (let i = firstIdx; i <= lastIdx; i++) {
      if (altitude && altitude[i] != null && !isNaN(altitude[i])) {
        const a = altitude[i];
        if (altMax === null || a > altMax) altMax = a;
        if (prevAlt != null) {
          const dA = a - prevAlt;
          if (dA > 0) dPlus += dA; else dMinus += -dA;
        }
        prevAlt = a;
      }
      if (speed && speed[i] != null && !isNaN(speed[i])) {
        vSum += speed[i]; vCount++;
        if (speed[i] > vMax) vMax = speed[i];
      }
    }

    // Slope stats : uniquement si zoomé (vue restreinte vs activité totale) ET distance dispo
    const fullSpan = fullX[fullX.length - 1] - fullX[0];
    const visSpan = maxX - minX;
    const isZoomed = visSpan < fullSpan * 0.97;
    let slopeAvg = null, slopeMax = null;
    if (useDistance && isZoomed && altitude && distance && lastIdx > firstIdx) {
      // Slope avg = pente nette du début à la fin de la section
      let fv = -1, lv = -1;
      for (let i = firstIdx; i <= lastIdx; i++) {
        if (altitude[i] != null && !isNaN(altitude[i]) && distance[i] != null) {
          if (fv === -1) fv = i;
          lv = i;
        }
      }
      if (fv !== -1 && lv > fv) {
        const dD = distance[lv] - distance[fv];
        if (dD > 0) slopeAvg = (altitude[lv] - altitude[fv]) / dD * 100;
      }
      // Slope max = pente la plus raide sur fenêtre glissante ±50m
      const winM = 50;
      for (let i = firstIdx; i <= lastIdx; i++) {
        if (altitude[i] == null) continue;
        const xVal = fullX[i];
        const tLo = xVal - winM, tHi = xVal + winM;
        let lo = firstIdx, hi = lastIdx;
        while (lo < hi) {
          const m = (lo + hi) >> 1;
          if (fullX[m] < tLo) lo = m + 1; else hi = m;
        }
        const i1 = lo;
        lo = firstIdx; hi = lastIdx;
        while (lo < hi) {
          const m = (lo + hi + 1) >> 1;
          if (fullX[m] > tHi) hi = m - 1; else lo = m;
        }
        const i2 = lo;
        if (i2 > i1 && altitude[i1] != null && altitude[i2] != null) {
          const dD = fullX[i2] - fullX[i1];
          if (dD > 0) {
            const sl = (altitude[i2] - altitude[i1]) / dD * 100;
            if (slopeMax === null || sl > slopeMax) slopeMax = sl;
          }
        }
      }
    }
    return {
      dPlus: Math.round(dPlus),
      dMinus: Math.round(dMinus),
      altMax: altMax !== null ? Math.round(altMax) : null,
      vAvg: vCount > 0 ? vSum / vCount : null,
      vMax: vMax > 0 ? vMax : null,
      slopeAvg, slopeMax, isZoomed
    };
  }

  function renderAltSpeedStats(s) {
    const set = (id, val) => { const el = document.getElementById(id); if (el) el.textContent = val; };
    if (!s) {
      ['stat-dplus','stat-dminus','stat-altmax','stat-vmoy','stat-vmax'].forEach(id => set(id, '—'));
      const w = document.getElementById('stat-slope-wrap'); if (w) w.style.display = 'none';
      return;
    }
    set('stat-dplus', s.dPlus + ' m');
    set('stat-dminus', s.dMinus + ' m');
    set('stat-altmax', s.altMax !== null ? s.altMax + ' m' : '—');
    // course / natation : la vitesse se lit en allure (min/km, min/100m)
    const _vCat = window.__lastActSport;
    if (_vCat === 'course' || _vCat === 'natation') {
      const _p100 = _vCat === 'natation';
      const _kmhToPace = (v) => { const sec = (_p100 ? 360 : 3600) / v; return Math.floor(sec / 60) + ':' + String(Math.round(sec % 60)).padStart(2, '0') + (_p100 ? ' /100m' : ' /km'); };
      set('stat-vmoy', s.vAvg ? _kmhToPace(s.vAvg) : '—');
      set('stat-vmax', s.vMax ? _kmhToPace(s.vMax) : '—');
    } else {
      set('stat-vmoy', s.vAvg !== null ? s.vAvg.toFixed(1) + ' km/h' : '—');
      set('stat-vmax', s.vMax !== null ? s.vMax.toFixed(1) + ' km/h' : '—');
    }
    const wrap = document.getElementById('stat-slope-wrap');
    if (wrap) {
      if (s.isZoomed && s.slopeAvg !== null && s.slopeMax !== null) {
        wrap.style.display = 'inline-flex';
        set('stat-slopeavg', (s.slopeAvg >= 0 ? '+' : '') + s.slopeAvg.toFixed(1) + '%');
        set('stat-slopemax', (s.slopeMax >= 0 ? '+' : '') + s.slopeMax.toFixed(1) + '%');
      } else {
        wrap.style.display = 'none';
      }
    }
  }

  // === Stats Puissance + FC ===
  function computePowerHRStats(minX, maxX) {
    if (!fullX || !fullX.length) return null;
    let firstIdx = -1, lastIdx = -1;
    for (let i = 0; i < fullX.length; i++) {
      if (firstIdx === -1 && fullX[i] >= minX) firstIdx = i;
      if (fullX[i] <= maxX) lastIdx = i;
    }
    if (firstIdx === -1 || lastIdx < firstIdx) return null;
    let wSum = 0, wCount = 0, wMax = 0;
    let hSum = 0, hCount = 0, hMax = 0;
    for (let i = firstIdx; i <= lastIdx; i++) {
      if (watts && watts[i] != null && !isNaN(watts[i])) {
        wSum += watts[i]; wCount++;
        if (watts[i] > wMax) wMax = watts[i];
      }
      if (hr && hr[i] != null && !isNaN(hr[i])) {
        hSum += hr[i]; hCount++;
        if (hr[i] > hMax) hMax = hr[i];
      }
    }
    return {
      wAvg: wCount > 0 ? Math.round(wSum / wCount) : null,
      wMax: wMax > 0 ? Math.round(wMax) : null,
      hAvg: hCount > 0 ? Math.round(hSum / hCount) : null,
      hMax: hMax > 0 ? Math.round(hMax) : null,
    };
  }
  function renderPowerHRStats(s) {
    const set = (id, val) => { const el = document.getElementById(id); if (el) el.textContent = val; };
    if (!s) {
      ['stat-wmoy','stat-wmaxx','stat-fcmoy','stat-fcmaxx'].forEach(id => set(id, '—'));
      return;
    }
    set('stat-wmoy', s.wAvg !== null ? s.wAvg + ' w' : '—');
    set('stat-wmaxx', s.wMax !== null ? s.wMax + ' w' : '—');
    set('stat-fcmoy', s.hAvg !== null ? s.hAvg + ' bpm' : '—');
    set('stat-fcmaxx', s.hMax !== null ? s.hMax + ' bpm' : '—');
  }

  // === Stats W'bal (moyenne + min en kJ) ===
  function computeWbalStats(minX, maxX) {
    if (!fullX || !fullX.length || !wbal) return null;
    let firstIdx = -1, lastIdx = -1;
    for (let i = 0; i < fullX.length; i++) {
      if (firstIdx === -1 && fullX[i] >= minX) firstIdx = i;
      if (fullX[i] <= maxX) lastIdx = i;
    }
    if (firstIdx === -1 || lastIdx < firstIdx) return null;
    let wSum = 0, wCount = 0, wMin = Infinity;
    for (let i = firstIdx; i <= lastIdx; i++) {
      if (wbal[i] != null && !isNaN(wbal[i])) {
        wSum += wbal[i]; wCount++;
        if (wbal[i] < wMin) wMin = wbal[i];
      }
    }
    return {
      avg: wCount > 0 ? wSum / wCount : null,
      min: wMin !== Infinity ? wMin : null,
    };
  }
  function renderWbalStats(s) {
    const set = (id, val) => { const el = document.getElementById(id); if (el) el.textContent = val; };
    if (!s) { ['stat-wbalmoy','stat-wbalmin'].forEach(id => set(id, '—')); return; }
    set('stat-wbalmoy', s.avg !== null ? (s.avg / 1000).toFixed(1) + ' kJ' : '—');
    set('stat-wbalmin', s.min !== null ? (s.min / 1000).toFixed(1) + ' kJ' : '—');
  }

  // === Stats Cadence ===
  function computeCadenceStats(minX, maxX) {
    if (!fullX || !fullX.length) return null;
    let firstIdx = -1, lastIdx = -1;
    for (let i = 0; i < fullX.length; i++) {
      if (firstIdx === -1 && fullX[i] >= minX) firstIdx = i;
      if (fullX[i] <= maxX) lastIdx = i;
    }
    if (firstIdx === -1 || lastIdx < firstIdx) return null;
    let cSum = 0, cCount = 0, cMax = 0;
    for (let i = firstIdx; i <= lastIdx; i++) {
      if (cadence && cadence[i] != null && !isNaN(cadence[i]) && cadence[i] > 0) {
        cSum += cadence[i]; cCount++;
        if (cadence[i] > cMax) cMax = cadence[i];
      }
    }
    return {
      cAvg: cCount > 0 ? Math.round(cSum / cCount) : null,
      cMax: cMax > 0 ? Math.round(cMax) : null,
    };
  }
  function renderCadenceStats(s) {
    const set = (id, val) => { const el = document.getElementById(id); if (el) el.textContent = val; };
    if (!s) { ['stat-cmoy','stat-cmaxx'].forEach(id => set(id, '—')); return; }
    set('stat-cmoy', s.cAvg !== null ? s.cAvg + ' rpm' : '—');
    set('stat-cmaxx', s.cMax !== null ? s.cMax + ' rpm' : '—');
  }

  // Stats initiales : toute la plage
  setTimeout(() => {
    renderStats(computeStats(fullX[0], fullX[fullX.length - 1]));
    renderAltSpeedStats(computeAltSpeedStats(fullX[0], fullX[fullX.length - 1]));
    renderPowerHRStats(computePowerHRStats(fullX[0], fullX[fullX.length - 1]));
    renderCadenceStats(computeCadenceStats(fullX[0], fullX[fullX.length - 1]));
    renderWbalStats(computeWbalStats(fullX[0], fullX[fullX.length - 1]));
  }, 0);

  // Expose pour syncZoomToOthers
  window._streamsComputeStats = computeStats;
  window._streamsRenderStats = renderStats;
  window._streamsComputeAltSpeedStats = computeAltSpeedStats;
  window._streamsRenderAltSpeedStats = renderAltSpeedStats;
  window._streamsComputePowerHRStats = computePowerHRStats;
  window._streamsRenderPowerHRStats = renderPowerHRStats;
  window._streamsComputeCadenceStats = computeCadenceStats;
  window._streamsRenderCadenceStats = renderCadenceStats;
  window._streamsComputeWbalStats = computeWbalStats;
  window._streamsRenderWbalStats = renderWbalStats;

  // Bornes réelles de l'activité (évite l'auto-scaling qui rajoute des km fantômes)
  const xMin = fullX[0];
  const xMax = fullX[fullX.length - 1];

  // Axe X linéaire : positions proportionnelles à la distance (ou au temps)
  const _mobileCharts = window.innerWidth <= 860;
  const sharedX = {
    type: 'linear',
    min: xMin,
    max: xMax,
    title: useDistance ? { display: true, text: 'km', color: '#6b7686', font: { size: 10 }, padding: { top: 2 } } : undefined,
    ticks: {
      maxTicksLimit: _mobileCharts ? 6 : 8,
      callback: (val) => fmtXTick(val),
      font: { size: 10 }
    },
    grid: { display: false }
  };
  // Tooltip : affiche la valeur réelle de X (km ou temps), pas l'index
  const tooltipTitle = (items) => fmtXTooltip(items[0].parsed.x);

  // Plugin decimation : redécime intelligemment selon la zone visible (LTTB préserve les pics)
  const decimationConfig = {
    enabled: true,
    algorithm: 'lttb',
    samples: 1500,
    threshold: 1500
  };

  // Y axis ticks : valeurs entières (pas de décimales)
  const intY = { ticks: { callback: (v) => Math.round(v) } };
  // Tooltip label : arrondi à l'entier
  const labelInt = (ctx) => `${ctx.dataset.label}: ${Math.round(ctx.parsed.y)}`;

  // Config zoom : drag pour zoomer, double-clic pour reset, sync entre les 3 charts
  const syncZoomToOthers = (sourceChart) => {
    const { min, max } = sourceChart.scales.x;
    appState._modalCharts.forEach(c => {
      if (c === sourceChart || !c.scales.x) return;
      c.options.scales.x.min = min;
      c.options.scales.x.max = max;
      c.update('none');
    });
    // Afficher le bouton "Réinitialiser le zoom" si on est zoomé
    const fullSpan = fullX[fullX.length - 1] - fullX[0];
    const visSpan = max - min;
    const isZoomed = visSpan < fullSpan * 0.97;
    const btn = document.getElementById('streams-zoom-reset');
    if (btn) btn.style.visibility = isZoomed ? 'visible' : 'hidden';
    // Recalculer les stats sur la nouvelle plage visible
    if (window._streamsComputeStats && window._streamsRenderStats) {
      window._streamsRenderStats(window._streamsComputeStats(min, max));
    }
    if (window._streamsComputeAltSpeedStats && window._streamsRenderAltSpeedStats) {
      window._streamsRenderAltSpeedStats(window._streamsComputeAltSpeedStats(min, max));
    }
    if (window._streamsComputePowerHRStats && window._streamsRenderPowerHRStats) {
      window._streamsRenderPowerHRStats(window._streamsComputePowerHRStats(min, max));
    }
    if (window._streamsComputeCadenceStats && window._streamsRenderCadenceStats) {
      window._streamsRenderCadenceStats(window._streamsComputeCadenceStats(min, max));
    }
    if (window._streamsComputeWbalStats && window._streamsRenderWbalStats) {
      window._streamsRenderWbalStats(window._streamsComputeWbalStats(min, max));
    }
  };
  const zoomConfig = {
    zoom: {
      drag: {
        enabled: true,
        backgroundColor: 'rgba(74, 222, 128, 0.15)',
        borderColor: 'rgba(74, 222, 128, 0.5)',
        borderWidth: 1
      },
      mode: 'x',
      onZoomComplete: ({ chart }) => syncZoomToOthers(chart)
    },
    pan: {
      enabled: true,
      mode: 'x',
      modifierKey: 'shift', // pan avec Shift+drag (sinon le drag normal zoome)
      onPanComplete: ({ chart }) => syncZoomToOthers(chart)
    },
    limits: { x: { min: 'original', max: 'original' } }
  };

  // Double-clic sur n'importe quel chart → reset zoom partout + stats sur plage complète
  setTimeout(() => {
    const resetAll = () => {
      appState._modalCharts.forEach(c => { try { c.resetZoom(); } catch (e) {} });
      // Recalculer stats sur la plage complète après reset
      if (window._streamsComputeStats && window._streamsRenderStats) {
        window._streamsRenderStats(window._streamsComputeStats(fullX[0], fullX[fullX.length - 1]));
      }
      if (window._streamsComputeAltSpeedStats && window._streamsRenderAltSpeedStats) {
        window._streamsRenderAltSpeedStats(window._streamsComputeAltSpeedStats(fullX[0], fullX[fullX.length - 1]));
      }
      if (window._streamsComputePowerHRStats && window._streamsRenderPowerHRStats) {
        window._streamsRenderPowerHRStats(window._streamsComputePowerHRStats(fullX[0], fullX[fullX.length - 1]));
      }
      if (window._streamsComputeCadenceStats && window._streamsRenderCadenceStats) {
        window._streamsRenderCadenceStats(window._streamsComputeCadenceStats(fullX[0], fullX[fullX.length - 1]));
      }
      if (window._streamsComputeWbalStats && window._streamsRenderWbalStats) {
        window._streamsRenderWbalStats(window._streamsComputeWbalStats(fullX[0], fullX[fullX.length - 1]));
      }
      // Cacher le bouton "Réinitialiser le zoom" après reset
      const btn = document.getElementById('streams-zoom-reset');
      if (btn) btn.style.visibility = 'hidden';
    };
    ['streams-power-hr', 'streams-wbal', 'streams-cadence', 'streams-speed-alt'].forEach(id => {
      const cv = document.getElementById(id);
      if (cv) cv.addEventListener('dblclick', resetAll);
    });
    const btn = document.getElementById('streams-zoom-reset');
    if (btn) btn.addEventListener('click', resetAll);
  }, 0);

  // Largeurs fixes pour aligner pixel-perfect les chartAreas entre tous les
  // graphiques (sinon le label "900" est plus large que "60" → décalage).
  // Mobile : graphes etires au maximum -> axes Y etroits, sans titre lateral
  const LEFT_Y_WIDTH = _mobileCharts ? 34 : 55;
  const RIGHT_Y_WIDTH = _mobileCharts ? 36 : 60;
  const yTitle = (txt) => (_mobileCharts ? { display: false } : { display: true, text: txt });
  const forceLeftWidth = (scale) => { scale.width = LEFT_Y_WIDTH; };
  const forceRightWidth = (scale) => { scale.width = RIGHT_Y_WIDTH; };

  // Légende : carré plein quand dataset visible, vide quand caché.
  // Toggle visibilité + sync de l'axe Y (titre + ticks) en différé pour ne pas
  // entrer en conflit avec l'update interne de Chart.js déclenché par hide/show.
  const legendConfig = {
    onClick: (e, legendItem, legend) => {
      const chart = legend.chart;
      const i = legendItem.datasetIndex;
      if (chart.isDatasetVisible(i)) chart.hide(i);
      else chart.show(i);
      requestAnimationFrame(() => {
        const ds = chart.data.datasets[i];
        const yAxisID = ds.yAxisID || 'y';
        const sc = chart.options.scales && chart.options.scales[yAxisID];
        if (!sc) return;
        const visible = chart.isDatasetVisible(i);
        if (sc.title) sc.title.display = visible;
        if (sc.ticks) sc.ticks.display = visible;
        chart.update('none');
      });
    },
    labels: {
      boxWidth: 10,
      font: { size: 11 },
      color: '#e6e9ef',
      generateLabels: (chart) => chart.data.datasets.map((ds, i) => {
        const meta = chart.getDatasetMeta(i);
        const hidden = meta.hidden === true;
        return {
          text: ds.label,
          fillStyle: hidden ? 'transparent' : (ds.borderColor || ds.backgroundColor),
          strokeStyle: ds.borderColor || ds.backgroundColor,
          lineWidth: 1.5,
          fontColor: '#e6e9ef',
          hidden: false, // pas de strikethrough
          datasetIndex: i
        };
      })
    }
  };

  // Axe Y droit "fantôme" (invisible mais réserve l'espace) pour les charts
  // qui n'ont qu'un axe Y gauche, afin qu'ils s'alignent sur Watts/FC.
  const phantomY1 = {
    position: 'right',
    display: true,
    ticks: { display: true, color: 'transparent', callback: (v) => v.toFixed(0) },
    grid: { display: false },
    border: { display: false },
    title: { display: false },
    afterFit: forceRightWidth
  };

  // Chart 1 : Watts + FC (double Y, axe X linéaire en distance ou temps)
  if (wattsPts.length || hrPts.length) {
    const datasets = [];
    if (wattsPts.length) datasets.push({
      label: 'Puissance (w)', data: wattsPts,
      borderColor: '#fbbf24', backgroundColor: 'rgba(251,191,36,0.12)',
      yAxisID: 'y', pointRadius: 0, borderWidth: 1.2, fill: true, tension: 0.1, spanGaps: true
    });
    if (hrPts.length) datasets.push({
      label: 'FC (bpm)', data: hrPts,
      borderColor: '#f87171', backgroundColor: 'transparent',
      yAxisID: 'y1', pointRadius: 0, borderWidth: 1.5, tension: 0.15, spanGaps: true
    });
    appState._modalCharts.push(new Chart(document.getElementById('streams-power-hr'), {
      type: 'line',
      data: { datasets },
      options: {
        responsive: true, maintainAspectRatio: false,
        animation: false,
        parsing: false,
        interaction: { intersect: false, mode: 'nearest', axis: 'x' },
        elements: { point: { hoverRadius: 0 } },
        plugins: {
          legend: { display: false }, // remplacée par la barre HTML custom
          tooltip: { enabled: false },
          zoom: zoomConfig,
          decimation: decimationConfig
        },
        scales: {
          x: sharedX,
          y: { position: 'left', title: yTitle('Watts'), suggestedMin: 0, suggestedMax: 600, ...intY, afterFit: forceLeftWidth },
          ...(hrPts.length ? { y1: { position: 'right', title: yTitle('FC'), grid: { display: false }, suggestedMin: 80, suggestedMax: 200, ...intY, afterFit: forceRightWidth } } : {})
        }
      }
    }));
    // Wire la légende HTML custom pour Puissance + FC
    const powerHrChart = appState._modalCharts[appState._modalCharts.length - 1];
    setTimeout(() => {
      document.querySelectorAll('#custom-legend-powerhr .cl-btn-phr').forEach(btn => {
        btn.addEventListener('click', () => {
          const idx = +btn.dataset.idx;
          const yax = btn.dataset.yax;
          const color = btn.dataset.color;
          if (powerHrChart.isDatasetVisible(idx)) powerHrChart.hide(idx);
          else powerHrChart.show(idx);
          requestAnimationFrame(() => {
            const visible = powerHrChart.isDatasetVisible(idx);
            const sc = powerHrChart.options.scales && powerHrChart.options.scales[yax];
            if (sc) {
              if (sc.title) sc.title.display = visible;
              if (sc.ticks) sc.ticks.display = visible;
            }
            powerHrChart.update('none');
            const box = btn.querySelector('.cl-box');
            if (box) box.style.background = visible ? color : 'transparent';
          });
        });
      });
    }, 0);
  }

  // Chart 1.5 : W'bal (réserve anaérobie en kJ)
  if (wbalPts.length) {
    const wbalKJ = wbalPts.map(p => ({ x: p.x, y: p.y / 1000 }));
    appState._modalCharts.push(new Chart(document.getElementById('streams-wbal'), {
      type: 'line',
      data: { datasets: [{
        label: "W'bal (kJ)", data: wbalKJ,
        borderColor: '#60a5fa', backgroundColor: 'rgba(96,165,250,0.15)',
        pointRadius: 0, borderWidth: 1.2, fill: true, tension: 0.1, spanGaps: true,
        // Ligne en pointillé + rouge quand on est franchement sous 0
        // (les segments qui croisent y=0 restent solides pour ne pas "fuir" au-dessus de 0)
        segment: {
          borderDash: ctx => (ctx.p0.parsed.y < 0 && ctx.p1.parsed.y < 0) ? [5, 4] : undefined,
          borderColor: ctx => (ctx.p0.parsed.y < 0 && ctx.p1.parsed.y < 0) ? '#f87171' : '#60a5fa'
        }
      }] },
      options: {
        responsive: true, maintainAspectRatio: false,
        animation: false, parsing: false,
        interaction: { intersect: false, mode: 'nearest', axis: 'x' },
        elements: { point: { hoverRadius: 0 } },
        plugins: {
          legend: { display: false },
          tooltip: { enabled: false },
          zoom: zoomConfig,
          decimation: decimationConfig
        },
        scales: {
          x: sharedX,
          y: { title: yTitle("W'bal (kJ)"), suggestedMin: 0, suggestedMax: wPrime / 1000, ticks: { callback: (v) => v.toFixed(0) }, afterFit: forceLeftWidth },
          y1: phantomY1
        }
      }
    }));
    // Wire la légende HTML custom pour W'bal
    const wbalChart = appState._modalCharts[appState._modalCharts.length - 1];
    setTimeout(() => {
      document.querySelectorAll('#custom-legend-wbal .cl-btn-wbal').forEach(btn => {
        btn.addEventListener('click', () => {
          const idx = +btn.dataset.idx;
          const yax = btn.dataset.yax;
          const color = btn.dataset.color;
          if (wbalChart.isDatasetVisible(idx)) wbalChart.hide(idx);
          else wbalChart.show(idx);
          requestAnimationFrame(() => {
            const visible = wbalChart.isDatasetVisible(idx);
            const sc = wbalChart.options.scales && wbalChart.options.scales[yax];
            if (sc) {
              if (sc.title) sc.title.display = visible;
              if (sc.ticks) sc.ticks.display = visible;
            }
            wbalChart.update('none');
            const box = btn.querySelector('.cl-box');
            if (box) box.style.background = visible ? color : 'transparent';
          });
        });
      });
    }, 0);
  }

  // Chart 2 : Cadence
  if (cadencePts.length) {
    appState._modalCharts.push(new Chart(document.getElementById('streams-cadence'), {
      type: 'line',
      data: { datasets: [{ label: 'Cadence (rpm)', data: cadencePts, borderColor: '#a78bfa', backgroundColor: 'transparent', pointRadius: 0, borderWidth: 1.2, tension: 0.1, spanGaps: true }] },
      options: {
        responsive: true, maintainAspectRatio: false,
        animation: false,
        parsing: false,
        interaction: { intersect: false, mode: 'nearest', axis: 'x' },
        elements: { point: { hoverRadius: 0 } },
        plugins: { legend: { display: false }, tooltip: { enabled: false }, zoom: zoomConfig, decimation: decimationConfig },
        scales: { x: sharedX, y: { title: yTitle('rpm'), suggestedMin: 0, suggestedMax: 110, ...intY, afterFit: forceLeftWidth }, y1: phantomY1 }
      }
    }));
    // Wire la légende HTML custom pour Cadence
    const cadChart = appState._modalCharts[appState._modalCharts.length - 1];
    setTimeout(() => {
      document.querySelectorAll('#custom-legend-cadence .cl-btn-cad').forEach(btn => {
        btn.addEventListener('click', () => {
          const idx = +btn.dataset.idx;
          const yax = btn.dataset.yax;
          const color = btn.dataset.color;
          if (cadChart.isDatasetVisible(idx)) cadChart.hide(idx);
          else cadChart.show(idx);
          requestAnimationFrame(() => {
            const visible = cadChart.isDatasetVisible(idx);
            const sc = cadChart.options.scales && cadChart.options.scales[yax];
            if (sc) {
              if (sc.title) sc.title.display = visible;
              if (sc.ticks) sc.ticks.display = visible;
            }
            cadChart.update('none');
            const box = btn.querySelector('.cl-box');
            if (box) box.style.background = visible ? color : 'transparent';
          });
        });
      });
    }, 0);
  }

  // Chart 3 : Altitude (fond) + Vitesse (ligne au-dessus)
  // Altitude en premier dans le tableau → rendue en arrière-plan (profil de montagne).
  if (speedPts.length || altPts.length) {
    const datasets = [];
    if (altPts.length) datasets.push({
      label: 'Altitude (m)', data: altPts,
      borderColor: 'rgba(74,222,128,0.6)', backgroundColor: 'rgba(74,222,128,0.18)',
      yAxisID: 'y1', pointRadius: 0, borderWidth: 1, fill: true, tension: 0.2, spanGaps: true
    });
    if (speedPts.length) datasets.push({
      label: 'Vitesse (km/h)', data: speedPts,
      borderColor: '#22d3ee', backgroundColor: 'transparent',
      yAxisID: 'y', pointRadius: 0, borderWidth: 1.4, fill: false, tension: 0.1, spanGaps: true
    });
    appState._modalCharts.push(new Chart(document.getElementById('streams-speed-alt'), {
      type: 'line',
      data: { datasets },
      options: {
        responsive: true, maintainAspectRatio: false,
        animation: false, parsing: false,
        interaction: { intersect: false, mode: 'nearest', axis: 'x' },
        elements: { point: { hoverRadius: 0 } },
        plugins: {
          legend: { display: false }, // remplacée par la barre HTML custom
          tooltip: { enabled: false },
          zoom: zoomConfig,
          decimation: decimationConfig
        },
        scales: {
          x: sharedX,
          // Cotes inverses (demande utilisateur) : altitude a GAUCHE, vitesse a DROITE
          y: { position: 'right', title: yTitle('km/h'), suggestedMin: 0, suggestedMax: 50, grid: { display: false }, afterFit: forceRightWidth },
          ...(altPts.length ? { y1: { position: 'left', title: yTitle('m'), ...intY, afterFit: forceLeftWidth } } : { y1: { ...phantomY1, position: 'left', afterFit: forceLeftWidth } })
        }
      }
    }));

    // Wire la légende HTML custom au-dessus du chart
    const speedAltChart = appState._modalCharts[appState._modalCharts.length - 1];
    setTimeout(() => {
      document.querySelectorAll('#custom-legend-altspeed .cl-btn').forEach(btn => {
        btn.addEventListener('click', () => {
          const idx = +btn.dataset.idx;
          const yax = btn.dataset.yax;
          const color = btn.dataset.color;
          if (speedAltChart.isDatasetVisible(idx)) speedAltChart.hide(idx);
          else speedAltChart.show(idx);
          requestAnimationFrame(() => {
            const visible = speedAltChart.isDatasetVisible(idx);
            const sc = speedAltChart.options.scales && speedAltChart.options.scales[yax];
            if (sc) {
              if (sc.title) sc.title.display = visible;
              if (sc.ticks) sc.ticks.display = visible;
            }
            speedAltChart.update('none');
            // Toggle visuel : carré plein si visible, vide sinon
            const box = btn.querySelector('.cl-box');
            if (box) box.style.background = visible ? color : 'transparent';
          });
        });
      });
    }, 0);
  }
  // Graphes detailles caches inline : ils s'affichent dans l'analyse plein ecran.
  try { var _dc = document.getElementById('detailed-charts'); if (_dc) _dc.style.display = 'none'; } catch (e) { /* ignore */ }
}

export function bootStreamsSection() {

bootSportDisplay();


appState._modalCharts = [];


// Throttle via requestAnimationFrame
appState._smoothFrame = null;

appState._smoothPendingX = undefined;

if (typeof Chart !== 'undefined') {
  try { Chart.register(smoothTooltipPlugin); } catch (e) { /* déjà enregistré */ }
}


// === Plugin : zone hachurée sous 0 pour W'bal ===
// Dessine un motif rayé rouge dans la partie négative du W'bal (au-dessus du fill normal).
appState._hatchPattern = null;

if (typeof Chart !== 'undefined') {
  try { Chart.register(wbalNegStripesPlugin); } catch (e) {}
}


// (Plugin axisVisibility retiré — la synchro axe ↔ dataset est faite dans
// legendConfig.onClick avec un requestAnimationFrame pour éviter les conflits)

// Detecte les sequences d'une sortie a partir du stream de puissance et renvoie des
// blocs AU MEME FORMAT que les seances structurees (int = %FTP), reutilisables par
// renderWorkoutProfileHTML / renderWorkoutDetailHTML. Heuristique (approximatif).
window.detectRideSequences = function (watts, ftp) {
  try {
    ftp = +ftp || 250;
    if (!watts || !watts.length) return [];
    var raw = []; for (var i = 0; i < watts.length; i++) { var v = watts[i]; raw.push((v == null || isNaN(v)) ? 0 : +v); }
    var n = raw.length; if (n < 180) return [];
    // Lissage ~15 s pour stabiliser la "base" (sinon la puissance bruitee sur-segmente)
    function sm(arr, win) { var m = arr.length, o = new Array(m), s = 0, c = 0; for (var x = 0; x <= win && x < m; x++) { s += arr[x]; c++; } for (var x2 = 0; x2 < m; x2++) { if (x2 > 0 && x2 + win < m) { s += arr[x2 + win]; c++; } if (x2 - win - 1 >= 0) { s -= arr[x2 - win - 1]; c--; } o[x2] = c > 0 ? s / c : 0; } return o; }
    var sw = sm(raw, 2);   // +/-2 s = ~5 s : leger, garde les efforts distincts (pas de moyenne coast+sprint)
    var zoneOf = function (w) { var p = w / ftp * 100; if (p < 55) return 0; if (p < 76) return 1; if (p < 91) return 2; if (p < 106) return 3; if (p < 121) return 4; if (p < 151) return 5; return 6; };
    // Binning 5 s, zone par bin (7 zones)
    var BIN = 5, bins = [];
    for (var s2 = 0; s2 < n; s2 += BIN) { var sum = 0, c2 = 0; for (var k = s2; k < Math.min(n, s2 + BIN); k++) { sum += sw[k]; c2++; } var w = c2 ? sum / c2 : 0; bins.push({ w: w, dur: c2, z: zoneOf(w) }); }
    // Segments = bins consecutifs de MEME zone (jamais de moyenne entre zones differentes)
    var remerge = function (arr) {
      var o = [];
      arr.forEach(function (g) { var L = o[o.length - 1]; if (L && L.z === g.z) { L.dur += g.dur; L._sw += g._sw; } else o.push({ z: g.z, dur: g.dur, _sw: g._sw }); });
      o.forEach(function (s) { s.w = s._sw / Math.max(1, s.dur); s.z = zoneOf(s.w); });
      return o;
    };
    var segs = remerge(bins.map(function (b) { return { z: b.z, dur: b.dur, _sw: b.w * b.dur }; }));
    // Absorption des segments < 10 s (bruit) dans le voisin de PUISSANCE la plus proche
    var guard = 0;
    while (segs.length > 1 && guard++ < 5000) {
      var bi = -1, bd = 1e9;
      for (var q = 0; q < segs.length; q++) { var mn = (segs[q].w / ftp * 100) >= 170 ? 10 : 45; if (segs[q].dur < mn && segs[q].dur < bd) { bd = segs[q].dur; bi = q; } }
      if (bi === -1) break;
      var p0 = segs[bi - 1], n0 = segs[bi + 1];
      var into = (!p0) ? n0 : (!n0 ? p0 : (Math.abs(p0.w - segs[bi].w) <= Math.abs(n0.w - segs[bi].w) ? p0 : n0));
      if (!into) break;
      into.dur += segs[bi].dur; into._sw += segs[bi]._sw; segs.splice(bi, 1); segs = remerge(segs);
    }
    if (!segs.length) return [];
    // Chaque segment = un bloc, a sa vraie duree (pas de regroupement en series).
    var pctFtp = function (w) { return Math.round(w / ftp * 100); };
    var blocks = segs.map(function (g) {
      return { type: 'steady', name: null, _z: g.z, _durS: g.dur, metric: 'power', unit: 'percent', work: { min: Math.round(g.dur / 60 * 100) / 100, int: pctFtp(g.w), metric: 'power' } };
    });
    // Zone d'un bloc a partir de son %FTP (memes seuils que la couleur des barres)
    var zp = function (p) { return zoneOf(ftp * p / 100); };
    // 1) Retire les micro-blocs (< 25 s) AVANT de fusionner
    blocks = blocks.filter(function (bl) { var d = bl._durS || ((+bl.work.min || 0) * 60), mn = (+bl.work.int || 0) >= 170 ? 10 : 45; return d >= mn; });
    // 2) Fusionne les blocs adjacents de MEME zone (duree additive, watts moyennes)
    var mg = [];
    blocks.forEach(function (bl) {
      var L = mg[mg.length - 1];
      if (L && zp(L.work.int) === zp(bl.work.int)) {
        var d1 = +L.work.min || 0, d2 = +bl.work.min || 0, dt = d1 + d2;
        L.work.int = dt ? Math.round((L.work.int * d1 + bl.work.int * d2) / dt) : L.work.int;
        L.work.min = Math.round(dt * 100) / 100;
        L._durS = (L._durS || d1 * 60) + (bl._durS || d2 * 60);
      } else { mg.push(bl); }
    });
    blocks = mg;
    // 3) Nommage deduit
    var ZN = ['Récupération', 'Endurance', 'Tempo', 'Seuil', 'VO2max', 'Anaérobie', 'Sprint'];
    blocks.forEach(function (bl, bi2) {
      var z = zp(bl.work.int), durS = bl._durS || ((+bl.work.min || 0) * 60);
      if (bi2 === 0 && z <= 2) { bl.name = 'Échauffement'; return; }
      if (bi2 === blocks.length - 1 && z <= 2) { bl.name = 'Retour au calme'; return; }
      if (z >= 4 && durS <= 50) { bl.name = 'Sprint'; return; }
      bl.name = ZN[z] || 'Bloc';
    });
    return blocks;
  } catch (e) { console.warn('[detect sequences]', e && e.message); return []; }
};
}
