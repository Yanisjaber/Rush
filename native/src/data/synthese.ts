// Calculs purs sur les données brutes (ni réseau ni écran, donc testables).
// Port de app/src/lib/data/synthese.js : pour l'instant seulement ce que l'Accueil utilise.
import { dateIsoLocale } from './format.ts';
import type { Prevue, Seance } from './types.ts';

/**
 * Charge d'une séance, en « points ». Principe : une charge universelle, comparable d'un sport
 * à l'autre. Le TSS enregistré s'il existe ; sinon une estimation simple à partir de la durée
 * (un peu plus élevée si le cardio est connu).
 */
export function chargeSeance(s: Pick<Seance, 'tss' | 'moving_time' | 'avg_heartrate'>): number {
  if (typeof s.tss === 'number' && s.tss > 0) return s.tss;
  const heures = (s.moving_time || 0) / 3600;
  return Math.round(heures * (s.avg_heartrate ? 45 : 35));
}

/**
 * Les prochaines séances prévues (aujourd'hui compris), de la plus proche à la plus lointaine.
 * Les compétitions n'en font pas partie : elles ont leur dossard d'objectif.
 */
export function prochainesPrevues(planifiees: Prevue[] | null | undefined, aujourdhui: Date = new Date(), limite = 3): Prevue[] {
  const aujIso = dateIsoLocale(aujourdhui);
  return (planifiees || [])
    .filter((p) => p.category !== 'competition' && String(p.date).slice(0, 10) >= aujIso)
    .sort((a, b) => String(a.date).localeCompare(String(b.date)))
    .slice(0, limite);
}
