// La forme vélo semaine par semaine sur une année civile (graphique « Forme par saison », maquette 7 choisie par Yanis le 2 nov. 2026).
// Chaque semaine reçoit les watts à cardio égal calculés sur les 3 dernières sorties mesurées avant la fin de la semaine (quelle que soit leur date) :
// - la pente du cardio et la correction du home-trainer viennent d'une seule régression sur tout l'historique (une colonne par trimestre, comme la courbe Forme) ;
// - les watts de chaque sortie de la fenêtre sont ramenés au cardio de référence, puis moyennés ; la marge d'erreur vient de leur dispersion ;
// - le score utilise la même échelle que la courbe Forme (100 = ton meilleur trimestre, voir niveau-annees.ts).
// - après plus de 6 semaines sans sortie mesurée, ce n'est pas un trou : la forme baisse quand on ne roule pas, donc le score est ESTIMÉ à partir des 3 dernières sorties et de la baisse de ta charge (CTL) depuis la dernière ;
// À côté : tes heures de vélo de chaque semaine, pour voir si la forme suit le volume.

import { mediane, regression } from '../outils/regression.ts';
import { lignesVelo, noteDe, noteLibre, SORTIES_MINI_PERIODE, type SerieNiveau, type SortieNiveauVelo } from './niveau-annees.ts';

/** Après 6 semaines sans sortie mesurée, la forme n'est plus mesurée mais estimée. */
export const SEMAINES_FENETRE = 6;
/** Comme la courbe Forme : la marge d'erreur vaut 1,8 fois l'incertitude. */
const Z = 1.8;
/** La forme baisse moitié moins vite que la charge (CTL) quand on arrête : estimation, pas une mesure. */
export const PART_BAISSE_FORME = 0.5;
/** Chaque semaine estimée élargit la marge de 2 points. */
const MARGE_PAR_SEMAINE = 2;
const ALPHA_CTL = 2 / 43;

export interface SemaineForme {
  /** Numéro de la semaine dans l'année, à partir de 0 (la semaine 0 commence le 1er janvier ; la dernière va jusqu'au 31 décembre). */
  index: number;
  /** Premier jour de la semaine, « AAAA-MM-JJ ». */
  debut: string;
  /** Le score sur 100, ou null s'il y a moins de 3 sorties dans la fenêtre. */
  score: number | null;
  /** La fourchette du score (le haut peut dépasser 100). */
  bas: number | null;
  haut: number | null;
  /** Vrai quand le score est une estimation (pas assez de sorties mesurées : il suit la baisse de la charge depuis la dernière semaine mesurée). */
  estimee: boolean;
  /** Sorties mesurées dans la fenêtre de 6 semaines. */
  n: number;
  /** Heures de vélo de la semaine elle-même (toutes les sorties vélo, même sans capteur ni cardio, hors vélo électrique). */
  heures: number;
}

export interface FormeSaison {
  annee: number;
  /** Les semaines déjà commencées (toutes, pour une année passée). */
  semaines: SemaineForme[];
  /** L'index de la meilleure semaine. */
  meilleure: number;
}

/** Les champs d'une séance utiles pour les heures (un sous-ensemble de `Seance`). */
export interface SeanceHeures {
  sport: string;
  start_date_local: string;
  moving_time: number;
  /** La charge de la séance (tous sports) : elle sert à estimer la baisse de forme quand on ne roule pas. */
  tss?: number | null;
}

/** Les heures comptent le vélo que tu pédales toi-même (pas le vélo électrique), comme la forme. */
const SPORTS_HEURES = new Set(['Ride', 'GravelRide', 'MountainBikeRide', 'VirtualRide']);
const jourDe = (date: string): number => Date.UTC(Number(date.slice(0, 4)), Number(date.slice(5, 7)) - 1, Number(date.slice(8, 10))) / 86400000;
const dateDe = (jour: number): string => new Date(jour * 86400000).toISOString().slice(0, 10);
const moyenne = (v: number[]): number => v.reduce((s, x) => s + x, 0) / v.length;

