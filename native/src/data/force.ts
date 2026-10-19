// Calculs du carnet de force : tonnage, 1RM estimé, records, séries par groupe, programme du jour.
// Port de app/src/lib/data/force.js (sans le brouillon de séance ni la validation des formulaires, qui viendront avec la saisie).
import { GRANDS_MOUVEMENTS, GROUPES, groupeValide, ORDRE_GROUPES } from './exercices.ts';
import type { ProgrammeForce, Seance, SerieForce } from './types.ts';

const JOUR = 86400000;

const nombre = (v: unknown): number => (Number.isFinite(Number(v)) ? Number(v) : 0);
const arrondi1 = (v: number): number => Math.round(v * 10) / 10;

/**
 * 1RM estimé (la charge qu'on soulèverait une seule fois) par la formule d'Epley : poids × (1 + reps / 30).
 * Au-delà de 12 répétitions, l'estimation n'est plus fiable : on renvoie null. Poids nul (gainage, pompes) : null.
 */
export function unRmEstime(poids: unknown, reps: unknown): number | null {
  const p = nombre(poids);
  const r = nombre(reps);
  if (!(p > 0) || !(r >= 1) || r > 12) return null;
  return arrondi1(r === 1 ? p : p * (1 + r / 30));
}

/**
 * Les records battus dans chaque séance. Un record = le meilleur 1RM estimé d'un exercice dans cette séance dépasse tout ce que tu
 * avais fait avant sur le même exercice (la toute première séance d'un exercice n'est pas un record : rien à battre).
 * Renvoie une Map : identifiant de la séance (activity_id des séries) → liste des noms d'exercices dont c'était un record.
 * Les séries sans séance rattachée (activity_id vide) sont ignorées : il n'y a pas de séance où afficher le record.
 */
export function recordsParSeance(series: SerieForce[]): Map<string, string[]> {
  const parExo = new Map<string, { nom: string; jours: Map<string, { rm: number; id: string | null }> }>();
  for (const s of series) {
    const rm = unRmEstime(s.weight_kg, s.reps);
    if (rm == null) continue;
    const date = String(s.date).slice(0, 10);
    let e = parExo.get(s.exercise_key);
    if (!e) parExo.set(s.exercise_key, (e = { nom: s.exercise_name, jours: new Map() }));
    const j = e.jours.get(date);
    if (!j) e.jours.set(date, { rm, id: s.activity_id || null });
    else {
      if (rm > j.rm) j.rm = rm;
      if (!j.id && s.activity_id) j.id = s.activity_id;
    }
  }
  const sortie = new Map<string, string[]>();
  for (const e of parExo.values()) {
    let meilleur: number | null = null;
    for (const [, j] of [...e.jours.entries()].sort((a, b) => a[0].localeCompare(b[0]))) {
      if (meilleur != null && j.rm > meilleur && j.id) {
        const liste = sortie.get(j.id) ?? [];
        liste.push(e.nom);
        sortie.set(j.id, liste);
      }
      if (meilleur == null || j.rm > meilleur) meilleur = j.rm;
    }
  }
  return sortie;
}

/** Tonnage d'une série : répétitions × charge (en kg). */
export function tonnageSerie(s: Pick<SerieForce, 'reps' | 'weight_kg'>): number {
  return nombre(s.reps) * nombre(s.weight_kg);
}

/** Tonnage total d'une liste de séries (kg). */
export function tonnage(series: SerieForce[]): number {
  return Math.round(series.reduce((somme, s) => somme + tonnageSerie(s), 0));
}

/** Nombre de jours entiers entre une date ISO et aujourd'hui (positif = passé). */
function joursDepuis(dateIso: string, aujourdhui: Date): number {
  const base = new Date(aujourdhui.getFullYear(), aujourdhui.getMonth(), aujourdhui.getDate());
  const d = new Date(`${String(dateIso).slice(0, 10)}T00:00:00`);
  return Math.floor((base.getTime() - d.getTime()) / JOUR);
}

