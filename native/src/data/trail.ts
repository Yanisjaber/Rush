// Trail : le dénivelé et le km-effort par semaine, la préparation face à la course visée, les meilleures sorties.
// Calculs purs, sans écran (testés dans tests/trail.test.ts). On ne regarde que les sorties de type trail (TrailRun), pas la course sur route.
// Le km-effort est la mesure usuelle du trail : 1 km-effort = 1 km + 100 m de dénivelé positif.
import { familleSport } from './familles.ts';
import { joursAvant } from './format.ts';
import { cumulParSemaine, type CumulHebdo } from './hebdo.ts';
import { indexSemaine } from './synthese.ts';
import type { Objectif, Seance } from './types.ts';

const EST_TRAIL = (s: Seance): boolean => familleSport(s.sport) === 'trail' && s.moving_time > 0;
const positif = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v) && v > 0;

/** Les kilomètres-effort d'une sortie : distance + dénivelé positif ÷ 100. */
export const kmEffort = (s: Seance): number => (positif(s.distance_km) ? s.distance_km : 0) + (positif(s.total_elevation_gain) ? s.total_elevation_gain / 100 : 0);

/** Dénivelé positif grimpé par semaine glissante (mètres). */
export function deniveleTrailParSemaine(seances: Seance[], nbSemaines = 12, aujourdhui: Date = new Date()): CumulHebdo {
  return cumulParSemaine(seances, (s) => EST_TRAIL(s) && positif(s.total_elevation_gain), (s) => Number(s.total_elevation_gain), nbSemaines, aujourdhui, 0);
}

/** Km-effort par semaine glissante (une décimale). */
export function kmEffortParSemaine(seances: Seance[], nbSemaines = 12, aujourdhui: Date = new Date()): CumulHebdo {
  return cumulParSemaine(seances, (s) => EST_TRAIL(s) && kmEffort(s) > 0, kmEffort, nbSemaines, aujourdhui, 1);
}

export interface SortieTrail {
  id: string;
  nom: string | null;
  date: string;
  km: number;
  dPlus: number;
  secondes: number;
}

const enSortie = (s: Seance): SortieTrail => ({ id: s.id, nom: s.name, date: String(s.start_date_local).slice(0, 10), km: positif(s.distance_km) ? s.distance_km : 0, dPlus: positif(s.total_elevation_gain) ? s.total_elevation_gain : 0, secondes: s.moving_time });
const recentes = (seances: Seance[], nbSemaines: number, aujourdhui: Date): Seance[] =>
  seances.filter((s) => {
    const i = indexSemaine(s.start_date_local, aujourdhui);
    return EST_TRAIL(s) && i >= 0 && i < nbSemaines;
  });

export interface MeilleuresTrail {
  plusGrosDPlus: SortieTrail | null;
  plusLongue: SortieTrail | null;
  plusLongueDuree: SortieTrail | null;
  /** Les cinq plus gros dénivelés, du plus gros au plus petit. */
  top: SortieTrail[];
}

/** Les meilleures sorties de trail des 12 dernières semaines : le plus gros D+, la plus longue distance, la plus longue durée. */
export function meilleuresTrail(seances: Seance[], nbSemaines = 12, aujourdhui: Date = new Date()): MeilleuresTrail {
  const sorties = recentes(seances, nbSemaines, aujourdhui).map(enSortie);
  const max = (cle: (s: SortieTrail) => number): SortieTrail | null => (sorties.length && Math.max(...sorties.map(cle)) > 0 ? sorties.reduce((a, b) => (cle(b) > cle(a) ? b : a)) : null);
  return {
    plusGrosDPlus: max((s) => s.dPlus),
    plusLongue: max((s) => s.km),
    plusLongueDuree: max((s) => s.secondes),
    top: sorties.filter((s) => s.dPlus > 0).sort((a, b) => b.dPlus - a.dPlus).slice(0, 5),
  };
}

export interface CibleTrail {
  nom: string;
  date: string;
  km: number | null;
  dPlus: number;
  joursRestants: number;
}

export interface PrepaTrail {
  /** La prochaine course (trail ou course) avec un dénivelé ; null s'il n'y en a pas. */
  cible: CibleTrail | null;
  /** Ton plus gros dénivelé en une sortie, et ta plus longue distance, sur les 12 dernières semaines. */
  meilleureDPlus: number;
  meilleureDistance: number;
  /** Le dénivelé des 4 dernières semaines, et sa moyenne par semaine. */
  dPlus4Semaines: number;
  dPlusParSemaine: number;
  /** Ton plus gros D+ en % du D+ de la course (peut dépasser 100) ; null sans cible. */
  pctDPlus: number | null;
  /** Ta plus longue sortie en % de la distance de la course ; null sans cible ou sans distance. */
  pctDistance: number | null;
}

/** Une course sur route avec un peu de dénivelé n'est pas un objectif de trail : en dessous de ce D+, on ne la retient pas. */
const DPLUS_MINI_COURSE = 300;

/** La prochaine course à dénivelé : la plus proche à venir parmi les objectifs de trail, ou de course avec au moins 300 m de D+. */
export function cibleTrail(objectifs: Objectif[], aujourdhui: Date = new Date()): CibleTrail | null {
  const retenu = (o: Objectif): boolean => {
    const famille = familleSport(o.sport);
    const dPlus = Number(o.d_plus);
    return positif(dPlus) && (famille === 'trail' || (famille === 'course' && dPlus >= DPLUS_MINI_COURSE));
  };
  const prochaine = objectifs
    .filter((o) => retenu(o) && joursAvant(o.date, aujourdhui) >= 0)
    .sort((a, b) => a.date.localeCompare(b.date))[0];
  return prochaine ? { nom: prochaine.name, date: prochaine.date, km: positif(Number(prochaine.km)) ? Number(prochaine.km) : null, dPlus: Number(prochaine.d_plus), joursRestants: joursAvant(prochaine.date, aujourdhui) } : null;
}

/** Où tu en es de ta préparation au dénivelé de la course visée. */
export function prepaTrail(seances: Seance[], objectifs: Objectif[], aujourdhui: Date = new Date()): PrepaTrail {
  const cible = cibleTrail(objectifs, aujourdhui);
  const douze = recentes(seances, 12, aujourdhui).map(enSortie);
  const quatre = recentes(seances, 4, aujourdhui).map(enSortie);
  const meilleureDPlus = Math.max(0, ...douze.map((s) => s.dPlus));
  const meilleureDistance = Math.max(0, ...douze.map((s) => s.km));
  const dPlus4Semaines = Math.round(quatre.reduce((t, s) => t + s.dPlus, 0));
  return {
    cible,
    meilleureDPlus: Math.round(meilleureDPlus),
    meilleureDistance: Math.round(meilleureDistance * 10) / 10,
    dPlus4Semaines,
    dPlusParSemaine: Math.round(dPlus4Semaines / 4),
    pctDPlus: cible ? Math.round((meilleureDPlus / cible.dPlus) * 100) : null,
    pctDistance: cible?.km ? Math.round((meilleureDistance / cible.km) * 100) : null,
  };
}
