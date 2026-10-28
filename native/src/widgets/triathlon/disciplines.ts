import type { Discipline } from '@/data/sports/triathlon';
import type { Palette } from '@/theme/couleurs';

// Les trois disciplines du triathlon : leur nom et leur couleur (la couleur désigne le sport : natation cyan, vélo bleu, course orange).
export const NOM_DISCIPLINE: Record<Discipline, string> = { natation: 'Natation', velo: 'Vélo', course: 'Course' };
export const NOM_COURT: Record<Discipline, string> = { natation: 'Nat.', velo: 'Vélo', course: 'Course' };

export function couleurDiscipline(p: Palette, d: Discipline): string {
  return d === 'natation' ? p.sportNatation : d === 'velo' ? p.sportVelo : p.sportCourse;
}