/** Tonnage par fenêtre de 7 jours glissants, sur N fenêtres (la dernière = les 7 derniers jours). */
export function tonnageParSemaine(
  series: SerieForce[],
  nbSemaines = 12,
  aujourdhui: Date = new Date(),
): { parSemaine: number[]; derniere: number; moyenne: number; ecartPct: number | null } {
  const valeurs: number[] = new Array(nbSemaines).fill(0);
  for (const s of series) {
    const j = joursDepuis(s.date, aujourdhui);
    if (j < 0) continue;
    const i = Math.floor(j / 7);
    if (i >= nbSemaines) continue;
    valeurs[nbSemaines - 1 - i] += tonnageSerie(s);
  }
  const parSemaine = valeurs.map(Math.round);
  const derniere = parSemaine[nbSemaines - 1];
  const avant = parSemaine.slice(0, nbSemaines - 1).filter((v) => v > 0);
  const moyenne = avant.length ? avant.reduce((a, b) => a + b, 0) / avant.length : 0;
  // Écart en % de la semaine en cours par rapport à la moyenne des semaines d'avant (null si rien à comparer)
  const ecartPct = moyenne > 0 ? Math.round(((derniere - moyenne) / moyenne) * 100) : null;
  return { parSemaine, derniere, moyenne: Math.round(moyenne), ecartPct };
}

/** Séries par groupe musculaire sur les 7 derniers jours, avec la zone cible de chaque groupe. */
export function seriesParGroupe(series: SerieForce[], aujourdhui: Date = new Date()): { groupe: string; nom: string; series: number; cible: [number, number] }[] {
  const compte: Record<string, number> = Object.fromEntries(ORDRE_GROUPES.map((g) => [g, 0]));
  for (const s of series) {
    const j = joursDepuis(s.date, aujourdhui);
    if (j < 0 || j >= 7) continue;
    if (groupeValide(s.muscle_group) && nombre(s.reps) > 0) compte[s.muscle_group] += 1;
  }
  return ORDRE_GROUPES.map((g) => ({ groupe: g, nom: GROUPES[g].nom, series: compte[g], cible: GROUPES[g].cible }));
}

export interface ProgressionExercice {
  cle: string;
  nom: string;
  groupe: string;
  rm: number; // meilleur 1RM estimé de la séance la plus récente
  poids: number;
  reps: number;
  date: string;
  serie: { date: string; rm: number; poids: number; reps: number }[];
  meilleurRm: number;
  record: boolean; // ce meilleur 1RM bat les séances précédentes
  delta: number | null; // écart en kg avec la meilleure séance précédente
  nbSeries: number;
}

/**
 * Progression par exercice : meilleur 1RM estimé de chaque séance, record de tous les temps, et évolution.
 * Renvoie les exercices triés par date de dernière séance (les plus récents d'abord).
 *  - rm : meilleur 1RM estimé de la séance la plus récente de l'exercice ;
 *  - record : true si ce meilleur 1RM bat les séances précédentes ;
 *  - delta : écart en kg avec la meilleure séance précédente (null s'il n'y en a pas).
 */
export function progressionParExercice(series: SerieForce[]): ProgressionExercice[] {
  interface Brouillon {
    cle: string;
    nom: string;
    groupe: string;
    jours: Map<string, { rm: number; poids: number; reps: number }>;
    derniere: string;
    nbSeries: number;
  }
  const parExo = new Map<string, Brouillon>();
  for (const s of series) {
    const rm = unRmEstime(s.weight_kg, s.reps);
    if (rm == null) continue;
    let e = parExo.get(s.exercise_key);
    if (!e) parExo.set(s.exercise_key, (e = { cle: s.exercise_key, nom: s.exercise_name, groupe: s.muscle_group, jours: new Map(), derniere: '', nbSeries: 0 }));
    e.nbSeries += 1;
    const date = String(s.date).slice(0, 10);
    const meilleur = e.jours.get(date);
    if (!meilleur || rm > meilleur.rm) e.jours.set(date, { rm, poids: nombre(s.weight_kg), reps: nombre(s.reps) });
    if (date >= e.derniere) e.derniere = date;
  }
  const sortie: ProgressionExercice[] = [];
  for (const e of parExo.values()) {
    const serie = [...e.jours.entries()].map(([date, v]) => ({ date, ...v })).sort((a, b) => a.date.localeCompare(b.date));
    const dernier = serie[serie.length - 1];
    const avant = serie.slice(0, -1);
    const meilleurAvant = avant.length ? Math.max(...avant.map((p) => p.rm)) : null;
    sortie.push({
      cle: e.cle,
      nom: e.nom,
      groupe: e.groupe,
      rm: dernier.rm,
      poids: dernier.poids,
      reps: dernier.reps,
      date: dernier.date,
      serie,
      meilleurRm: Math.max(...serie.map((p) => p.rm)),
      record: meilleurAvant != null && dernier.rm > meilleurAvant,
      delta: meilleurAvant != null ? arrondi1(dernier.rm - meilleurAvant) : null,
      nbSeries: e.nbSeries,
    });
  }
  return sortie.sort((a, b) => b.date.localeCompare(a.date) || b.nbSeries - a.nbSeries);
}

