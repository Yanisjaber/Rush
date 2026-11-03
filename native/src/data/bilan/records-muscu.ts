// Les records de musculation du Bilan, calculés sur le carnet de force (une ligne par série : exercice, poids, répétitions) et sur les séances déjà chargées. Fonctions pures, sans réseau.
// Deux étages : les records de séance (la plus grosse en tonnage, en séries, en répétitions…) qui alimentent les mini tuiles, et les records par exercice
// (1RM estimé, charge max, répétitions max, charge par nombre de répétitions) qui se choisissent dans un menu.
import type { SerieForce } from '../types.ts';
import type { ActiviteBilan } from './bilan.ts';
import type { EntreeCourbe, EntreeRecord, PointCourbe, RecordTop } from './records.ts';

/** Au-delà de 12 répétitions, la formule d'Epley surestime : le 1RM estimé n'est calculé que sur 1 à 12 répétitions (comme la progression). */
export const REPS_MAX_1RM = 12;
/** Les nombres de répétitions de la « courbe de force » : la charge la plus lourde tenue pour au moins n répétitions. */
export const REPETITIONS_COURBE = [1, 2, 3, 5, 8, 10, 12] as const;
/** Combien d'entrées dans le classement d'un record. */
const CLASSEMENT = 30;

/** 1RM estimé (Epley) d'une série : poids × (1 + répétitions ÷ 30). */
export const epley = (poidsKg: number, reps: number): number => poidsKg * (1 + reps / 30);

const iso = (s: SerieForce): string => String(s.date).slice(0, 10);
const kg = (v: number): string => (Number.isInteger(v) ? String(v) : v.toFixed(1).replace('.', ','));

/** Les séries qui comptent : un poids et au moins une répétition (les exercices au poids du corps, sans lest, n'ont pas de charge à comparer). */
export const seriesAvecCharge = (series: readonly SerieForce[]): SerieForce[] => series.filter((s) => Number(s.weight_kg) > 0 && Number(s.reps) >= 1);

export interface ExerciceCarnet {
  cle: string;
  nom: string;
  groupe: string;
  /** Combien de séries au carnet (avec une charge). */
  nSeries: number;
}

/** Les exercices du carnet, le plus pratiqué d'abord (à égalité, par ordre alphabétique). */
export function exercicesDuCarnet(series: readonly SerieForce[]): ExerciceCarnet[] {
  const par = new Map<string, ExerciceCarnet>();
  for (const s of seriesAvecCharge(series)) {
    const x = par.get(s.exercise_key) ?? { cle: s.exercise_key, nom: s.exercise_name || s.exercise_key, groupe: s.muscle_group || '', nSeries: 0 };
    x.nSeries += 1;
    par.set(s.exercise_key, x);
  }
  return [...par.values()].sort((a, b) => b.nSeries - a.nSeries || a.nom.localeCompare(b.nom, 'fr'));
}

/** Les n meilleures entrées (la plus grande valeur d'abord, à égalité la plus ancienne), sans les valeurs nulles. */
function meilleures(entrees: EntreeRecord[], n = CLASSEMENT): EntreeRecord[] {
  return entrees
    .filter((e) => Number.isFinite(e.valeur) && e.valeur > 0)
    .sort((a, b) => b.valeur - a.valeur || (a.iso < b.iso ? -1 : a.iso > b.iso ? 1 : 0))
    .slice(0, n);
}

/** La meilleure série de chaque séance (une entrée par séance, pas dix fois la même) selon `valeur` ; sans séance connue, une entrée par jour. */
function meilleurParSeance(series: SerieForce[], valeur: (s: SerieForce) => number, nom: (s: SerieForce) => string): EntreeRecord[] {
  const par = new Map<string, { s: SerieForce; v: number }>();
  for (const s of series) {
    const cle = s.activity_id ?? `jour:${iso(s)}`;
    const v = valeur(s);
    const x = par.get(cle);
    if (!x || v > x.v) par.set(cle, { s, v });
  }
  return [...par.values()].map(({ s, v }) => ({ valeur: v, nom: nom(s), iso: iso(s), id: s.activity_id }));
}

/** La précision écrite sous le nom : « 5 × 100 kg ». */
const detailSerie = (s: SerieForce): string => `${s.reps} × ${kg(Number(s.weight_kg))} kg`;

export interface RecordsExercice {
  /** 1RM estimé (kg). */
  rm: RecordTop;
  /** Charge la plus lourde, quel que soit le nombre de répétitions (kg). */
  poids: RecordTop;
  /** Le plus de répétitions d'une série à une charge d'au moins 20 % du poids du record, ou à n'importe quelle charge s'il n'y a pas de repère : voir `repsMax`. */
  reps: RecordTop;
  /** Le plus gros volume de l'exercice dans une séance (poids × répétitions de toutes ses séries, en kg). */
  volume: RecordTop;
}

/**
 * Les records d'un exercice. Chaque record garde au plus une entrée par séance (sa meilleure série) : un classement de 30 séances, pas de 30 séries de la même séance.
 * `reps` ne compte que les séries d'au moins la moitié du poids le plus lourd : 30 pompes sans charge ne battent pas un travail lourd.
 */
