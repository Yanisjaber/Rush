/* src/features/dashboard/charts-core.js — extrait de l'ancien app.js (découpage par fonctionnalité). */
import { appState } from '../../core/state.js';
import { fmtDate } from '../../core/utils.js';


export function bootChartsCore() {


// ========= CHART DEFAULTS =========
Chart.defaults.color = '#8b94a8';

Chart.defaults.borderColor = '#232a3a';

Chart.defaults.font.family = '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';

// Tooltips : ronds pleins au lieu de carrés pour les indicateurs de série
Chart.defaults.plugins.tooltip.usePointStyle = true;

Chart.defaults.plugins.tooltip.boxPadding = 6;


// ========= PLUGIN : LIGNE VERTICALE AU HOVER =========
Chart.register({
  id: 'verticalHoverLine',
  afterDraw: (chart) => {
    if (chart.config.options?.plugins?.verticalHoverLine === false) return;
    if (!chart.tooltip || !chart.tooltip._active || chart.tooltip._active.length === 0) return;
    const ctx = chart.ctx;
    const x = chart.tooltip._active[0].element.x;
    const topY = chart.chartArea.top;
    const bottomY = chart.chartArea.bottom;
    ctx.save();
    ctx.beginPath();
    ctx.moveTo(x, topY);
    ctx.lineTo(x, bottomY);
    ctx.lineWidth = 1;
    ctx.setLineDash([4, 4]);
    ctx.strokeStyle = 'rgba(139, 148, 168, 0.5)';
    ctx.stroke();
    ctx.restore();
  }
});

// Forcer le remplissage avec la couleur de la courbe / barre (sinon intérieur transparent / "blanc")
Chart.defaults.plugins.tooltip.callbacks = Chart.defaults.plugins.tooltip.callbacks || {};

Chart.defaults.plugins.tooltip.callbacks.labelColor = function(context) {
  // Priorité : couleur spécifique de la barre survolée si backgroundColor est un array,
  // sinon borderColor de la courbe, sinon backgroundColor unique.
  const ds = context.dataset;
  let color;
  if (Array.isArray(ds.backgroundColor)) {
    color = ds.backgroundColor[context.dataIndex];
  } else {
    color = ds.borderColor || ds.backgroundColor || '#888';
  }
  return {
    borderColor: color,
    backgroundColor: color,
    borderWidth: 0,
    borderRadius: 0
  };
};


appState.labels = appState.data.map(d => fmtDate(d.date));
}
