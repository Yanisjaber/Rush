// Formes des données, identiques à celles de la base (voir docs/db/MODELE_DONNEES.md) : activities, activity_planned, strength_sets.
import type { DetailsNote } from './sante/sante-notes.ts';

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
  // Colonnes présentes sur les vraies lignes de la base (absentes des données de démo)
  strava_id?: number | null;
  source?: string;
  rpe?: number | null;
  user_notes?: string | null;
  // Colonnes de l'écran de détail d'une séance (voir chargerSeance)
  elapsed_time?: number | null;
  avg_speed_kmh?: number | null;
  max_heartrate?: number | null;
  max_watts?: number | null;
  avg_cadence?: number | null;
  kj?: number | null;
  calories?: number | null;
  /** Valeurs d'origine quand la séance a été retouchée (voir retouches.ts). */
  origine?: Record<string, unknown>;
  retouchee?: boolean;
}

/** Un tour (lap) d'une séance, tel que le renvoie la fonction strava-laps : durées en secondes, distance en mètres. */
export interface Tour {
  index: number;
  name: string;
  elapsed_time: number;
  moving_time: number;
  distance: number;
}

/** Un cycle d'entraînement (table training_cycles) : une période que l'utilisateur nomme et colore (« Bloc force », « Affûtage »…). Dates incluses. */
export interface Cycle {
  id: string;
  name: string;
  from_date: string;
  to_date: string;
  /** #rrggbb */
  color: string;
  /** Le sport du cycle (clé de theme/sports : course, velo, muscu…), ou null : le cycle concerne tous les sports. */
  sport?: string | null;
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
  /** Dénivelé prévu, en mètres (facultatif). */
  d_plus?: number | null;
  programme_id?: string;
}

/** Une séance prévue ou une compétition avec toutes ses colonnes (blocs, notes, parcours GPX…), telle qu'on la lit pour l'ouvrir ou la modifier. */
export interface PrevueComplete extends Prevue {
  start_date_local: string | null;
  rpe: number | null;
  notes: string | null;
  /** Les blocs de la séance (voir structure.ts) ; null sans structure. */
  structure: unknown[] | null;
  est_watts: number | null;
  est_bpm: number | null;
  est_kj: number | null;
  est_if: number | null;
  gpx_name: string | null;
  gpx_content: string | null;
  /** Compétition seulement : priorité A ou B, type d'épreuve, temps cible (minutes, en texte), tours, fédération, niveau, format de triathlon. */
  priority: string | null;
  type: string | null;
  target: string | null;
  laps: number | null;
  federation: string | null;
  race_level: string | null;
  tri_format: string | null;
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

/** Un test ou une course Hyrox (table hyrox_tests) : 16 segments dans l'ordre officiel (run, station, run, station…). */
export interface TestHyrox {
  id: string;
  date: string;
  label: string;
  kind: 'test' | 'course';
  segments: number[]; // 16 temps en secondes
  total_s: number;
  source: string;
  activity_id: string | null;
  notes: string | null;
}

/** L'objectif de temps Hyrox : un total et, facultatif, 16 temps visés (table hyrox_objectif). */
export interface ObjectifHyrox {
  total_s: number;
  segments: number[] | null;
}

/** Une note du calendrier (table day_notes) : sur une plage de dates, avec un type et une couleur. */
export interface Note {
  id: string;
  type: 'texte' | 'maladie' | 'blessure' | 'indisponible' | string;
  text: string | null;
  color: string | null;
  from_date: string;
  to_date: string;
  /** Le détail de santé (nom de la maladie, zone de la blessure…), voir data/sante-notes.ts. Absent pour une simple note. */
  details?: DetailsNote | null;
}

/** Segment d'une nuit : [début en minutes, fin en minutes, niveau] (0 profond, 1 léger, 2 paradoxal, 3 éveillé). */
export type SegmentNuit = [number, number, number];

/** Une nuit de sommeil (une ligne de garmin_sleep). Les valeurs absentes sont null. */
export interface Nuit {
  date: string;
  bedtime: string | null; // « AAAA-MM-JJ HH:MM »
  wake_time: string | null;
  total_sec: number | null;
  deep_sec: number | null;
  light_sec: number | null;
  rem_sec: number | null;
  awake_sec: number | null;
  awake_count: number | null;
  restless_count: number | null;
  avg_stress: number | null;
  avg_heart_rate: number | null;
  resting_heart_rate: number | null;
  body_battery_change: number | null;
  hrv_avg: number | null;
  hrv_status: string | null;
  resp_avg: number | null;
  resp_min: number | null;
  resp_max: number | null;
  spo2_avg: number | null;
  score: number | null; // score de Garmin : jamais utilisé, on recalcule le nôtre
  score_qualifier: string | null;
  segments: SegmentNuit[] | null;
}

/** Taille d'un widget : XS = une ligne fine (60 pt), S = une demi-ligne (tuile), M = une ligne entière, L = deux lignes de haut. */
export type Taille = 'xs' | 's' | 'm' | 'l';

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
  hyrox: { tests: TestHyrox[]; objectif: ObjectifHyrox | null };
}

/** Les propriétés que reçoit chaque composant de widget. */
export interface WidgetProps {
  contexte: Contexte;
  taille?: Taille;
  /** Taille S : version tuile (deux par ligne), disponible pour tous les widgets. */
  tuile?: boolean;
}
