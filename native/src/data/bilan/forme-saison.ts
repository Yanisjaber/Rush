// La forme vélo semaine par semaine sur une année civile (graphique « Forme par saison », maquette 7 choisie par Yanis le 2 nov. 2026).
// Chaque semaine reçoit les watts à cardio égal calculés sur toutes les sorties mesurées avant la fin de la semaine, chacune pesant moitié moins tous les 21 jours (moyenne qui oublie doucement, comme le CTL) :
// - la pente du cardio et la correction du home-trainer viennent d'une seule régression sur tout l'historique (une colonne par trimestre, comme la courbe Forme) ;
// - les watts de chaque sortie de la fenêtre sont ramenés au cardio de référence, puis moyennés ; la marge d'erreur vient de leur dispersion ;
// - le score utilise la même échelle que la courbe Forme (100 = ton meilleur trimestre, voir niveau-annees.ts).
// - après plus de 2 semaines sans sortie mesurée, ce n'est pas un trou : la forme baisse quand on ne roule pas, donc le score est ESTIMÉ à partir de cette moyenne et de la baisse de ta charge (CTL) depuis la dernière ;
// À côté : tes heures de vélo de chaque semaine, pour voir si la forme suit le volume.

import { mediane, regression } from '../outils/regression.ts';
import { lignesCourse, lignesVelo, noteDe, noteLibre, SORTIES_MINI_PERIODE, type LigneNiveau, type SerieNiveau, type SortieNiveauCourse, type SortieNiveauVelo } from './niveau-annees.ts';

/** La mémoire de la forme : une sortie perd la moitié de son poids tous les 21 jours. */
export const DEMI_VIE_JOURS = 21;
/** Le poids des sorties des 6 dernières semaines (une sortie du jour = 1) qu'il faut pour croire la mesure : en dessous, la note est ramenée vers le bas (au plus de moitié, sans aucune sortie récente). */
export const POIDS_MINI_PREUVE = 3;
/** Au bout de 2 semaines sans sortie mesurée, la forme n'est plus mesurée mais estimée : elle baisse avec ta charge. */
export const SEMAINES_SANS_MESURE = 2;
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
  /** Nombre de sorties qui comptent vraiment dans la moyenne (arrondi) : beaucoup de sorties récentes = beaucoup. */
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
  /** Ce que mesurent les barres du bas, dans le champ `heures` de chaque semaine : des heures (« h », par défaut), des tonnes pour la musculation (« t ») ou des kilomètres pour la natation (« km »). */
  unite?: 'h' | 't' | 'km';
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

/** Les courses comptent à pied, tapis compris (le Bilan de la course range tout cela dans « course »). */
const SPORTS_HEURES_COURSE = new Set(['Run', 'TrailRun', 'VirtualRun']);

/** La pente du cardio (watts ou secondes par km, par bpm) et les corrections (home-trainer ; dénivelé, tapis), estimées sur tout l'historique avec une colonne par trimestre. */
function modele(lignes: readonly LigneNiveau[], fcRef: number): { pente: number; coefs: number[] } | null {
  const trimestre = (date: string) => `${date.slice(0, 4)}-${Math.floor((Number(date.slice(5, 7)) - 1) / 3)}`;
  const compte = new Map<string, number>();
  for (const l of lignes) compte.set(trimestre(l.date), (compte.get(trimestre(l.date)) ?? 0) + 1);
  const cles = [...compte].filter(([, n]) => n >= SORTIES_MINI_PERIODE).map(([cle]) => cle).sort();
  const retenues = lignes.filter((l) => cles.includes(trimestre(l.date)));
  if (!retenues.length || new Set(retenues.map((l) => l.fc)).size < 2) return null;
  // Une colonne de correction ne sert que si elle varie (sinon elle ferait doublon avec les colonnes de trimestre)
  const nb = retenues[0].corrections.length;
  const colonnes = Array.from({ length: nb }, (_, j) => j).filter((j) => new Set(retenues.map((l) => l.corrections[j])).size > 1);
  const x = retenues.map((l) => [...cles.map((cle) => (trimestre(l.date) === cle ? 1 : 0)), l.fc - fcRef, ...colonnes.map((j) => l.corrections[j])]);
  const fit = regression(x, retenues.map((l) => l.valeur));
  if (!fit) return null;
  const coefs = new Array<number>(nb).fill(0);
  colonnes.forEach((j, k) => {
    coefs[j] = fit.b[cles.length + 1 + k];
  });
  return { pente: fit.b[cles.length], coefs };
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
  return formeGenerique(lignesVelo(sorties), seances, serie, annee, aujourdhui, true, SPORTS_HEURES);
}