export function recordsExercice(series: readonly SerieForce[], cle: string): RecordsExercice {
  const toutes = seriesAvecCharge(series).filter((s) => s.exercise_key === cle);
  const nom = (s: SerieForce): string => s.exercise_name || s.exercise_key;
  const lourdeur = Math.max(0, ...toutes.map((s) => Number(s.weight_kg)));
  const volumeParSeance = new Map<string, EntreeRecord>();
  for (const s of toutes) {
    const k = s.activity_id ?? `jour:${iso(s)}`;
    const x = volumeParSeance.get(k) ?? { valeur: 0, nom: nom(s), iso: iso(s), id: s.activity_id };
    x.valeur += Number(s.weight_kg) * Number(s.reps);
    volumeParSeance.set(k, x);
  }
  const avecDetail = (entrees: EntreeRecord[], parSerie: SerieForce[], valeur: (s: SerieForce) => number): EntreeRecord[] => {
    // Rattache la précision (« 5 × 100 kg ») à la série qui a fait la valeur de la séance
    const par = new Map<string, SerieForce>();
    for (const s of parSerie) {
      const k = s.activity_id ?? `jour:${iso(s)}`;
      const avant = par.get(k);
      if (!avant || valeur(s) > valeur(avant)) par.set(k, s);
    }
    return entrees.map((e) => {
      const s = par.get(e.id ?? `jour:${e.iso}`);
      return s ? { ...e, detail: detailSerie(s) } : e;
    });
  };
  const rmDe = (s: SerieForce): number => (Number(s.reps) <= REPS_MAX_1RM ? epley(Number(s.weight_kg), Number(s.reps)) : 0);
  const sansDetail = (valeur: (s: SerieForce) => number): EntreeRecord[] => meilleurParSeance(toutes, valeur, nom);
  const lourdes = toutes.filter((s) => Number(s.weight_kg) >= lourdeur * 0.5);
  return {
    rm: { cle: 'rm', libelle: '1RM estimé', unite: 'kg', top: meilleures(avecDetail(sansDetail(rmDe), toutes, rmDe)) },
    poids: { cle: 'poids', libelle: 'Charge max', unite: 'kg', top: meilleures(avecDetail(sansDetail((s) => Number(s.weight_kg)), toutes, (s) => Number(s.weight_kg))) },
    reps: { cle: 'reps', libelle: 'Répétitions max', unite: 'rép.', top: meilleures(avecDetail(meilleurParSeance(lourdes, (s) => Number(s.reps), nom), lourdes, (s) => Number(s.reps))) },
    volume: { cle: 'volume', libelle: 'Volume de la séance', unite: 'kg', top: meilleures([...volumeParSeance.values()].map((e) => ({ ...e, valeur: Math.round(e.valeur) }))) },
  };
}

export interface PointForce {
  /** Nombre de répétitions. */
  reps: number;
  /** La charge la plus lourde tenue pour au moins ce nombre de répétitions (kg). */
  poids: number;
  iso: string;
  id: string | null;
}

/** La « courbe de force » d'un exercice : pour 1, 2, 3, 5, 8, 10 et 12 répétitions, la charge la plus lourde faite pour au moins ce nombre de répétitions (une série de 8 répétitions vaut aussi pour 5). */
export function chargeParRepetitions(series: readonly SerieForce[], cle: string): PointForce[] {
  const toutes = seriesAvecCharge(series).filter((s) => s.exercise_key === cle);
  const points: PointForce[] = [];
  for (const reps of REPETITIONS_COURBE) {
    let meilleur: SerieForce | null = null;
    for (const s of toutes) {
      if (Number(s.reps) < reps) continue;
      if (!meilleur || Number(s.weight_kg) > Number(meilleur.weight_kg) || (Number(s.weight_kg) === Number(meilleur.weight_kg) && iso(s) < iso(meilleur))) meilleur = s;
    }
    if (meilleur) points.push({ reps, poids: Number(meilleur.weight_kg), iso: iso(meilleur), id: meilleur.activity_id });
  }
  return points;
}

/** Les mêmes records sur les séries d'une période (année) : le carnet est filtré par date. */
export const seriesDeLAnnee = (series: readonly SerieForce[], annee: number): SerieForce[] => series.filter((s) => iso(s).startsWith(`${annee}-`));

/**
 * Les records de séance de la musculation (mini tuiles) : la plus longue séance, le plus gros tonnage, le plus de séries, le plus de répétitions, la plus grosse charge (TSS)
 * et la charge la plus lourde soulevée (parmi toutes les séries avec poids). Séries, répétitions et tonnage viennent du carnet (voir `avecForce`).
 */
