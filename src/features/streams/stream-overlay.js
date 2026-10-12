/* src/features/streams/stream-overlay.js — surcouche des graphiques de streams
   (curseur/valeurs synchronisés, motif hachuré du W'bal, nettoyage des graphes de la modale).
   Déplacé tel quel depuis streams-section.js (aucun changement de comportement). */
import { appState } from '../../core/state.js';

export function destroyModalCharts() {
  appState._modalCharts.forEach(c => {
    try {
      if (c.canvas && c.canvas._smoothMM) {
        c.canvas.removeEventListener('mousemove', c.canvas._smoothMM);
        c.canvas.removeEventListener('mouseleave', c.canvas._smoothML);
        delete c.canvas._smoothMM;
        delete c.canvas._smoothML;
      }
      if (c._stOverlay && c._stOverlay.parentNode) {
        c._stOverlay.parentNode.removeChild(c._stOverlay);
      }
      c.destroy();
    } catch (e) {}
  });
  appState._modalCharts = [];
}


// === Crosshair fluide + tooltip interpolé (canvas overlay) ===
// Au lieu de redessiner les charts à chaque mouvement de souris (coûteux),
// on superpose une canvas transparente sur chaque chart et on n'en redessine
// QUE la crosshair. Le chart lui-même n'est plus repeint pendant les hover.
function _ensureOverlay(chart) {
  if (chart._stOverlay && chart._stOverlay.isConnected) return;
  const canvas = chart.canvas;
  const parent = canvas.parentNode;
  if (!parent) return;
  const cs = getComputedStyle(parent);
  if (cs.position === 'static') parent.style.position = 'relative';
  const ov = document.createElement('canvas');
  ov.style.cssText = 'position:absolute;top:0;left:0;width:100%;height:100%;pointer-events:none;z-index:2;';
  parent.appendChild(ov);
  chart._stOverlay = ov;
  chart._stOverlayCtx = ov.getContext('2d');
  _resizeOverlay(chart);

  // Listener direct sur la canvas pour suivre le curseur MÊME pendant un drag-zoom
  // (afterEvent peut être bypassé par le plugin zoom pendant la sélection).
  if (!canvas._smoothMM) {
    canvas._smoothMM = (e) => {
      const rect = canvas.getBoundingClientRect();
      const x = (e.clientX - rect.left) * (canvas.width / rect.width) / (chart.currentDevicePixelRatio || window.devicePixelRatio || 1);
      const y = (e.clientY - rect.top) * (canvas.height / rect.height) / (chart.currentDevicePixelRatio || window.devicePixelRatio || 1);
      const { left, right, top, bottom } = chart.chartArea;
      if (x < left || x > right || y < top || y > bottom) {
        if (chart._stxv != null) {
          appState._smoothPendingX = null;
          _scheduleSmoothDraw();
        }
        return;
      }
      appState._smoothPendingX = chart.scales.x.getValueForPixel(x);
      _scheduleSmoothDraw();
    };
    canvas._smoothML = () => {
      appState._smoothPendingX = null;
      _scheduleSmoothDraw();
    };
    canvas.addEventListener('mousemove', canvas._smoothMM);
    canvas.addEventListener('mouseleave', canvas._smoothML);
  }
}

export function _resizeOverlay(chart) {
  if (!chart._stOverlay) return;
  const c = chart.canvas;
  chart._stOverlay.width = c.width;
  chart._stOverlay.height = c.height;
  // Reset transform pour matcher le DPR utilisé par Chart.js
  const dpr = chart.currentDevicePixelRatio || window.devicePixelRatio || 1;
  chart._stOverlayCtx.setTransform(dpr, 0, 0, dpr, 0, 0);
}


