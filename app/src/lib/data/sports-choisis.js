// Les sports choisis par l'utilisateur (onboarding et Préférences) : fonctions pures, sans réseau.
// Stockage : colonne `sports` de user_preferences (tableau JSON de clés de lib/sports.js). `null` = jamais demandé.

/** Les cinq sports qui ont leurs widgets et leurs onglets sur l'accueil. */
export const SPORTS_PRINCIPAUX = ['course', 'velo', 'natation', 'muscu', 'hyrox'];

/** Les autres sports de performance : ils ont leur pastille de couleur et leurs séances, sans widgets dédiés. */
export const SPORTS_AUTRES = ['athletisme', 'trail', 'vtt', 'triathlon', 'duathlon', 'crossfit', 'aviron', 'ski', 'combat', 'rando', 'escalade', 'pagaie'];

/** Tout ce qu'on peut cocher, dans l'ordre de l'écran. */
export const SPORTS_A_CHOISIR = [...SPORTS_PRINCIPAUX, ...SPORTS_AUTRES];

/** Les sports rangés par thème pour l'écran de choix (chaque sport proposé apparaît dans un seul groupe). */
export const GROUPES_SPORTS = [
  { titre: 'Course & athlé', sports: ['course', 'trail', 'athletisme'] },
  { titre: 'Vélo & multisport', sports: ['velo', 'vtt', 'triathlon', 'duathlon'] },
  { titre: 'Eau', sports: ['natation', 'aviron', 'pagaie'] },
  { titre: 'Force & hybride', sports: ['muscu', 'hyrox', 'crossfit', 'combat'] },
  { titre: 'Nature', sports: ['rando', 'escalade', 'ski'] },
];

/**
 * Nettoie une liste venue du stockage : on ne garde que des clés connues, une seule fois chacune, dans l'ordre de l'écran.
 * Renvoie null si ce n'est pas un tableau (= « jamais demandé »).
 */
export function nettoyerSports(brut) {
  if (!Array.isArray(brut)) return null;
  const choisis = new Set(brut.filter((s) => typeof s === 'string'));
  return SPORTS_A_CHOISIR.filter((s) => choisis.has(s));
}

/**
 * Faut-il proposer l'onboarding ? Seulement à un vrai compte neuf : sports jamais demandés ET aucune donnée (séance, force, Hyrox).
 * Un compte qui a déjà des données n'est jamais dérangé ; il peut changer ses sports dans Préférences.
 */
export function onboardingNecessaire({ demo = false, sportsEnregistres = null, nbSeances = 0, aForce = false, aHyrox = false } = {}) {
  return !demo && sportsEnregistres === null && nbSeances === 0 && !aForce && !aHyrox;
}

/** Les familles de l'accueil qu'un sport choisi fait apparaître : le trail est de la course, le VTT du vélo, le triathlon les trois disciplines, le duathlon course et vélo. */
const FAMILLES_DU_SPORT = { trail: ['course'], vtt: ['velo'], triathlon: ['course', 'velo', 'natation'], duathlon: ['course', 'velo'] };

/** Les familles de sport de l'accueil : celles déduites des données, plus celles des sports choisis (« autre » n'a pas d'onglet). */
export function fusionnerFamilles(deDonnees = [], choisis = []) {
  const f = new Set(deDonnees);
  for (const s of choisis || []) {
    for (const famille of Object.hasOwn(FAMILLES_DU_SPORT, s) ? FAMILLES_DU_SPORT[s] : [s]) f.add(famille);
  }
  f.delete('autre');
  return [...f];
}
