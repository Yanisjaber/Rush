// Le niveau année après année : un score où 100 = ton meilleur niveau mesuré. Calculs purs, testés dans tests/bilan/niveau-annees.test.ts.
//
// Le niveau d'une période, c'est la puissance (vélo) ou l'allure (course) à cardio égal. On le calcule avec la même régression que la comparaison de deux périodes
// (progression-velo.ts, progression-course.ts), mais sur TOUT l'historique d'un coup, avec une colonne par année (ou par trimestre) : le cardio, le home-trainer et le
// dénivelé sont corrigés avec les mêmes coefficients pour toutes les périodes, donc les niveaux se comparent d'une année à l'autre.
// Chaque niveau vient avec sa marge d'erreur ; une période a besoin de 3 sorties au moins.
// 100 = le meilleur niveau parmi les périodes d'au moins 8 sorties (une période avec peu de sorties peut sortir très haut par hasard : elle ne fixe pas le sommet).
import { mediane, regression } from '../outils/regression.ts';

/** Une sortie réduite à ce qui sert au niveau : sa valeur (watts ou secondes par km), son cardio, et ses colonnes de correction (home-trainer, dénivelé…). */
export interface LigneNiveau {
  date: string;
  valeur: number;
  fc: number;
  /** Colonnes de correction déjà prêtes (le zéro est la situation de référence : sur route, au dénivelé médian). */
  corrections: number[];
}

export interface PointNiveau {
  /** « 2025 », « 2025-T3 » (trimestre) ou « 2025-S2 » (semestre). */
  cle: string;
  an: number;
  /** Numéro de la tranche dans l'année, à partir de 0 (toujours 0 pour une année entière). */
  tranche: number;
  /** Le niveau, dans l'unité du sport (watts, ou secondes par km). */
  niveau: number;
  /** La marge d'erreur du niveau, dans la même unité. */
  demi: number;
  /** Nombre de sorties de la période ; null pour un record (une seule sortie compte). */
  n: number | null;
  /** Le score, de 0 à 100 (100 = le meilleur niveau mesuré). */
  score: number;
  /** La fourchette du score (le haut peut dépasser 100). */
  bas: number;
  haut: number;
}

export interface SerieNiveau {
  /** Le cardio (bpm) auquel les niveaux sont ramenés ; null pour une série de records. */
  fcReference: number | null;
  /** 4 (trimestres), 2 (semestres) ou 1 (pas de tranches) : combien de tranches par année dans `tranches`. */
  tranchesParAn: number;
  annuel: PointNiveau[];
  tranches: PointNiveau[];
  /** La période qui vaut 100. */
  meilleur: PointNiveau;
  /** L'année la plus récente. */
  actuel: PointNiveau;
}

/** Une période a besoin d'au moins 3 sorties ; pour fixer le sommet, d'au moins 8. */
export const SORTIES_MINI_PERIODE = 3;
export const SORTIES_MINI_SOMMET = 8;

interface Reglage {
  tranchesParAn: 2 | 4;
  /** Combien de fois l'incertitude pour la marge d'erreur (1,8 au vélo, 2 en course). */
  z: number;
  /** Vrai pour des watts (plus haut = mieux), faux pour une allure (plus bas = mieux). */
  plusHautMieux: boolean;
}

interface Brut {
  cle: string;
  an: number;
  tranche: number;
  niveau: number;
  demi: number;
  n: number;
}

const anDe = (date: string): number => Number(date.slice(0, 4));
const moisDe = (date: string): number => Number(date.slice(5, 7));

/** Les niveaux de chaque période (`cleDe` donne la période d'une sortie) : une régression avec une colonne par période. Vide si ça n'est pas calculable. */
function niveauxPar(lignes: readonly LigneNiveau[], cleDe: (l: LigneNiveau) => { cle: string; an: number; tranche: number }, fcRef: number, z: number): Brut[] {
  const compte = new Map<string, number>();
  for (const l of lignes) compte.set(cleDe(l).cle, (compte.get(cleDe(l).cle) ?? 0) + 1);
  const cles = [...compte].filter(([, n]) => n >= SORTIES_MINI_PERIODE).map(([cle]) => cle).sort();
  if (!cles.length) return [];
  const retenues = lignes.filter((l) => cles.includes(cleDe(l).cle));
  const nbCorrections = retenues[0].corrections.length;
  // Une colonne de correction ne sert que si elle varie : sinon elle ferait doublon avec les colonnes de période
  const colonnes = Array.from({ length: nbCorrections }, (_, j) => j).filter((j) => new Set(retenues.map((l) => l.corrections[j])).size > 1);
  const avecFc = new Set(retenues.map((l) => l.fc)).size > 1;
  const x = retenues.map((l) => [...cles.map((cle) => (cleDe(l).cle === cle ? 1 : 0)), ...(avecFc ? [l.fc - fcRef] : []), ...colonnes.map((j) => l.corrections[j])]);
  const fit = regression(x, retenues.map((l) => l.valeur));
  if (!fit) return [];
  return cles.map((cle, i) => {
    const d = cleDe(retenues.find((l) => cleDe(l).cle === cle)!);
    return { cle, an: d.an, tranche: d.tranche, niveau: fit.b[i], demi: z * fit.se[i], n: compte.get(cle) ?? 0 };
  }).filter((p) => p.niveau > 0);
}

