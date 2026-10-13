/* src/features/sport/sport-display.js — icônes, couleurs et libellés de sport.
   Déplacé tel quel depuis streams-section.js (aucun changement de comportement).
   Expose window.sportGlyph / sportColor / sportFr / sportEmoji / activitySportLabel /
   activitySportColorKey, utilisés par le calendrier, les listes et les modales. */
import { SPORT_CATEGORY_FR, SPORT_COLOR_FROM_CATEGORY, SPORT_COLOR_KEY } from '../../core/sports-catalog.js';

// ============================================================
// Icone "dessin" coloree du sport (petit SVG trait, teinte = couleur du sport).
// Accepte un raw_type Strava (Ride, TrailRun...) OU une categorie interne.
// ============================================================
const SPORT_CAT_COLOR = {
  triathlon: '#f43f5e',
  cyclisme: '#3b82f6', vtt: '#b45309', course: '#fc4c02', trail: '#15803d',
  natation: '#06b6d4', musculation: '#ef4444', marche: '#65a30d', ski: '#60a5fa',
  nautique: '#0284c7', football: '#22c55e', collectif: '#c026d3', raquette: '#eab308',
  yoga: '#a78bfa', escalade: '#c2410c', combat: '#b91c1c', autre: '#9ca3af',
};

function _sportCatKey(v) {
  if (!v) return 'autre';
  if (SPORT_COLOR_KEY[v]) return SPORT_COLOR_KEY[v];                 // raw_type -> categorie
  if (SPORT_CAT_COLOR[v]) return v;                                  // deja une categorie
  if (SPORT_COLOR_FROM_CATEGORY[v]) return SPORT_COLOR_FROM_CATEGORY[v];
  return 'autre';
}

const _SPORT_ICON_GROUP = {
  triathlon: 'run',
  cyclisme: 'bike', vtt: 'bike',
  course: 'run', trail: 'run', marche: 'walk',
  natation: 'swim', nautique: 'swim',
  musculation: 'gym',
  ski: 'mountain', escalade: 'mountain',
  football: 'ball', collectif: 'ball', raquette: 'ball', combat: 'ball',
  yoga: 'dot', autre: 'dot',
};

const _SPORT_ICON_SVG = {
  bike: '<circle cx="5.5" cy="17.5" r="3.5"/><circle cx="18.5" cy="17.5" r="3.5"/><circle cx="15" cy="5" r="1"/><path d="M12 17.5V14l-3-3 4-3 2 3h2"/>',
  run: '<circle cx="13" cy="4" r="1.4"/><path d="M4 17l5 1 .9-1.6"/><path d="M15 21v-4.5l-4-3 1-6"/><path d="M7 12V9l5-1 3 3 3 1"/>',
  walk: '<circle cx="13" cy="4" r="1.4"/><path d="M7 21l3-4"/><path d="M16 21l-2-4-3-3 1-6"/><path d="M6 12l2-3 4-1 3 3 3 1"/>',
  swim: '<path d="M2 8c1 .8 2 .8 3 0s2-.8 3 0 2 .8 3 0 2-.8 3 0 2 .8 3 0 2-.8 3 0"/><path d="M2 13c1 .8 2 .8 3 0s2-.8 3 0 2 .8 3 0 2-.8 3 0 2 .8 3 0 2-.8 3 0"/><path d="M2 18c1 .8 2 .8 3 0s2-.8 3 0 2 .8 3 0 2-.8 3 0 2 .8 3 0 2-.8 3 0"/>',
  gym: '<rect x="1.6" y="8" width="2.6" height="8" rx="1" fill="currentColor" stroke="none"/><rect x="4.4" y="9.6" width="2" height="4.8" rx="0.6" fill="currentColor" stroke="none"/><rect x="6.4" y="11" width="11.2" height="2" fill="currentColor" stroke="none"/><rect x="17.6" y="9.6" width="2" height="4.8" rx="0.6" fill="currentColor" stroke="none"/><rect x="19.8" y="8" width="2.6" height="8" rx="1" fill="currentColor" stroke="none"/>',
  mountain: '<path d="M2 19 8 8l3.5 6 2.5-4.5L22 19Z"/>',
  ball: '<circle cx="12" cy="12" r="8"/><path d="M4.6 9.4c4.9 3 9.9 3 14.8 0"/><path d="M4.6 14.6c4.9-3 9.9-3 14.8 0"/>',
  dot: '<circle cx="12" cy="12" r="6" fill="currentColor" stroke="none"/>',
};