/** Le CTL (charge chronique) de chaque jour, de la première séance à `fin` (jour exclu), même calcul que la base : moyenne exponentielle sur 42 jours, départ à 0. */
function ctlParJour(seances: readonly SeanceHeures[], fin: number): Map<number, number> {
  const tss = new Map<number, number>();
  let debut = Infinity;
  for (const s of seances) {
    if (!(Number(s.tss) > 0)) continue;
    const j = jourDe(s.start_date_local);
    debut = Math.min(debut, j);
    tss.set(j, (tss.get(j) ?? 0) + Number(s.tss));
  }
  const out = new Map<number, number>();
  let ctl = 0;
  for (let j = debut; j < fin; j++) {
    ctl += ((tss.get(j) ?? 0) - ctl) * ALPHA_CTL;
    out.set(j, ctl);
  }
  return out;
}

/** La pente du cardio (watts par bpm) et la correction home-trainer, estimées sur tout l'historique avec une colonne par trimestre. */
function modele(lignes: ReturnType<typeof lignesVelo>, fcRef: number): { pente: number; salle: number } | null {
  const trimestre = (date: string) => `${date.slice(0, 4)}-${Math.floor((Number(date.slice(5, 7)) - 1) / 3)}`;
  const compte = new Map<string, number>();
  for (const l of lignes) compte.set(trimestre(l.date), (compte.get(trimestre(l.date)) ?? 0) + 1);
  const cles = [...compte].filter(([, n]) => n >= SORTIES_MINI_PERIODE).map(([cle]) => cle).sort();
  const retenues = lignes.filter((l) => cles.includes(trimestre(l.date)));
  if (!retenues.length || new Set(retenues.map((l) => l.fc)).size < 2) return null;
  const avecSalle = retenues[0].corrections.length > 0 && new Set(retenues.map((l) => l.corrections[0])).size > 1;
  const x = retenues.map((l) => [...cles.map((cle) => (trimestre(l.date) === cle ? 1 : 0)), l.fc - fcRef, ...(avecSalle ? [l.corrections[0]] : [])]);
  const fit = regression(x, retenues.map((l) => l.valeur));
  if (!fit) return null;
  return { pente: fit.b[cles.length], salle: avecSalle ? fit.b[cles.length + 1] : 0 };
}

/**
 * La forme de chaque semaine de `annee` (jusqu'à la semaine d'aujourd'hui pour l'année en cours), et les heures de vélo par semaine.
 * Null si la série Forme n'existe pas ou si aucune semaine n'a 3 sorties dans sa fenêtre.
 */
