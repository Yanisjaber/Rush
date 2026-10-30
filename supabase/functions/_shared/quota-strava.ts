// Les limites d'appels que Strava annonce dans chaque réponse :
//   X-RateLimit-Limit: 100,1000   (par quart d'heure, par jour)
//   X-RateLimit-Usage: 45,310     (déjà utilisés dans le quart d'heure, dans la journée)
// Les limites valent pour toute l'application Rush (tous les comptes ensemble) : l'écran de synchro les lit ici pour prévoir ses pauses.

export interface QuotaStrava {
  limite15: number;
  limiteJour: number;
  usage15: number;
  usageJour: number;
}

/** Deux entiers positifs séparés par une virgule, sinon null. */
function deuxEntiers(valeur: string | null): [number, number] | null {
  if (!valeur) return null;
  const m = /^\s*(\d{1,7})\s*,\s*(\d{1,7})\s*$/.exec(valeur);
  return m ? [Number(m[1]), Number(m[2])] : null;
}

/** Le quota lu dans les en-têtes d'une réponse de Strava, ou null si Strava ne les a pas donnés. */
export function lireQuota(en: { get(nom: string): string | null }): QuotaStrava | null {
  const limite = deuxEntiers(en.get("x-ratelimit-limit"));
  const usage = deuxEntiers(en.get("x-ratelimit-usage"));
  if (!limite || !usage || limite[0] <= 0 || limite[1] <= 0) return null;
  return { limite15: limite[0], limiteJour: limite[1], usage15: usage[0], usageJour: usage[1] };
}
