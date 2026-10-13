/* src/core/format.js — extrait de l'ancien app.js (découpage par fonctionnalité). */


// ========= UTIL : format durée =========
// < 60 min → "X min" ; sinon "XhYY". Utilisé partout pour homogénéiser l'affichage.
export function fmtDur(min) {
  min = Math.round(Number(min) || 0);
  if (min < 60) return min + ' min';
  const h = Math.floor(min / 60);
  const m = (min % 60).toString().padStart(2, '0');
  return h + 'h' + m;
}


// Priorité de compétition : Principal (doré) / Secondaire (argenté).
// Compat : anciennes valeurs 'A' → principal, 'B'/'C' → secondaire.
export function compPrio(priority) {
  const isPrincipal = (priority === 'A' || priority === 'principal' || priority == null || priority === '');
  return isPrincipal
    ? { key: 'principal', label: 'Objectif', color: '#fbbf24' }
    : { key: 'secondaire', label: 'Préparation', color: '#9ca3af' };
}

export function trophySvg(color, size = 15) {
  return `<svg class="comp-trophy" viewBox="0 0 24 24" width="${size}" height="${size}" fill="none" stroke="${color}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M6 9H4.5a2.5 2.5 0 0 1 0-5H6"/><path d="M18 9h1.5a2.5 2.5 0 0 0 0-5H18"/><path d="M4 22h16"/><path d="M10 14.66V17c0 .55-.47.98-.97 1.21C7.85 18.75 7 20.24 7 22"/><path d="M14 14.66V17c0 .55.47.98.97 1.21C16.15 18.75 17 20.24 17 22"/><path d="M18 2H6v7a6 6 0 0 0 12 0V2Z"/></svg>`;
}


// Petit canapé dessiné pour les jours de repos.
export const REST_COUCH_SVG = `<svg class="rest-couch" viewBox="0 0 64 44" fill="none" stroke="currentColor" stroke-width="2.3" stroke-linejoin="round" stroke-linecap="round"><path d="M14 24 V12 C14 9.2 15.6 8 18 8 H30.5 C31.5 8 32 8.6 32 9.6 V24"/><path d="M50 24 V12 C50 9.2 48.4 8 46 8 H33.5 C32.5 8 32 8.6 32 9.6 V24"/><path d="M13 24 H31 C31.6 24 32 24.5 32 25.2 V31 H10 V27 C10 25.3 11.3 24 13 24 Z"/><path d="M51 24 H33 C32.4 24 32 24.5 32 25.2 V31 H54 V27 C54 25.3 52.7 24 51 24 Z"/><path d="M9 31 H55 V35 H9 Z"/><path d="M13 35 V40"/><path d="M51 35 V40"/></svg>`;

// Jour de repos (calendrier) : lune + étoiles, liseré violet — même langage que les séances
export const REST_MOON_SVG = `<svg class="rest-moon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3c.132 0 .263 0 .393 0a7.5 7.5 0 0 0 7.92 12.446a9 9 0 1 1 -8.313 -12.454z"/><path d="M17 4a2 2 0 0 0 2 2a2 2 0 0 0 -2 2a2 2 0 0 0 -2 -2a2 2 0 0 0 2 -2"/><path d="M19 11h2m-1 -1v2"/></svg>`;

export function bootFormat() {

window.fmtDur = fmtDur;

window.compPrio = compPrio;

window.trophySvg = trophySvg;
}
