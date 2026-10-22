// Catalogue des sports de l'app : un nom et une couleur par sport.
// La couleur est celle d'une variable CSS (voir tokens.css) : elle change toute seule en thème clair.
// Sports de performance liés à un entraînement physique et à une forme (pas de sports collectifs).

export const SPORTS = {
  course: { nom: 'Course à pied', court: 'Course', couleur: 'var(--sport-course)' },
  velo: { nom: 'Cyclisme', court: 'Cyclisme', couleur: 'var(--sport-velo)' },
  natation: { nom: 'Natation', court: 'Natation', couleur: 'var(--sport-natation)' },
  triathlon: { nom: 'Triathlon', court: 'Triathlon', couleur: 'var(--sport-velo)' },
  duathlon: { nom: 'Duathlon', court: 'Duathlon', couleur: 'var(--sport-velo)' },
  hyrox: { nom: 'Hyrox', court: 'Hyrox', couleur: 'var(--sport-hybride)' },
  muscu: { nom: 'Musculation', court: 'Muscu', couleur: 'var(--sport-muscu)' },
  autre: { nom: 'Autres', court: 'Autres', couleur: 'var(--sport-neutre)' },
};

/** Couleur d'un sport (repli neutre si le sport est inconnu). */
export function couleurSport(cle) {
  const sport = typeof cle === 'string' && Object.hasOwn(SPORTS, cle) ? SPORTS[cle] : SPORTS.autre;
  return sport.couleur;
}
