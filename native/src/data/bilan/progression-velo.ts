// Progression à vélo : « à cardio égal, est-ce que je produis plus de watts qu'avant ? ». Calculs purs, testés dans tests/bilan/progression-velo.test.ts.
//
// Pourquoi pas une simple moyenne : sur les vraies sorties, une sortie varie d'environ 12 % d'un jour à l'autre (sommeil, hydratation, fatigue), bien plus que le
// progrès qu'on cherche. Une moyenne de 2 sorties « annonce » alors un progrès ou un recul de plus de 1 % presque tout le temps, même quand rien n'a changé.
// Ici, on compare deux périodes avec une régression : watts = base + pente × (cardio − cardio de référence) + intérieur + période.
// Le coefficient « période » est l'écart en watts à cardio égal, et son incertitude donne une fourchette : on n'annonce une hausse ou une baisse que si la
// fourchette exclut zéro. Mesuré sur 1 026 sorties réelles : fausses alertes ≈ 10 % (contre ≈ 88 % pour la moyenne simple), et l'écart suit mieux le meilleur 20 min.
// Les autres facteurs testés (durée, dénivelé, volume de la semaine, nombre de sorties retenues) n'amélioraient rien : on ne les ajoute pas.

/** Une sortie vélo retenue pour la comparaison. */
export interface SortieVelo {
  /** Date de la séance (début local, ISO). */
  date: string;
  /** Puissance normalisée (NP), sinon puissance moyenne : en watts. */
  watts: number;
  /** Cardio moyen, en bpm. */
  fc: number;
  /** Sortie sur home-trainer ou vélo virtuel : à cardio égal elle donne moins de watts (pas d'air, plus de chaleur), on la compte à part. */
  interieur: boolean;
}

/** Les champs d'une séance dont l'algorithme a besoin (un sous-ensemble de `Seance`). */
export interface SeanceVelo {
  sport: string;
  start_date_local: string;
  moving_time: number;
  avg_heartrate: number | null;
  avg_watts: number | null;
  np: number | null;
  device_watts?: boolean | null;
  excl_power?: boolean | null;
  excl_hr?: boolean | null;
}

const SPORTS_VELO = new Set(['Ride', 'GravelRide', 'MountainBikeRide', 'VirtualRide']);
const DUREE_MINI = 1200; // 20 min : en dessous, la moyenne du cardio suit encore la montée du début
const WATTS_MINI = 40; // en dessous, on roule à peine : la sortie ne mesure rien
/** Plage de cardio retenue : large exprès, la régression corrige l'écart de cardio (le cardio de 51 % et celui de 91 % ne sont pas traités pareil). */
const PLAGE_FC_MAX: readonly [number, number] = [0.5, 0.92];
const PLAGE_FC_SANS_MAX: readonly [number, number] = [95, 175];

/** Il faut au moins 3 sorties retenues dans chaque période : en dessous, la fourchette est trop large pour dire quoi que ce soit. */
export const SORTIES_MINI_VELO = 3;
/** Un écart n'est annoncé que s'il dépasse son incertitude de 1,8 fois (fourchette « à ~93 % »). */
const Z = 1.8;
/** Sous cet écart (en %), même une fourchette qui exclut zéro ne justifie pas de parler de hausse ou de baisse. */
const ECART_MINI_PCT = 1;
/** Une fourchette plus étroite que ± ce nombre de % permet de dire « stable » ; plus large, on dit « trop de variations pour trancher ». */
const PRECISION_STABLE_PCT = 4;

/** Garde les sorties comparables : capteur de puissance réel, hors vélo électrique, données non exclues, cardio plausible. */
export function sortiesVelo(seances: readonly SeanceVelo[], hrMax: number | null): SortieVelo[] {
  const [bas, haut] = hrMax ? [hrMax * PLAGE_FC_MAX[0], hrMax * PLAGE_FC_MAX[1]] : PLAGE_FC_SANS_MAX;
  const sorties: SortieVelo[] = [];
  for (const s of seances) {
    if (!SPORTS_VELO.has(s.sport)) continue; // inclut les sports de la famille vélo sauf le vélo électrique (sa puissance n'est pas la tienne)
    if (s.device_watts === false || s.excl_power || s.excl_hr) continue; // puissance estimée par Strava, ou données que l'utilisateur a écartées
    const np = Number(s.np);
    const watts = np > 0 ? np : Number(s.avg_watts);
    const fc = Number(s.avg_heartrate);
    if (!(s.moving_time >= DUREE_MINI) || !(watts >= WATTS_MINI) || !(fc >= bas && fc <= haut)) continue;
    sorties.push({ date: s.start_date_local, watts, fc, interieur: s.sport === 'VirtualRide' });
  }
  return sorties;
}

