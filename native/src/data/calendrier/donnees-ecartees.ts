// Les données qu'on peut écarter d'une activité (écran d'une activité › « Compte dans mes calculs »). Fonctions pures, sans réseau.
//
// Une donnée écartée n'entre plus dans AUCUN calcul : totaux, records, charge, forme, niveau global. La ligne en base garde ses chiffres
// (on peut les remettre) ; les calculs de l'app lisent les séances à travers `sansDonneesEcartees`, qui les vide. L'écran de l'activité,
// lui, lit la séance entière et barre ce qui est écarté. Côté base : supabase/migrations/2026-11-02_donnees_ecartees.sql (mêmes règles).
import type { Seance } from '../types.ts';

export type DonneeEcartable = 'puissance' | 'cardio' | 'cadence' | 'distance' | 'denivele' | 'charge';

/** Les colonnes de `activities` qui portent les drapeaux (vrai = écartée). */
export type ColonneEcart = 'excl_power' | 'excl_hr' | 'excl_cadence' | 'excl_distance' | 'excl_elevation' | 'excl_load';

export const COLONNES_ECART: readonly ColonneEcart[] = ['excl_power', 'excl_hr', 'excl_cadence', 'excl_distance', 'excl_elevation', 'excl_load'];

export interface PuceEcart {
  cle: DonneeEcartable;
  libelle: string;
  colonne: ColonneEcart;
  ecartee: boolean;
}

const positif = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v) && v > 0;
const aDeLaPuissance = (s: Seance): boolean => positif(s.np) || positif(s.avg_watts);

// L'ordre est celui des puces à l'écran
const DONNEES: { cle: DonneeEcartable; libelle: string; colonne: ColonneEcart; presente: (s: Seance) => boolean }[] = [
  { cle: 'puissance', libelle: 'Puissance', colonne: 'excl_power', presente: aDeLaPuissance },
  { cle: 'cardio', libelle: 'Cardio', colonne: 'excl_hr', presente: (s) => positif(s.avg_heartrate) },
  { cle: 'cadence', libelle: 'Cadence', colonne: 'excl_cadence', presente: (s) => positif(s.avg_cadence) },
  { cle: 'distance', libelle: 'Distance', colonne: 'excl_distance', presente: (s) => positif(s.distance_km) },
  { cle: 'denivele', libelle: 'Dénivelé', colonne: 'excl_elevation', presente: (s) => positif(s.total_elevation_gain) },
  { cle: 'charge', libelle: 'Charge', colonne: 'excl_load', presente: (s) => positif(s.tss) },
];

/** Le drapeau d'une donnée sur une séance. */
export const estEcartee = (s: Seance, cle: DonneeEcartable): boolean => {
  const d = DONNEES.find((x) => x.cle === cle);
  return d ? s[d.colonne] === true : false;
};

/** Les puces de l'écran d'une activité : une par donnée que la séance a (ou qu'elle a déjà écartée : on doit pouvoir la remettre). */
export function pucesEcart(s: Seance): PuceEcart[] {
  return DONNEES.filter((d) => d.presente(s) || s[d.colonne] === true).map((d) => ({ cle: d.cle, libelle: d.libelle, colonne: d.colonne, ecartee: s[d.colonne] === true }));
}

/** Le chiffre d'une séance (clé de `chiffresSeance`) et la donnée dont il vient : de quoi le barrer quand elle est écartée. */
export const DONNEE_DU_CHIFFRE: Readonly<Record<string, DonneeEcartable>> = {
  distance: 'distance',
  allure: 'distance',
  vitesse: 'distance',
  denivele: 'denivele',
  fc: 'cardio',
  watts: 'puissance',
  energie: 'puissance',
  cadence: 'cadence',
  charge: 'charge',
};

/**
 * La charge (tss) qui compte vraiment : elle vient de la puissance si la séance en a, sinon du cardio, sinon de l'effort ressenti.
 * Écarter la puissance retire donc la charge d'une séance qui en a ; écarter le cardio, celle d'une séance sans puissance qui a du cardio ;
 * écarter la charge la retire toujours. (Même règle que `tss_retenu` en SQL.) Null = elle ne compte pas.
 */
export function chargeRetenue(s: Seance): number | null {
  if (s.excl_load) return null;
  if (s.excl_power && aDeLaPuissance(s)) return null;
  if (s.excl_hr && !aDeLaPuissance(s) && positif(s.avg_heartrate)) return null;
  return s.tss;
}

/**
 * La séance telle que les calculs doivent la voir : chaque donnée écartée est vidée (null), les drapeaux restent. Renvoie la même séance
 * (pas une copie) quand rien n'est écarté. La charge se décide avant de vider la puissance et le cardio (elle en dépend).
 */
export function sansDonneesEcartees<T extends Seance>(s: T): T {
  if (!COLONNES_ECART.some((c) => s[c] === true)) return s;
  const r: T = { ...s, tss: chargeRetenue(s) };
  if (s.excl_power) {
    r.avg_watts = null;
    r.np = null;
    r.max_watts = null;
    r.kj = null;
  }
  if (s.excl_hr) {
    r.avg_heartrate = null;
    r.max_heartrate = null;
  }
  if (s.excl_cadence) r.avg_cadence = null;
  if (s.excl_distance) {
    r.distance_km = null;
    r.avg_speed_kmh = null;
  }
  if (s.excl_elevation) r.total_elevation_gain = null;
  return r;
}

export const sansDonneesEcarteesTout = <T extends Seance>(lignes: T[]): T[] => lignes.map(sansDonneesEcartees);
