// Trail et VTT : le dénivelé par semaine, la préparation face à la course visée, les meilleures sorties (le trail a aussi le km-effort).
// Calculs purs, sans écran (testés dans tests/trail.test.ts et tests/vtt.test.ts). On ne regarde que les sorties du sport (TrailRun pour le trail,
// VTT, gravel et VTT électrique pour le VTT), pas la course sur route ni le vélo de route.
// Le km-effort est la mesure usuelle du trail : 1 km-effort = 1 km + 100 m de dénivelé positif.
import { familleBarre, familleSport } from './familles.ts';
import { joursAvant } from './format.ts';
import { cumulParSemaine, type CumulHebdo } from './hebdo.ts';
import { indexSemaine } from './synthese.ts';
import type { Objectif, Seance } from './types.ts';

/** Les deux sports de dénivelé qui ont leur onglet. */
export type SportDenivele = 'trail' | 'vtt';

const EST_TRAIL = (s: Seance): boolean => familleSport(s.sport) === 'trail' && s.moving_time > 0;
const EST_SPORT = (sport: SportDenivele) => (s: Seance): boolean => s.moving_time > 0 && (sport === 'trail' ? familleSport(s.sport) === 'trail' : familleBarre(s.sport) === 'vtt');
const positif = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v) && v > 0;

/** Les kilomètres-effort d'une sortie : distance + dénivelé positif ÷ 100. */
export const kmEffort = (s: Seance): number => (positif(s.distance_km) ? s.distance_km : 0) + (positif(s.total_elevation_gain) ? s.total_elevation_gain / 100 : 0);

/** Dénivelé positif grimpé par semaine glissante (mètres), pour un sport de dénivelé. */
export function deniveleParSemaineSport(seances: Seance[], sport: SportDenivele, nbSemaines = 12, aujourdhui: Date = new Date()): CumulHebdo {
  const est = EST_SPORT(sport);
  return cumulParSemaine(seances, (s) => est(s) && positif(s.total_elevation_gain), (s) => Number(s.total_elevation_gain), nbSemaines, aujourdhui, 0);
}

/** Dénivelé positif grimpé par semaine glissante en trail (mètres). */
export const deniveleTrailParSemaine = (seances: Seance[], nbSemaines = 12, aujourdhui: Date = new Date()): CumulHebdo => deniveleParSemaineSport(seances, 'trail', nbSemaines, aujourdhui);

/** Kilomètres par semaine glissante (une décimale), pour un sport de dénivelé. */
export function kmParSemaineSport(seances: Seance[], sport: SportDenivele, nbSemaines = 12, aujourdhui: Date = new Date()): CumulHebdo {
  const est = EST_SPORT(sport);
  return cumulParSemaine(seances, (s) => est(s) && positif(s.distance_km), (s) => Number(s.distance_km), nbSemaines, aujourdhui, 1);
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
const recentes = (seances: Seance[], nbSemaines: number, aujourdhui: Date, sport: SportDenivele = 'trail'): Seance[] => {
  const est = EST_SPORT(sport);
  return seances.filter((s) => {
    const i = indexSemaine(s.start_date_local, aujourdhui);
    return est(s) && i >= 0 && i < nbSemaines;
  });
};

export interface MeilleuresTrail {
  plusGrosDPlus: SortieTrail | null;
  plusLongue: SortieTrail | null;
  plusLongueDuree: SortieTrail | null;
  /** Les cinq plus gros dénivelés, du plus gros au plus petit. */
  top: SortieTrail[];
}

/** Les meilleures sorties des 12 dernières semaines pour un sport de dénivelé : le plus gros D+, la plus longue distance, la plus longue durée. */
export function meilleuresSorties(seances: Seance[], sport: SportDenivele, nbSemaines = 12, aujourdhui: Date = new Date()): MeilleuresTrail {
  const sorties = recentes(seances, nbSemaines, aujourdhui, sport).map(enSortie);
  const max = (cle: (s: SortieTrail) => number): SortieTrail | null => (sorties.length && Math.max(...sorties.map(cle)) > 0 ? sorties.reduce((a, b) => (cle(b) > cle(a) ? b : a)) : null);
  return {
    plusGrosDPlus: max((s) => s.dPlus),
    plusLongue: max((s) => s.km),
    plusLongueDuree: max((s) => s.secondes),
    top: sorties.filter((s) => s.dPlus > 0).sort((a, b) => b.dPlus - a.dPlus).slice(0, 5),
  };
}

/** Les meilleures sorties de trail des 12 dernières semaines. */
export const meilleuresTrail = (seances: Seance[], nbSemaines = 12, aujourdhui: Date = new Date()): MeilleuresTrail => meilleuresSorties(seances, 'trail', nbSemaines, aujourdhui);

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

/**
 * La prochaine course à dénivelé : la plus proche à venir. Trail : un objectif de trail, ou de course avec au moins 300 m de D+.
 * VTT : un objectif de VTT, gravel ou VTT électrique avec un D+ (un objectif de vélo de route n'est pas une cible de VTT).
 */
export function cibleDenivele(objectifs: Objectif[], sport: SportDenivele = 'trail', aujourdhui: Date = new Date()): CibleTrail | null {
  const retenu = (o: Objectif): boolean => {
    const dPlus = Number(o.d_plus);
    if (!positif(dPlus)) return false;
    if (sport === 'vtt') return familleBarre(o.sport) === 'vtt';
    const famille = familleSport(o.sport);
    return famille === 'trail' || (famille === 'course' && dPlus >= DPLUS_MINI_COURSE);
  };
  const prochaine = objectifs.filter((o) => retenu(o) && joursAvant(o.date, aujourdhui) >= 0).sort((a, b) => a.date.localeCompare(b.date))[0];
  return prochaine ? { nom: prochaine.name, date: prochaine.date, km: positif(Number(prochaine.km)) ? Number(prochaine.km) : null, dPlus: Number(prochaine.d_plus), joursRestants: joursAvant(prochaine.date, aujourdhui) } : null;
}

/** La prochaine course de trail à dénivelé. */
export const cibleTrail = (objectifs: Objectif[], aujourdhui: Date = new Date()): CibleTrail | null => cibleDenivele(objectifs, 'trail', aujourdhui);

/** Où tu en es de ta préparation au dénivelé de la course visée, pour un sport de dénivelé. */
export function prepaDenivele(seances: Seance[], objectifs: Objectif[], sport: SportDenivele = 'trail', aujourdhui: Date = new Date()): PrepaTrail {
  const cible = cibleDenivele(objectifs, sport, aujourdhui);
  const douze = recentes(seances, 12, aujourdhui, sport).map(enSortie);
  const quatre = recentes(seances, 4, aujourdhui, sport).map(enSortie);
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

/** Où tu en es de ta préparation à ta course de trail. */
export const prepaTrail = (seances: Seance[], objectifs: Objectif[], aujourdhui: Date = new Date()): PrepaTrail => prepaDenivele(seances, objectifs, 'trail', aujourdhui);
