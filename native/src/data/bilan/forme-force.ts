// La force de la musculation semaine par semaine sur une année civile (graphique « Forme par saison » de la musculation) : même idée que la forme du vélo (forme-saison.ts), sur le carnet de force.
// Chaque exercice principal (les 5 les plus pratiqués) a un record de toujours (son meilleur 1RM estimé, Epley, séries de 1 à 12 répétitions) ; chaque séance donne un point par exercice :
// son meilleur 1RM de la séance divisé par ce record. La force d'une semaine est la moyenne de ces points jusqu'à sa fin, chaque point pesant moitié moins tous les 28 jours (mémoire plus longue
// que le vélo : on ne soulève pas ses maxima toutes les semaines). Le score a la même échelle que la forme du vélo : 100 = ta meilleure semaine, 0 = 30 % en dessous.
// Comme pour le vélo : peu de séances récentes ramènent la note vers le bas, et après plus de 2 semaines sans séance la note baisse (5 % par semaine, au plus de moitié) et passe en pointillé.
// À côté, au lieu des heures : le tonnage de chaque semaine (en tonnes), pour voir si la force suit le volume.
import type { SerieForce } from '../types.ts';
import type { FormeSaison, SemaineForme } from './forme-saison.ts';
import { noteDe, noteLibre } from './niveau-annees.ts';
import { epley, exercicesDuCarnet, REPS_MAX_1RM, seriesAvecCharge } from './records-muscu.ts';

/** Un point pèse moitié moins tous les 28 jours. */
export const DEMI_VIE_FORCE_JOURS = 28;
/** Il faut au moins 6 points (exercice × séance) avant la fin d'une semaine pour la noter. */
export const POINTS_MINI_FORCE = 6;
/** Le poids des points des 6 dernières semaines (un point du jour = 1) qu'il faut pour croire la mesure. */
const POIDS_MINI_PREUVE = 3;
const SEMAINES_SANS_MESURE = 2;
const BAISSE_PAR_SEMAINE = 0.05;
const BAISSE_MAX = 0.5;
const MARGE_PAR_SEMAINE = 2;
const Z = 1.8;

const jourDe = (date: string): number => Date.UTC(Number(date.slice(0, 4)), Number(date.slice(5, 7)) - 1, Number(date.slice(8, 10))) / 86400000;
const dateDe = (jour: number): string => new Date(jour * 86400000).toISOString().slice(0, 10);

type Point = PointNiveauJour;

/** Un point par exercice principal et par jour : le meilleur 1RM du jour contre le record de toujours. */
export function pointsDeForce(series: readonly SerieForce[]): Point[] {
  const valides = seriesAvecCharge(series);
  const exercices = exercicesDuCarnet(valides).filter((e) => e.nSeries >= 6).slice(0, 5);
  const points: Point[] = [];
  for (const e of exercices) {
    const parJour = new Map<number, number>();
    for (const s of valides) {
      if (s.exercise_key !== e.cle || Number(s.reps) > REPS_MAX_1RM) continue;
      const j = jourDe(String(s.date).slice(0, 10));
      parJour.set(j, Math.max(parJour.get(j) ?? 0, epley(Number(s.weight_kg), Number(s.reps))));
    }
    const record = Math.max(0, ...parJour.values());
    if (record > 0) for (const [jour, rm] of parJour) points.push({ jour, ratio: rm / record });
  }
  return points.sort((a, b) => a.jour - b.jour);
}

/** La moyenne pondérée des points avant `fin` (jour exclu), le nombre de points qui comptent vraiment, le poids des 6 dernières semaines, l'écart-type et le dernier jour ; null avec trop peu de points. */
function etatA(points: readonly Point[], fin: number, pointsMini = POINTS_MINI_FORCE): { moyenne: number; neff: number; recent: number; ecartType: number; dernier: number } | null {
  const avant = points.filter((p) => p.jour < fin);
  if (avant.length < pointsMini) return null;
  const poids = avant.map((p) => 0.5 ** ((fin - 1 - p.jour) / DEMI_VIE_FORCE_JOURS));
  const somme = poids.reduce((t, w) => t + w, 0);
  const moyenne = avant.reduce((t, p, k) => t + poids[k] * p.ratio, 0) / somme;
  const neff = (somme * somme) / poids.reduce((t, w) => t + w * w, 0);
  const variance = neff > 1.05 ? avant.reduce((t, p, k) => t + poids[k] * (p.ratio - moyenne) ** 2, 0) / (somme * (1 - 1 / neff)) : 0.01;
  const recent = avant.reduce((t, p, k) => (p.jour >= fin - 1 - 42 ? t + poids[k] : t), 0);
  return { moyenne, neff, recent, ecartType: Math.sqrt(variance), dernier: avant[avant.length - 1].jour };
}

/** Un point de niveau : un jour et le rapport de ce jour à ton record (1 = ton record). */
export interface PointNiveauJour {
  jour: number;
  ratio: number;
}

