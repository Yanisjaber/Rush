// Hyrox : le suivi dans le temps. Séances par semaine, évolution du temps total, part des runs et des stations, dérive des runs.
// Calculs purs, sans écran (testés dans tests/hyrox-suivi.test.ts). Un test = 16 segments (8 runs d'1 km, 8 stations), voir hyrox.ts.
import { familleAffichage } from './familles.ts';
import { cumulParSemaine, type CumulHebdo } from './hebdo.ts';
import { analyserTest } from './hyrox.ts';
import type { Seance, TestHyrox } from './types.ts';

/** Minutes d'entraînement Hyrox par semaine glissante (toutes les séances de type Hyrox, pas seulement les tests complets). */
export function hyroxParSemaine(seances: Seance[], nbSemaines = 12, aujourdhui: Date = new Date()): CumulHebdo {
  return cumulParSemaine(seances, (s) => familleAffichage(s.sport) === 'hyrox' && s.moving_time > 0, (s) => s.moving_time / 60, nbSemaines, aujourdhui, 0);
}

const totalDe = (t: TestHyrox): number => (t.total_s > 0 ? t.total_s : analyserTest(t.segments).total);
/** Les tests exploitables, du plus ancien au plus récent (la liste arrive du plus récent au plus ancien). */
const anciensDabord = (tests: TestHyrox[]): TestHyrox[] => tests.filter((t) => totalDe(t) > 0).sort((a, b) => a.date.localeCompare(b.date));

export interface PointTotal {
  id: string;
  date: string;
  label: string;
  kind: TestHyrox['kind'];
  total: number;
}

export interface EvolutionTotal {
  /** Du plus ancien au plus récent. */
  points: PointTotal[];
  dernier: PointTotal;
  premier: PointTotal;
  /** Le meilleur (le plus court) temps total. */
  record: number;
  /** Le dernier est-il le record ? */
  estRecord: boolean;
  /** Dernier moins premier, en secondes : négatif = tu as gagné du temps. 0 avec un seul test. */
  ecart: number;
}

/** L'évolution du temps total de tes tests et courses. Null sans test. */
export function evolutionTotal(tests: TestHyrox[]): EvolutionTotal | null {
  const points = anciensDabord(tests).map((t) => ({ id: t.id, date: t.date, label: t.label, kind: t.kind, total: totalDe(t) }));
  if (!points.length) return null;
  const dernier = points[points.length - 1];
  const record = Math.min(...points.map((p) => p.total));
  return { points, dernier, premier: points[0], record, estRecord: dernier.total === record, ecart: dernier.total - points[0].total };
}

export interface PartTest {
  id: string;
  date: string;
  label: string;
  runs: number;
  stations: number;
  total: number;
  /** Part des runs dans le temps total, en % (entier). */
  pctRuns: number;
}

/** Pour chaque test (du plus ancien au plus récent) : le temps passé à courir et celui passé sur les stations. */
export function partsRunsStations(tests: TestHyrox[]): PartTest[] {
  return anciensDabord(tests)
    .map((t) => ({ t, a: analyserTest(t.segments) }))
    .filter(({ a }) => a.runs > 0 && a.stations > 0)
    .map(({ t, a }) => ({ id: t.id, date: t.date, label: t.label, runs: a.runs, stations: a.stations, total: a.total, pctRuns: Math.round((a.runs / a.total) * 100) }));
}

export interface DeriveRuns {
  /** Le temps de chacun des 8 runs, en secondes. */
  runs: number[];
  /** Les deux premiers runs : temps moyen d'un run. */
  debut: number;
  /** Les deux derniers runs. */
  fin: number;
  /** Fin moins début, en secondes par km : positif = tu ralentis. */
  ecart: number;
  /** Le même écart en % du début (une décimale). */
  pct: number;
}

/**
 * La dérive des runs d'un test : les 2 derniers kilomètres comparés aux 2 premiers (la moyenne de deux runs lisse un mauvais kilomètre).
 * Null sans les 8 runs.
 */
export function deriveRuns(test: TestHyrox | null | undefined): DeriveRuns | null {
  if (!test) return null;
  const runs = analyserTest(test.segments).allures;
  if (runs.length !== 8 || runs.some((r) => !(r > 0))) return null;
  const debut = (runs[0] + runs[1]) / 2;
  const fin = (runs[6] + runs[7]) / 2;
  return { runs, debut, fin, ecart: Math.round(fin - debut), pct: Math.round(((fin - debut) / debut) * 1000) / 10 };
}

export interface DeriveTest {
  id: string;
  date: string;
  derive: DeriveRuns;
}

/** La dérive de chaque test qui a ses 8 runs, du plus ancien au plus récent. */
export function deriveParTest(tests: TestHyrox[]): DeriveTest[] {
  return anciensDabord(tests).flatMap((t) => {
    const derive = deriveRuns(t);
    return derive ? [{ id: t.id, date: t.date, derive }] : [];
  });
}
