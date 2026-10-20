// « État de forme » : un indice de 0 à 100 qui combine les facteurs de santé du jour (HRV, fréquence cardiaque de repos, sommeil, stress de nuit,
// charge d'entraînement). Fonctions pures, sans réseau, testées. C'est une ESTIMATION à partir de tes chiffres, pas un avis médical.
//
// Méthode (chaque pilier devient un sous-indice de 0 à 100) :
//  - HRV : logarithme de la HRV de nuit (moyenne des 3 dernières nuits) comparé à TA PROPRE référence des 28 nuits précédentes, en écarts-types.
//    Le logarithme et la comparaison à soi-même suivent Plews et coll. (2013), « Training adaptation and heart rate variability in elite endurance
//    athletes », et Buchheit (2014), « Monitoring training status with HR measures ».
//  - FC de repos : même méthode, signe inversé (une FC de repos plus haute que d'habitude signale de la fatigue ou du stress).
//  - Stress de nuit : même méthode, signe inversé.
//  - Sommeil : le score de sommeil déjà calculé (durée, efficacité, réveils, latence, architecture ; repères de la National Sleep Foundation, 2015).
//  - Charge : la « fraîcheur » (forme = condition − fatigue) du modèle fitness-fatigue de Banister (1975), que l'app calcule déjà.
// Un écart à la référence (z) devient un centile de 0 à 100 : 50 = comme d'habitude, au-dessus = mieux que d'habitude.
// L'indice est la moyenne pondérée des sous-indices disponibles ; si trop de données manquent, il vaut null (on n'invente rien).
import { scoreNuit } from './score-sommeil.ts';
import type { Metrique, Nuit } from './types.ts';

export type CleComposante = 'hrv' | 'fc' | 'sommeil' | 'stress' | 'charge';

/** Poids de chaque pilier dans l'indice. La HRV pèse le plus : c'est le marqueur de récupération le plus sensible (Plews 2013, Buchheit 2014). */
export const POIDS_FORME: Record<CleComposante, number> = { hrv: 0.35, sommeil: 0.25, fc: 0.2, stress: 0.1, charge: 0.1 };

export const NOM_COMPOSANTE: Record<CleComposante, string> = { hrv: 'HRV', fc: 'FC de repos', sommeil: 'Sommeil', stress: 'Stress de nuit', charge: 'Charge d\'entraînement' };

/** Nombre de nuits qui forment ta référence personnelle, et minimum de valeurs pour qu'elle compte. */
export const NUITS_REFERENCE = 28;
export const MIN_REFERENCE = 10;
/** Part minimale du poids total qui doit être disponible pour afficher un indice. */
export const CONFIANCE_MINI = 0.55;

export interface Composante {
  cle: CleComposante;
  nom: string;
  poids: number;
  /** Sous-indice de 0 à 100 (50 = comme d'habitude), ou null si on manque de données. */
  indice: number | null;
}

export interface PointForme {
  date: string;
  /** L'état de forme du jour, de 0 à 100, ou null si les données ne suffisent pas. */
  indice: number | null;
  /** Part du poids total réellement disponible (0 à 1). */
  confiance: number;
  composantes: Composante[];
}

// --- Petits outils statistiques ---------------------------------------------------------------------------------------------

/** Fonction de répartition de la loi normale centrée réduite (approximation d'Abramowitz et Stegun 7.1.26, erreur < 1,5e-7). */
export function phi(z: number): number {
  const x = Math.abs(z) / Math.SQRT2;
  const t = 1 / (1 + 0.3275911 * x);
  const erf = 1 - (((((1.061405429 * t - 1.453152027) * t) + 1.421413741) * t - 0.284496736) * t + 0.254829592) * t * Math.exp(-x * x);
  return 0.5 * (1 + (z < 0 ? -erf : erf));
}

