// Calculs communs à plusieurs sports : un cumul par semaine glissante, et une répartition du temps par zone. Purs, sans écran (testés via course.test.ts et velo.test.ts).
import { indexSemaine } from './synthese.ts';
import type { Seance } from './types.ts';

export interface CumulHebdo {
  /** Un cumul par semaine glissante, de la plus ancienne à la plus récente (la dernière = les 7 derniers jours). */
  parSemaine: number[];
  derniere: number;
  /** Écart de la dernière semaine à la moyenne des précédentes, en % (null sans semaine de comparaison). */
  ecartPct: number | null;
}

/** Additionne `valeur(séance)` par semaine glissante pour les séances que `garde` accepte ; `decimales` : arrondi de chaque semaine. */
export function cumulParSemaine(
  seances: Seance[],
  garde: (s: Seance) => boolean,
  valeur: (s: Seance) => number,
  nbSemaines: number,
  aujourdhui: Date,
  decimales = 0,
): CumulHebdo {
  const brut: number[] = new Array(nbSemaines).fill(0);
  for (const s of seances) {
    if (!garde(s)) continue;
    const i = indexSemaine(s.start_date_local, aujourdhui);
    if (i < 0 || i >= nbSemaines) continue;
    brut[nbSemaines - 1 - i] += valeur(s);
  }
  const facteur = 10 ** decimales;
  const parSemaine = brut.map((v) => Math.round(v * facteur) / facteur);
  const avant = brut.slice(0, -1).filter((v) => v > 0);
  const moyenne = avant.length ? avant.reduce((a, b) => a + b, 0) / avant.length : 0;
  return { parSemaine, derniere: parSemaine[nbSemaines - 1], ecartPct: moyenne > 0 ? Math.round(((brut[nbSemaines - 1] - moyenne) / moyenne) * 100) : null };
}

export interface ZoneTemps {
  nom: string;
  /** Temps passé dans la zone, en secondes. */
  temps: number;
  /** Part du temps total, en % (entier). */
  pct: number;
}

export interface RepartitionZones {
  zones: ZoneTemps[];
  /** Temps total sur la période, en secondes. */
  total: number;
  /** Indice de la zone où l'on passe le plus de temps. */
  dominante: number;
}

/**
 * Range des temps dans des zones : chaque entrée (`pct` = son niveau en % de la référence, `temps` en secondes) va dans la dernière zone
 * dont le bas est atteint ; au-delà de la dernière, elle reste dans la dernière. Null sans temps.
 */
export function repartirParZone(entrees: { pct: number; temps: number }[], bornes: readonly (readonly [string, number, number])[]): RepartitionZones | null {
  const temps: number[] = new Array(bornes.length).fill(0);
  for (const e of entrees) {
    // La première zone dont la suivante commence au-dessus du niveau
    let z = bornes.findIndex((_, k) => k === bornes.length - 1 || e.pct < bornes[k + 1][1]);
    if (z < 0) z = bornes.length - 1;
    temps[z] += e.temps;
  }
  const total = temps.reduce((a, b) => a + b, 0);
  if (total <= 0) return null;
  return { zones: bornes.map(([nom], k) => ({ nom, temps: temps[k], pct: Math.round((temps[k] / total) * 100) })), total, dominante: temps.indexOf(Math.max(...temps)) };
}

/** Les trois niveaux d'intensité d'une séance, en % de la FC max (repères indicatifs) : moins de 75 % modérée, de 75 à 85 % soutenue, au-delà intense. */
export const ZONES_INTENSITE: [string, number, number][] = [
  ['Z1 Modérée', 0, 74],
  ['Z2 Soutenue', 75, 84],
  ['Z3 Intense', 85, 200],
];

/**
 * Le temps des séances que `garde` accepte, rangé selon leur cardio moyen face à la FC max, sur les `nbSemaines` dernières semaines.
 * Une séance est rangée tout entière dans un niveau : c'est une estimation. Null sans FC max ou sans séance avec cardio.
 */
export function intensiteParZone(seances: Seance[], hrMax: number | null, garde: (s: Seance) => boolean, nbSemaines = 4, aujourdhui: Date = new Date()): RepartitionZones | null {
  if (!(Number(hrMax) > 0)) return null;
  const entrees = seances
    .filter((s) => {
      const i = indexSemaine(s.start_date_local, aujourdhui);
      return garde(s) && s.moving_time > 0 && Number(s.avg_heartrate) > 0 && i >= 0 && i < nbSemaines;
    })
    .map((s) => ({ pct: (Number(s.avg_heartrate) / Number(hrMax)) * 100, temps: s.moving_time }));
  return repartirParZone(entrees, ZONES_INTENSITE);
}

