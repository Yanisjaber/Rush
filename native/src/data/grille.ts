import type { Taille } from './types.ts';

/**
 * Parmi les tailles des widgets dans l'ordre, lesquels sont des S « seuls » ? Les S voisins se rangent deux par deux ;
 * dans une suite de S de longueur impaire, le dernier reste seul sur sa ligne (l'accueil le centre).
 */
export function solitaires(tailles: readonly Taille[]): boolean[] {
  const seul = tailles.map(() => false);
  let suite = 0;
  tailles.forEach((t, i) => {
    suite = t === 's' ? suite + 1 : 0;
    // Fin de la suite de S (le suivant n'en est pas un) et nombre impair : celui-ci est seul
    if (t === 's' && tailles[i + 1] !== 's' && suite % 2 === 1) seul[i] = true;
  });
  return seul;
}

/** Un élément de la grille tel qu'il a été mesuré : sa taille de widget, sa largeur et sa hauteur (marges comprises). */
export interface CaseGrille {
  taille: Taille;
  w: number;
  h: number;
}

/**
 * Où chaque élément se range, dans l'ordre donné, dans une grille de `largeur` points : les mêmes règles que l'accueil
 * (les S par deux, les autres sur toute la ligne, un S seul centré). Sert à montrer, pendant un glissement, la place
 * que prendra chaque widget une fois lâché. Renvoie le coin haut gauche de chaque élément.
 */
export function placerGrille(cases: readonly CaseGrille[], largeur: number): { x: number; y: number }[] {
  const seuls = solitaires(cases.map((c) => c.taille));
  const positions: { x: number; y: number }[] = [];
  let x = 0;
  let y = 0;
  let hauteurLigne = 0;
  cases.forEach((c, i) => {
    const pleine = c.taille !== 's';
    // Passage à la ligne : un élément pleine largeur, ou un S qui ne tient plus à côté du précédent
    if (x > 0 && (pleine || x + c.w > largeur + 0.5)) {
      y += hauteurLigne;
      x = 0;
      hauteurLigne = 0;
    }
    positions.push({ x: !pleine && seuls[i] ? largeur / 4 : x, y });
    if (pleine) {
      y += c.h;
    } else {
      x += c.w;
      hauteurLigne = Math.max(hauteurLigne, c.h);
    }
  });
  return positions;
}