export interface EstimationVelo {
  /** Watts à cardio de référence, période d'avant et période actuelle (mêmes conditions : extérieur, sauf si tu ne roules que sur home-trainer). */
  avant: number;
  actuel: number;
  /** Écart en % de l'indicateur (positif = plus de watts). */
  variationPct: number;
  /** Fourchette de cet écart, en %. */
  bas: number;
  haut: number;
  nbAvant: number;
  nbActuel: number;
  /** Cardio de référence (bpm) auquel les watts sont ramenés. */
  fcReference: number;
  /** Les watts d'une sortie ramenés au cardio de référence et à l'extérieur : sert à tracer la courbe. */
  ajuster: (s: SortieVelo) => number;
  /** Watts gagnés (ou perdus) par bpm de cardio en plus : la pente de la régression. */
  pente: number;
  /** Écart des sorties en salle par rapport à l'extérieur, à cardio égal, en watts (négatif : moins de watts en salle). 0 quand on ne compare qu'un seul terrain. */
  decalageInterieur: number;
  /** Les sorties qui ont servi au calcul, de la plus ancienne à la plus récente, avec leurs watts ramenés au cardio de référence. */
  sorties: SortieComparee[];
  /** Moyennes brutes de chaque période (avant toute correction) : elles expliquent le passage de l'écart brut à l'écart à cardio égal. */
  brut: { avant: MoyenneBrute; actuel: MoyenneBrute };
}

/** Une sortie qui a servi au calcul. */
export interface SortieComparee extends SortieVelo {
  /** Vrai pour la période actuelle, faux pour la période d'avant. */
  actuelle: boolean;
  /** Ses watts ramenés au cardio de référence et à l'extérieur. */
  ajuste: number;
}

export interface MoyenneBrute {
  watts: number;
  fc: number;
  /** Part de sorties en salle, de 0 à 1. */
  partSalle: number;
}

export type RaisonVelo = 'pas-assez' | 'pas-comparable';

const mediane = (v: number[]): number => {
  const t = [...v].sort((a, b) => a - b);
  const m = t.length >> 1;
  return t.length % 2 ? t[m] : (t[m - 1] + t[m]) / 2;
};

/** Inverse d'une petite matrice carrée (élimination de Gauss) ; null si elle n'est pas inversible (colonnes qui disent la même chose). */
function inverse(a: number[][]): number[][] | null {
  const k = a.length;
  const m = a.map((ligne, i) => [...ligne, ...Array.from({ length: k }, (_, j) => (i === j ? 1 : 0))]);
  for (let i = 0; i < k; i++) {
    let p = i;
    for (let j = i + 1; j < k; j++) if (Math.abs(m[j][i]) > Math.abs(m[p][i])) p = j;
    if (Math.abs(m[p][i]) < 1e-9) return null;
    [m[i], m[p]] = [m[p], m[i]];
    const d = m[i][i];
    m[i] = m[i].map((v) => v / d);
    for (let j = 0; j < k; j++) {
      if (j === i) continue;
      const f = m[j][i];
      if (f) m[j] = m[j].map((v, t) => v - f * m[i][t]);
    }
  }
  return m.map((ligne) => ligne.slice(k));
}

/** Moindres carrés avec écarts-types robustes (HC1) : les coefficients et l'incertitude de chacun. Null si le modèle est dégénéré. */
function regression(x: number[][], y: number[]): { b: number[]; se: number[] } | null {
  const n = x.length;
  const k = x[0].length;
  if (n <= k) return null;
  const xtx = Array.from({ length: k }, (_, a) => Array.from({ length: k }, (_, c) => x.reduce((s, ligne) => s + ligne[a] * ligne[c], 0)));
  const inv = inverse(xtx);
  if (!inv) return null;
  const xty = Array.from({ length: k }, (_, a) => x.reduce((s, ligne, i) => s + ligne[a] * y[i], 0));
  const b = inv.map((ligne) => ligne.reduce((s, v, c) => s + v * xty[c], 0));
  const e = y.map((v, i) => v - x[i].reduce((s, xv, a) => s + xv * b[a], 0));
  const meat = Array.from({ length: k }, (_, a) => Array.from({ length: k }, (_, c) => x.reduce((s, ligne, i) => s + ligne[a] * ligne[c] * e[i] * e[i], 0)));
  const tmp = inv.map((ligne) => Array.from({ length: k }, (_, c) => ligne.reduce((s, v, m) => s + v * meat[m][c], 0)));
  const echelle = n / (n - k);
  const se = Array.from({ length: k }, (_, a) => Math.sqrt(Math.max(0, tmp[a].reduce((s, v, m) => s + v * inv[m][a], 0) * echelle)));
  return { b, se };
}

/**
 * Les sorties qui entrent dans la comparaison. Le home-trainer n'est corrigé que si on a de quoi mesurer son écart (au moins 3 sorties de chaque sorte) ;
 * sinon on garde la sorte la plus fréquente.
 */