export function recordsSeanceMuscu(acts: ActiviteBilan[], series: readonly SerieForce[]): RecordTop[] {
  const entree = (a: ActiviteBilan, valeur: number): EntreeRecord => ({ valeur, nom: a.name || 'Sans titre', iso: a.iso, id: a.id });
  const lourde = meilleurParSeance(seriesAvecCharge(series), (s) => Number(s.weight_kg), (s) => s.exercise_name || s.exercise_key);
  const lourdeAvecDetail = lourde.map((e) => {
    const s = seriesAvecCharge(series).find((x) => (x.activity_id ?? `jour:${iso(x)}`) === (e.id ?? `jour:${e.iso}`) && Number(x.weight_kg) === e.valeur);
    return s ? { ...e, detail: `${e.nom} · ${detailSerie(s)}`, nom: e.nom } : e;
  });
  const records: RecordTop[] = [
    { cle: 'duree', libelle: 'Plus longue séance', unite: 'min', top: meilleures(acts.map((a) => entree(a, a.duree_min))) },
    { cle: 'tonnage', libelle: 'Plus gros tonnage', unite: 't', top: meilleures(acts.map((a) => entree(a, (a.tonnage ?? 0) / 1000))) },
    { cle: 'series', libelle: 'Plus de séries', unite: 'séries', top: meilleures(acts.map((a) => entree(a, a.series ?? 0))) },
    { cle: 'reps', libelle: 'Plus de répétitions', unite: 'rép.', top: meilleures(acts.map((a) => entree(a, a.reps ?? 0))) },
    { cle: 'poids', libelle: 'Charge la plus lourde', unite: 'kg', top: meilleures(lourdeAvecDetail) },
    { cle: 'tss', libelle: 'Plus grosse charge', unite: 'TSS', top: meilleures(acts.map((a) => entree(a, a.tss))) },
  ];
  return records.filter((r) => r.top.length);
}

export interface PointTrimestre {
  /** « 2026-T1 ». */
  cle: string;
  an: number;
  /** Le trimestre de l'année, de 1 à 4. */
  trimestre: number;
  /** Le meilleur 1RM estimé du trimestre pour l'exercice (kg). */
  rm: number;
}

/** Le meilleur 1RM estimé d'un exercice, trimestre après trimestre (les trimestres sans série sont absents) : sert à la courbe « Force par exercice » du Progrès. */
export function rmParTrimestre(series: readonly SerieForce[], cle: string): PointTrimestre[] {
  const par = new Map<string, PointTrimestre>();
  for (const s of seriesAvecCharge(series)) {
    if (s.exercise_key !== cle || Number(s.reps) > REPS_MAX_1RM) continue;
    const jour = iso(s);
    const an = Number(jour.slice(0, 4));
    const trimestre = Math.floor((Number(jour.slice(5, 7)) - 1) / 3) + 1;
    const k = `${an}-T${trimestre}`;
    const rm = epley(Number(s.weight_kg), Number(s.reps));
    const x = par.get(k);
    if (!x || rm > x.rm) par.set(k, { cle: k, an, trimestre, rm });
  }
  return [...par.values()].sort((a, b) => (a.cle < b.cle ? -1 : 1));
}

/** Le nombre de répétitions le plus haut de la courbe de force (au-delà, ce n'est plus de la force mais de l'endurance musculaire). */
export const REPETITIONS_COURBE_MAX = 12;

/**
 * Le classement des séances pour « au moins `reps` répétitions » sur un exercice : une entrée par séance (sa charge la plus lourde tenue pour au moins ce nombre de répétitions), la plus lourde d'abord,
 * à égalité la plus ancienne. `nom` dit la série qui a fait la valeur (« Squat · 5 × 100 kg »). Les séances sans identifiant ont un `id` vide (on ne peut pas les ouvrir).
 */
export function classementRepetitions(series: readonly SerieForce[], cle: string, reps: number, n = CLASSEMENT): EntreeCourbe[] {
  const par = new Map<string, SerieForce>();
  for (const s of seriesAvecCharge(series)) {
    if (s.exercise_key !== cle || Number(s.reps) < reps) continue;
    const k = s.activity_id ?? `jour:${iso(s)}`;
    const x = par.get(k);
    if (!x || Number(s.weight_kg) > Number(x.weight_kg)) par.set(k, s);
  }
  return [...par.values()]
    .sort((a, b) => Number(b.weight_kg) - Number(a.weight_kg) || (iso(a) < iso(b) ? -1 : iso(a) > iso(b) ? 1 : 0))
    .slice(0, n)
    .map((s) => ({ valeur: Number(s.weight_kg), id: s.activity_id ?? '', nom: `${s.exercise_name || s.exercise_key} · ${detailSerie(s)}`, iso: iso(s) }));
}

/**
 * La courbe de meilleurs efforts d'un exercice, comme la courbe de puissance du vélo : pour chaque nombre de répétitions de 1 à 12, les trois séances qui ont tenu la charge la plus lourde pour au moins ce nombre.
 * `duree` porte le nombre de répétitions (la courbe tactile du vélo se sert du même format). Les nombres de répétitions jamais faits sont absents.
 */
export function courbeForce(series: readonly SerieForce[], cle: string, n = 3): PointCourbe[] {
  const points: PointCourbe[] = [];
  for (let reps = 1; reps <= REPETITIONS_COURBE_MAX; reps++) {
    const top = classementRepetitions(series, cle, reps, n);
    if (top.length) points.push({ duree: reps, top });
  }
  return points;
}
