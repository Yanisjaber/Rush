// Ce que l'écran du niveau année après année dessine, calculé sans écran : positions dans le temps, segments continus, axe du score, textes.
// Testé dans tests/bilan/niveau-annees.test.ts.
import { formatAllure, formatNum } from '../outils/format.ts';
import type { PointNiveau, RecordsAnnee, SerieNiveau } from './niveau-annees.ts';
import type { PointCourbe } from './records.ts';

export interface PositionNiveau {
  point: PointNiveau;
  /** Le numéro de la tranche depuis l'an 0 : deux tranches qui se suivent sont à 1 d'écart. */
  t: number;
}

/** Les points placés dans le temps. `tranchesParAn` vaut 1 pour une série annuelle. */
export function positionsNiveau(points: readonly PointNiveau[], tranchesParAn: number): PositionNiveau[] {
  return points.map((point) => ({ point, t: point.an * tranchesParAn + point.tranche })).sort((a, b) => a.t - b.t);
}

/**
 * Les points de `depuisAn` à `jusquAn` (la fenêtre de 5 ans qui finit sur l'année choisie ; sans borne, pas de limite de ce côté).
 * S'il reste moins de deux points dans la fenêtre (une courbe d'un seul point ne montre rien), tous les points jusqu'à `jusquAn`.
 * Le résultat peut avoir moins de deux points quand rien n'est mesuré jusqu'à `jusquAn` : voir aDeQuoiTracer.
 */
export function pointsDepuis(points: readonly PointNiveau[], depuisAn?: number, jusquAn?: number): PointNiveau[] {
  const avant = jusquAn === undefined ? [...points] : points.filter((p) => p.an <= jusquAn);
  if (depuisAn === undefined) return avant;
  const gardes = avant.filter((p) => p.an >= depuisAn);
  return gardes.length >= 2 ? gardes : avant;
}

/** Vrai quand la courbe a au moins deux points à montrer jusqu'à `jusquAn`. */
export function aDeQuoiTracer(points: readonly PointNiveau[], jusquAn?: number): boolean {
  return pointsDepuis(points, undefined, jusquAn).length >= 2;
}

/** Les morceaux de courbe qui se suivent : on coupe quand une période n'a pas assez de sorties (écart de plus d'une tranche). */
export function segmentsContinus(positions: readonly PositionNiveau[]): PositionNiveau[][] {
  const segments: PositionNiveau[][] = [];
  for (const p of positions) {
    const dernier = segments[segments.length - 1];
    if (dernier && p.t - dernier[dernier.length - 1].t <= 1) dernier.push(p);
    else segments.push([p]);
  }
  return segments;
}

/**
 * Où écrire l'année sous la courbe : au milieu de ses points. Au début de la première année (qui n'a parfois que deux trimestres, juste avant la suivante), l'écrire au premier point
 * ferait chevaucher deux années.
 */
export function reperesAnnees(positions: readonly PositionNiveau[]): { an: number; t: number }[] {
  const parAn = new Map<number, number[]>();
  for (const { point, t } of positions) parAn.set(point.an, [...(parAn.get(point.an) ?? []), t]);
  return [...parAn].map(([an, ts]) => ({ an, t: (Math.min(...ts) + Math.max(...ts)) / 2 }));
}

/**
 * Les repères d'années qu'on a la place d'écrire : quand ils se serrent (tout l'historique sur 10 ans), on en saute un sur deux, un sur trois…
 * Le dernier (l'année en cours) est toujours gardé, on compte à rebours depuis lui. `ecartMini` = l'écart minimal entre deux étiquettes, dans l'unité de `x`.
 */
export function amincirReperes<T extends { x: number }>(reperes: readonly T[], ecartMini: number): T[] {
  const gardes: T[] = [];
  for (let i = reperes.length - 1; i >= 0; i--) {
    const dernier = gardes[gardes.length - 1];
    if (!dernier || dernier.x - reperes[i].x >= ecartMini) gardes.push(reperes[i]);
  }
  return gardes.reverse();
}

/**
 * Où tracer la barre du début de chaque année : entre le dernier trimestre d'une année et le premier de la suivante (une demi-tranche avant le premier point de l'année).
 * Seulement entre le premier et le dernier point, et seulement quand la courbe a des tranches (une série annuelle a un point par année : rien à séparer).
 */
export function debutsAnnees(positions: readonly PositionNiveau[], tranchesParAn: number): number[] {
  if (tranchesParAn <= 1 || positions.length < 2) return [];
  const t0 = positions[0].t;
  const t1 = positions[positions.length - 1].t;
  const debuts: number[] = [];
  for (let an = Math.floor(t0 / tranchesParAn) + 1; an * tranchesParAn - 0.5 < t1; an++) debuts.push(an * tranchesParAn - 0.5);
  return debuts.filter((t) => t > t0);
}

/**
 * L'axe du score : du repère sous le plus bas (avec un peu d'air) jusqu'à 104 (pour voir le haut des marges d'erreur au-dessus de 100), un repère par dizaine,
 * ou par vingtaine quand l'axe est haut (sinon les repères se serrent).
 */
export function axeScore(points: readonly PointNiveau[]): { min: number; max: number; reperes: number[] } {
  const plusBas = Math.min(...points.map((p) => p.bas)) - 6;
  const pas = 100 - plusBas > 50 ? 20 : 10;
  const min = Math.max(0, Math.floor(plusBas / pas) * pas);
  const max = 104;
  const reperes: number[] = [];
  for (let v = min; v <= 100; v += pas) reperes.push(v);
  return { min, max, reperes };
}

/** De combien de points l'année actuelle est sous le meilleur niveau (0 si c'est le meilleur). */
export function ecartAuSommet(serie: SerieNiveau): number {
  return Math.max(0, serie.meilleur.score - serie.actuel.score);
}

/** Le nom d'une période en toutes lettres : « 2025-T2 » → « T2 2025 », « 2026-S1 » → « 1er semestre 2026 », « 2025 » → « 2025 ». */
export function libellePeriode(cle: string): string {
  const m = /^(\d{4})-([TS])(\d)$/.exec(cle);
  if (!m) return cle;
  if (m[2] === 'T') return `T${m[3]} ${m[1]}`;
  return `${m[3] === '1' ? '1er' : `${m[3]}e`} semestre ${m[1]}`;
}

export type GenreNiveau = 'velo' | 'course' | 'record';

/** Un niveau dans son unité : « 169 W » (vélo, records) ou « 5'22"/km » (course). */
export function formatNiveau(genre: GenreNiveau, valeur: number): string {
  return genre === 'course' ? formatAllure(valeur) : `${formatNum(valeur)} W`;
}

/** La marge d'erreur dans son unité : « ± 3 W » ou « ± 17 s/km ». */
export function formatMarge(genre: GenreNiveau, demi: number): string {
  return `± ${formatNum(demi)} ${genre === 'course' ? 's/km' : 'W'}`;
}

/** Les records d'une année, lus dans la courbe de puissance de cette année (le meilleur de chaque durée). Une durée sans point reste absente. */
export function recordsDeCourbe(an: number, courbe: readonly PointCourbe[]): RecordsAnnee {
  const meilleur = (duree: number): number | undefined => {
    const v = courbe.find((p) => p.duree === duree)?.top[0]?.valeur;
    return v && v > 0 ? v : undefined;
  };
  return { an, w5: meilleur(5), w300: meilleur(300), w1200: meilleur(1200), w3600: meilleur(3600) };
}