const moyenne = (v: number[]): number => v.reduce((s, x) => s + x, 0) / v.length;
const ecartType = (v: number[], m: number): number => Math.sqrt(v.reduce((s, x) => s + (x - m) ** 2, 0) / Math.max(1, v.length - 1));
const borner = (x: number, mini: number, maxi: number): number => Math.min(maxi, Math.max(mini, x));
const valide = (x: unknown): x is number => x != null && Number.isFinite(Number(x)) && Number(x) > 0;

/** Un écart à la référence (en écarts-types) devient un sous-indice de 0 à 100 : le centile du jour par rapport à toi-même. */
export function indiceDepuisEcart(z: number): number {
  return Math.round(100 * phi(borner(z, -2.5, 2.5)));
}

/**
 * Compare une valeur du jour à la référence des valeurs précédentes. `sens` : 1 si plus haut = mieux (HRV), -1 si plus haut = moins bien (FC, stress).
 * `plancher` : écart-type minimal (évite qu'une référence presque constante transforme un petit écart en énorme variation).
 */
export function indiceContreReference(valeur: number, reference: number[], sens: 1 | -1, plancher: number): number | null {
  if (reference.length < MIN_REFERENCE) return null;
  const m = moyenne(reference);
  const sd = Math.max(ecartType(reference, m), plancher);
  return indiceDepuisEcart((sens * (valeur - m)) / sd);
}

/** Sous-indice de la charge : la fraîcheur (forme = condition − fatigue, modèle de Banister) ramenée entre 0 et 100 ; 0 de forme = 50. */
export function indiceCharge(tsb: number): number {
  return Math.round(borner(50 + 1.5 * tsb, 0, 100));
}

// --- Le calcul jour par jour ----------------------------------------------------------------------------------------------

/** Les métriques de charge triées par date, pour retrouver la fraîcheur d'un jour (à défaut, la dernière connue avant). */
function fraicheurDu(metriques: Metrique[], date: string): number | null {
  let trouve: Metrique | null = null;
  for (const m of metriques) {
    if (m.iso_date <= date && (!trouve || m.iso_date > trouve.iso_date)) trouve = m;
  }
  return trouve && Number.isFinite(Number(trouve.tsb)) ? Number(trouve.tsb) : null;
}

/**
 * L'état de forme de chaque nuit connue (de la plus ancienne à la plus récente). La référence d'une nuit est faite des 28 nuits qui la précèdent :
 * on ne compare jamais une nuit à son propre futur. Les premières nuits n'ont pas assez d'historique : leur indice est null.
 */
export function serieEtatDeForme(nuits: Nuit[] | null | undefined, metriques: Metrique[] | null | undefined): PointForme[] {
  const chrono = [...(nuits || [])].sort((a, b) => String(a.date).localeCompare(String(b.date)));
  const mesures = metriques || [];
  return chrono.map((n, i) => {
    const avant = chrono.slice(Math.max(0, i - NUITS_REFERENCE), i);
    const n3 = chrono.slice(Math.max(0, i - 2), i + 1);

    // HRV : le logarithme de la moyenne des 3 dernières nuits, contre la référence des nuits précédentes
    const hrv3 = n3.map((x) => x.hrv_avg).filter(valide).map((x) => Math.log(Number(x)));
    const hrvRef = avant.map((x) => x.hrv_avg).filter(valide).map((x) => Math.log(Number(x)));
    const hrv = hrv3.length >= 2 ? indiceContreReference(moyenne(hrv3), hrvRef, 1, 0.05) : null;

    // FC de repos et stress de nuit : la valeur de la nuit, contre la référence, sens inversé
    const fcRef = avant.map((x) => x.resting_heart_rate).filter(valide).map(Number);
    const fc = valide(n.resting_heart_rate) ? indiceContreReference(Number(n.resting_heart_rate), fcRef, -1, 1) : null;
    const stressRef = avant.map((x) => x.avg_stress).filter(valide).map(Number);
    const stress = valide(n.avg_stress) ? indiceContreReference(Number(n.avg_stress), stressRef, -1, 2) : null;

    const score = scoreNuit(n);
    const sommeil = score && (n.total_sec ?? 0) > 0 ? score.total : null;
    const tsb = fraicheurDu(mesures, n.date);
    const charge = tsb != null ? indiceCharge(tsb) : null;

    const valeurs: Record<CleComposante, number | null> = { hrv, fc, sommeil, stress, charge };
    const composantes: Composante[] = (Object.keys(POIDS_FORME) as CleComposante[]).map((cle) => ({ cle, nom: NOM_COMPOSANTE[cle], poids: POIDS_FORME[cle], indice: valeurs[cle] }));
    const dispo = composantes.filter((c) => c.indice != null);
    const confiance = dispo.reduce((s, c) => s + c.poids, 0);
    const indice = confiance >= CONFIANCE_MINI ? Math.round(dispo.reduce((s, c) => s + c.poids * (c.indice as number), 0) / confiance) : null;
    return { date: n.date, indice, confiance: Math.round(confiance * 100) / 100, composantes };
  });
}

