// Les données qu'on peut écarter d'une activité (écran d'une activité › « Compte dans mes calculs »). Fonctions pures, sans réseau.
//
// Les WATTS ESTIMÉS par Strava (`device_watts` faux : pas de capteur de puissance) sont traités comme une puissance écartée d'office, sans drapeau et sans rien changer en base (3 nov. 2026) :
// l'app ne les montre pas et ne les utilise nulle part. Seul un vrai capteur donne une puissance.
//
// Une donnée écartée n'entre plus dans AUCUN calcul : totaux, records, charge, forme, niveau global. La ligne en base garde ses chiffres
// (on peut les remettre) ; les calculs de l'app lisent les séances à travers `sansDonneesEcartees`, qui les vide. L'écran de l'activité,
// lui, lit la séance entière et barre ce qui est écarté. Côté base : supabase/migrations/2026-11-02_donnees_ecartees.sql (mêmes règles).
import type { Seance } from '../types.ts';

export type DonneeEcartable = 'duree' | 'puissance' | 'cardio' | 'cadence' | 'distance' | 'denivele' | 'charge';

/** Les colonnes de `activities` qui portent les drapeaux (vrai = écartée). */
export type ColonneEcart = 'excl_duration' | 'excl_power' | 'excl_hr' | 'excl_cadence' | 'excl_distance' | 'excl_elevation' | 'excl_load';

export const COLONNES_ECART: readonly ColonneEcart[] = ['excl_duration', 'excl_power', 'excl_hr', 'excl_cadence', 'excl_distance', 'excl_elevation', 'excl_load'];

export interface PuceEcart {
  cle: DonneeEcartable;
  libelle: string;
  colonne: ColonneEcart;
  ecartee: boolean;
}

const positif = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v) && v > 0;
const aDeLaPuissance = (s: Seance): boolean => positif(s.np) || positif(s.avg_watts);
/** Les watts de cette séance sont estimés par Strava (pas de capteur de puissance) : l'app ne les montre pas et ne les utilise pas. */
export const wattsEstimes = (s: Pick<Seance, 'device_watts'>): boolean => s.device_watts === false;
/** La séance a une vraie puissance, mesurée par un capteur (une puissance estimée par Strava n'en est pas une). */
export const aUneVraiePuissance = (s: Seance): boolean => !wattsEstimes(s) && aDeLaPuissance(s);

// L'ordre est celui des puces à l'écran
const DONNEES: { cle: DonneeEcartable; libelle: string; colonne: ColonneEcart; presente: (s: Seance) => boolean }[] = [
  { cle: 'duree', libelle: 'Durée', colonne: 'excl_duration', presente: (s) => positif(s.moving_time) },
  { cle: 'puissance', libelle: 'Puissance', colonne: 'excl_power', presente: aUneVraiePuissance },
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

/** Les données dont vient chaque chiffre de l'écran (clé de `chiffresSeance`) : un chiffre est écarté dès qu'une seule d'entre elles l'est. */
export const DONNEES_DU_CHIFFRE: Readonly<Record<string, readonly DonneeEcartable[]>> = {
  duree: ['duree'],
  distance: ['distance'],
  allure: ['distance', 'duree'], // l'allure et la vitesse sont une distance divisée par une durée
  vitesse: ['distance', 'duree'],
  denivele: ['denivele'],
  fc: ['cardio'],
  watts: ['puissance'],
  energie: ['puissance'],
  cadence: ['cadence'],
  // Les chiffres calculés sur les flux : écartés avec la donnée dont ils viennent
  derive: ['cardio'],
  fcpct: ['cardio'],
  trimp: ['cardio'],
  if: ['puissance'],
  ef: ['puissance', 'cardio'],
  pmax: ['puissance'],
  kjftp: ['puissance'],
  // « charge » n'est pas dans la table : elle est écartée dès que `chargeRetenue` la retire (durée, charge, ou sa source)
};

/** Ce chiffre de l'écran est-il écarté des calculs ? (de quoi le barrer) */
export function chiffreEcarte(s: Seance, cleChiffre: string): boolean {
  if (cleChiffre === 'charge') return positif(s.tss) && chargeRetenue(s) === null;
  return (DONNEES_DU_CHIFFRE[cleChiffre] ?? []).some((d) => estEcartee(s, d));
}

/**
 * La charge (tss) qui compte vraiment : elle vient de la puissance si la séance en a, sinon du cardio, sinon de l'effort ressenti.
 * Écarter la puissance retire donc la charge d'une séance qui en a ; écarter le cardio, celle d'une séance sans puissance qui a du cardio ;
 * écarter la durée ou la charge la retire toujours. (Même règle que `tss_retenu` en SQL.) Null = elle ne compte pas.
 */
export function chargeRetenue(s: Seance): number | null {
  if (s.excl_load || s.excl_duration) return null; // toute charge se calcule avec la durée
  if (s.excl_power && aDeLaPuissance(s)) return null;
  if (s.excl_hr && !aDeLaPuissance(s) && positif(s.avg_heartrate)) return null;
  return s.tss;
}

/**
 * La séance telle que les calculs doivent la voir : chaque donnée écartée est vidée (null), les drapeaux restent. Renvoie la même séance
 * (pas une copie) quand rien n'est écarté. La charge se décide avant de vider la puissance et le cardio (elle en dépend).
 */
export function sansDonneesEcartees<T extends Seance>(s: T): T {
  if (!COLONNES_ECART.some((c) => s[c] === true) && !wattsEstimes(s)) return s;
  const r: T = { ...s, tss: chargeRetenue(s) };
  if (s.excl_duration) {
    r.moving_time = 0; // les sommes ajoutent 0 ; les progressions, qui demandent une durée minimale, passent leur tour
    r.elapsed_time = null;
    r.avg_speed_kmh = null; // une vitesse est une distance divisée par une durée
  }
  if (s.excl_power || wattsEstimes(s)) {
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