// Helper : emoji du sport (accepte un raw_type Strava OU une categorie interne)
const SPORT_CATEGORY_EMOJI = { cyclisme: '🚴', course: '🏃', natation: '🏊', musculation: '🏋️', triathlon: '🏊🚴🏃', autre: '🏅' };

export function bootSportDisplay() {

window.sportGlyph = function (v, size) {
  size = size || 15;
  const cat = _sportCatKey(v);
  const color = SPORT_CAT_COLOR[cat] || '#9ca3af';
  const inner = _SPORT_ICON_SVG[_SPORT_ICON_GROUP[cat] || 'dot'];
  return '<svg width="' + size + '" height="' + size + '" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="color:' + color + ';display:inline-block;vertical-align:-2px;flex:none">' + inner + '</svg>';
};

// Couleur (hex) du sport — meme palette que les barres laterales.
window.sportColor = function (v) { return SPORT_CAT_COLOR[_sportCatKey(v)] || '#9ca3af'; };


// Helper unique : renvoie le nom Strava FR exact à afficher
//  Priorité : raw_type Strava traduit → catégorie traduite → 'Activité'
window.sportFr = (rawTypeOrCategory) => {
  if (!rawTypeOrCategory) return 'Activité';
  const entry = window.SPORTS_CATALOG[rawTypeOrCategory];
  if (entry) return entry.fr;
  if (SPORT_CATEGORY_FR[rawTypeOrCategory]) return SPORT_CATEGORY_FR[rawTypeOrCategory];
  return rawTypeOrCategory; // type Strava inconnu : on le montre brut
};

window.sportEmoji = (rawTypeOrCategory) => {
  if (!rawTypeOrCategory) return '';
  const entry = window.SPORTS_CATALOG[rawTypeOrCategory];
  if (entry && entry.icon) return entry.icon;
  return SPORT_CATEGORY_EMOJI[rawTypeOrCategory] || '';
};


// Helper qui prend une activité complète et renvoie le nom de sport à afficher
window.activitySportLabel = (act) => {
  if (!act) return 'Activité';
  // Priorité 1 : raw_type Strava (ex: "Ride" → "Cyclisme")
  if (act.raw_type) return window.sportFr(act.raw_type);
  // Priorité 2 : type brut Strava sur certaines anciennes activités
  if (act.type && window.SPORTS_CATALOG[act.type]) return window.sportFr(act.type);
  // Priorité 3 : catégorie interne
  if (act.sport) return window.sportFr(act.sport);
  return 'Activité';
};


// Helper qui renvoie la "clé couleur" (data-attribute pour CSS)
window.activitySportColorKey = (act) => {
  if (!act) return 'autre';
  if (act.raw_type && SPORT_COLOR_KEY[act.raw_type]) return SPORT_COLOR_KEY[act.raw_type];
  if (act.type && SPORT_COLOR_KEY[act.type]) return SPORT_COLOR_KEY[act.type];
  // sport peut être soit un raw_type Strava (ex: "Ride") soit une catégorie ("cyclisme")
  if (act.sport && SPORT_COLOR_KEY[act.sport]) return SPORT_COLOR_KEY[act.sport];
  if (act.sport && SPORT_COLOR_FROM_CATEGORY[act.sport]) return SPORT_COLOR_FROM_CATEGORY[act.sport];
  return 'autre';
};
}
