// Outils de tracé pour les graphiques SVG sur mesure. Port de app/src/lib/utils/courbes.js :
// de simples fonctions, on leur donne des nombres, elles rendent des chemins SVG.

export type Point = [number, number];

/**
 * Transforme une liste de points [x, y] en un chemin SVG lissé (courbes de Bézier).
 * `tension` règle la souplesse (0 = lignes droites, ~0.2 = courbe douce).
 */
export function lisse(points: Point[] | null | undefined, tension = 0.18): string {
  if (!points || points.length === 0) return '';
  const f = (n: number) => n.toFixed(1);
  let d = `M${f(points[0][0])} ${f(points[0][1])}`;
  for (let i = 0; i < points.length - 1; i++) {
    const p0 = points[i - 1] || points[i];
    const p1 = points[i];
    const p2 = points[i + 1];
    const p3 = points[i + 2] || p2;
    const c1x = p1[0] + (p2[0] - p0[0]) * tension;
    const c1y = p1[1] + (p2[1] - p0[1]) * tension;
    const c2x = p2[0] - (p3[0] - p1[0]) * tension;
    const c2y = p2[1] - (p3[1] - p1[1]) * tension;
    d += ` C${f(c1x)} ${f(c1y)} ${f(c2x)} ${f(c2y)} ${f(p2[0])} ${f(p2[1])}`;
  }
  return d;
}

/**
 * Convertit une série de valeurs en points [x, y] à l'échelle d'un cadre largeur × hauteur.
 * La plus grande valeur est en haut. `marge` évite que le trait touche les bords.
 */
export function echelle(valeurs: number[] | null | undefined, largeur: number, hauteur: number, marge = 6, min?: number, max?: number): Point[] {
  if (!valeurs || valeurs.length === 0) return [];
  const bas = min ?? Math.min(...valeurs);
  const haut = max ?? Math.max(...valeurs);
  const ecart = haut - bas || 1;
  const pas = valeurs.length > 1 ? (largeur - 2 * marge) / (valeurs.length - 1) : 0;
  return valeurs.map((v, i) => [marge + i * pas, hauteur - marge - ((v - bas) / ecart) * (hauteur - 2 * marge)]);
}

/** Fait fermer une courbe vers le bas du cadre, pour la remplir (aire sous la courbe). */
export function aireSousCourbe(chemin: string, points: Point[], hauteur: number): string {
  if (!points.length) return '';
  const dernier = points[points.length - 1];
  const premier = points[0];
  return `${chemin} L${dernier[0].toFixed(1)} ${hauteur} L${premier[0].toFixed(1)} ${hauteur} Z`;
}