// --- La lecture du jour -----------------------------------------------------------------------------------------------------

export type Niveau = 'bon' | 'moyen' | 'faible';

/** Les seuils de lecture d'un indice : 65 et plus = bon, de 40 à 64 = moyen, en dessous = faible. */
export const niveauDe = (indice: number | null | undefined): Niveau | null => (indice == null ? null : indice >= 65 ? 'bon' : indice >= 40 ? 'moyen' : 'faible');

export interface Lecture {
  indice: number;
  niveau: Niveau;
  libelle: string;
  phrase: string;
  /** Le pilier le plus bas s'il est sous 45 (ce qui tire l'état de forme vers le bas), sinon null. */
  pointFaible: Composante | null;
}

const LIBELLES: Record<Niveau, { libelle: string; phrase: string }> = {
  bon: { libelle: 'Bien récupéré', phrase: 'Tes chiffres sont meilleurs que d\'habitude : ton corps peut encaisser une séance exigeante.' },
  moyen: { libelle: 'Récupération moyenne', phrase: 'Tes chiffres sont dans ta norme : une séance modérée est adaptée.' },
  faible: { libelle: 'À ménager', phrase: 'Tes chiffres sont en dessous de ta norme : privilégie le repos ou une séance facile.' },
};

/** La lecture d'un point (ou null si l'indice n'est pas calculable). */
export function lecture(point: PointForme | null | undefined): Lecture | null {
  if (!point || point.indice == null) return null;
  const niveau = niveauDe(point.indice) as Niveau;
  const bas = point.composantes.filter((c) => c.indice != null).sort((a, b) => (a.indice as number) - (b.indice as number))[0];
  return { indice: point.indice, niveau, ...LIBELLES[niveau], pointFaible: bas && (bas.indice as number) < 45 ? bas : null };
}

/** Les trois indicateurs du résumé : sommeil, récupération (HRV et FC de repos) et forme (charge). Chacun a un niveau, ou null sans données. */
export function indicateurs(point: PointForme | null | undefined): { cle: string; nom: string; indice: number | null; niveau: Niveau | null }[] {
  const val = (cle: CleComposante) => point?.composantes.find((c) => c.cle === cle)?.indice ?? null;
  const recup = [val('hrv'), val('fc')].filter((x): x is number => x != null);
  const recuperation = recup.length ? Math.round(moyenne(recup)) : null;
  return [
    { cle: 'sommeil', nom: 'Sommeil', indice: val('sommeil'), niveau: niveauDe(val('sommeil')) },
    { cle: 'recuperation', nom: 'Récup.', indice: recuperation, niveau: niveauDe(recuperation) },
    { cle: 'forme', nom: 'Forme', indice: val('charge'), niveau: niveauDe(val('charge')) },
  ];
}
