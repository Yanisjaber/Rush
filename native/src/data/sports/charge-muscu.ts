// Charge de musculation : combien ta musculation te charge-t-elle, et est-ce que ça monte à un rythme sain ?
// Chaque série pèse « répétitions × intensité », l'intensité étant ton poids divisé par ton 1RM estimé de CET exercice.
// Un curl à 70 % et un squat à 70 % pèsent donc pareil : les exercices deviennent comparables entre eux, ce que le
// tonnage (kg soulevés) ne permet pas. Fonctions pures, sans réseau ni écran.
// Cette charge mesure le travail des MUSCLES : elle ne se compare pas à une charge de vélo ou de course (TSS), qui
// mesure surtout le travail du cœur et de l'énergie. Les deux se cumulent dans ta fatigue, mais pas dans la même unité.
// Port de app/src/lib/analyse/charge-muscu.js : pour l'instant seulement ce que l'Accueil utilise.
import { groupeValide } from './exercices.ts';
import { dateIsoLocale } from '../outils/format.ts';
import { decalerJour, ecartJours, moyenne } from '../outils/maths.ts';
import type { SerieForce } from '../types.ts';

const FENETRE_RM = 90; // le 1RM de référence d'un exercice = ton meilleur des 90 derniers jours
const INTENSITE_SANS_CHARGE = 0.6; // pompes, tractions au poids du corps… : pas de charge notée, on suppose un effort moyen
const iso = (s: { date: string }) => String(s.date).slice(0, 10);
const nombre = (v: unknown): number => {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
};
const epley = (poids: number, reps: number) => poids * (1 + reps / 30); // 1RM estimé (formule d'Epley), sans plafond de répétitions

/**
 * Effet de la proximité de l'échec sur la charge d'une série, quand tu as noté le RIR (répétitions en réserve).
 * Une série qui s'arrête loin de l'échec fatigue et stimule moins : RIR 0 ou 1 = 100 %, puis −15 % par répétition en réserve en plus
 * (RIR 2 : 85 %, RIR 3 : 70 %, RIR 4 : 55 %), plancher à 40 %. Sans RIR noté, aucune correction. Un repère de coaching, pas une loi.
 */
export const effortRir = (rir: number | null): number => (rir == null ? 1 : rir <= 1 ? 1 : Math.max(0.4, 1 - 0.15 * (rir - 1)));

const rirDe = (s: { rir?: unknown }): number | null =>
  s.rir === null || s.rir === undefined || String(s.rir).trim() === '' || !Number.isFinite(Number(s.rir)) ? null : Math.min(10, Math.max(0, Math.round(Number(s.rir))));

export interface ChargeSerie {
  date: string;
  groupe: string;
  cle: string;
  nom: string;
  reps: number;
  intensite: number;
  rir: number | null;
  charge: number;
  estimee: boolean; // vrai quand l'intensité est supposée (exercice au poids du corps, sans charge notée)
}

/**
 * Charge de chaque série. intensite = poids ÷ 1RM de référence de l'exercice (entre 0 et 1) ; charge = répétitions × intensité.
 */
