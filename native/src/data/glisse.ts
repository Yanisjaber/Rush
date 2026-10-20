// Calculs du glisser-déposer de la grille de l'accueil (mode édition). Fonctions pures, sans écran.
/** Boîte d'un élément d'une grille (liste qui passe à la ligne) : position du coin haut-gauche et taille. */
export interface BoiteGrille {
  x: number;
  y: number;
  w: number;
  h: number;
}

/**
 * Quel élément de la grille (hors `exclu`, celui qu'on glisse) est sous le point (cx, cy) ? Renvoie son index, ou -1 si le point
 * est entre deux éléments. `boites` donne la place ACTUELLE de chacun (celle de l'aperçu, pas celle de départ).
 */
export function elementSousPoint(boites: readonly BoiteGrille[], exclu: number, cx: number, cy: number): number {
  return boites.findIndex((b, i) => i !== exclu && cx >= b.x && cx <= b.x + b.w && cy >= b.y && cy <= b.y + b.h);
}

/** Déplace un élément d'une position à une autre ; renvoie la même liste si rien ne change. */
export function deplacerVers<T>(liste: T[], de: number, vers: number): T[] {
  if (de === vers || de < 0 || vers < 0 || de >= liste.length || vers >= liste.length) return liste;
  const copie = [...liste];
  const [bouge] = copie.splice(de, 1);
  copie.splice(vers, 0, bouge);
  return copie;
}

/** Défilement automatique près des bords : vitesse (px par pas) selon la distance du doigt au bord, 0 au milieu. */
export function vitesseDefilement(doigtY: number, hautVisible: number, basVisible: number, zone = 110, max = 18): number {
  if (doigtY < hautVisible + zone) return -Math.min(max, ((hautVisible + zone - doigtY) / zone) * max);
  if (doigtY > basVisible - zone) return Math.min(max, ((doigtY - (basVisible - zone)) / zone) * max);
  return 0;
}