function noter(brut: Brut, meilleur: number, plusHautMieux: boolean): PointNiveau {
  // Le rapport au meilleur niveau (1 = le meilleur, 0,9 = 10 % en dessous), du centre de la marge d'erreur et de ses deux bouts
  const rapport = plusHautMieux ? brut.niveau / meilleur : meilleur / brut.niveau;
  const rapportBas = plusHautMieux ? (brut.niveau - brut.demi) / meilleur : meilleur / (brut.niveau + brut.demi);
  const rapportHaut = plusHautMieux ? (brut.niveau + brut.demi) / meilleur : meilleur / Math.max(1e-9, brut.niveau - brut.demi);
  const score = noteDe(rapport);
  return { cle: brut.cle, an: brut.an, tranche: brut.tranche, niveau: brut.niveau, demi: brut.demi, n: brut.n, score, bas: Math.min(noteDe(rapportBas), score), haut: Math.max(noteLibre(rapportHaut), score) };
}

/**
 * L'échelle du score : 100 = ton meilleur niveau, 0 = un niveau 30 % en dessous du meilleur, entre les deux en ligne droite (1 % de niveau en moins = 3,3 points).
 * Un rapport au meilleur niveau simple (90 % = note 90) serrerait tout entre 70 et 100 : les écarts réels (un vélo qui passe de 138 à 169 W, soit 22 %) se verraient à peine.
 */
export const RAPPORT_ZERO = 0.7;
const noteLibre = (rapport: number): number => ((rapport - RAPPORT_ZERO) / (1 - RAPPORT_ZERO)) * 100;
/** La note, entre 0 et 100 (le haut de la marge d'erreur, lui, peut dépasser 100 : voir noteLibre). */
const noteDe = (rapport: number): number => Math.max(0, Math.min(100, noteLibre(rapport)));

/** Construit la série à partir des sorties, ou null s'il y a moins de deux années calculables. */
function construire(lignes: readonly LigneNiveau[], r: Reglage): SerieNiveau | null {
  if (lignes.length < 2 * SORTIES_MINI_PERIODE) return null;
  const fcRef = Math.round(mediane(lignes.map((l) => l.fc)));
  const parAn = (l: LigneNiveau) => ({ cle: String(anDe(l.date)), an: anDe(l.date), tranche: 0 });
  const largeur = 12 / r.tranchesParAn;
  const parTranche = (l: LigneNiveau) => {
    const an = anDe(l.date);
    const tranche = Math.floor((moisDe(l.date) - 1) / largeur);
    return { cle: `${an}-${r.tranchesParAn === 4 ? 'T' : 'S'}${tranche + 1}`, an, tranche };
  };
  const annuelBrut = niveauxPar(lignes, parAn, fcRef, r.z);
  if (annuelBrut.length < 2) return null;
  const tranchesBrut = niveauxPar(lignes, parTranche, fcRef, r.z);
  // Le sommet : le meilleur niveau parmi les tranches (ou les années, s'il n'y a pas assez de tranches) qui ont au moins 8 sorties ; à défaut, parmi toutes
  const fines = tranchesBrut.length >= 2 ? tranchesBrut : annuelBrut;
  const fiables = fines.filter((p) => p.n >= SORTIES_MINI_SOMMET);
  const candidats = fiables.length ? fiables : fines;
  const meilleurNiveau = candidats.reduce((m, p) => (r.plusHautMieux ? Math.max(m, p.niveau) : Math.min(m, p.niveau)), candidats[0].niveau);
  const annuel = annuelBrut.map((p) => noter(p, meilleurNiveau, r.plusHautMieux));
  const tranches = tranchesBrut.length >= 2 ? tranchesBrut.map((p) => noter(p, meilleurNiveau, r.plusHautMieux)) : [];
  const meilleur = (tranches.length ? tranches : annuel).filter((p) => (p.n ?? 0) >= SORTIES_MINI_SOMMET || !fiables.length).reduce((m, p) => (p.score > m.score ? p : m));
  return { fcReference: fcRef, tranchesParAn: tranches.length ? r.tranchesParAn : 1, annuel, tranches, meilleur, actuel: annuel[annuel.length - 1] };
}

