// Ski de fond : le temps réparti entre la neige, les roulettes et le hors-piste. Calculs purs, sans écran (testés dans tests/ski.test.ts).
// Le dénivelé, les kilomètres, les meilleures sorties, l'intensité et la préparation à une course passent par les fonctions communes
// (trail.ts, hebdo.ts, natation.ts) : elles servent à plusieurs sports.
import { SKI_DE_FOND } from './familles.ts';
import { cumulParSemaine } from './hebdo.ts';
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
