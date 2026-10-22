// Géométrie de la courbe de puissance (watts sur 90 jours et sur toute la vie, de 5 secondes à 1 heure).
// Port du calcul qui était dans widgets/WidgetPuissance.svelte, sorti en fonction pure pour être testable.
import { lisse } from './courbes.ts';
import type { PointPuissance } from './types.ts';

export interface Cadre {
  largeur: number;
  hauteur: number;
  gauche: number;
  droite: number;
  haut: number;
  bas: number;
}

/** Le cadre de la grande courbe (L) ; les autres tailles passent le leur : M plus plat, S une simple forme sans libellés. */
export const CADRE: Cadre = { largeur: 400, hauteur: 230, gauche: 18, droite: 18, haut: 28, bas: 34 };
export const CADRE_M: Cadre = { largeur: 400, hauteur: 112, gauche: 18, droite: 18, haut: 24, bas: 22 };
export const CADRE_S: Cadre = { largeur: 140, hauteur: 36, gauche: 5, droite: 5, haut: 6, bas: 5 };

const LIBELLES: Record<number, string> = { 5: '5 s', 15: '15 s', 30: '30 s', 60: '1 min', 300: '5 min', 600: '10 min', 1200: '20 min', 3600: '1 h' };

/** Les durées dont on écrit la puissance et le libellé quand le widget est petit (toutes en grand). */
export const LIBELLES_CLES = ['5 s', '1 min', '5 min', '20 min', '1 h'];

export interface GeometriePuissance {
  ligne90: string; // chemin SVG de la courbe sur 90 jours
  ligneTout: string; // chemin SVG de la courbe sur toute la vie
  points: { x: number; y: number; watts: number; label: string }[];
  base: number; // ordonnée de l'axe
}

/** Les lignes valides (au moins une puissance), triées par durée. */
export function lignesValides(puissance: PointPuissance[] | null | undefined): PointPuissance[] {
  return [...(puissance || [])].filter((l) => l.watts_90d > 0 || l.watts_alltime > 0).sort((a, b) => a.duration_s - b.duration_s);
}

/** Abscisse logarithmique (de la plus courte à la plus longue durée) et ordonnée linéaire. Null s'il y a moins de 2 durées. */
export function geometriePuissance(puissance: PointPuissance[] | null | undefined, cadre: Cadre = CADRE): GeometriePuissance | null {
  const lignes = lignesValides(puissance);
  if (lignes.length < 2) return null;
  const { largeur, hauteur, gauche, droite, haut, bas } = cadre;
  const dmin = Math.log(lignes[0].duration_s);
  const dmax = Math.log(lignes[lignes.length - 1].duration_s);
  const toutes = lignes.flatMap((l) => [l.watts_90d || 0, l.watts_alltime || 0]);
  const wmax = Math.max(...toutes) * 1.08;
  const x = (d: number) => gauche + ((Math.log(d) - dmin) / (dmax - dmin)) * (largeur - gauche - droite);
  const y = (w: number) => haut + (1 - w / wmax) * (hauteur - haut - bas);
  const pts90: [number, number][] = lignes.filter((l) => l.watts_90d > 0).map((l) => [x(l.duration_s), y(l.watts_90d)]);
  const ptsTout: [number, number][] = lignes.filter((l) => l.watts_alltime > 0).map((l) => [x(l.duration_s), y(l.watts_alltime)]);
  return {
    ligne90: lisse(pts90, 0.2),
    ligneTout: lisse(ptsTout, 0.2),
    points: lignes
      .filter((l) => l.watts_90d > 0)
      .map((l) => ({ x: x(l.duration_s), y: y(l.watts_90d), watts: l.watts_90d, label: LIBELLES[l.duration_s] || `${l.duration_s} s` })),
    base: hauteur - bas,
  };
}