/** La même forme pour la course : l'allure à cardio égal et au dénivelé médian (une allure plus basse est un meilleur niveau), et les heures de course par semaine. */
export function formeCourseParSemaine(
  sorties: readonly SortieNiveauCourse[],
  seances: readonly SeanceHeures[],
  serie: SerieNiveau | null,
  annee: number,
  aujourdhui: Date,
): FormeSaison | null {
  return formeGenerique(lignesCourse(sorties), seances, serie, annee, aujourdhui, false, SPORTS_HEURES_COURSE);
}

/** Le calcul commun : `plusHautMieux` vrai pour des watts, faux pour une allure (le rapport au meilleur niveau se lit alors à l'envers). */
function formeGenerique(
  lignes: readonly LigneNiveau[],
  seances: readonly SeanceHeures[],
  serie: SerieNiveau | null,
  annee: number,
  aujourdhui: Date,
  plusHautMieux: boolean,
  sportsHeures: ReadonlySet<string>,
): FormeSaison | null {
  if (!serie || !serie.fcReference || !(serie.meilleur.niveau > 0) || !lignes.length) return null;
  const fcRef = serie.fcReference ?? Math.round(mediane(lignes.map((l) => l.fc)));
  const m = modele(lignes, fcRef);
  if (!m) return null;
  const corrigees = lignes.map((l) => ({ jour: jourDe(l.date), watts: l.valeur - m.pente * (l.fc - fcRef) - m.coefs.reduce((t, c, j) => t + c * (l.corrections[j] ?? 0), 0) }));
  // Le rapport au meilleur niveau (1 = le meilleur) : watts ÷ meilleur, ou meilleur ÷ allure (plus basse = mieux)
  const rapport = (niveau: number): number => (plusHautMieux ? niveau / meilleur : meilleur / Math.max(1e-9, niveau));

  const debutAn = jourDe(`${annee}-01-01`);
  const finAn = jourDe(`${annee + 1}-01-01`);
  const auj = jourDe(`${aujourdhui.getFullYear()}-${String(aujourdhui.getMonth() + 1).padStart(2, '0')}-${String(aujourdhui.getDate()).padStart(2, '0')}`);
  const heuresParSemaine = new Map<number, number>();
  for (const s of seances) {
    if (!sportsHeures.has(s.sport) || !(s.moving_time > 0)) continue;
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
    // Toutes les sorties mesurées avant la fin de la semaine, pondérées par leur âge : une sortie vieille de 3 semaines pèse moitié moins qu'une sortie du jour
    const avant = triees.filter((c) => c.jour < fin);
    if (avant.length < SORTIES_MINI_PERIODE) {
      semaines.push({ index: i, debut: dateDe(debut), score: null, bas: null, haut: null, estimee: false, n: avant.length, heures });
      continue;
    }
    const poids = avant.map((c) => 0.5 ** ((fin - 1 - c.jour) / DEMI_VIE_JOURS));
    const somme = poids.reduce((t, w) => t + w, 0);
    const niveau = avant.reduce((t, c, k) => t + poids[k] * c.watts, 0) / somme;
    // Nombre de sorties qui comptent vraiment (beaucoup de sorties récentes = beaucoup ; une seule récente et le reste très vieux = peu)
    const neff = (somme * somme) / poids.reduce((t, w) => t + w * w, 0);
    const variance = neff > 1.05 ? avant.reduce((t, c, k) => t + poids[k] * (c.watts - niveau) ** 2, 0) / (somme * (1 - 1 / neff)) : (0.15 * niveau) ** 2;
    const demi = (Z * Math.sqrt(variance)) / Math.sqrt(Math.max(neff, 1));
    // Peu de sorties récentes (la moyenne ne repose que sur du vieux) : la mesure n'est pas crue en entier, la note est ramenée vers le bas
    // (le poids des sorties des 6 dernières semaines seulement : les vieilles sorties, même nombreuses, ne prouvent pas la forme d'aujourd'hui)
    const recent = avant.reduce((t, c, k) => (c.jour >= fin - 1 - 42 ? t + poids[k] : t), 0);
    const preuve = Math.min(1, recent / POIDS_MINI_PREUVE);
    const prudence = 1 - 0.5 * (1 - preuve);
    const noteBrute = noteDe(rapport(niveau));
    const mesure = noteBrute * prudence;
    // La marge : le haut de la fourchette est le meilleur côté (plus de watts, ou une allure plus basse)
    const rapportMoins = plusHautMieux ? rapport(niveau - demi) : rapport(niveau + demi);
    const rapportPlus = plusHautMieux ? rapport(niveau + demi) : rapport(niveau - demi);
    const mesureBas = Math.min(noteDe(rapportMoins), noteBrute) * prudence;
    const mesureHaut = Math.max(noteLibre(rapportPlus), noteBrute) * prudence;
    // Pas de sortie mesurée depuis plus de 2 semaines : on ne mesure plus, on estime. La forme baisse (de moitié moins vite que le CTL) depuis la dernière sortie
    const derniereSortie = avant[avant.length - 1].jour;
    const semainesSansSortie = (fin - 1 - derniereSortie) / 7;
    const ctlSortie = ctl.get(derniereSortie);
    const ctlSemaine = ctl.get(Math.min(fin, auj + 1) - 1);
    // La baisse de la charge depuis la dernière sortie mesurée s'applique dès le premier jour (pas de palier plat) ; la semaine n'est dite « estimée » (pointillé) qu'au-delà de 2 semaines
    if (ctlSortie && ctlSemaine !== undefined && semainesSansSortie > 0) {
      const perte = Math.max(0, 1 - ctlSemaine / ctlSortie);
      const score = mesure * (1 - PART_BAISSE_FORME * perte);
      const estimee = semainesSansSortie > SEMAINES_SANS_MESURE;
      const marge = Math.max(mesure - mesureBas, mesureHaut - mesure) + MARGE_PAR_SEMAINE * Math.max(0, semainesSansSortie - SEMAINES_SANS_MESURE);
      semaines.push({ index: i, debut: dateDe(debut), score, bas: Math.max(0, score - marge), haut: Math.min(100, score + marge), estimee, n: Math.round(neff), heures });
      continue;
    }
    // Plus de sortie mesurée depuis 2 semaines et aucune charge connue : on ne sait rien, la semaine reste vide
    if (semainesSansSortie > SEMAINES_SANS_MESURE) {
      semaines.push({ index: i, debut: dateDe(debut), score: null, bas: null, haut: null, estimee: false, n: Math.round(neff), heures });
      continue;
    }
    semaines.push({ index: i, debut: dateDe(debut), score: mesure, bas: mesureBas, haut: mesureHaut, estimee: false, n: Math.round(neff), heures });
  }
  // La meilleure semaine se cherche parmi les semaines mesurées
  const notees = semaines.filter((s) => s.score !== null && !s.estimee);
  if (!notees.length) return null;
  return { annee, semaines, meilleure: notees.reduce((a, s) => (s.score! > a.score! ? s : a)).index };
}
