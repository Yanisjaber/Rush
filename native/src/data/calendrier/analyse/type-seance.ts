// Le type d'une sortie, deviné d'après son nom (et sa durée à défaut) : ce que la personne comptait faire, quand aucune séance prévue ne le dit.
export type TypeSeance = 'footing' | 'fractionne' | 'longue' | 'competition' | 'autre';

const sansAccent = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

/**
 * Le type de la séance, deviné d'après son nom (le nom reste ici : il n'est jamais envoyé) et, à défaut, sa durée.
 * Une sortie de plus d'1 h 30 sans autre indice est une sortie longue.
 */
export function typeDeSeance(nom: string | null | undefined, dureeS: number | null | undefined): TypeSeance {
  const n = sansAccent(String(nom ?? ''));
  if (/\b(fraction|vma|interval|serie|series|fartlek|pyramide|cotes?|cote)\b|\d\s*x\s*\d/.test(n)) return 'fractionne';
  if (/\b(competition|course|race|10\s?k|5\s?k|semi|marathon|trail)\b|\b(10|5)\s?km\b/.test(n)) return 'competition';
  if (/\b(sortie longue|longue|sl)\b/.test(n)) return 'longue';
  if (/\b(footing|ef|endurance|recup|recuperation|facile|decrassage|reprise)\b/.test(n)) return 'footing';
  return Number(dureeS) >= 5400 ? 'longue' : 'autre';
}
