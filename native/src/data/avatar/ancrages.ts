// Où tombent, à l'écran, les points d'intérêt de l'avatar (pour accrocher les légendes de la carte).
// Fonctions pures, sans React Native : testables avec node. Le calcul reprend la caméra du composant 3D.

export type ZoneAvatarCle = 'heart' | 'lungs' | 'chest' | 'arms' | 'legs' | 'head';

/** Caméra de `ModeleAthleteRealiste` : à garder identique des deux côtés. */
export const CAMERA = {
  /** Champ de vision vertical, en degrés. */
  fov: 32,
  /** Distance caméra → avatar, en mètres. */
  distance: 3.7,
  /** Hauteur de l'avatar, pieds au sol, en mètres. */
  hauteurModele: 1.8,
} as const;

/** Points d'intérêt sur l'avatar de face : X (m, + = côté gauche de la personne = droite de l'écran), Y (m depuis le sol). */
export const POINTS_MODELE: Record<ZoneAvatarCle, { x: number; y: number }> = {
  heart: { x: 0.05, y: 1.29 },
  lungs: { x: -0.1, y: 1.34 },
  chest: { x: 0.12, y: 1.06 },
  arms: { x: -0.4, y: 1.02 },
  legs: { x: -0.11, y: 0.55 },
  head: { x: 0, y: 1.68 },
};

/** Pixels par mètre au niveau de l'avatar, pour une vue de cette hauteur. */
export function pixelsParMetre(hauteurVue: number): number {
  const demiHauteurMonde = CAMERA.distance * Math.tan((CAMERA.fov * Math.PI) / 360);
  return hauteurVue / 2 / demiHauteurMonde;
}

/** Position à l'écran (pixels, origine en haut à gauche de la vue) d'un point du modèle de face. */
export function versEcran(point: { x: number; y: number }, largeurVue: number, hauteurVue: number): { x: number; y: number } {
  const k = pixelsParMetre(hauteurVue);
  return {
    x: largeurVue / 2 + point.x * k,
    y: hauteurVue / 2 - (point.y - CAMERA.hauteurModele / 2) * k,
  };
}

export function ancragesEcran(largeurVue: number, hauteurVue: number): Record<ZoneAvatarCle, { x: number; y: number }> {
  const sortie = {} as Record<ZoneAvatarCle, { x: number; y: number }>;
  for (const cle of Object.keys(POINTS_MODELE) as ZoneAvatarCle[]) sortie[cle] = versEcran(POINTS_MODELE[cle], largeurVue, hauteurVue);
  return sortie;
}

/** Trait entre deux points : milieu, longueur et angle (radians), pour dessiner une ligne avec une vue tournée. */
export function trait(a: { x: number; y: number }, b: { x: number; y: number }): { milieuX: number; milieuY: number; longueur: number; angle: number } {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  return { milieuX: (a.x + b.x) / 2, milieuY: (a.y + b.y) / 2, longueur: Math.hypot(dx, dy), angle: Math.atan2(dy, dx) };
}
