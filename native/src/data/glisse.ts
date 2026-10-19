// Calculs du glisser-déposer d'une liste verticale (mode édition de l'accueil). Fonctions pures, sans écran.
export interface Boite {
  y: number; // position du haut, dans la liste
  h: number; // hauteur (marge comprise)
}

/**
 * Où va tomber l'élément `de` si on le lâche maintenant : son centre est à `centre` (dans le repère de la liste).
 * On compte les AUTRES éléments dont le milieu est au-dessus de ce centre : c'est le nouvel index.
 */
export function indiceCible(boites: Boite[], de: number, centre: number): number {
  let vers = 0;
  boites.forEach((b, i) => {
    if (i !== de && b.y + b.h / 2 < centre) vers++;
  });
  return vers;
}

/**
 * De combien chaque élément se pousse pour faire de la place (celui qu'on glisse ne compte pas : il suit le doigt).
 * Vers le bas (de < vers) : les éléments entre les deux montent ; vers le haut : ils descendent.
 */
export function decalages(boites: Boite[], de: number, vers: number): number[] {
  const hauteur = boites[de]?.h ?? 0;
  return boites.map((_, i) => {
    if (i === de) return 0;
    if (de < vers && i > de && i <= vers) return -hauteur;
    if (de > vers && i >= vers && i < de) return hauteur;
    return 0;
  });
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
