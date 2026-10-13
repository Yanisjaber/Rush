// Les sports choisis par l'utilisateur (onboarding et Préférences) : fonctions pures, sans réseau.
// Stockage : colonne `sports` de user_preferences (tableau JSON de clés). `null` = jamais demandé.

/** Ce qu'on propose de cocher : les cinq familles qui ont leurs widgets et leurs onglets, plus « Autre ». */
export const SPORTS_A_CHOISIR = ['course', 'velo', 'natation', 'muscu', 'hyrox', 'autre'];

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

/** Les familles de sport de l'accueil : celles déduites des données, plus celles que l'utilisateur a choisies (« Autre » n'a pas d'onglet). */
export function fusionnerFamilles(deDonnees = [], choisis = []) {
  const f = new Set(deDonnees);
  for (const s of choisis || []) f.add(s);
  f.delete('autre');
  return [...f];
}
