import type { Palette } from './couleurs';

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

/** Couleur d'un sport dans la palette courante (repli neutre si le sport est inconnu ou absent). */
export function couleurSport(palette: Palette, cle?: string): string {
  const sport = cle && Object.hasOwn(SPORTS, cle) ? SPORTS[cle as CleSport] : SPORTS.autre;
  return palette[sport.couleur];
}