/**
 * La forme de chaque semaine de `annee` (jusqu'à la semaine d'aujourd'hui pour l'année en cours) à partir de points de niveau (voir `pointsDeForce`) : la moyenne pondérée des points jusqu'à la fin de la semaine
 * (chaque point pèse moitié moins tous les 28 jours), 100 = ta meilleure semaine, 0 = 30 % en dessous ; peu de points récents ramènent la note vers le bas ; après plus de 2 semaines sans point elle baisse
 * (5 % par semaine, au plus de moitié) et passe en pointillé. `volumeParSemaine` : ce que montrent les barres du bas (dans le champ `heures`), semaine de l'année → valeur ; `unite` : « t », « km » ou « h ».
 * Null s'il n'y a pas assez de points pour noter une semaine de l'année. `pointsMini` : le nombre de points avant lequel une semaine n'est pas notée.
 */
export function formeDepuisPoints(
  points: readonly PointNiveauJour[],
  annee: number,
  aujourdhui: Date,
  volumeParSemaine: (debutAn: number, finAn: number) => Map<number, number>,
  unite: 'h' | 't' | 'km',
  pointsMini = POINTS_MINI_FORCE,
): FormeSaison | null {
  if (points.length < pointsMini) return null;
  const auj = jourDe(`${aujourdhui.getFullYear()}-${String(aujourdhui.getMonth() + 1).padStart(2, '0')}-${String(aujourdhui.getDate()).padStart(2, '0')}`);
  // Ta meilleure semaine, toutes années confondues : elle fixe le 100 (comme « ton meilleur trimestre » pour le vélo)
  let meilleure = 0;
  for (let fin = points[0].jour + 7; fin <= auj + 1; fin += 7) {
    const e = etatA(points, fin, pointsMini);
    if (e) meilleure = Math.max(meilleure, e.moyenne);
  }
  if (!(meilleure > 0)) return null;

  const debutAn = jourDe(`${annee}-01-01`);
  const finAn = jourDe(`${annee + 1}-01-01`);
  const volume = volumeParSemaine(debutAn, finAn);
  const semaines: SemaineForme[] = [];
  for (let i = 0; i < 52; i++) {
    const debut = debutAn + 7 * i;
    if (debut > auj) break;
    const fin = i === 51 ? finAn : debut + 7;
    const heures = volume.get(i) ?? 0;
    const e = etatA(points, fin, pointsMini);
    if (!e) {
      semaines.push({ index: i, debut: dateDe(debut), score: null, bas: null, haut: null, estimee: false, n: 0, heures });
      continue;
    }
    const prudence = 1 - 0.5 * (1 - Math.min(1, e.recent / POIDS_MINI_PREUVE));
    const demi = (Z * e.ecartType) / Math.sqrt(Math.max(e.neff, 1));
    const brute = noteDe(e.moyenne / meilleure);
    const mesure = brute * prudence;
    const mesureBas = Math.min(noteDe((e.moyenne - demi) / meilleure), brute) * prudence;
    const mesureHaut = Math.max(noteLibre((e.moyenne + demi) / meilleure), brute) * prudence;
    const semainesSansSeance = (Math.min(fin, auj + 1) - 1 - e.dernier) / 7;
    if (semainesSansSeance > SEMAINES_SANS_MESURE) {
      const perte = Math.min(BAISSE_MAX, BAISSE_PAR_SEMAINE * (semainesSansSeance - SEMAINES_SANS_MESURE));
      const score = mesure * (1 - perte);
      const marge = Math.max(mesure - mesureBas, mesureHaut - mesure) + MARGE_PAR_SEMAINE * (semainesSansSeance - SEMAINES_SANS_MESURE);
      semaines.push({ index: i, debut: dateDe(debut), score, bas: Math.max(0, score - marge), haut: Math.min(100, score + marge), estimee: true, n: Math.round(e.neff), heures });
      continue;
    }
    semaines.push({ index: i, debut: dateDe(debut), score: mesure, bas: mesureBas, haut: mesureHaut, estimee: false, n: Math.round(e.neff), heures });
  }
  const notees = semaines.filter((s) => s.score !== null && !s.estimee);
  if (!notees.length) return null;
  return { annee, semaines, meilleure: notees.reduce((a, s) => (s.score! > a.score! ? s : a)).index, unite };
}

/**
 * La force de chaque semaine de `annee` (jusqu'à la semaine d'aujourd'hui pour l'année en cours) et le tonnage de la semaine (en tonnes, dans le champ `heures`, avec `unite: 't'`).
 * Null s'il n'y a pas assez de points de force pour noter une semaine de l'année.
 */
export function formeForceParSemaine(series: readonly SerieForce[], annee: number, aujourdhui: Date): FormeSaison | null {
  return formeDepuisPoints(pointsDeForce(series), annee, aujourdhui, (debutAn, finAn) => {
    const tonnage = new Map<number, number>();
    for (const s of seriesAvecCharge(series)) {
      const j = jourDe(String(s.date).slice(0, 10));
      if (j < debutAn || j >= finAn) continue;
      const i = Math.min(51, Math.floor((j - debutAn) / 7));
      tonnage.set(i, (tonnage.get(i) ?? 0) + (Number(s.weight_kg) * Number(s.reps)) / 1000);
    }
    return tonnage;
  }, 't');
}
