// Le Bilan de l'Hyrox : les records (meilleur total, meilleur temps de chaque run et de chaque station) et le niveau global de l'athlète. Fonctions pures, sans réseau.
// Un test ou une course Hyrox = 16 segments (8 runs d'1 km, 8 stations, voir sports/hyrox.ts) ; les séances de type Hyrox donnent le volume (heures, jours actifs).
//
// Le niveau global (même mécanique que le vélo, la course, la musculation : piliers-sport.ts), quatre piliers notés de 0 à 100, année après année :
//   total    : ton meilleur temps total de l'année contre ton meilleur de TOUS LES TEMPS (100 = ton record, 0 = 25 % plus lent) ;
//   runs     : le temps moyen d'un run (médiane des tests de l'année) contre ton meilleur, même échelle ;
//   stations : le temps total des stations (médiane des tests de l'année) contre ton meilleur, même échelle ;
//   volume   : 60 % les heures, 25 % les jours actifs de séance Hyrox et 15 % le nombre de tests de l'année, contre la moyenne de tes 3 MEILLEURES années (0 à 40 %), ramenés à 365 jours
//              pour l'année en cours et la première (à partir de 30 jours couverts).
// Preuves : total, runs et stations demandent 2 tests dans l'année (avec moins, la note est réduite d'autant) ; le volume demande 30 jours de données. Score global : 3 piliers prouvés sur 4.
import type { TestHyrox } from '../types.ts';
import { NB_SEGMENTS, SEGMENTS, analyserTest, type Segment } from '../sports/hyrox.ts';
import type { ActiviteBilan } from './bilan.ts';
import { moyenneDesMeilleures, noteChargeDe, noteLineaire, preuveDe, surUneAnnee } from './piliers-niveau.ts';
import { assemblerNiveau, joursCouverts, moyennePonderee, type NiveauGlobalSport, type PilierSport } from './piliers-sport.ts';
import type { EntreeCourbe } from './records.ts';

const totalDe = (t: TestHyrox): number => (t.total_s > 0 ? t.total_s : analyserTest(t.segments).total);
const anDe = (date: string): number => Number(String(date).slice(0, 4));

/** Les tests exploitables (un total et ses 16 segments), du plus récent au plus ancien. */
export function testsExploitables(tests: readonly TestHyrox[]): TestHyrox[] {
  return tests
    .filter((t) => totalDe(t) > 0 && Array.isArray(t.segments) && t.segments.length === NB_SEGMENTS && t.segments.every((s) => Number(s) > 0))
    .sort((a, b) => b.date.localeCompare(a.date));
}

/** Les tests d'une année civile. */
export const testsDeLAnnee = (tests: readonly TestHyrox[], annee: number): TestHyrox[] => tests.filter((t) => anDe(t.date) === annee);

export interface RecordTotal {
  /** Le meilleur (le plus court) temps total, en secondes. */
  valeur: number;
  test: TestHyrox;
}

/** Le meilleur temps total ; null sans test. À égalité, le plus ancien. */
export function recordTotal(tests: readonly TestHyrox[]): RecordTotal | null {
  const ok = testsExploitables(tests);
  if (!ok.length) return null;
  const meilleur = ok.reduce((m, t) => (totalDe(t) < totalDe(m) || (totalDe(t) === totalDe(m) && t.date < m.date) ? t : m), ok[0]);
  return { valeur: totalDe(meilleur), test: meilleur };
}

/** Le classement des tests par temps total (le plus rapide d'abord), au plus `n` ; `id` est la séance liée au test (vide sans séance : on ne peut pas l'ouvrir). */
export function classementTotaux(tests: readonly TestHyrox[], n = 30): EntreeCourbe[] {
  return testsExploitables(tests)
    .sort((a, b) => totalDe(a) - totalDe(b) || (a.date < b.date ? -1 : 1))
    .slice(0, n)
    .map((t) => ({ valeur: totalDe(t), id: t.activity_id ?? '', nom: t.label || (t.kind === 'course' ? 'Course' : 'Test'), iso: String(t.date).slice(0, 10) }));
}

export interface RecordSegment {
  segment: Segment;
  /** Le meilleur temps de ce segment, en secondes. */
  meilleur: number;
  /** Le test qui l'a fait. */
  test: TestHyrox;
  /** Le temps du test le plus récent sur ce segment, et son écart avec le record (positif = plus lent) ; null s'il n'y a qu'un test ou si le dernier est le record. */
  dernier: number | null;
  ecart: number | null;
}

/** Le record de chacun des 16 segments (run 1 à 8, SkiErg…Wall Balls), dans l'ordre de la course. Vide sans test. */
export function recordsParSegment(tests: readonly TestHyrox[]): RecordSegment[] {
  const ok = testsExploitables(tests);
  if (!ok.length) return [];
  const dernierTest = ok[0];
  return SEGMENTS.map((segment) => {
    const meilleur = ok.reduce((m, t) => (Number(t.segments[segment.i]) < Number(m.segments[segment.i]) ? t : m), ok[0]);
    const valeur = Number(meilleur.segments[segment.i]);
    const dernier = Number(dernierTest.segments[segment.i]);
    const estLeRecord = dernierTest.id === meilleur.id || dernier <= valeur;
    return { segment, meilleur: valeur, test: meilleur, dernier: estLeRecord ? null : dernier, ecart: estLeRecord ? null : Math.round(dernier - valeur) };
  });
}

