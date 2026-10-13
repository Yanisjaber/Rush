/* src/features/streams/detailed-analysis.js — extrait de l'ancien app.js (découpage par fonctionnalité). */
import { appState } from '../../core/state.js';
import { _buildAfCharts, _buildRecordsTable } from '../training/structure-page.js';
import { activatePanel } from '../../routing/tabs.js';
import { openSessionModal } from '../sessions/session-modal.js';


export function bootDetailedAnalysis() {


// ============================================================
// Analyse detaillee PLEIN ECRAN : courbes temps (deplacees) + courbe de
// puissance (mean-max) + temps par zone (puissance/FC) + distribution.
// ============================================================
// Calcule les metriques avancees d'une activite a partir des streams.
// S = { watts:[], hr:[], ftp, hrMax } ; ath = objet athlete ; hrRest = FC repos (profil).
// Tout est calculable depuis watts+FC sauf l'equilibre G/D (mesure capteur, pas dans Strava).
window.__computeActivityMetrics = function (S, ath, hrRest) {
  S = S || {}; ath = ath || {};
  var W = S.wattsRaw || S.watts || [], HR = S.hr || [];
  var ftp = +S.ftp || +ath.ftp || 250;
  var hrMax = +S.hrMax || +ath.hr_max || +ath.hrMax || 190;
  var sex = ath.sex || 'M';
  hrRest = +hrRest || +ath.hr_rest || 50;
  var m = { _v: 2 };
  var n = W.length;

  if (n) {
    var ps = new Float64Array(n + 1);
    for (var i = 0; i < n; i++) ps[i + 1] = ps[i] + (+W[i] || 0);
    var bestAvg = function (d) { if (d > n) return 0; var b = 0; for (var s = 0; s + d <= n; s++) { var v = (ps[s + d] - ps[s]) / d; if (v > b) b = v; } return b; };

    var pmax = 0; for (var i2 = 0; i2 < n; i2++) { var w0 = +W[i2] || 0; if (w0 > pmax) pmax = w0; }
    m.pmax = Math.round(pmax);

    var ex = 0; for (var i3 = 0; i3 < n; i3++) { var w1 = +W[i3] || 0; if (w1 > ftp) ex += (w1 - ftp); }
    m.work_over_ftp_kj = Math.round(ex / 100) / 10;

    // NP (moyenne glissante 30s, puissance 4) -> IF -> TSS, calcules nous-memes
    // (utile quand la source ne fournit pas intensity/tss).
    if (n >= 30) {
      var np4 = 0, npc = 0;
      for (var r = 30; r <= n; r++) { var a30 = (ps[r] - ps[r - 30]) / 30; np4 += a30 * a30 * a30 * a30; npc++; }
      if (npc) m.np = Math.round(Math.pow(np4 / npc, 0.25));
    }
    if (m.np && ftp) { var ifr = m.np / ftp; m.if_pct = Math.round(ifr * 100); m.tss = Math.round(n / 3600 * ifr * ifr * 100); }

    // eFTP / CP / W' / W'bal ne sont fiables que si la sortie contient un effort
    // assez dur (sinon le modele puissance-duree donne des valeurs absurdes).
    var hard = (bestAvg(300) >= ftp * 0.86) || (bestAvg(60) >= ftp * 1.15) || (bestAvg(1200) >= ftp * 0.84);

    if (hard) {
    var durs = [120, 180, 240, 300, 420, 600, 720, 900, 1200].filter(function (d) { return d <= n; });
    if (durs.length >= 2) {
      var sx = 0, sy = 0, sxy = 0, sxx = 0, k = durs.length;
      durs.forEach(function (d) { var x = 1 / d, y = bestAvg(d); sx += x; sy += y; sxy += x * y; sxx += x * x; });
      var slope = (k * sxy - sx * sy) / (k * sxx - sx * sx); var inter = (sy - slope * sx) / k;
      if (isFinite(inter) && inter > 0) m.cp = Math.round(inter);
      if (isFinite(slope) && slope > 0) m.w_prime = Math.round(slope);
    }

    var p20 = bestAvg(1200), p5 = bestAvg(300);
    if (p20) m.eftp = Math.round(0.95 * p20);
    else if (p5) m.eftp = Math.round(0.90 * p5);
    else if (m.cp) m.eftp = Math.round(0.97 * m.cp);

    var cp = m.cp || Math.round(0.97 * ftp), wp = m.w_prime || 20000;
    if (cp > 0 && wp > 0) {
      var bSum = 0, bN = 0; for (var b1 = 0; b1 < n; b1++) { var w2 = +W[b1] || 0; if (w2 < cp) { bSum += w2; bN++; } }
      var dcp = bN ? (cp - bSum / bN) : 0; var tau = 546 * Math.exp(-0.01 * dcp) + 316;
      var bal = wp, minb = wp, rec = 1 - Math.exp(-1 / tau);
      for (var b2 = 0; b2 < n; b2++) { var w3 = +W[b2] || 0; if (w3 > cp) bal -= (w3 - cp); else bal += (wp - bal) * rec; if (bal > wp) bal = wp; if (bal < minb) minb = bal; }
      m.wbal_kj = Math.round(Math.min(wp, wp - minb) / 100) / 10;   // deplete <= W'
    }
    }

    var GE_carb = 0, choMech = 0;
    for (var c1 = 0; c1 < n; c1++) { var w4 = +W[c1] || 0; if (w4 <= 0) continue; var I = w4 / ftp; var fr = 1 / (1 + Math.exp(-5 * (I - 0.45))); if (fr < 0.15) fr = 0.15; if (fr > 1) fr = 1; choMech += (w4 / 1000) * fr; }
    m.cho_g = Math.round(choMech / 4.0);

    var z1 = 0, z2 = 0, z3 = 0;
    for (var p1 = 0; p1 < n; p1++) { var ww = W[p1]; if (ww == null) continue; var pr = ww / ftp; if (pr < 0.80) z1++; else if (pr <= 1.05) z2++; else z3++; }
    var zt = z1 + z2 + z3;
    if (zt) {
      var f1 = z1 / zt, f2 = z2 / zt, f3 = z3 / zt;
      if (f2 > 0 && f3 > 0) m.pol_index = Math.round(Math.log10((f1 * f3) / (f2 * f2)) * 100) / 100;
      m.pol_class = (f1 >= f2 && f2 >= f3) ? 'Pyramidal' : (f3 > f2) ? 'Polarisé' : (f2 > f1) ? 'Seuil' : 'Endurance';
    }
  }

  if (HR.length) {
    var hn = HR.length, denom = (hrMax - hrRest) || 1, kk = (sex === 'F') ? 1.67 : 1.92, trimp = 0;
    for (var h1 = 0; h1 < hn; h1++) { var hh = HR[h1]; if (hh == null) continue; var r = (hh - hrRest) / denom; if (r < 0) r = 0; if (r > 1) r = 1; trimp += (1 / 60) * r * 0.64 * Math.exp(kk * r); }
    m.trimp = Math.round(trimp);
    // HRRc : plus forte chute de FC sur 60 s de TEMPS ECOULE reel (gere les pauses),
    // mesuree apres un instant a FC haute. Repli sur l'index si pas de flux temps.
    var drop = 0;
    var T = S.time;
    if (T && T.length === hn) {
      var j = 0;
      for (var h2 = 0; h2 < hn; h2++) {
        if (j < h2) j = h2;
        var target = T[h2] + 60;
        while (j < hn && T[j] < target) j++;
        if (j >= hn) break;
        if (HR[h2] != null && HR[j] != null && HR[h2] >= 0.85 * hrMax) { var d1 = HR[h2] - HR[j]; if (d1 > drop) drop = d1; }
      }
    } else {
      for (var h3 = 0; h3 + 60 < hn; h3++) { if (HR[h3] == null || HR[h3 + 60] == null) continue; if (HR[h3] >= 0.85 * hrMax) { var d2 = HR[h3] - HR[h3 + 60]; if (d2 > drop) drop = d2; } }
    }
    if (drop > 0) m.hrrc = Math.round(drop);
  }
  return m;
};

window.__buildAfOverview = function (act, m) {
  m = m || {};
  if (!act) return '<div class="af-section"><div class="af-h">Aperçu</div><div style="color:var(--text-mute)">Données indisponibles.</div></div>';
  var ath = (window.DASHBOARD_DATA && window.DASHBOARD_DATA.athlete) || {};
  var hrMax = +ath.hr_max || +ath.hrMax || +act.max_hr || 0;
  var durMin = act.duration || (act.moving_time ? Math.round(act.moving_time / 60) : 0);
  var durSec = act.moving_time || act.elapsed_time || (durMin * 60);
  var fmtHMS = function (s) { s = Math.round(s); var h = Math.floor(s / 3600), mm = Math.floor((s % 3600) / 60), x = s % 60; var p = function (n) { return n < 10 ? '0' + n : '' + n; }; return h ? (h + ':' + p(mm) + ':' + p(x)) : (mm + ':' + p(x)); };
  var ifPct = act.ftpPct || (act.intensity ? Math.round(act.intensity * 100) : 0) || m.if_pct || 0;
  var vi = act.variability_index ? +act.variability_index : 0;
  var ef = (act.np && act.hr) ? (act.np / act.hr).toFixed(2) : ((m.np && act.hr) ? (m.np / act.hr).toFixed(2) : null);
  var fcMaxPct = (act.max_hr && hrMax) ? Math.round(act.max_hr / hrMax * 100) : null;
  var np = act.np || m.np || 0;
  var tss = act.tss || m.tss || 0;
  var pmaxW = act.max_watts || m.pmax || 0;
  var ctl = null, atl = null, tsb = null;
  if (Array.isArray(appState.data)) { for (var i = 0; i < appState.data.length; i++) { if (appState.data[i].date === window.__lastActDate) { ctl = appState.data[i].ctl; atl = appState.data[i].atl; tsb = appState.data[i].tsb; break; } } }

  var gauge = function (label, valTxt, w, col) { return '<div><div style="display:flex;justify-content:space-between;font-size:11px;color:var(--text-dim);margin-bottom:4px"><span>' + label + '</span><span style="color:var(--text);font-weight:600">' + valTxt + '</span></div><div style="height:6px;background:var(--bg-elev2);border-radius:99px;overflow:hidden"><div style="width:' + Math.max(0, Math.min(100, w)) + '%;height:100%;background:' + col + '"></div></div></div>'; };
  var row = function (label, val) { return '<div style="display:flex;justify-content:space-between;gap:10px"><span style="color:var(--text-dim)">' + label + '</span><span style="font-weight:600;text-align:right">' + val + '</span></div>'; };
  var mkCard = function (title, col, rows) { if (!rows.length) return ''; return '<div style="background:var(--bg-elev);border:1px solid var(--border);border-radius:12px;padding:14px 16px"><div style="font-size:12px;font-weight:600;margin-bottom:8px;color:' + col + '">' + title + '</div><div style="font-size:13px;line-height:2.05">' + rows.join('') + '</div></div>'; };

  // ---- Header : Retour + identite (gauche) + score cle (droite) ----
  var heroVal = tss ? Math.round(tss) : (np ? Math.round(np) : '–');
  var heroLab = tss ? 'Charge (TSS)' : 'Puiss. norm.';
  var _iso = window.__lastActDate || (act.start_date_local ? String(act.start_date_local).slice(0, 10) : '');
  var _nm = (act.name || 'Activité').replace(/</g, '&lt;');
  var _when = '';
  try {
    if (_iso) _when = new Date(_iso + 'T00:00:00').toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
    var _hm = (act.start_date_local && String(act.start_date_local).length >= 16) ? String(act.start_date_local).slice(11, 16) : '';
    if (_hm) _when += ' · ' + _hm;
  } catch (e9) {}

  var cg = [];
  if (ifPct) cg.push(gauge('Intensité (IF)', ifPct + '%', ifPct, 'var(--warn)'));
  if (fcMaxPct) cg.push(gauge('FC max', fcMaxPct + '%', fcMaxPct, 'var(--danger)'));
  if (vi) cg.push(gauge('Variabilité', vi.toFixed(2), (vi - 1) * 200, 'var(--info)'));

  var header = '<div class="af-topbar">'
    + '<button class="af-back" type="button">← Retour</button>'
    + '<div class="af-id"><div class="af-id-name">' + _nm + '</div>' + (_when ? '<div class="af-id-sub">' + _when + '</div>' : '') + '</div>'
    + '</div>';

  var chargeCol = '<div style="min-width:200px">'
    + '<div style="display:flex;align-items:baseline;gap:7px;margin-bottom:9px"><span style="font-size:27px;font-weight:700;line-height:1">' + heroVal + '</span><span style="font-size:11px;color:var(--text-dim)">' + heroLab + '</span></div>'
    + (cg.length ? '<div style="display:flex;flex-direction:column;gap:8px">' + cg.join('') + '</div>' : '')
    + (m.pol_class ? '<div style="display:inline-block;margin-top:10px;background:rgba(167,139,250,.15);color:var(--purple);border-radius:7px;padding:4px 10px;font-size:11px;font-weight:600">' + m.pol_class + (m.pol_index != null ? ' · ' + m.pol_index : '') + '</div>' : '')
    + '</div>';

  // ---- Colonnes de detail ----
  var pRows = [];
  if (np) pRows.push(row('NP', Math.round(np) + ' w'));
  if (act.avg_watts || pmaxW) pRows.push(row('Moy / Max', (act.avg_watts ? Math.round(act.avg_watts) : '–') + ' / ' + (pmaxW ? Math.round(pmaxW) : '–') + ' w'));
  if (act.cadence) pRows.push(row('Cadence', Math.round(act.cadence) + ' rpm'));
  if (m.eftp) pRows.push(row('eFTP', m.eftp + ' w'));
  if (m.cp) pRows.push(row('CP' + (m.w_prime ? " · W'" : ''), m.cp + 'w' + (m.w_prime ? ' · ' + (m.w_prime / 1000).toFixed(1) + 'kJ' : '')));
  if (m.wbal_kj) pRows.push(row("W'bal (baisse)", '-' + m.wbal_kj + ' kJ'));

  var cRows = [];
  if (act.hr || act.max_hr) cRows.push(row('Moy / Max', (act.hr || '–') + ' / ' + (act.max_hr || '–') + ' bpm'));
  if (ef) cRows.push(row('P/FC (EF)', ef));
  if (m.trimp) cRows.push(row('TRIMP', m.trimp));
  if (m.hrrc) cRows.push(row('HRRc', m.hrrc + ' bpm'));

  var vRows = [];
  vRows.push(row('Durée', fmtHMS(durSec)));
  if (act.distance_km) vRows.push(row('Distance', window.fmtDist(act.distance_km, act.raw_type || act.sport)));
  if (act.elevation_gain) vRows.push(row('Dénivelé+', Math.round(act.elevation_gain) + ' m'));
  if (act.avg_speed_kmh) { const _sp3 = act.raw_type || act.sport; const _al = window.rateLabel(_sp3) === 'Allure' ? window.fmtRate(act.distance_km, durSec / 60, _sp3) : null; vRows.push(row(window.rateLabel(_sp3) + ' moy', _al || (+act.avg_speed_kmh).toFixed(1) + ' km/h')); }

  var eRows = [];
  if (act.kj) eRows.push(row('Travail', Math.round(act.kj) + ' kJ'));
  if (m.work_over_ftp_kj) eRows.push(row('dont &gt;FTP', m.work_over_ftp_kj + ' kJ'));
  if (act.calories) eRows.push(row('Calories', Math.round(act.calories) + ' kcal'));
  if (m.cho_g) eRows.push(row('CHO estimé', m.cho_g + ' g'));

  var fRows = [];
  if (ctl != null) fRows.push(row('Condition phys.', Math.round(ctl)));
  if (atl != null) fRows.push(row('Fatigue', Math.round(atl)));
  if (tsb != null) fRows.push(row('Forme', '<span style="color:' + (tsb >= 0 ? 'var(--accent)' : 'var(--danger)') + '">' + (tsb >= 0 ? '+' : '') + Math.round(tsb) + '</span>'));

  var grp = function (title, col, rows) { if (!rows.length) return ''; return '<div><div style="font-size:11px;font-weight:600;color:' + col + ';margin-bottom:7px;text-transform:uppercase;letter-spacing:.4px">' + title + '</div><div style="font-size:13px;line-height:2.05">' + rows.join('') + '</div></div>'; };

  var band = '<div class="af-band">'
    + chargeCol
    + grp('Puissance', 'var(--warn)', pRows)
    + grp('Cardio', 'var(--danger)', cRows)
    + grp('Volume', 'var(--accent)', vRows)
    + grp('Énergie', 'var(--info)', eRows)
    + grp('Forme', 'var(--purple)', fRows)
    + '</div>';

  var html = header + '<div class="af-section">' + band + '</div>';
  return html;
};

window.openFullAnalysis = function () {
  var S = window.__lastStreams;
  try {
    var _ath = (window.DASHBOARD_DATA && window.DASHBOARD_DATA.athlete) || {};
    var _rhr = 0;
    if (Array.isArray(appState.data)) { for (var _di = 0; _di < appState.data.length; _di++) { if (appState.data[_di].date === window.__lastActDate) { _rhr = +appState.data[_di].rhr || 0; break; } } }
    window.__lastMetrics = window.__computeActivityMetrics(S, _ath, _rhr);
    var _sb = window.__lastActSbId;
    if (_sb && window.__lastMetrics) {
      var _prev = null;
      if (Array.isArray(appState.data)) appState.data.forEach(function (dd) { (dd.activities || []).forEach(function (aa) { if (String(aa._sbId) === String(_sb)) { _prev = aa.metrics; aa.metrics = window.__lastMetrics; } }); });
      if ((!_prev || +_prev._v !== +window.__lastMetrics._v) && window.cloudSync && window.cloudSync.saveActivityMetrics) {
        try { window.cloudSync.saveActivityMetrics(_sb, window.__lastMetrics); } catch (e) {}
      }
    }
  } catch (e) { console.warn('[metrics]', e && e.message); window.__lastMetrics = {}; }
  var container = document.querySelector('.main .container') || document.querySelector('.container');
  if (!container) return;
  var page = document.getElementById('p-analysis');
  if (!page) { page = document.createElement('section'); page.className = 'panel'; page.id = 'p-analysis'; container.appendChild(page); }
  // memorise le panneau courant pour le retour
  var cur = document.querySelector('.panel.active');
  window.__prevPanelId = (cur && cur.id && cur.id !== 'p-analysis') ? cur.id : (window.__prevPanelId || 'p1');
  // ferme la modale d'activite
  var modal = document.getElementById('session-modal'); if (modal) modal.classList.remove('active');
  // structure : Retour + onglets internes + contenus
  page.innerHTML =
    '<div class="af-overview-wrap">' + window.__buildAfOverview(window.__lastAct, window.__lastMetrics) + '</div>'
    + '<div class="af-tabbar">'
    +   '<button class="af-tab active" type="button" data-tab="courbes">Courbes</button>'
    +   '<button class="af-tab" type="button" data-tab="records">Records</button>'
    +   '<button class="af-tab" type="button" data-tab="zones">Zones</button>'
    +   '<button class="af-tab" type="button" data-tab="dist">Distribution</button>'
    + '</div>'
    + '<div class="af-tabc active" id="af-tab-courbes"><div id="af-courbes-slot"></div></div>'
    + '<div class="af-tabc" id="af-tab-records"><div class="af-section"><div class="af-h">Courbe de puissance (mean-max)</div><div class="af-chart"><canvas id="af-pcurve"></canvas></div></div><div class="af-section"><div class="af-h" style="display:flex;align-items:center;justify-content:space-between;gap:10px">Records de puissance <button class="af-recalc af-back" type="button" style="margin:0">Recalculer les records</button></div><div id="af-recalc-status" style="font-size:11px;color:var(--text-mute);margin-bottom:8px;display:none"></div><div id="af-records"></div></div></div>'
    + '<div class="af-tabc" id="af-tab-zones"><div class="af-grid2"><div class="af-section"><div class="af-h">Temps par zone \u2014 Puissance</div><div class="af-chart"><canvas id="af-zpow"></canvas></div></div><div class="af-section"><div class="af-h">Temps par zone \u2014 FC</div><div class="af-chart"><canvas id="af-zhr"></canvas></div></div></div></div>'
    + '<div class="af-tabc" id="af-tab-dist"><div class="af-section"><div class="af-h">Distribution de puissance</div><div class="af-chart"><canvas id="af-dist"></canvas></div></div></div>';
  page.querySelector('.af-back').addEventListener('click', window.closeFullAnalysis);
  // deplace les courbes temps (deja construites dans la modale) dans l'onglet Courbes
  var dc = document.getElementById('detailed-charts');
  if (dc) { dc.style.display = 'block'; var slot = page.querySelector('#af-courbes-slot'); if (slot) slot.appendChild(dc); }
  // bascule d'onglets
  page.querySelectorAll('.af-tab').forEach(function (btn) {
    btn.addEventListener('click', function () {
      page.querySelectorAll('.af-tab').forEach(function (b) { b.classList.remove('active'); });
      page.querySelectorAll('.af-tabc').forEach(function (c) { c.classList.remove('active'); });
      btn.classList.add('active');
      var tc = page.querySelector('#af-tab-' + btn.dataset.tab); if (tc) tc.classList.add('active');
      try { window.dispatchEvent(new Event('resize')); } catch (e) {}
    });
  });
  var _rc = page.querySelector('.af-recalc');
  if (_rc) _rc.addEventListener('click', async function () {
    var st = document.getElementById('af-recalc-status'); if (st) { st.style.display = 'block'; st.textContent = 'Calcul en cours\u2026'; }
    _rc.disabled = true;
    try { await window.recalcAllPowerCurves(function (done, total) { if (st) st.textContent = 'Traitement ' + done + ' / ' + total + ' sorties\u2026'; }); } catch (e) {}
    if (st) st.textContent = 'Records mis \u00e0 jour.';
    _rc.disabled = false;
    try { var rt = document.getElementById('af-records'); if (rt && window.__lastStreams) rt.innerHTML = _buildRecordsTable(window.__lastStreams); } catch (e) {}
  });
  // active la page (sidebar inchangee)
  document.querySelectorAll('.tab').forEach(function (b) { b.classList.remove('active'); });
  document.querySelectorAll('.panel').forEach(function (p) { p.classList.remove('active'); });
  page.classList.add('active');
  var tb = document.getElementById('topbar-title'); if (tb) tb.textContent = 'Analyse détaillée';
  try { window.scrollTo(0, 0); } catch (e) {}
  window.__afCharts = [];
  setTimeout(function () { try { _buildAfCharts(S); } catch (e) { console.warn('[af charts]', e && e.message); } try { window.dispatchEvent(new Event('resize')); } catch (e2) {} }, 40);
};

window.closeFullAnalysis = function (reopen) {
  (window.__afCharts || []).forEach(function (c) { try { c.destroy(); } catch (e) {} });
  window.__afCharts = [];
  var pid = window.__prevPanelId || 'p1';
  if (typeof activatePanel === 'function') { activatePanel(pid, false); }
  else { var pg = document.getElementById('p-analysis'); if (pg) pg.classList.remove('active'); var pv = document.getElementById(pid); if (pv) pv.classList.add('active'); }
  // Retour -> rouvre la modale detail de l'activite (et non le calendrier)
  if (reopen !== false && window.__currentModalIso && typeof openSessionModal === 'function') {
    if (typeof window.__modalActIdx === 'number') window.__openActIdx = window.__modalActIdx;
    try { openSessionModal(window.__currentModalIso, window.__currentModalSource || 'realise'); } catch (e) {}
  }
};
}
