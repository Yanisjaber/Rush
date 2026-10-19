// Formes des données, identiques à celles de la base (voir MODELE_DONNEES.md) : activities, activity_planned, strength_sets.

/** Une séance réalisée (table activities). */
export interface Seance {
  id: string;
  name: string | null;
  sport: string; // type brut (Strava) : Run, Ride, WeightTraining…
  start_date_local: string;
  moving_time: number; // secondes
  distance_km: number | null;
  total_elevation_gain: number | null;
  avg_heartrate: number | null;
  ftp_at_time: number | null;
  avg_watts: number | null;
  np: number | null;
  tss: number | null;
  category: string;
}

/** Une séance prévue ou une compétition (table activity_planned). */
export interface Prevue {
  id: string;
  name: string | null;
  date: string;
  sport: string;
  duration: number | null; // minutes
  tss: number | null;
  category: string; // 'entrainement' | 'competition'
  km: number | null;
  programme_id?: string;
}

/** Un objectif de compétition. */
export interface Objectif {
  id: string;
  name: string;
  date: string;
  sport: string;
  km: number | null;
  d_plus: number | null;
  priority: string;
  duration: number;
  category: string;
}

/** Une série de force (table strength_sets). */
export interface SerieForce {
  id: string;
  activity_id: string | null;
  date: string;
  exercise_key: string;
  exercise_name: string;
  muscle_group: string;
  position: number;
  set_no: number;
  reps: number;
  weight_kg: number;
  rir?: number;
}

/** Un jour de charge : CTL (forme de fond), ATL (fatigue), TSB (fraîcheur). */
export interface Metrique {
  iso_date: string;
  tss: number;
  ctl: number;
  atl: number;
  tsb: number;
  duration_min: number;
  activity_count: number;
}

/** Meilleure puissance moyenne sur une durée : sur 90 jours et sur toute la vie (watts). */
export interface PointPuissance {
  duration_s: number;
  watts_90d: number;
  watts_alltime: number;
}

/** Un exercice d'un programme de musculation. */
export interface ExerciceProgramme {
  key: string;
  name: string;
  group: string;
  sets: number;
  reps: number;
  weight: number;
}

/** Un programme de musculation (table strength_programs) : PUSH, PULL, LEGS… */
export interface ProgrammeForce {
  id: string;
  name: string;
  created_at: string;
  notes: string | null;
  exercises: ExerciceProgramme[];
}

/** Taille d'un widget : petit, moyen, large, pleine largeur. */
export type Taille = 's' | 'm' | 'l' | 'xl';

/** Réglages de l'athlète (table user_profiles). */
export interface Profil {
  ftp: number | null;
  hr_max: number | null;
  lthr: number | null;
  weight: number | null;
  extras: Record<string, unknown>;
}

/**
 * Ce que reçoit chaque widget : toujours la même enveloppe, filtrée par le sport choisi
 * (`seances`, `dernieres`, `planifiees`), plus les données qui ne se filtrent pas (`toutesSeances`, `metriques`).
 */
export interface Contexte {
  seances: Seance[];
  toutesSeances: Seance[];
  dernieres: Seance[];
  metriques: Metrique[];
  objectifs: Objectif[];
  planifiees: Prevue[];
  profil: Profil | null;
  hrMax: number | null;
  filtre: string;
  puissance: PointPuissance[];
  force: { series: SerieForce[]; programmes: ProgrammeForce[] };
}

/** Les propriétés que reçoit chaque composant de widget. */
export interface WidgetProps {
  contexte: Contexte;
  taille?: Taille;
  /** Version compacte pour téléphone (tuile de 2 par ligne). */
  compact?: boolean;
}
