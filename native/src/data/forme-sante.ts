// « État de forme » : un indice de 0 à 100 qui combine cinq piliers (HRV, fréquence cardiaque de repos, sommeil, ressenti du matin, charge
// d'entraînement). Fonctions pures, sans réseau, testées. C'est une ESTIMATION à partir de tes chiffres, pas un avis médical.
// Le stress de nuit, la respiration et la température ne comptent PAS dans le chiffre : ce sont des ALERTES (poids 0). Le stress de nuit est
// dérivé de la HRV (il la compterait deux fois) ; la respiration et la température viennent d'appareils que tout le monde n'a pas, et ne servent
// qu'à signaler un écart marqué (début de maladie, surcharge).
//
// Méthode (chaque pilier devient un sous-indice de 0 à 100) :
//  - HRV : logarithme de la HRV de nuit (moyenne des 3 dernières nuits) comparé à TA PROPRE référence des 28 nuits précédentes, en écarts-types.
//    Le logarithme et la comparaison à soi-même suivent Plews et coll. (2013), « Training adaptation and heart rate variability in elite endurance
//    athletes », et Buchheit (2014), « Monitoring training status with HR measures ».
//  - FC de repos : même méthode, signe inversé (une FC de repos plus haute que d'habitude signale de la fatigue ou du stress).
//  - Stress de nuit (alerte) : même méthode, signe inversé.
//  - Sommeil : le score de sommeil déjà calculé (durée, efficacité, réveils, latence, architecture ; repères de la National Sleep Foundation, 2015).
//  - Charge : la « fraîcheur » (forme = condition − fatigue) du modèle fitness-fatigue de Banister (1975), que l'app calcule déjà.
//  - Ressenti : les cinq questions du matin (fatigue, courbatures, humeur, motivation, stress), de 1 à 5, dans l'esprit de l'indice de Hooper (1995) ;
//    les mesures subjectives sont souvent plus sensibles que les mesures objectives (Saw et coll., 2016).
//  - Respiration de nuit (alerte) : même méthode que la FC de repos. Température cutanée (alerte) : plus l'écart à ta normale est grand, plus l'indice baisse.
// Un écart à la référence (z) devient un centile de 0 à 100 : 50 = comme d'habitude, au-dessus = mieux que d'habitude.
// L'indice est la moyenne pondérée des sous-indices DISPONIBLES (les poids se renormalisent sur ce qui existe) ; si trop de données manquent,
// il vaut null (on n'invente rien). Deux événements sont des FREINS qui plafonnent l'indice quoi que disent les autres chiffres : malade (35) et blessé (50).
// Le reste (alcool, voyage) n'a pas d'effet numérique : il est signalé comme contexte, parce qu'il peut fausser les mesures de la nuit.
import { scoreNuit } from './score-sommeil.ts';
import type { MesuresParJour } from './sante-catalogue.ts';
import type { Metrique, Nuit } from './types.ts';

export type CleComposante = 'hrv' | 'fc' | 'sommeil' | 'ressenti' | 'charge' | 'stress' | 'resp' | 'temperature';

/**
 * Poids de chaque pilier dans l'indice (ils font 1). La HRV pèse le plus : c'est le marqueur de récupération le plus sensible (Plews 2013, Buchheit 2014).
 * Ces poids sont des choix raisonnés, pas ceux d'une étude. Le stress, la respiration et la température ont un poids de 0 : ce sont des alertes.
 */
export const POIDS_FORME: Record<CleComposante, number> = { hrv: 0.3, sommeil: 0.24, fc: 0.18, ressenti: 0.18, charge: 0.1, stress: 0, resp: 0, temperature: 0 };

/** Un pilier compte dans le chiffre ; sinon c'est une alerte (stress de nuit, respiration, température). */
export const estPilier = (cle: CleComposante): boolean => POIDS_FORME[cle] > 0;

/** Sous cet indice, une alerte se déclenche : un écart marqué (plus d'environ 0,85 écart-type) à TA normale. La température a sa propre échelle (0,75 °C d'écart). */
const SEUIL_ALERTE: Partial<Record<CleComposante, number>> = { stress: 20, resp: 20, temperature: 50 };

/** Cette alerte est-elle déclenchée ? Faux pour un pilier (qui a un poids) ou sans donnée. */
export const enAlerte = (cle: CleComposante, indice: number | null | undefined): boolean => indice != null && SEUIL_ALERTE[cle] != null && indice <= (SEUIL_ALERTE[cle] as number);

export const NOM_COMPOSANTE: Record<CleComposante, string> = {
  hrv: 'HRV',
  fc: 'FC de repos',
  sommeil: 'Sommeil',
  ressenti: 'Ressenti du matin',
  charge: 'Charge d\'entraînement',
  stress: 'Stress de nuit',
  resp: 'Respiration de nuit',
  temperature: 'Température cutanée',
};