export function formeParSemaine(
  sorties: readonly SortieNiveauVelo[],
  seances: readonly SeanceHeures[],
  serie: SerieNiveau | null,
  annee: number,
  aujourdhui: Date,
): FormeSaison | null {
  if (!serie || !serie.fcReference || !(serie.meilleur.niveau > 0)) return null;
  const lignes = lignesVelo(sorties);
  const fcRef = serie.fcReference ?? Math.round(mediane(lignes.map((l) => l.fc)));
  const m = modele(lignes, fcRef);
  if (!m) return null;
  const corrigees = lignes.map((l) => ({ jour: jourDe(l.date), watts: l.valeur - m.pente * (l.fc - fcRef) - m.salle * (l.corrections[0] ?? 0) }));

  const debutAn = jourDe(`${annee}-01-01`);
  const finAn = jourDe(`${annee + 1}-01-01`);
  const auj = jourDe(`${aujourdhui.getFullYear()}-${String(aujourdhui.getMonth() + 1).padStart(2, '0')}-${String(aujourdhui.getDate()).padStart(2, '0')}`);
  const heuresParSemaine = new Map<number, number>();
  for (const s of seances) {
    if (!SPORTS_HEURES.has(s.sport) || !(s.moving_time > 0)) continue;
    const j = jourDe(s.start_date_local);
    if (j < debutAn || j >= finAn) continue;
    const i = Math.min(51, Math.floor((j - debutAn) / 7));
    heuresParSemaine.set(i, (heuresParSemaine.get(i) ?? 0) + s.moving_time / 3600);
  }

  const ctl = ctlParJour(seances, Math.min(finAn, auj + 1));
  const meilleur = serie.meilleur.niveau;
  const triees = [...corrigees].sort((a, b) => a.jour - b.jour);
  const semaines: SemaineForme[] = [];
  for (let i = 0; i < 52; i++) {
    const debut = debutAn + 7 * i;
    if (debut > auj) break;
    const fin = i === 51 ? finAn : debut + 7;
    const heures = heuresParSemaine.get(i) ?? 0;
    // Les 3 dernières sorties mesurées avant la fin de la semaine, quelle que soit leur date
    const avant = triees.filter((c) => c.jour < fin);
    const dernieres = avant.slice(-SORTIES_MINI_PERIODE);
    if (dernieres.length < SORTIES_MINI_PERIODE) {
      semaines.push({ index: i, debut: dateDe(debut), score: null, bas: null, haut: null, estimee: false, n: dernieres.length, heures });
      continue;
    }
    const fenetre = dernieres.map((c) => c.watts);
    const niveau = moyenne(fenetre);
    const ecartType = Math.sqrt(fenetre.reduce((t, w) => t + (w - niveau) ** 2, 0) / (fenetre.length - 1));
    const demi = (Z * ecartType) / Math.sqrt(fenetre.length);
    const mesure = noteDe(niveau / meilleur);
    const mesureBas = Math.min(noteDe((niveau - demi) / meilleur), mesure);
    const mesureHaut = Math.max(noteLibre((niveau + demi) / meilleur), mesure);
    // Pas de sortie depuis plus de 6 semaines : on ne mesure plus, on estime. La forme baisse (de moitié moins vite que le CTL) depuis la dernière sortie
    const derniereSortie = dernieres[dernieres.length - 1].jour;
    const semainesSansSortie = (fin - 1 - derniereSortie) / 7;
    const ctlSortie = ctl.get(derniereSortie);
    const ctlSemaine = ctl.get(Math.min(fin, auj + 1) - 1);
    if (semainesSansSortie > SEMAINES_FENETRE && ctlSortie && ctlSemaine !== undefined) {
      const perte = Math.max(0, 1 - ctlSemaine / ctlSortie);
      const score = mesure * (1 - PART_BAISSE_FORME * perte);
      const marge = Math.max(mesure - mesureBas, mesureHaut - mesure) + MARGE_PAR_SEMAINE * (semainesSansSortie - SEMAINES_FENETRE);
      semaines.push({ index: i, debut: dateDe(debut), score, bas: Math.max(0, score - marge), haut: Math.min(100, score + marge), estimee: true, n: fenetre.length, heures });
      continue;
    }
    // Plus de sortie depuis 6 semaines et aucune charge connue : on ne sait rien, la semaine reste vide
    if (semainesSansSortie > SEMAINES_FENETRE) {
      semaines.push({ index: i, debut: dateDe(debut), score: null, bas: null, haut: null, estimee: false, n: fenetre.length, heures });
      continue;
    }
    semaines.push({ index: i, debut: dateDe(debut), score: mesure, bas: mesureBas, haut: mesureHaut, estimee: false, n: fenetre.length, heures });
  }
  // La meilleure semaine se cherche parmi les semaines mesurées
  const notees = semaines.filter((s) => s.score !== null && !s.estimee);
  if (!notees.length) return null;
  return { annee, semaines, meilleure: notees.reduce((a, s) => (s.score! > a.score! ? s : a)).index };
}