export function chargeParSerie(series: SerieForce[]): ChargeSerie[] {
  const parExo = new Map<string, SerieForce[]>();
  for (const s of series) {
    if (!(nombre(s.reps) > 0) || !groupeValide(s.muscle_group)) continue;
    if (!parExo.has(s.exercise_key)) parExo.set(s.exercise_key, []);
    parExo.get(s.exercise_key)!.push(s);
  }
  const sortie: ChargeSerie[] = [];
  for (const lignes of parExo.values()) {
    // Meilleur 1RM estimé de chaque jour (séries de 1 à 12 répétitions, plus fiables), puis référence glissante sur 90 jours
    const parJour = new Map<string, number>();
    for (const s of lignes) {
      const p = nombre(s.weight_kg);
      const r = nombre(s.reps);
      if (p > 0 && r >= 1 && r <= 12) parJour.set(iso(s), Math.max(parJour.get(iso(s)) || 0, epley(p, r)));
    }
    const jours = [...parJour.keys()].sort();
    const reference = (date: string) => {
      let m = 0;
      for (const j of jours) if (j <= date && ecartJours(j, date) <= FENETRE_RM) m = Math.max(m, parJour.get(j)!);
      return m;
    };
    const cache = new Map<string, number>();
    for (const s of lignes) {
      const d = iso(s);
      const p = nombre(s.weight_kg);
      const r = nombre(s.reps);
      let intensite: number;
      let estimee = false;
      if (!(p > 0)) {
        intensite = INTENSITE_SANS_CHARGE;
        estimee = true;
      } else {
        if (!cache.has(d)) cache.set(d, reference(d));
        const ref = cache.get(d) || epley(p, r); // aucun 1RM connu (séries longues seulement) : on part de la série elle-même
        intensite = Math.min(1, p / ref);
      }
      const rir = rirDe(s);
      sortie.push({ date: d, groupe: s.muscle_group, cle: s.exercise_key, nom: s.exercise_name, reps: r, intensite, rir, charge: r * intensite * effortRir(rir), estimee });
    }
  }
  return sortie;
}

const arrondiPts = (v: number) => Math.round(v);
/** Charge totale des séries dont la date est dans [debut, fin] (ISO inclus). */
const chargeEntre = (sets: ChargeSerie[], debut: string, fin: string): number => sets.filter((s) => s.date >= debut && s.date <= fin).reduce((t, s) => t + s.charge, 0);

export interface ZoneRatio {
  cle: 'inconnu' | 'danger' | 'attention' | 'ok' | 'basse';
  libelle: string;
  ton: 'neutre' | 'danger' | 'alerte' | 'ok' | 'info';
}

/** Zone du ratio charge récente / habituelle (mêmes repères que la charge générale : 0,8 à 1,3 = progression sûre). */
export function zoneRatio(r: number | null): ZoneRatio {
  if (r == null) return { cle: 'inconnu', libelle: 'pas encore de repère', ton: 'neutre' };
  if (r > 1.5) return { cle: 'danger', libelle: 'trop haute, risque de blessure', ton: 'danger' };
  if (r > 1.3) return { cle: 'attention', libelle: 'au-dessus de ton habitude', ton: 'alerte' };
  if (r >= 0.8) return { cle: 'ok', libelle: 'dans ta zone habituelle', ton: 'ok' };
  return { cle: 'basse', libelle: 'en dessous de ton habitude', ton: 'info' };
}

/**
 * Pour le widget de l'accueil : charge des 7 derniers jours, habitude (moyenne des 4 semaines d'avant) et ratio,
 * plus la charge de chacune des `nbSemaines` dernières périodes de 7 jours glissants.
 */
export function chargeMuscuRecente(
  series: SerieForce[],
  nbSemaines = 12,
  aujourdhui: Date = new Date(),
): { parSemaine: number[]; derniere: number; habituelle: number; ratio: number | null; zone: ZoneRatio } {
  const fin = dateIsoLocale(aujourdhui);
  const sets = chargeParSerie(series);
  const parSemaine: number[] = [];
  for (let i = nbSemaines - 1; i >= 0; i--) parSemaine.push(arrondiPts(chargeEntre(sets, decalerJour(fin, -(i * 7 + 6)), decalerJour(fin, -i * 7))));
  const derniere = parSemaine[nbSemaines - 1];
  const avant = parSemaine.slice(-5, -1); // les 4 semaines d'avant
  const habituelle = avant.length ? moyenne(avant) : 0;
  const ratio = habituelle > 0 ? derniere / habituelle : null;
  return { parSemaine, derniere, habituelle: arrondiPts(habituelle), ratio, zone: zoneRatio(ratio) };
}