/** Comment obtenir un pilier qui manque (affiché sous « Pour être plus précis »). */
export const COMMENT_AJOUTER: Record<CleComposante, string> = {
  hrv: 'Porte ta montre la nuit pour mesurer ta HRV.',
  fc: 'Porte ta montre la nuit pour mesurer ta FC de repos.',
  sommeil: 'Porte ta montre la nuit pour suivre ton sommeil.',
  ressenti: 'Réponds aux 5 questions du ressenti du matin.',
  charge: 'Enregistre tes séances pour calculer ta charge.',
  stress: 'Porte ta montre la nuit pour mesurer ton stress.',
  resp: 'Connecte une source qui mesure la respiration de nuit (Whoop, Apple Santé).',
  temperature: 'Connecte une source qui mesure la température cutanée (Whoop, Apple Santé).',
};

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

/** La précision de l'estimation : la part du poids total réellement disponible. */
export type Precision = 'basique' | 'bonne' | 'elevee';

export interface PointForme {
  date: string;
  /** L'état de forme du jour, de 0 à 100, ou null si les données ne suffisent pas. */
  indice: number | null;
  /** Part du poids total réellement disponible (0 à 1). */
  confiance: number;
  /** « elevee » à partir de 90 % du poids, « bonne » à partir de 75 %, « basique » à partir de 55 % ; null en dessous (pas d'indice). */
  precision: Precision | null;
  composantes: Composante[];
  /** Les événements qui plafonnent l'indice (malade, blessé), en toutes lettres. */
  freins: string[];
  /** Le contexte qui peut fausser les mesures de la nuit (alcool, voyage), sans effet sur le chiffre. */
  contexte: string[];
  /** Les piliers sans donnée ce jour-là, avec le moyen de les obtenir : ce qui rendrait l'estimation plus précise. Les alertes n'y figurent pas. */
  manquants: { cle: CleComposante; nom: string; comment: string }[];
  /** Les alertes déclenchées ce jour-là (stress de nuit, respiration, température hors de ta norme). Elles ne changent pas le chiffre. */
  alertes: { cle: CleComposante; nom: string; indice: number }[];
}

