// Le suivi du corps et de la nutrition : des TENDANCES lentes, qui ne bougent pas l'état de forme du jour. Fonctions pures, sans réseau, testées.
//  - Le poids varie de plusieurs centaines de grammes d'un jour à l'autre (eau, sel, digestion) : on le lisse avec une moyenne mobile exponentielle
//    sur 7 jours et on juge la tendance (la variation par semaine), jamais la valeur du jour.
//  - Une perte de plus de 1 % du poids par semaine est signalée : au-delà, la perte devient trop rapide pour un sportif (risque de perdre du muscle
//    et d'un déficit d'énergie, repère courant des recommandations de l'American College of Sports Medicine).
//  - Protéines : 1,4 à 2,0 g par kilo et par jour pour une personne qui s'entraîne (position de l'International Society of Sports Nutrition, 2017).
import type { MesuresParJour } from './sante-catalogue.ts';

export interface PointSerie {
  date: string;
  valeur: number;
}

export interface PointLisse extends PointSerie {
  /** La valeur lissée (moyenne mobile exponentielle sur 7 jours). */
  lisse: number;
}

/** Une mesure jour après jour, de la plus ancienne à la plus récente. */
export function serieDe(mesures: MesuresParJour | null | undefined, metric: string): PointSerie[] {
  return Object.keys(mesures || {})
    .sort()
    .filter((d) => Number.isFinite(mesures?.[d]?.[metric]))
    .map((date) => ({ date, valeur: (mesures as MesuresParJour)[date][metric] }));
}

/** Moyenne mobile exponentielle sur 7 jours (alpha = 2 / (7 + 1)) : chaque valeur pèse plus que les précédentes. */
export function lisser(points: PointSerie[]): PointLisse[] {
  const alpha = 2 / (7 + 1);
  let precedent: number | null = null;
  return points.map((p) => {
    precedent = precedent == null ? p.valeur : alpha * p.valeur + (1 - alpha) * precedent;
    return { ...p, lisse: Math.round(precedent * 100) / 100 };
  });
}

const JOUR = 24 * 3600 * 1000;
const joursEntre = (a: string, b: string) => Math.round((new Date(`${b}T12:00:00`).getTime() - new Date(`${a}T12:00:00`).getTime()) / JOUR);

export interface VariationHebdo {
  /** Variation lissée par semaine (kg ou unité de la mesure). */
  parSemaine: number;
  /** La même variation en pourcentage de la valeur de départ. */
  pctParSemaine: number;
  /** Nombre de jours réellement utilisés pour la calculer. */
  jours: number;
}

/**
 * La variation lissée par semaine : entre le dernier point et le point lissé le plus récent qui date d'au moins 14 jours (à défaut, d'au moins 7 jours).
 * Avec moins de 7 jours de recul, on ne juge pas : null.
 */
export function variationHebdo(lisses: PointLisse[]): VariationHebdo | null {
  if (lisses.length < 2) return null;
  const fin = lisses[lisses.length - 1];
  const recul = (mini: number) => [...lisses].reverse().find((p) => joursEntre(p.date, fin.date) >= mini);
  const ancien = recul(14) ?? recul(7);
  if (!ancien || ancien.lisse <= 0) return null;
  const jours = joursEntre(ancien.date, fin.date);
  const parSemaine = ((fin.lisse - ancien.lisse) / jours) * 7;
  return { parSemaine: Math.round(parSemaine * 100) / 100, pctParSemaine: Math.round((parSemaine / ancien.lisse) * 1000) / 10, jours };
}

export type AlerteCorps = 'perte_rapide' | 'prise_rapide' | null;

/** Une perte de plus de 1 % par semaine est trop rapide ; une prise de plus de 1 % aussi (rétention ou excès). */
export const alerteVariation = (v: VariationHebdo | null): AlerteCorps => (!v ? null : v.pctParSemaine <= -1 ? 'perte_rapide' : v.pctParSemaine >= 1 ? 'prise_rapide' : null);

/** Moyenne d'une mesure sur les N derniers jours jusqu'à `fin` (comprise), et le nombre de jours renseignés. */
export function moyenneSur(mesures: MesuresParJour | null | undefined, metric: string, jours: number, fin: string): { moyenne: number; n: number } | null {
  const v = serieDe(mesures, metric).filter((p) => joursEntre(p.date, fin) >= 0 && joursEntre(p.date, fin) < jours);
  if (!v.length) return null;
  return { moyenne: v.reduce((s, p) => s + p.valeur, 0) / v.length, n: v.length };
}

export type NiveauProteines = 'basse' | 'limite' | 'bonne' | 'haute';

/** Les protéines par kilo de poids de corps. Repère : 1,4 à 2,0 g/kg/jour pour une personne qui s'entraîne ; sous 1,2 c'est bas, au-dessus de 2,0 c'est plus que nécessaire. */
export function proteinesParKg(proteinesG: number | null | undefined, poidsKg: number | null | undefined): { gParKg: number; niveau: NiveauProteines } | null {
  if (!Number.isFinite(proteinesG) || !Number.isFinite(poidsKg) || (poidsKg as number) <= 0) return null;
  const g = Math.round(((proteinesG as number) / (poidsKg as number)) * 100) / 100;
  return { gParKg: g, niveau: g < 1.2 ? 'basse' : g < 1.4 ? 'limite' : g <= 2 ? 'bonne' : 'haute' };
}