// --- Vélo -------------------------------------------------------------------------------------------------------------------

/** Les mêmes sorties que la comparaison de deux périodes (voir sortiesVelo) : `watts`, `fc`, `interieur`, `date`. */
export interface SortieNiveauVelo {
  date: string;
  watts: number;
  fc: number;
  interieur: boolean;
}

/** Niveau du vélo par année et par trimestre : les watts à cardio égal, sur route. Le home-trainer n'est corrigé que s'il y en a au moins 3 et 3 sorties sur route. */
export function niveauxVelo(sorties: readonly SortieNiveauVelo[]): SerieNiveau | null {
  const salle = sorties.filter((s) => s.interieur).length;
  const route = sorties.length - salle;
  const separe = salle >= SORTIES_MINI_PERIODE && route >= SORTIES_MINI_PERIODE;
  const gardees = separe ? sorties : sorties.filter((s) => s.interieur === salle > route);
  return construire(
    gardees.map((s) => ({ date: s.date, valeur: s.watts, fc: s.fc, corrections: separe ? [s.interieur ? 1 : 0] : [] })),
    { tranchesParAn: 4, z: 1.8, plusHautMieux: true },
  );
}

// --- Course -----------------------------------------------------------------------------------------------------------------

/** Les mêmes courses que la comparaison de deux périodes (voir sortiesCourse). */
export interface SortieNiveauCourse {
  date: string;
  allure: number;
  fc: number;
  denivele: number;
  tapis: boolean;
}

/** Niveau de la course par année et par semestre : l'allure à cardio égal et au dénivelé médian, sur route. Plus rapide = score plus haut. */
export function niveauxCourse(sorties: readonly SortieNiveauCourse[]): SerieNiveau | null {
  const tapis = sorties.filter((s) => s.tapis).length;
  const route = sorties.length - tapis;
  const separe = tapis >= SORTIES_MINI_PERIODE && route >= SORTIES_MINI_PERIODE;
  const gardees = separe ? sorties : sorties.filter((s) => s.tapis === tapis > route);
  if (!gardees.length) return null;
  const deniveleRef = mediane(gardees.map((s) => s.denivele));
  return construire(
    gardees.map((s) => ({ date: s.date, valeur: s.allure, fc: s.fc, corrections: [s.denivele - deniveleRef, ...(separe ? [s.tapis ? 1 : 0] : [])] })),
    { tranchesParAn: 2, z: 2, plusHautMieux: false },
  );
}

// --- Records ----------------------------------------------------------------------------------------------------------------

/** Les meilleures puissances d'une année, pour quelques durées (en watts ; absentes quand l'année n'a pas de record sur cette durée). */
export interface RecordsAnnee {
  an: number;
  /** Sprint (5 secondes), 5 min, 20 min, 60 min. */
  w5?: number;
  w300?: number;
  w1200?: number;
  w3600?: number;
}

export type DureeRecord = 'w5' | 'w300' | 'w1200' | 'w3600';

/** La série annuelle d'un record : une valeur par année (pas de marge d'erreur, pas de trimestre : un record n'est pas assez régulier pour ça). Null avec moins de deux années. */
export function serieRecord(records: readonly RecordsAnnee[], duree: DureeRecord): SerieNiveau | null {
  const valeurs = records.filter((r) => (r[duree] ?? 0) > 0).sort((a, b) => a.an - b.an);
  if (valeurs.length < 2) return null;
  const meilleurW = Math.max(...valeurs.map((r) => r[duree]!));
  const annuel = valeurs.map((r): PointNiveau => ({ cle: String(r.an), an: r.an, tranche: 0, niveau: r[duree]!, demi: 0, n: null, score: noteDe(r[duree]! / meilleurW), bas: noteDe(r[duree]! / meilleurW), haut: noteDe(r[duree]! / meilleurW) }));
  return { fcReference: null, tranchesParAn: 1, annuel, tranches: [], meilleur: annuel.reduce((m, p) => (p.score > m.score ? p : m)), actuel: annuel[annuel.length - 1] };
}