/** Combien de piliers (ceux qui comptent dans le chiffre) ont une donnée ce jour-là, sur combien. */
export function piliersDispo(point: PointForme | null | undefined): { pris: number; total: number } {
  const piliers = (point?.composantes ?? []).filter((c) => estPilier(c.cle));
  return { pris: piliers.filter((c) => c.indice != null).length, total: Object.keys(POIDS_FORME).filter((k) => estPilier(k as CleComposante)).length };
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

/** Une échelle de 1 à 5 ramenée à 0-100 ; `hautMieux` = false : 1 est la meilleure valeur (fatigue, courbatures, stress). */
const echelle100 = (v: number, hautMieux: boolean): number => Math.round(((hautMieux ? v - 1 : 5 - v) / 4) * 100);

const RESSENTI: { cle: string; hautMieux: boolean }[] = [
  { cle: 'ressenti_fatigue', hautMieux: false },
  { cle: 'ressenti_courbatures', hautMieux: false },
  { cle: 'ressenti_humeur', hautMieux: true },
  { cle: 'ressenti_motivation', hautMieux: true },
  { cle: 'ressenti_stress', hautMieux: false },
];

/** Le sous-indice du ressenti : la moyenne des réponses du matin (au moins deux), de 0 à 100 ; null sinon. */
export function indiceRessenti(mesures: Record<string, number> | undefined): number | null {
  const v = RESSENTI.map((q) => (mesures && Number.isFinite(mesures[q.cle]) ? echelle100(mesures[q.cle], q.hautMieux) : null)).filter((x): x is number => x != null);
  return v.length >= 2 ? Math.round(moyenne(v)) : null;
}

/** Le sous-indice de la température cutanée : 100 à l'écart nul, 0 à 1,5 °C d'écart (au-dessus comme en dessous). */
export function indiceTemperature(ecart: number): number {
  return Math.round(100 * (1 - borner(Math.abs(ecart) / 1.5, 0, 1)));
}

export const precisionDe = (confiance: number): Precision | null => (confiance >= 0.9 ? 'elevee' : confiance >= 0.75 ? 'bonne' : confiance >= CONFIANCE_MINI ? 'basique' : null);

/**
 * L'état de forme de chaque jour où l'on a une donnée (une nuit ou une mesure saisie), de la plus ancienne à la plus récente.
 * La référence d'une nuit est faite des 28 nuits qui la précèdent : on ne compare jamais une nuit à son propre futur.
 * Les piliers sans donnée sont simplement absents (leur poids est réparti sur les autres) et listés dans `manquants`.
 */
export function serieEtatDeForme(nuits: Nuit[] | null | undefined, metriques: Metrique[] | null | undefined, mesures: MesuresParJour | null | undefined = {}): PointForme[] {
  const chrono = [...(nuits || [])].sort((a, b) => String(a.date).localeCompare(String(b.date)));
  const indexNuit = new Map(chrono.map((n, i) => [n.date, i]));
  const mesuresDuJour = mesures || {};
  const dates = [...new Set([...chrono.map((n) => n.date), ...Object.keys(mesuresDuJour)])].sort();
  const charges = metriques || [];

  return dates.map((date) => {
    const i = indexNuit.get(date);
    const n = i != null ? chrono[i] : null;
    const jour = mesuresDuJour[date];
    const avant = i != null ? chrono.slice(Math.max(0, i - NUITS_REFERENCE), i) : [];
    const n3 = i != null ? chrono.slice(Math.max(0, i - 2), i + 1) : [];

    // HRV : le logarithme de la moyenne des 3 dernières nuits, contre la référence des nuits précédentes
    const hrv3 = n3.map((x) => x.hrv_avg).filter(valide).map((x) => Math.log(Number(x)));
    const hrvRef = avant.map((x) => x.hrv_avg).filter(valide).map((x) => Math.log(Number(x)));
    const hrv = hrv3.length >= 2 ? indiceContreReference(moyenne(hrv3), hrvRef, 1, 0.05) : null;

    // FC de repos et stress de nuit : la valeur de la nuit, contre la référence, sens inversé
    const fcRef = avant.map((x) => x.resting_heart_rate).filter(valide).map(Number);
    const fc = n && valide(n.resting_heart_rate) ? indiceContreReference(Number(n.resting_heart_rate), fcRef, -1, 1) : null;
    const stressRef = avant.map((x) => x.avg_stress).filter(valide).map(Number);
    const stress = n && valide(n.avg_stress) ? indiceContreReference(Number(n.avg_stress), stressRef, -1, 2) : null;

    const score = n ? scoreNuit(n) : null;
    const sommeil = score && (n?.total_sec ?? 0) > 0 ? score.total : null;
    const tsb = fraicheurDu(charges, date);
    const charge = tsb != null ? indiceCharge(tsb) : null;
    const ressenti = indiceRessenti(jour);

    // Respiration de nuit : contre la référence des jours précédents qui en ont une (sens inversé) ; température : l'écart à ta normale
    const respRef = dates.filter((d) => d < date).slice(-NUITS_REFERENCE).map((d) => mesuresDuJour[d]?.resp_nuit).filter(valide).map(Number);
    const resp = valide(jour?.resp_nuit) ? indiceContreReference(Number(jour?.resp_nuit), respRef, -1, 0.5) : null;
    const temperature = jour && Number.isFinite(jour.temp_cutanee_ecart) ? indiceTemperature(jour.temp_cutanee_ecart) : null;

    const valeurs: Record<CleComposante, number | null> = { hrv, fc, sommeil, ressenti, charge, stress, resp, temperature };
    const composantes: Composante[] = (Object.keys(POIDS_FORME) as CleComposante[]).map((cle) => ({ cle, nom: NOM_COMPOSANTE[cle], poids: POIDS_FORME[cle], indice: valeurs[cle] }));
    const dispo = composantes.filter((c) => c.indice != null);
    const confiance = Math.round(dispo.reduce((s, c) => s + c.poids, 0) * 100) / 100;
    let indice = confiance >= CONFIANCE_MINI ? Math.round(dispo.reduce((s, c) => s + c.poids * (c.indice as number), 0) / confiance) : null;

    // Les freins : malade et blessé plafonnent l'indice, quels que soient les autres chiffres
    const freins: string[] = [];
    if (jour?.evt_malade === 1) {
      freins.push('Malade : ton état de forme est plafonné à 35.');
      if (indice != null) indice = Math.min(indice, 35);
    }
    if (jour?.evt_blesse === 1) {
      freins.push('Blessé : ton état de forme est plafonné à 50.');
      if (indice != null) indice = Math.min(indice, 50);
    }
    // Le contexte : il peut fausser les mesures de la nuit, sans toucher au chiffre
    const contexte: string[] = [];
    if ((jour?.alcool_verres ?? 0) >= 1) contexte.push("De l'alcool hier peut avoir abaissé ta HRV et ton sommeil.");
    if (jour?.evt_voyage === 1) contexte.push('Un voyage ou un décalage horaire peut fausser tes mesures de la nuit.');

    const manquants = composantes.filter((c) => estPilier(c.cle) && c.indice == null).map((c) => ({ cle: c.cle, nom: c.nom, comment: COMMENT_AJOUTER[c.cle] }));
    const alertes = composantes.filter((c) => enAlerte(c.cle, c.indice)).map((c) => ({ cle: c.cle, nom: c.nom, indice: c.indice as number }));
    return { date, indice, confiance, precision: precisionDe(confiance), composantes, freins, contexte, manquants, alertes };
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
  /** Le mot court (« Récupéré », « Moyen », « À ménager ») pour les écrans qui ne gardent aucune phrase. */
  mot: string;
  phrase: string;
  /** Le pilier le plus bas s'il est sous 45 (ce qui tire l'état de forme vers le bas), sinon null. */
  pointFaible: Composante | null;
}

const LIBELLES: Record<Niveau, { libelle: string; mot: string; phrase: string }> = {
  bon: { libelle: 'Bien récupéré', mot: 'Récupéré', phrase: 'Tes chiffres sont meilleurs que d\'habitude : tu peux faire une séance exigeante.' },
  moyen: { libelle: 'Récupération moyenne', mot: 'Moyen', phrase: 'Tes chiffres sont dans ta norme : une séance modérée est adaptée.' },
  faible: { libelle: 'À ménager', mot: 'À ménager', phrase: 'Tes chiffres sont sous ta norme : privilégie le repos ou une séance facile.' },
};

/** La lecture d'un point (ou null si l'indice n'est pas calculable). */
export function lecture(point: PointForme | null | undefined): Lecture | null {
  if (!point || point.indice == null) return null;
  const niveau = niveauDe(point.indice) as Niveau;
  const bas = point.composantes.filter((c) => estPilier(c.cle) && c.indice != null).sort((a, b) => (a.indice as number) - (b.indice as number))[0];
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

// --- La vérification : l'état de forme calculé colle-t-il à ce que tu ressens ? --------------------------------------------------------------------

export type Accord = 'fort' | 'moyen' | 'faible';

export interface AccordRessenti {
  /** Nombre de jours où l'on a à la fois l'état de forme (calculé SANS le ressenti) et ton ressenti du matin. */
  jours: number;
  /** Corrélation de Pearson entre les deux (de −1 à 1), ou null s'il y a trop peu de jours. */
  r: number | null;
  accord: Accord | null;
}

/** Il faut au moins ce nombre de jours pour juger l'accord (moins, le hasard décide). */
export const JOURS_MINI_ACCORD = 14;

/**
 * L'état de forme calculé reflète-t-il TON ressenti ? On calcule l'état de forme sans le pilier « ressenti » (sinon on compare un chiffre à lui-même),
 * puis on regarde, jour par jour, s'il monte et descend avec les cinq réponses du matin (corrélation de Pearson).
 * Fort à partir de 0,5, moyen de 0,3 à 0,5, faible en dessous. C'est le seul vrai test de ce score : sans accord, il ne faut pas s'y fier.
 */
export function accordAvecRessenti(nuits: Nuit[] | null | undefined, metriques: Metrique[] | null | undefined, mesures: MesuresParJour | null | undefined): AccordRessenti {
  const sansRessenti: MesuresParJour = Object.fromEntries(Object.entries(mesures || {}).map(([d, m]) => [d, Object.fromEntries(Object.entries(m).filter(([k]) => !k.startsWith('ressenti_')))]));
  const objectif = serieEtatDeForme(nuits, metriques, sansRessenti);
  const paires: [number, number][] = [];
  for (const point of objectif) {
    const ressenti = indiceRessenti((mesures || {})[point.date]);
    if (point.indice != null && ressenti != null) paires.push([point.indice, ressenti]);
  }
  if (paires.length < JOURS_MINI_ACCORD) return { jours: paires.length, r: null, accord: null };
  const mx = moyenne(paires.map((p) => p[0]));
  const my = moyenne(paires.map((p) => p[1]));
  const sxy = paires.reduce((s, [x, y]) => s + (x - mx) * (y - my), 0);
  const sxx = paires.reduce((s, [x]) => s + (x - mx) ** 2, 0);
  const syy = paires.reduce((s, [, y]) => s + (y - my) ** 2, 0);
  if (sxx === 0 || syy === 0) return { jours: paires.length, r: null, accord: null }; // une des deux séries ne bouge pas : pas de corrélation possible
  const r = Math.round((sxy / Math.sqrt(sxx * syy)) * 100) / 100;
  return { jours: paires.length, r, accord: r >= 0.5 ? 'fort' : r >= 0.3 ? 'moyen' : 'faible' };
}