function _drawOverlay(chart) {
  if (!chart._stOverlay) return;
  // Safety : si une overlay s'est créée par erreur sur un non-stream chart, on la retire
  if (typeof _isStreamChart === 'function' && !_isStreamChart(chart)) {
    try {
      if (chart._stOverlay.parentNode) chart._stOverlay.parentNode.removeChild(chart._stOverlay);
    } catch (e) {}
    chart._stOverlay = null;
    chart._stOverlayCtx = null;
    return;
  }
  const ctx = chart._stOverlayCtx;
  const w = chart._stOverlay.width;
  const h = chart._stOverlay.height;
  // Clear (en coords brutes, pas affecté par le transform DPR)
  ctx.save();
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.clearRect(0, 0, w, h);
  ctx.restore();

  const xValue = chart._stxv;
  if (xValue == null) return;
  const xScale = chart.scales.x;
  if (!xScale || xValue < xScale.min || xValue > xScale.max) return;
  const pixelX = xScale.getPixelForValue(xValue);
  const { top, bottom, left, right } = chart.chartArea;
  if (pixelX < left - 0.5 || pixelX > right + 0.5) return;

  ctx.save();

  // Ligne verticale (crosshair)
  ctx.beginPath();
  ctx.strokeStyle = 'rgba(180,180,180,0.5)';
  ctx.lineWidth = 1;
  ctx.setLineDash([3, 3]);
  ctx.moveTo(pixelX, top);
  ctx.lineTo(pixelX, bottom);
  ctx.stroke();
  ctx.setLineDash([]);

  // Interpolation linéaire de chaque dataset à xValue
  const items = [];
  chart.data.datasets.forEach((ds, i) => {
    // Skip si la courbe est cachée via la légende
    const meta = chart.getDatasetMeta(i);
    if (meta && meta.hidden) return;
    const data = ds.data;
    if (!data || !data.length) return;
    let y;
    if (xValue <= data[0].x) y = data[0].y;
    else if (xValue >= data[data.length - 1].x) y = data[data.length - 1].y;
    else {
      let lo = 0, hi = data.length - 1;
      while (hi - lo > 1) {
        const mid = (lo + hi) >> 1;
        if (data[mid].x <= xValue) lo = mid;
        else hi = mid;
      }
      const p0 = data[lo], p1 = data[hi];
      const dx = p1.x - p0.x;
      const t = dx === 0 ? 0 : (xValue - p0.x) / dx;
      y = p0.y + t * (p1.y - p0.y);
    }
    const yScale = chart.scales[ds.yAxisID || 'y'];
    if (!yScale) return;
    const pixelY = yScale.getPixelForValue(y);
    ctx.beginPath();
    ctx.fillStyle = ds.borderColor;
    ctx.strokeStyle = '#1a1a1a';
    ctx.lineWidth = 1.5;
    ctx.arc(pixelX, pixelY, 4, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();

    // Pente (%) pour l'altitude — uniquement si X est la distance (m)
    // Recherche binaire dans la fenêtre ±100 m. Si vide (gap dans la data),
    // fallback sur les deux points immédiatement autour du curseur.
    let extra = null;
    if (ds.label && ds.label.toLowerCase().includes('altitude') && window._streamsUseDistance) {
      const win = 100;
      const tLo = xValue - win;
      const tHi = xValue + win;
      // Borne basse : premier index avec data[j].x >= tLo
      let lo = 0, hi = data.length - 1;
      while (lo < hi) {
        const m = (lo + hi) >> 1;
        if (data[m].x < tLo) lo = m + 1;
        else hi = m;
      }
      let i1 = lo;
      // Borne haute : dernier index avec data[j].x <= tHi
      lo = 0; hi = data.length - 1;
      while (lo < hi) {
        const m = (lo + hi + 1) >> 1;
        if (data[m].x > tHi) hi = m - 1;
        else lo = m;
      }
      let i2 = lo;

      // Fallback : fenêtre vide → utilise les 2 points encadrant xValue
      if (i2 <= i1) {
        lo = 0; hi = data.length - 1;
        while (lo < hi) {
          const m = (lo + hi) >> 1;
          if (data[m].x < xValue) lo = m + 1;
          else hi = m;
        }
        i1 = Math.max(0, lo - 1);
        i2 = Math.min(data.length - 1, lo);
        // Élargir si encore i1 == i2 (xValue exactement sur un point unique)
        if (i2 === i1 && data.length > 1) {
          if (i1 > 0) i1--;
          else if (i2 < data.length - 1) i2++;
        }
      }

      if (i2 > i1) {
        const dD = data[i2].x - data[i1].x;
        const dA = data[i2].y - data[i1].y;
        if (dD > 0) {
          const slope = (dA / dD) * 100;
          extra = `${slope >= 0 ? '+' : ''}${slope.toFixed(1)}%`;
        }
      }
    }
    items.push({ label: ds.label, value: y, color: ds.borderColor, extra });
  });

  if (items.length === 0) { ctx.restore(); return; }

  const fmtX = window._streamsFmtXTooltip || (v => v.toFixed(1));
  const title = fmtX(xValue);
  const fmtV = (v, lbl) => {
    if (lbl && (lbl.includes("W'bal") || lbl.includes('Vitesse'))) return v.toFixed(1);
    return Math.round(v).toString();
  };
  // Reformatage : "Altitude (m)" → label "Altitude" + unité "m" placée après la valeur
  const lines = items.map(it => {
    const m = (it.label || '').match(/^(.*?)\s*\((.+)\)\s*$/);
    const labelPart = m ? m[1].trim() : it.label;
    const unitPart = m ? m[2] : '';
    const valueStr = fmtV(it.value, it.label);
    const formatted = `${labelPart}: ${valueStr}${unitPart ? ' ' + unitPart : ''}`;
    return `${formatted}${it.extra ? ' · pente ' + it.extra : ''}`;
  });
  const allLines = [title, ...lines];

  ctx.font = '11px ui-sans-serif, system-ui, sans-serif';
  const widths = allLines.map(l => ctx.measureText(l).width);
  const boxW = Math.max(...widths) + 16;
  const lineH = 14;
  const boxH = allLines.length * lineH + 12;

  let bx = pixelX + 12;
  let by = top + 8;
  if (bx + boxW > right) bx = pixelX - boxW - 12;
  if (by + boxH > bottom) by = bottom - boxH - 8;
  if (bx < left) bx = left + 4;

  ctx.fillStyle = 'rgba(20,20,20,0.92)';
  ctx.strokeStyle = 'rgba(255,255,255,0.1)';
  ctx.lineWidth = 1;
  if (ctx.roundRect) {
    ctx.beginPath();
    ctx.roundRect(bx, by, boxW, boxH, 5);
    ctx.fill();
    ctx.stroke();
  } else {
    ctx.fillRect(bx, by, boxW, boxH);
    ctx.strokeRect(bx, by, boxW, boxH);
  }

  ctx.textBaseline = 'top';
  allLines.forEach((l, i) => {
    ctx.fillStyle = i === 0 ? 'rgba(255,255,255,0.65)' : items[i - 1].color;
    ctx.fillText(l, bx + 8, by + 6 + i * lineH);
  });

  ctx.restore();
}

export function _scheduleSmoothDraw() {
  if (appState._smoothFrame) return;
  appState._smoothFrame = requestAnimationFrame(() => {
    appState._smoothFrame = null;
    const v = appState._smoothPendingX;
    appState._modalCharts.forEach(c => {
      if (!_isStreamChart(c)) return; // ignore donuts et autres types
      c._stxv = v;
      _drawOverlay(c);
    });
  });
}


// Helper : le crosshair ne s'applique qu'aux line charts streams (pas aux donuts, bars, etc.)
function _isStreamChart(chart) {
  if (!chart || !chart.config || chart.config.type !== 'line') return false;
  if (!chart.canvas) return false;
  const id = chart.canvas.id || '';
  return id.startsWith('streams-');
}

export const smoothTooltipPlugin = {
  id: 'smoothTooltip',
  afterInit(chart) { if (_isStreamChart(chart)) _ensureOverlay(chart); },
  afterRender(chart) { if (_isStreamChart(chart)) { _ensureOverlay(chart); _drawOverlay(chart); } },
  resize(chart) { if (_isStreamChart(chart)) { _resizeOverlay(chart); _drawOverlay(chart); } },
  afterEvent(chart, args) {
    if (!_isStreamChart(chart)) return;
    const e = args.event;
    if (e.type === 'mousemove') {
      const { left, right, top, bottom } = chart.chartArea;
      if (e.x < left || e.x > right || e.y < top || e.y > bottom) {
        if (chart._stxv != null) {
          appState._smoothPendingX = null;
          _scheduleSmoothDraw();
        }
        return;
      }
      appState._smoothPendingX = chart.scales.x.getValueForPixel(e.x);
      _scheduleSmoothDraw();
    } else if (e.type === 'mouseout') {
      appState._smoothPendingX = null;
      _scheduleSmoothDraw();
    }
  },
};

function _getHatchPattern(ctx) {
  if (appState._hatchPattern) return appState._hatchPattern;
  const p = document.createElement('canvas');
  p.width = 7; p.height = 7;
  const pc = p.getContext('2d');
  pc.strokeStyle = 'rgba(248, 113, 113, 0.55)';
  pc.lineWidth = 1.2;
  pc.beginPath();
  pc.moveTo(-1, 8); pc.lineTo(8, -1);
  pc.moveTo(0, 14); pc.lineTo(14, 0);
  pc.stroke();
  appState._hatchPattern = ctx.createPattern(p, 'repeat');
  return appState._hatchPattern;
}

export const wbalNegStripesPlugin = {
  id: 'wbalNegStripes',
  afterDatasetsDraw(chart) {
    if (!chart.canvas || chart.canvas.id !== 'streams-wbal') return;
    const ds = chart.data.datasets[0];
    const data = ds && ds.data;
    if (!data || !data.length) return;
    const xScale = chart.scales.x;
    const yScale = chart.scales.y;
    if (!xScale || !yScale) return;
    const zeroY = yScale.getPixelForValue(0);
    const { top, bottom, left, right } = chart.chartArea;
    if (zeroY >= bottom) return; // toute la zone est >= 0

    const ctx = chart.ctx;
    ctx.save();
    // Clip strict à la zone du chart
    ctx.beginPath();
    ctx.rect(left, top, right - left, bottom - top);
    ctx.clip();

    // Construit le polygone sous-zéro (suit la courbe en dessous de 0, ferme à y=0)
    const xMin = xScale.min, xMax = xScale.max;
    let inNeg = false;
    ctx.beginPath();
    for (let i = 0; i < data.length; i++) {
      const p = data[i];
      if (p.x < xMin || p.x > xMax) continue;
      const px = xScale.getPixelForValue(p.x);
      const py = yScale.getPixelForValue(p.y);
      if (p.y < 0) {
        if (!inNeg) { ctx.moveTo(px, zeroY); inNeg = true; }
        ctx.lineTo(px, py);
      } else if (inNeg) {
        ctx.lineTo(px, zeroY);
        ctx.closePath();
        ctx.fillStyle = _getHatchPattern(ctx) || 'rgba(248,113,113,0.25)';
        ctx.fill();
        ctx.beginPath();
        inNeg = false;
      }
    }
    if (inNeg) {
      const last = data[data.length - 1];
      ctx.lineTo(xScale.getPixelForValue(last.x), zeroY);
      ctx.closePath();
      ctx.fillStyle = _getHatchPattern(ctx) || 'rgba(248,113,113,0.25)';
      ctx.fill();
    }
    ctx.restore();
  }
};
