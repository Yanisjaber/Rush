import { couleurDuType, sportDuType } from '../data/catalogue-sports';
import { clair, type Palette } from './couleurs';

// Catalogue des sports : mêmes clés, noms et couleurs que app/src/lib/sports.js.
// La couleur est une clé de palette : elle change toute seule en thème clair.
type CleCouleur = 'sportCourse' | 'sportVelo' | 'sportNatation' | 'sportMuscu' | 'sportHybride' | 'sportNeutre';

export const SPORTS = {
  course: { nom: 'Course à pied', court: 'Course', couleur: 'sportCourse' },
  velo: { nom: 'Cyclisme', court: 'Cyclisme', couleur: 'sportVelo' },
  natation: { nom: 'Natation', court: 'Natation', couleur: 'sportNatation' },
  triathlon: { nom: 'Triathlon', court: 'Triathlon', couleur: 'sportVelo' },
  duathlon: { nom: 'Duathlon', court: 'Duathlon', couleur: 'sportVelo' },
  hyrox: { nom: 'Hyrox', court: 'Hyrox', couleur: 'sportHybride' },
  muscu: { nom: 'Musculation', court: 'Muscu', couleur: 'sportMuscu' },
  autre: { nom: 'Autres', court: 'Autres', couleur: 'sportNeutre' },
} as const satisfies Record<string, { nom: string; court: string; couleur: CleCouleur }>;

export type CleSport = keyof typeof SPORTS;

/**
 * Couleur d'un sport dans la palette courante. `cle` est une famille de l'app (course, velo… : la couleur de la famille) ou un vrai sport
 * (TrailRun, Rowing… : sa couleur à lui). Inconnu ou absent : le gris neutre.
 */
export function couleurSport(palette: Palette, cle?: string): string {
  if (cle && Object.hasOwn(SPORTS, cle)) return palette[SPORTS[cle as CleSport].couleur];
  return sportDuType(cle) ? couleurSportType(palette, cle) : palette.sportNeutre;
}

/** Couleur d'un sport précis (un type brut : TrailRun, Rowing…) dans la palette courante. Un type inconnu prend le gris neutre. */
export function couleurSportType(palette: Palette, type?: string | null): string {
  return couleurDuType(type, palette.fond === clair.fond ? 'clair' : 'sombre');
}
