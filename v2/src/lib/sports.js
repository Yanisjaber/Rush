// Catalogue des sports de l'app v2 : un nom et une couleur par sport.
// La couleur est celle d'une variable CSS (voir tokens.css) : elle change toute seule en thème clair.
// Sports de performance liés à un entraînement physique et à une forme (pas de sports collectifs).

export const SPORTS = {
  course: { nom: 'Course à pied', court: 'Course', couleur: 'var(--sport-course)' },
  trail: { nom: 'Trail', court: 'Trail', couleur: 'var(--sport-course)' },
  velo: { nom: 'Vélo route', court: 'Vélo', couleur: 'var(--sport-velo)' },
  vtt: { nom: 'VTT / Gravel', court: 'VTT', couleur: 'var(--sport-velo)' },
  natation: { nom: 'Natation', court: 'Natation', couleur: 'var(--sport-natation)' },
  triathlon: { nom: 'Triathlon', court: 'Triathlon', couleur: 'var(--sport-velo)' },
  hyrox: { nom: 'Hyrox', court: 'Hyrox', couleur: 'var(--sport-hybride)' },
  crossfit: { nom: 'CrossFit', court: 'CrossFit', couleur: 'var(--sport-hybride)' },
  muscu: { nom: 'Musculation', court: 'Muscu', couleur: 'var(--sport-muscu)' },
  aviron: { nom: 'Aviron', court: 'Aviron', couleur: 'var(--sport-natation)' },
  ski: { nom: 'Ski de fond', court: 'Ski', couleur: 'var(--sport-neutre)' },
  combat: { nom: 'Sports de combat', court: 'Combat', couleur: 'var(--sport-neutre)' },
  autre: { nom: 'Autre sport', court: 'Autre', couleur: 'var(--sport-neutre)' },
};

/** Couleur d'un sport (repli neutre si le sport est inconnu). */
export function couleurSport(cle) {
  return (SPORTS[cle] || SPORTS.autre).couleur;
}
