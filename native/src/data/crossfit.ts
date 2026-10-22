// CrossFit : le temps d'entraînement par semaine, l'intensité des séances, le mix force / WOD / endurance, les séances marquantes.
// Calculs purs, sans écran (testés dans tests/crossfit.test.ts). On n'a pas le détail des WOD (temps, répétitions, charges) : seulement la durée, le cardio et la charge de chaque séance.
import { familleAffichage } from './familles.ts';
import { cumulParSemaine, intensiteParZone, type CumulHebdo, type RepartitionZones } from './hebdo.ts';
import { indexSemaine } from './synthese.ts';
import type { Seance } from './types.ts';

/** Une séance de CrossFit : le type CrossFit de Strava ou le HIIT. */
const EST_WOD = (s: Seance): boolean => familleAffichage(s.sport) === 'crossfit' && s.moving_time > 0;

/** Minutes de CrossFit par semaine glissante. */
export function hebdoCrossfit(seances: Seance[], nbSemaines = 12, aujourdhui: Date = new Date()): CumulHebdo {
  return cumulParSemaine(seances, EST_WOD, (s) => s.moving_time / 60, nbSemaines, aujourdhui, 0);
}

/** L'intensité du CrossFit : voir intensiteParZone (hebdo.ts). */
export { ZONES_INTENSITE } from './hebdo.ts';

/**
 * Le temps de CrossFit selon l'intensité (cardio moyen de la séance rapporté à ta FC max), sur les 4 dernières semaines. Une séance est rangée tout entière
 * dans le niveau de son cardio moyen : c'est une estimation (un WOD alterne des pics et des pauses). Null sans FC max ou sans séance avec cardio.
 */
export function intensiteCrossfit(seances: Seance[], hrMax: number | null, nbSemaines = 4, aujourdhui: Date = new Date()): RepartitionZones | null {
  return intensiteParZone(seances, hrMax, EST_WOD, nbSemaines, aujourdhui);
}

export type TypeEntrainement = 'wod' | 'force' | 'endurance';

/** Le type d'une séance : WOD (CrossFit, HIIT), force (musculation), endurance (course, vélo, natation, aviron) ; null pour le reste. */
export function typeDe(s: Pick<Seance, 'sport'>): TypeEntrainement | null {
  const f = familleAffichage(s.sport);
  if (f === 'crossfit') return 'wod';
  if (f === 'muscu') return 'force';
  return ['course', 'velo', 'natation', 'aviron'].includes(f) ? 'endurance' : null;
}

export const TYPES: TypeEntrainement[] = ['wod', 'force', 'endurance'];

export interface MixEntrainement {
  parts: { cle: TypeEntrainement; temps: number; pct: number }[];
  total: number;
}

/** Le temps passé en WOD, en force et en endurance sur les `nbSemaines` dernières semaines. Null sans séance. */
export function mixEntrainement(seances: Seance[], nbSemaines = 4, aujourdhui: Date = new Date()): MixEntrainement | null {
  const temps: Record<TypeEntrainement, number> = { wod: 0, force: 0, endurance: 0 };
  for (const s of seances) {
    const t = typeDe(s);
    const i = indexSemaine(s.start_date_local, aujourdhui);
    if (!t || !(s.moving_time > 0) || i < 0 || i >= nbSemaines) continue;
    temps[t] += s.moving_time;
  }
  const total = TYPES.reduce((a, t) => a + temps[t], 0);
  if (total <= 0) return null;
  return { parts: TYPES.map((cle) => ({ cle, temps: temps[cle], pct: Math.round((temps[cle] / total) * 100) })), total };
}

/** Les minutes de chaque type, semaine après semaine (pour un graphique empilé), de la plus ancienne à la plus récente. */
export function minutesParSemaineTypes(seances: Seance[], nbSemaines = 8, aujourdhui: Date = new Date()): { cle: TypeEntrainement; minutes: number[] }[] {
  return TYPES.map((cle) => ({
    cle,
    minutes: cumulParSemaine(seances, (s) => typeDe(s) === cle && s.moving_time > 0, (s) => s.moving_time / 60, nbSemaines, aujourdhui, 0).parSemaine,
  }));
}

export interface SeanceMarquante {
  id: string;
  nom: string | null;
  date: string;
  secondes: number;
  /** Charge de la séance (points), cardio moyen (bpm) : null quand la séance ne les a pas. */
  charge: number | null;
  fc: number | null;
}

export interface SeancesMarquantes {
  plusLongue: SeanceMarquante | null;
  /** La séance qui a la plus forte charge. */
  plusLourde: SeanceMarquante | null;
  /** La séance au cardio moyen le plus haut. */
  plusIntense: SeanceMarquante | null;
  /** Les cinq plus fortes charges, de la plus forte à la plus faible. */
  top: SeanceMarquante[];
}

/** Tes séances de CrossFit les plus marquantes des 12 dernières semaines : la plus longue, la plus lourde, la plus intense. */
export function seancesMarquantes(seances: Seance[], nbSemaines = 12, aujourdhui: Date = new Date()): SeancesMarquantes {
  const liste = seances
    .filter((s) => {
      const i = indexSemaine(s.start_date_local, aujourdhui);
      return EST_WOD(s) && i >= 0 && i < nbSemaines;
    })
    .map((s): SeanceMarquante => ({
      id: s.id,
      nom: s.name,
      date: String(s.start_date_local).slice(0, 10),
      secondes: s.moving_time,
      charge: Number(s.tss) > 0 ? Math.round(Number(s.tss)) : null,
      fc: Number(s.avg_heartrate) > 0 ? Math.round(Number(s.avg_heartrate)) : null,
    }));
  const max = (cle: (s: SeanceMarquante) => number | null): SeanceMarquante | null => {
    const avec = liste.filter((s) => cle(s) != null);
    return avec.length ? avec.reduce((a, b) => ((cle(b) as number) > (cle(a) as number) ? b : a)) : null;
  };
  return {
    plusLongue: max((s) => s.secondes),
    plusLourde: max((s) => s.charge),
    plusIntense: max((s) => s.fc),
    top: liste.filter((s) => s.charge != null).sort((a, b) => (b.charge as number) - (a.charge as number)).slice(0, 5),
  };
}
