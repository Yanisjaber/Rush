// Natation : volume, allure au 100 m, plus longue séance. Calculs purs, sans écran (testés dans tests/natation.test.ts).
// On ne lit que la distance et la durée des séances (Swim) : c'est ce que Strava nous donne de façon fiable.
import { familleAffichage } from './familles.ts';
import { indexSemaine } from './synthese.ts';
import type { Seance } from './types.ts';

// En dessous de 300 m, la distance est trop courte pour une allure fiable (repos, départs, plongeons)
const KM_MINI_ALLURE = 0.3;

const EST_NATATION = (s: Seance): boolean => familleAffichage(s.sport) === 'natation';
const nage = (seances: Seance[]): Seance[] => seances.filter((s) => EST_NATATION(s) && (s.distance_km ?? 0) > 0 && s.moving_time > 0);
/** Secondes pour 100 m (distance en km : 1 km = 10 fois 100 m). */
const allure100 = (secondes: number, km: number): number => secondes / (km * 10);

export interface VolumeNatation {
  /** Mètres nagés par semaine glissante, de la plus ancienne à la plus récente (la dernière = les 7 derniers jours). */
  parSemaine: number[];
  derniere: number;
  /** Écart de la dernière semaine à la moyenne des précédentes, en % (null sans semaine de comparaison). */
  ecartPct: number | null;
}

export function volumeNatation(seances: Seance[], nbSemaines = 8, aujourdhui: Date = new Date()): VolumeNatation {
  const parSemaine: number[] = new Array(nbSemaines).fill(0);
  for (const s of nage(seances)) {
    const i = indexSemaine(s.start_date_local, aujourdhui);
    if (i < 0 || i >= nbSemaines) continue;
    parSemaine[nbSemaines - 1 - i] += Number(s.distance_km) * 1000;
  }
  const derniere = Math.round(parSemaine[nbSemaines - 1]);
  const avant = parSemaine.slice(0, -1).filter((v) => v > 0);
  const moyenne = avant.length ? avant.reduce((a, b) => a + b, 0) / avant.length : 0;
  return { parSemaine: parSemaine.map((v) => Math.round(v)), derniere, ecartPct: moyenne > 0 ? Math.round(((parSemaine[nbSemaines - 1] - moyenne) / moyenne) * 100) : null };
}

export interface AllureNatation {
  /** Allure moyenne des 4 dernières semaines, en secondes pour 100 m (null sans séance exploitable). */
  actuelle: number | null;
  /** Allure moyenne des 4 semaines d'avant. */
  precedente: number | null;
  /** Évolution en % : négatif = plus rapide. Null sans les deux périodes. */
  evolutionPct: number | null;
  /** Allure par semaine (4 + 4), de la plus ancienne à la plus récente : null si rien nagé cette semaine-là. */
  parSemaine: (number | null)[];
}

export function allureNatation(seances: Seance[], aujourdhui: Date = new Date()): AllureNatation {
  const semaines = Array.from({ length: 8 }, () => ({ temps: 0, km: 0 }));
  for (const s of nage(seances)) {
    if (Number(s.distance_km) < KM_MINI_ALLURE) continue;
    const i = indexSemaine(s.start_date_local, aujourdhui);
    if (i < 0 || i >= 8) continue;
    const m = semaines[7 - i];
    m.temps += s.moving_time;
    m.km += Number(s.distance_km);
  }
  const moyenne = (liste: { temps: number; km: number }[]): number | null => {
    const temps = liste.reduce((t, m) => t + m.temps, 0);
    const km = liste.reduce((t, m) => t + m.km, 0);
    return km > 0 ? Math.round(allure100(temps, km)) : null;
  };
  const precedente = moyenne(semaines.slice(0, 4));
  const actuelle = moyenne(semaines.slice(4));
  return {
    actuelle,
    precedente,
    evolutionPct: actuelle !== null && precedente !== null ? Math.round(((actuelle - precedente) / precedente) * 1000) / 10 : null,
    parSemaine: semaines.map((m) => (m.km >= KM_MINI_ALLURE ? Math.round(allure100(m.temps, m.km)) : null)),
  };
}

export interface MeilleuresNatation {
  plusLongue: { id: string; date: string; km: number; secondes: number } | null;
  /** La séance la plus rapide parmi celles d'au moins 500 m. */
  plusRapide: { id: string; date: string; km: number; allure: number } | null;
}

export function meilleuresNatation(seances: Seance[]): MeilleuresNatation {
  const liste = nage(seances);
  const plusLongueSeance = liste.length ? liste.reduce((a, b) => (Number(b.distance_km) > Number(a.distance_km) ? b : a)) : null;
  const longues = liste.filter((s) => Number(s.distance_km) >= 0.5);
  const rapideSeance = longues.length ? longues.reduce((a, b) => (allure100(b.moving_time, Number(b.distance_km)) < allure100(a.moving_time, Number(a.distance_km)) ? b : a)) : null;
  return {
    plusLongue: plusLongueSeance && { id: plusLongueSeance.id, date: String(plusLongueSeance.start_date_local).slice(0, 10), km: Number(plusLongueSeance.distance_km), secondes: plusLongueSeance.moving_time },
    plusRapide: rapideSeance && { id: rapideSeance.id, date: String(rapideSeance.start_date_local).slice(0, 10), km: Number(rapideSeance.distance_km), allure: Math.round(allure100(rapideSeance.moving_time, Number(rapideSeance.distance_km))) },
  };
}
