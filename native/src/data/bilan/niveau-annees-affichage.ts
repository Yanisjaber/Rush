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

/** Où écrire l'année sous la courbe : à la première période de chaque année. */
export function reperesAnnees(positions: readonly PositionNiveau[]): { an: number; t: number }[] {
  const vus = new Set<number>();
  const reperes: { an: number; t: number }[] = [];
  for (const { point, t } of positions) {
    if (vus.has(point.an)) continue;
    vus.add(point.an);
    reperes.push({ an: point.an, t });
  }
  return reperes;
}

/** L'axe du score : de la dizaine sous le plus bas (avec un peu d'air) jusqu'à 104 (pour voir le haut des marges d'erreur au-dessus de 100), un repère par dizaine. */
export function axeScore(points: readonly PointNiveau[]): { min: number; max: number; reperes: number[] } {
  const plusBas = Math.min(...points.map((p) => p.bas));
  const min = Math.max(0, Math.floor((plusBas - 6) / 10) * 10);
  const max = 104;
  const reperes: number[] = [];
  for (let v = Math.ceil(min / 10) * 10; v <= 100; v += 10) reperes.push(v);
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
  return { an, w300: meilleur(300), w1200: meilleur(1200), w3600: meilleur(3600) };
}
