// Analyse de la musculation, muscle par muscle. Port de app/src/lib/analyse/muscu.js :
// pour l'instant seulement ce que le corps de l'Accueil utilise (muscleParMuscle et musclesSurPeriode).
import { groupeValide } from './exercices.ts';
import { dateIsoLocale } from '../outils/format.ts';
import { decalerJour } from '../outils/maths.ts';
import { MUSCLES, PORTIONS, repartirPortions, repartirSerie } from './muscles.ts';
import type { SerieForce } from '../types.ts';

const iso = (s: { date: string }) => String(s.date).slice(0, 10);

/** Séries exploitables (passées, avec au moins une répétition) et jour de fin de l'analyse : toujours aujourd'hui. */
function reperes(series: SerieForce[], aujourdhui: Date): { valides: SerieForce[]; fin: string } {
  const fin = dateIsoLocale(aujourdhui);
  const valides = series.filter((s) => iso(s) <= fin && Number(s.reps) > 0);
  return { valides, fin };
}

export type EtatMuscle = 'oublie' | 'sous' | 'zone' | 'au-dessus';

export interface PortionMuscle {
  cle: string;
  nom: string;
  series: number;
  parSemaine: number;
  cible: [number, number];
  pct: number;
  etat: EtatMuscle;
  idee: string[];
}

export interface ResumeMuscle {
  slug: string;
  nom: string;
  avec: string;
  groupe: string;
  series: number;
  parSemaine: number;
  cible: [number, number];
  etat: EtatMuscle;
  pct: number; // pourcentage de la zone visée (100 = milieu de la zone)
  exercices: { nom: string; series: number; role: 'principal' | 'secondaire' }[];
  idee: string[];
  portions: PortionMuscle[];
}

/**
 * Muscle par muscle : chaque série est répartie entre les muscles qu'elle travaille (principal : 1, secondaire : 0,5).
 * Renvoie une fonction slug → résumé du muscle pour les séries données sur `semainesPeriode` semaines.
 */
export function muscleParMuscle(fenetre: SerieForce[], semainesPeriode: number): (slug: string) => ResumeMuscle {
  const parMuscle: Record<string, { series: number; exos: Map<string, { nom: string; series: number; role: 'principal' | 'secondaire' }>; portions: Record<string, number> }> = Object.fromEntries(
    Object.keys(MUSCLES).map((m) => [m, { series: 0, exos: new Map(), portions: Object.fromEntries((PORTIONS[m] || []).map((p) => [p.cle, 0])) }]),
  );
  for (const x of fenetre) {
    const nomExo = x.exercise_name || x.exercise_key;
    for (const { muscle, poids } of repartirSerie(x.exercise_key, x.exercise_name, x.muscle_group)) {
      const m = parMuscle[muscle];
      m.series += poids;
      for (const { portion, part } of repartirPortions(x.exercise_key, x.exercise_name, muscle)) m.portions[portion] += poids * part;
      const e = m.exos.get(nomExo) || { nom: nomExo, series: 0, role: 'secondaire' as const };
      e.series += 1;
      if (poids >= 1) e.role = 'principal';
      m.exos.set(nomExo, e);
    }
  }
  return (slug) => {
    const def = MUSCLES[slug];
    const par = parMuscle[slug].series / semainesPeriode;
    const [bas, haut] = def.cible;
    const etat: EtatMuscle = parMuscle[slug].series === 0 ? 'oublie' : par < bas ? 'sous' : par > haut ? 'au-dessus' : 'zone';
    const exercices = [...parMuscle[slug].exos.values()].sort((a, b) => b.series - a.series);
    const portions = (PORTIONS[slug] || []).map((p): PortionMuscle => {
      const parP = parMuscle[slug].portions[p.cle] / semainesPeriode;
      const [pb, ph] = p.cible;
      return {
        cle: p.cle,
        nom: p.nom,
        series: Math.round(parMuscle[slug].portions[p.cle] * 10) / 10,
        parSemaine: parP,
        cible: p.cible,
        pct: Math.round((parP / ((pb + ph) / 2)) * 100),
        etat: parMuscle[slug].portions[p.cle] === 0 ? 'oublie' : parP < pb ? 'sous' : parP > ph ? 'au-dessus' : 'zone',
        idee: p.idee,
      };
    });
    return {
      slug,
      nom: def.nom,
      avec: def.avec || '',
      groupe: def.groupe,
      series: Math.round(parMuscle[slug].series * 10) / 10,
      parSemaine: par,
      cible: def.cible,
      etat,
      pct: Math.round((par / ((bas + haut) / 2)) * 100),
      exercices,
      idee: def.idee,
      portions,
    };
  };
}

/** Les muscles (avec leur pourcentage de la zone visée) sur les `jours` derniers jours : pour le corps du widget de l'accueil. */
export function musclesSurPeriode(series: SerieForce[], aujourdhui: Date = new Date(), jours = 7): Record<string, ResumeMuscle> {
  const { valides, fin } = reperes(series, aujourdhui);
  const debut = decalerJour(fin, -(jours - 1));
  const fenetre = valides.filter((s) => iso(s) >= debut && iso(s) <= fin && groupeValide(s.muscle_group));
  const muscleDe = muscleParMuscle(fenetre, jours / 7);
  return Object.fromEntries(Object.keys(MUSCLES).map((slug) => [slug, muscleDe(slug)]));
}