// Quand on n'a la place que pour quelques cartes, les groupes retenus en priorité (le tronc n'a presque jamais de 1RM parlant)
const PRIORITE_GROUPES = ['jambes', 'pectoraux', 'dos', 'epaules', 'bras', 'tronc'];

/**
 * Les cartes « records » de l'accueil : UN exercice par groupe musculaire, sur TOUT l'historique (un record ne dépend pas de
 * ta régularité récente). L'exercice qui représente un groupe est son grand mouvement (squat, développé couché, soulevé de
 * terre…), sinon le plus pratiqué. S'il y a moins de place que de groupes (n), on garde les groupes dans l'ordre de
 * PRIORITE_GROUPES ; le résultat est toujours rangé dans l'ordre habituel (pectoraux, dos, jambes, épaules, bras, tronc).
 */
export function recordsParGroupe(series: SerieForce[], n = 5): ProgressionExercice[] {
  const rang = (cle: string) => {
    const i = GRANDS_MOUVEMENTS.indexOf(cle);
    return i === -1 ? GRANDS_MOUVEMENTS.length : i;
  };
  const parGroupe = new Map<string, ProgressionExercice>();
  const exos = progressionParExercice(series.filter((s) => groupeValide(s.muscle_group))).sort((a, b) => rang(a.cle) - rang(b.cle) || b.nbSeries - a.nbSeries);
  for (const e of exos) if (!parGroupe.has(e.groupe)) parGroupe.set(e.groupe, e);
  const retenus = PRIORITE_GROUPES.filter((g) => parGroupe.has(g)).slice(0, n);
  return ORDRE_GROUPES.filter((g) => retenus.includes(g)).map((g) => parGroupe.get(g)!);
}

// ---------------------------------------------------------------------------
// Programmes (séances types)
// ---------------------------------------------------------------------------

/** Durée estimée d'un programme : environ 3 minutes par série, repos compris. */
export function resumeProgramme(prog: ProgrammeForce | null | undefined): { exercices: number; series: number; minutes: number } {
  const exercices = Array.isArray(prog?.exercises) ? prog.exercises : [];
  const series = exercices.reduce((somme, e) => somme + nombre(e.sets), 0);
  return { exercices: exercices.length, series, minutes: series * 3 };
}

/**
 * Programme du jour : on enchaîne les programmes dans l'ordre où ils ont été créés (PUSH, PULL, LEGS, PUSH…).
 * Le suivant est celui qui vient après la dernière séance dont le nom correspond à un programme ;
 * sans historique, c'est le premier.
 */
export function programmeDuJour(programmes: ProgrammeForce[], seances: Seance[] = []): ProgrammeForce | null {
  if (!programmes.length) return null;
  const ordre = [...programmes].sort((a, b) => String(a.created_at || '').localeCompare(String(b.created_at || '')));
  const noms = ordre.map((p) => p.name.trim().toLowerCase());
  const force = seances.filter((s) => /weight|force|muscu/i.test(s.sport || '') || noms.includes(String(s.name || '').trim().toLowerCase()));
  const derniere = [...force].sort((a, b) => String(b.start_date_local).localeCompare(String(a.start_date_local)))[0];
  const i = derniere ? noms.indexOf(String(derniere.name || '').trim().toLowerCase()) : -1;
  return ordre[(i + 1) % ordre.length];
}
