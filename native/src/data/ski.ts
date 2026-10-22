// Ski de fond : le temps réparti entre la neige, les roulettes et le hors-piste, les kilomètres et le dénivelé par semaine, les meilleures sorties.
// Calculs purs, sans écran (testés dans tests/ski.test.ts). L'intensité et la préparation à une course passent par les fonctions communes (hebdo.ts, natation.ts).
import { SKI_DE_FOND } from './familles.ts';
import { cumulParSemaine, type CumulHebdo } from './hebdo.ts';
import { indexSemaine } from './synthese.ts';
import type { Seance } from './types.ts';

export type Surface = 'neige' | 'roulettes' | 'horspiste';
export const SURFACES: Surface[] = ['neige', 'roulettes', 'horspiste'];

const SURFACE_DE: Record<string, Surface> = { NordicSki: 'neige', RollerSki: 'roulettes', BackcountrySki: 'horspiste' };

/** Une séance de l'onglet Ski de fond : ski de fond, ski à roulettes, hors-piste. */
export const estSkiDeFond = (s: Pick<Seance, 'sport'>): boolean => SKI_DE_FOND.includes(s.sport);

/** La surface d'une séance de ski ; null pour tout autre sport (le ski alpin et le snowboard n'en ont pas ici). */
export const surfaceDe = (s: Pick<Seance, 'sport'>): Surface | null => (Object.hasOwn(SURFACE_DE, s.sport) ? SURFACE_DE[s.sport] : null);

export interface PartSurface {
  cle: Surface;
  /** Temps passé, en secondes. */
  temps: number;
  /** Distance parcourue, en kilomètres (une décimale). */
  km: number;
  /** Part du temps total, en % (entier). */
  pct: number;
}

export interface RepartitionSurfaces {
  parts: PartSurface[];
  /** Temps total, en secondes. */
  total: number;
}

/** Le temps passé sur la neige, en ski à roulettes et en hors-piste sur les `nbSemaines` dernières semaines. Null sans séance de ski. */
export function repartitionSurfaces(seances: Seance[], nbSemaines = 12, aujourdhui: Date = new Date()): RepartitionSurfaces | null {
  const temps: Record<Surface, number> = { neige: 0, roulettes: 0, horspiste: 0 };
  const km: Record<Surface, number> = { neige: 0, roulettes: 0, horspiste: 0 };
  for (const s of seances) {
    const surface = surfaceDe(s);
    const i = indexSemaine(s.start_date_local, aujourdhui);
    if (!surface || !(s.moving_time > 0) || i < 0 || i >= nbSemaines) continue;
    temps[surface] += s.moving_time;
    km[surface] += Number(s.distance_km) > 0 ? Number(s.distance_km) : 0;
  }
  const total = SURFACES.reduce((a, c) => a + temps[c], 0);
  if (total <= 0) return null;
  return { parts: SURFACES.map((cle) => ({ cle, temps: temps[cle], km: Math.round(km[cle] * 10) / 10, pct: Math.round((temps[cle] / total) * 100) })), total };
}

/** Les minutes de chaque surface, semaine après semaine (pour un graphique empilé), de la plus ancienne à la plus récente. */
export function minutesParSemaineSurfaces(seances: Seance[], nbSemaines = 8, aujourdhui: Date = new Date()): { cle: Surface; minutes: number[] }[] {
  return SURFACES.map((cle) => ({
    cle,
    minutes: cumulParSemaine(seances, (s) => surfaceDe(s) === cle && s.moving_time > 0, (s) => s.moving_time / 60, nbSemaines, aujourdhui, 0).parSemaine,
  }));
}

// --- Kilomètres, dénivelé et meilleures sorties ------------------------------------------------------------------------------------

const positif = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v) && v > 0;
const estSortie = (s: Seance): boolean => estSkiDeFond(s) && s.moving_time > 0;

/** Kilomètres skiés par semaine glissante (une décimale). */
export function kmSkiParSemaine(seances: Seance[], nbSemaines = 12, aujourdhui: Date = new Date()): CumulHebdo {
  return cumulParSemaine(seances, (s) => estSortie(s) && positif(s.distance_km), (s) => Number(s.distance_km), nbSemaines, aujourdhui, 1);
}

/** Dénivelé positif grimpé à ski par semaine glissante (mètres). */
export function deniveleSkiParSemaine(seances: Seance[], nbSemaines = 12, aujourdhui: Date = new Date()): CumulHebdo {
  return cumulParSemaine(seances, (s) => estSortie(s) && positif(s.total_elevation_gain), (s) => Number(s.total_elevation_gain), nbSemaines, aujourdhui, 0);
}

export interface SortieSki {
  id: string;
  nom: string | null;
  date: string;
  km: number;
  dPlus: number;
  secondes: number;
}

export interface MeilleuresSkis {
  plusGrosDPlus: SortieSki | null;
  plusLongue: SortieSki | null;
  plusLongueDuree: SortieSki | null;
  /** Les cinq plus gros dénivelés, du plus gros au plus petit. */
  top: SortieSki[];
}

/** Les meilleures sorties de ski des 12 dernières semaines : le plus gros D+, la plus longue distance, la plus longue durée. */
export function meilleuresSortiesSki(seances: Seance[], nbSemaines = 12, aujourdhui: Date = new Date()): MeilleuresSkis {
  const sorties = seances
    .filter((s) => {
      const i = indexSemaine(s.start_date_local, aujourdhui);
      return estSortie(s) && i >= 0 && i < nbSemaines;
    })
    .map((s): SortieSki => ({ id: s.id, nom: s.name, date: String(s.start_date_local).slice(0, 10), km: positif(s.distance_km) ? s.distance_km : 0, dPlus: positif(s.total_elevation_gain) ? s.total_elevation_gain : 0, secondes: s.moving_time }));
  const max = (cle: (s: SortieSki) => number): SortieSki | null => (sorties.length && Math.max(...sorties.map(cle)) > 0 ? sorties.reduce((a, b) => (cle(b) > cle(a) ? b : a)) : null);
  return {
    plusGrosDPlus: max((s) => s.dPlus),
    plusLongue: max((s) => s.km),
    plusLongueDuree: max((s) => s.secondes),
    top: sorties.filter((s) => s.dPlus > 0).sort((a, b) => b.dPlus - a.dPlus).slice(0, 5),
  };
}

