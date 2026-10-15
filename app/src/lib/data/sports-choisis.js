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
 * Nettoie une liste venue du stockage : on ne garde que des clés connues, une seule fois chacune, DANS L'ORDRE DE L'UTILISATEUR
 * (c'est l'ordre d'affichage des pastilles, réglable dans Paramètres › Préférences).
 * Renvoie null si ce n'est pas un tableau (= « jamais demandé »).
 */
export function nettoyerSports(brut) {
  if (!Array.isArray(brut)) return null;
  const connus = new Set(SPORTS_A_CHOISIR);
  const vus = new Set();
  const liste = [];
  for (const s of brut) {
    if (typeof s === 'string' && connus.has(s) && !vus.has(s)) {
      vus.add(s);
      liste.push(s);
    }
  }
  return liste;
}

/**
 * Les sports à montrer COCHÉS : ceux que l'utilisateur a choisis (dans son ordre), plus les sports principaux que ses données
 * font déjà apparaître dans la barre (muscu, Hyrox… révélés par ses séances) même s'il ne les a jamais cochés.
 * Sans cette règle commune, un sport visible dans la barre pourrait apparaître décoché dans Préférences.
 */
export function sportsCoches(liste, familles) {
  const base = Array.isArray(liste) ? liste : [];
  const revelesParLesDonnees = SPORTS_PRINCIPAUX.filter((s) => (familles || []).includes(s) && !base.includes(s));
  return [...base, ...revelesParLesDonnees];
}

/**
 * Faut-il proposer l'onboarding ? Seulement à un vrai compte neuf : sports jamais demandés ET aucune donnée (séance, force, Hyrox).
 * Un compte qui a déjà des données n'est jamais dérangé ; il peut changer ses sports dans Préférences.
 */
export function onboardingNecessaire({ demo = false, sportsEnregistres = null, nbSeances = 0, aForce = false, aHyrox = false } = {}) {
  return !demo && sportsEnregistres === null && nbSeances === 0 && !aForce && !aHyrox;
}

/**
 * Les familles de l'accueil qu'un sport choisi fait apparaître : le trail est de la course, le VTT du vélo.
 * Le triathlon et le duathlon sont des sports à part entière : cocher l'un n'ajoute ni course, ni vélo, ni natation
 * (on les coche à part, en plus si on les pratique aussi seuls).
 */
const FAMILLES_DU_SPORT = { trail: ['course'], vtt: ['velo'] };

/**
 * Les familles de sport de l'accueil, dans l'ordre d'affichage : d'abord les sports choisis (dans l'ordre de l'utilisateur),
 * puis ceux que ses données révèlent sans qu'il les ait cochés (« autre » n'a pas d'onglet).
 */
export function fusionnerFamilles(deDonnees = [], choisis = []) {
  const f = new Set();
  for (const s of choisis || []) {
    for (const famille of Object.hasOwn(FAMILLES_DU_SPORT, s) ? FAMILLES_DU_SPORT[s] : [s]) f.add(famille);
  }
  for (const famille of deDonnees || []) f.add(famille);
  f.delete('autre');
  return [...f];
}