export const PILIERS_HYROX: readonly PilierSport[] = [
  { cle: 'total', nom: 'Temps total', abrege: 'Total', explication: 'Meilleur temps de l\'année' },
  { cle: 'runs', nom: 'Runs', abrege: 'Runs', explication: 'Temps moyen d\'un run' },
  { cle: 'stations', nom: 'Stations', abrege: 'Stat.', explication: 'Temps total des stations' },
  { cle: 'volume', nom: 'Volume', abrege: 'Volume', explication: 'Heures, jours actifs, tests' },
];

/** Une note de 0 (25 % plus lent que ton meilleur de toujours) à 100 (ton meilleur). */
export const HYROX_ZERO = 0.75;
/** Deux tests dans l'année pour que le temps total, les runs et les stations aient toutes leurs preuves. */
export const TESTS_MINI = 2;
/** Ce que compte le volume. */
export const POIDS_VOLUME_HYROX = { heures: 0.6, jours: 0.25, tests: 0.15 } as const;
const JOURS_MINI = 30;

const mediane = (v: number[]): number => {
  const t = [...v].sort((a, b) => a - b);
  return t.length % 2 ? t[(t.length - 1) / 2] : (t[t.length / 2 - 1] + t[t.length / 2]) / 2;
};

/**
 * Le niveau global de l'Hyrox année après année. `tests` : tous les tests et courses ; `acts` : les séances de type Hyrox (famille « hyrox »). Une année existe dès qu'elle a un test ou une séance. Null sans aucun des deux.
 */
export function niveauGlobalHyrox(tests: readonly TestHyrox[], acts: readonly ActiviteBilan[], maintenant: Date): NiveauGlobalSport | null {
  const ok = testsExploitables(tests);
  const seances = acts.filter((a) => a.famille === 'hyrox' && a.duree_min > 0);
  const annees = [...new Set([...ok.map((t) => anDe(t.date)), ...seances.map((a) => anDe(a.iso))])].sort((a, b) => a - b);
  if (!annees.length) return null;
  const premierJour = [...ok.map((t) => String(t.date).slice(0, 10)), ...seances.map((a) => a.iso)].reduce((m, d) => (d < m ? d : m), '9999-12-31');

  const parAn = annees.map((an) => {
    const delAn = testsDeLAnnee(ok, an);
    const seancesAn = seances.filter((a) => anDe(a.iso) === an);
    const couverts = joursCouverts(an, premierJour, maintenant);
    const analyses = delAn.map((t) => analyserTest(t.segments));
    return {
      an, n: delAn.length, couverts,
      total: delAn.length ? Math.min(...delAn.map(totalDe)) : null,
      run: analyses.length ? mediane(analyses.map((a) => a.runs / 8)) : null,
      station: analyses.length ? mediane(analyses.map((a) => a.stations)) : null,
      heures: surUneAnnee(seancesAn.reduce((t, a) => t + a.duree_min / 60, 0), couverts),
      jours: surUneAnnee(new Set(seancesAn.map((a) => a.iso)).size, couverts),
      tests: surUneAnnee(delAn.length, couverts),
    };
  });
  // Ton meilleur de toujours : sur les années à assez de tests, à défaut sur celles qui en ont au moins un
  const fiables = parAn.filter((x) => x.n >= TESTS_MINI);
  const ref = fiables.length ? fiables : parAn.filter((x) => x.n > 0);
  const meilleur = (cle: 'total' | 'run' | 'station'): number => Math.min(Infinity, ...ref.map((x) => x[cle]).filter((v): v is number => v !== null && v > 0));
  const mTotal = meilleur('total'), mRun = meilleur('run'), mStation = meilleur('station');
  const refHeures = moyenneDesMeilleures(parAn.map((x) => x.heures));
  const refJours = moyenneDesMeilleures(parAn.map((x) => x.jours));
  const refTests = moyenneDesMeilleures(parAn.map((x) => x.tests));

  const entrees = parAn.map((x) => {
    const preuve = preuveDe(x.n, TESTS_MINI);
    const note = (valeur: number | null, record: number): number => (valeur !== null && valeur > 0 && Number.isFinite(record) ? noteLineaire(record / valeur, HYROX_ZERO, 1) * preuve : 0);
    const parts: [number, number][] = [];
    if (x.heures !== null && refHeures > 0) parts.push([POIDS_VOLUME_HYROX.heures, noteChargeDe(x.heures / refHeures)]);
    if (x.jours !== null && refJours > 0) parts.push([POIDS_VOLUME_HYROX.jours, noteChargeDe(x.jours / refJours)]);
    if (x.tests !== null && refTests > 0) parts.push([POIDS_VOLUME_HYROX.tests, noteChargeDe(x.tests / refTests)]);
    return {
      an: x.an,
      notes: { total: note(x.total, mTotal), runs: note(x.run, mRun), stations: note(x.station, mStation), volume: moyennePonderee(parts) },
      preuves: { total: x.total !== null ? preuve : 0, runs: x.run !== null ? preuve : 0, stations: x.station !== null ? preuve : 0, volume: x.couverts >= JOURS_MINI && parts.length ? 1 : 0 },
    };
  });
  return assemblerNiveau(PILIERS_HYROX, entrees);
}