function sortiesComparees(sorties: readonly SortieVelo[], actuelle: (date: string) => boolean, avant: (date: string) => boolean): { lignes: SortieVelo[]; nbActuel: number; nbAvant: number } {
  let lignes = sorties.filter((s) => actuelle(s.date) || avant(s.date));
  const interieures = lignes.filter((s) => s.interieur).length;
  const exterieures = lignes.length - interieures;
  if (interieures < SORTIES_MINI_VELO || exterieures < SORTIES_MINI_VELO) {
    const garderInterieur = interieures > exterieures;
    lignes = lignes.filter((s) => s.interieur === garderInterieur);
  }
  const nbActuel = lignes.filter((s) => actuelle(s.date)).length;
  return { lignes, nbActuel, nbAvant: lignes.length - nbActuel };
}

/** Combien de sorties comptent dans chaque période (pour dire « 2 sur 3 » quand il en manque). */
export function compterSortiesVelo(sorties: readonly SortieVelo[], actuelle: (date: string) => boolean, avant: (date: string) => boolean): { nbActuel: number; nbAvant: number } {
  const { nbActuel, nbAvant } = sortiesComparees(sorties, actuelle, avant);
  return { nbActuel, nbAvant };
}

/**
 * Compare la période actuelle (`actuelle`) à celle d'avant (`avant`) à cardio égal.
 * Retourne la raison quand c'est impossible : 'pas-assez' (moins de 3 sorties retenues dans une période) ou 'pas-comparable' (par exemple
 * du home-trainer d'un côté et de l'extérieur de l'autre : l'écart viendrait du lieu, pas de ta forme).
 */
export function estimerVelo(sorties: readonly SortieVelo[], actuelle: (date: string) => boolean, avant: (date: string) => boolean): EstimationVelo | RaisonVelo {
  const { lignes, nbActuel, nbAvant } = sortiesComparees(sorties, actuelle, avant);
  if (nbActuel < SORTIES_MINI_VELO || nbAvant < SORTIES_MINI_VELO) return 'pas-assez';

  const fcRef = Math.round(mediane(lignes.map((s) => s.fc)));
  const avecInterieur = lignes.some((s) => s.interieur) && lignes.some((s) => !s.interieur);
  const avecFc = new Set(lignes.map((s) => s.fc)).size > 1;
  // Colonnes : 1, cardio − référence (si le cardio varie), intérieur (si on a les deux), période (1 = actuelle)
  const x = lignes.map((s) => [1, ...(avecFc ? [s.fc - fcRef] : []), ...(avecInterieur ? [s.interieur ? 1 : 0] : []), actuelle(s.date) ? 1 : 0]);
  const fit = regression(x, lignes.map((s) => s.watts));
  if (!fit) return 'pas-comparable';

  const k = fit.b.length;
  const base = fit.b[0]; // watts au cardio de référence, à l'extérieur (ou tout au même endroit si on ne roule que d'un seul côté)
  const ecart = fit.b[k - 1];
  const incertitude = fit.se[k - 1];
  if (!(base > 0)) return 'pas-comparable';
  const pente = avecFc ? fit.b[1] : 0;
  const decalageInterieur = avecInterieur ? fit.b[k - 2] : 0;

  const variationPct = (ecart / base) * 100;
  const demi = ((Z * incertitude) / base) * 100;
  const arrondi1 = (v: number): number => Math.round(v * 10) / 10;
  const ajuster = (s: SortieVelo): number => s.watts - pente * (s.fc - fcRef) - (s.interieur ? decalageInterieur : 0);
  const moyenne = (liste: SortieVelo[]): MoyenneBrute => ({
    watts: liste.reduce((t, s) => t + s.watts, 0) / liste.length,
    fc: liste.reduce((t, s) => t + s.fc, 0) / liste.length,
    partSalle: liste.filter((s) => s.interieur).length / liste.length,
  });
  return {
    avant: base,
    actuel: base + ecart,
    variationPct: arrondi1(variationPct),
    bas: arrondi1(variationPct - demi),
    haut: arrondi1(variationPct + demi),
    nbAvant,
    nbActuel,
    fcReference: fcRef,
    ajuster,
    pente,
    decalageInterieur,
    sorties: lignes
      .map((s) => ({ ...s, actuelle: actuelle(s.date), ajuste: ajuster(s) }))
      .sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0)),
    brut: { avant: moyenne(lignes.filter((s) => !actuelle(s.date))), actuel: moyenne(lignes.filter((s) => actuelle(s.date))) },
  };
}

export type StatutVelo = 'hausse' | 'stable' | 'baisse' | 'incertain';

/** Le verdict d'une estimation : hausse ou baisse seulement si la fourchette exclut zéro ; sinon « stable » si elle est étroite, « incertain » si elle est large. */
export function statutVelo(e: Pick<EstimationVelo, 'variationPct' | 'bas' | 'haut'>): StatutVelo {
  if (e.bas > 0 && e.variationPct >= ECART_MINI_PCT) return 'hausse';
  if (e.haut < 0 && e.variationPct <= -ECART_MINI_PCT) return 'baisse';
  return (e.haut - e.bas) / 2 <= PRECISION_STABLE_PCT ? 'stable' : 'incertain';
}
