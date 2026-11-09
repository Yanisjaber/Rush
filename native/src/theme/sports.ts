import { couleurDuType, sportDuType } from '../data/sports/catalogue-sports';
import { famillesDuFiltre } from '../data/sports/filtre';
import { clair, melange, type Palette } from './couleurs';

// Catalogue des sports : mêmes clés, noms et couleurs que app/src/lib/sports.js.
// La couleur est une clé de palette : elle change toute seule en thème clair.
type CleCouleur = 'sportCourse' | 'sportVelo' | 'sportNatation' | 'sportMuscu' | 'sportHybride' | 'sportNeutre';

export const SPORTS = {
  course: { nom: 'Course à pied', court: 'Course', couleur: 'sportCourse' },
  velo: { nom: 'Cyclisme', court: 'Cyclisme', couleur: 'sportVelo' },
  natation: { nom: 'Natation', court: 'Natation', couleur: 'sportNatation' },
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
  // Plusieurs sports cochés (« course+velo ») : le mélange à parts égales de leurs couleurs
  const choisis = famillesDuFiltre(cle);
  if (choisis && choisis.length > 1) return melangerCouleurs(choisis.map((f) => couleurSport(palette, f)));
  if (cle && Object.hasOwn(SPORTS, cle)) return palette[SPORTS[cle as CleSport].couleur];
  return sportDuType(cle) ? couleurSportType(palette, cle) : palette.sportNeutre;
}

/** Le mélange à parts égales de plusieurs couleurs hexadécimales (deux : moitié-moitié ; trois : un tiers chacune). */
export function melangerCouleurs(couleurs: readonly string[]): string {
  return couleurs.reduce((acc, c, i) => (i === 0 ? c : melange(c, acc, 100 / (i + 1))));
}

/** Couleur d'un sport précis (un type brut : TrailRun, Rowing…) dans la palette courante. Un type inconnu prend le gris neutre. */
export function couleurSportType(palette: Palette, type?: string | null): string {
  return couleurDuType(type, palette.fond === clair.fond ? 'clair' : 'sombre');
}
