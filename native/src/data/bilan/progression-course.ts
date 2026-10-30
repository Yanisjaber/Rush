// Progression en course à pied : « à cardio égal, est-ce que je cours plus vite qu'avant ? ». Calculs purs, testés dans tests/bilan/progression-course.test.ts.
//
// Même méthode que le vélo (voir progression-velo.ts et docs/native/PROGRESSION_VELO.md) : une régression sur les courses des deux périodes,
//   allure = base + pente × (cardio − cardio de référence) + dénivelé × (dénivelé par km − dénivelé de référence) + tapis + période
// et une fourchette sur le coefficient « période ». On n'annonce une hausse ou un recul que si la fourchette exclut zéro.
// Ce que les vraies courses ont montré (73 sorties avec cardio d'un vrai compte) :
//   - l'ancienne moyenne ne gardait que les courses à 60–80 % de la FC max : 14 sur 73, et elle annonçait plus de 1 % d'écart ~100 % du temps sans aucun vrai changement ;
//   - le dénivelé par km est le facteur qui compte (+4 s/km pour chaque mètre de dénivelé en plus par km) ; la durée n'améliorait pas le suivi et faisait monter les fausses alertes ;
//   - il y a moins de courses que de sorties à vélo : le seuil de confiance est plus strict (2,0 au lieu de 1,8) et « stable » demande une fourchette plus large (± 5 %).
import { mediane, regression } from '../outils/regression.ts';

/** Une course retenue pour la comparaison. */
export interface SortieCourse {
  /** Date de la séance (début local, ISO). */
  date: string;
  /** Allure moyenne, en secondes par km. */
  allure: number;
  /** Cardio moyen, en bpm. */
  fc: number;
  /** Dénivelé positif par km, en mètres. */
  denivele: number;
  /** Course sur tapis (course virtuelle) : pas de dénivelé réel, on la compte à part. */
  tapis: boolean;
}

/** Les champs d'une séance dont l'algorithme a besoin (un sous-ensemble de `Seance`). */
export interface SeanceCourse {
  sport: string;
  start_date_local: string;
  moving_time: number;
  distance_km: number | null;
  total_elevation_gain: number | null;
  avg_heartrate: number | null;
  excl_hr?: boolean | null;
  excl_distance?: boolean | null;
}

/** Courses à pied seulement : l'elliptique et la machine d'escalier sont dans la famille « course » mais n'ont pas d'allure. */
const SPORTS_COURSE = new Set(['Run', 'TrailRun', 'VirtualRun']);
const DISTANCE_MINI_KM = 3;
const DUREE_MINI = 600; // 10 min : garde-fou, la distance de 3 km coupe déjà les très courtes
const PLAGE_FC_MAX: readonly [number, number] = [0.5, 0.95];
const PLAGE_FC_SANS_MAX: readonly [number, number] = [95, 185];

/** Il faut au moins 3 courses retenues dans chaque période. */
export const SORTIES_MINI_COURSE = 3;
/** Un écart n'est annoncé que s'il dépasse son incertitude de 2 fois (plus strict que le vélo : moins de courses). */
const Z = 2;
/** Sous cet écart (en %), même une fourchette qui exclut zéro ne justifie pas de parler de hausse ou de baisse. */
const ECART_MINI_PCT = 1;
/** Une fourchette plus étroite que ± ce nombre de % permet de dire « stable » ; plus large, on dit « trop de variations pour trancher ». */
const PRECISION_STABLE_PCT = 5;

/** Garde les courses comparables : à pied, assez longues, avec cardio plausible et dénivelé connu (sauf sur tapis). */
export function sortiesCourse(seances: readonly SeanceCourse[], hrMax: number | null): SortieCourse[] {
  const [bas, haut] = hrMax ? [hrMax * PLAGE_FC_MAX[0], hrMax * PLAGE_FC_MAX[1]] : PLAGE_FC_SANS_MAX;
  const sorties: SortieCourse[] = [];
  for (const s of seances) {
    if (!SPORTS_COURSE.has(s.sport) || s.excl_hr || s.excl_distance) continue;
    const km = Number(s.distance_km);
    const fc = Number(s.avg_heartrate);
    const tapis = s.sport === 'VirtualRun';
    // Sans dénivelé connu, l'allure ne se corrige pas : on écarte la course (sauf sur tapis, où il vaut zéro)
    if (!tapis && s.total_elevation_gain == null) continue;
    if (!(km >= DISTANCE_MINI_KM) || !(s.moving_time >= DUREE_MINI) || !(fc >= bas && fc <= haut)) continue;
    sorties.push({ date: s.start_date_local, allure: s.moving_time / km, fc, denivele: tapis ? 0 : Number(s.total_elevation_gain) / km, tapis });
  }
  return sorties;
}

/** Une course qui a servi au calcul. */
export interface SortieComparee extends SortieCourse {
  /** Vrai pour la période actuelle, faux pour la période d'avant. */
  actuelle: boolean;
  /** Son allure ramenée au cardio et au dénivelé de référence, sur route. */
  ajuste: number;
}

export interface MoyenneBrute {
  allure: number;
  fc: number;
  denivele: number;
  /** Part de courses sur tapis, de 0 à 1. */
  partTapis: number;
}

export interface EstimationCourse {
  /** Allure (s/km) au cardio et au dénivelé de référence, sur route : période d'avant et période actuelle. */
  avant: number;
  actuel: number;
  /** Évolution en % : positive = tu cours plus vite. */
  variationPct: number;
  /** Fourchette de cette évolution, en %. */
  bas: number;
  haut: number;
  nbAvant: number;
  nbActuel: number;
  /** Cardio (bpm) et dénivelé par km (m) auxquels les allures sont ramenées. */
  fcReference: number;
  deniveleReference: number;
  /** L'allure d'une course ramenée au cardio et au dénivelé de référence : sert à tracer le nuage. */
  ajuster: (s: SortieCourse) => number;
  /** Secondes par km en plus (négatif : en moins) pour chaque bpm de cardio en plus : la pente de la régression. Négative : plus le cardio est haut, plus on court vite. */
  pente: number;
  /** Secondes par km perdues par mètre de dénivelé en plus par km. */
  penteDenivele: number;
  /** Écart du tapis par rapport à la route, à cardio et dénivelé égaux, en s/km (0 quand on ne compare qu'un seul terrain). */
  decalageTapis: number;
  sorties: SortieComparee[];
  brut: { avant: MoyenneBrute; actuel: MoyenneBrute };
}

export type RaisonCourse = 'pas-assez' | 'pas-comparable';

/** Les courses qui entrent dans la comparaison : le tapis n'est corrigé que s'il y en a au moins 3 et 3 sur route ; sinon on garde le terrain le plus fréquent. */
function sortiesComparees(sorties: readonly SortieCourse[], actuelle: (date: string) => boolean, avant: (date: string) => boolean): { lignes: SortieCourse[]; nbActuel: number; nbAvant: number } {
  let lignes = sorties.filter((s) => actuelle(s.date) || avant(s.date));
  const tapis = lignes.filter((s) => s.tapis).length;
  const route = lignes.length - tapis;
  if (tapis < SORTIES_MINI_COURSE || route < SORTIES_MINI_COURSE) {
    const garderTapis = tapis > route;
    lignes = lignes.filter((s) => s.tapis === garderTapis);
  }
  const nbActuel = lignes.filter((s) => actuelle(s.date)).length;
  return { lignes, nbActuel, nbAvant: lignes.length - nbActuel };
}

/** Combien de courses comptent dans chaque période (pour dire « 2 sur 3 » quand il en manque). */
export function compterSortiesCourse(sorties: readonly SortieCourse[], actuelle: (date: string) => boolean, avant: (date: string) => boolean): { nbActuel: number; nbAvant: number } {
  const { nbActuel, nbAvant } = sortiesComparees(sorties, actuelle, avant);
  return { nbActuel, nbAvant };
}

/**
 * Compare la période actuelle (`actuelle`) à celle d'avant (`avant`) à cardio et dénivelé égaux.
 * Retourne la raison quand c'est impossible : 'pas-assez' (moins de 3 courses retenues dans une période) ou 'pas-comparable' (par exemple tapis d'un côté et route de l'autre).
 */
export function estimerCourse(sorties: readonly SortieCourse[], actuelle: (date: string) => boolean, avant: (date: string) => boolean): EstimationCourse | RaisonCourse {
  const { lignes, nbActuel, nbAvant } = sortiesComparees(sorties, actuelle, avant);
  if (nbActuel < SORTIES_MINI_COURSE || nbAvant < SORTIES_MINI_COURSE) return 'pas-assez';

  const fcRef = Math.round(mediane(lignes.map((s) => s.fc)));
  const deniveleRef = Math.round(mediane(lignes.map((s) => s.denivele)) * 10) / 10;
  const avecTapis = lignes.some((s) => s.tapis) && lignes.some((s) => !s.tapis);
  const avecFc = new Set(lignes.map((s) => s.fc)).size > 1;
  // Le dénivelé ne se corrige qu'à partir de 8 courses : en dessous, un coefficient de plus se mesurerait n'importe comment
  const avecDenivele = lignes.length >= 8 && new Set(lignes.map((s) => s.denivele)).size > 1;
  // Colonnes : 1, cardio − référence, dénivelé − référence, tapis, période (1 = actuelle) ; chaque colonne n'existe que si elle sert
  const x = lignes.map((s) => [
    1,
    ...(avecFc ? [s.fc - fcRef] : []),
    ...(avecDenivele ? [s.denivele - deniveleRef] : []),
    ...(avecTapis ? [s.tapis ? 1 : 0] : []),
    actuelle(s.date) ? 1 : 0,
  ]);
  const fit = regression(x, lignes.map((s) => s.allure));
  if (!fit) return 'pas-comparable';

  const k = fit.b.length;
  const base = fit.b[0];
  const ecart = fit.b[k - 1]; // en s/km : négatif = plus rapide
  if (!(base > 0)) return 'pas-comparable';
  let colonne = 1;
  const pente = avecFc ? fit.b[colonne++] : 0;
  const penteDenivele = avecDenivele ? fit.b[colonne++] : 0;
  const decalageTapis = avecTapis ? fit.b[colonne] : 0;

  const variationPct = (-ecart / base) * 100;
  const demi = ((Z * fit.se[k - 1]) / base) * 100;
  const arrondi1 = (v: number): number => Math.round(v * 10) / 10;
  const ajuster = (s: SortieCourse): number => s.allure - pente * (s.fc - fcRef) - penteDenivele * (s.denivele - deniveleRef) - (s.tapis ? decalageTapis : 0);
  const moyenne = (liste: SortieCourse[]): MoyenneBrute => ({
    allure: liste.reduce((t, s) => t + s.allure, 0) / liste.length,
    fc: liste.reduce((t, s) => t + s.fc, 0) / liste.length,
    denivele: liste.reduce((t, s) => t + s.denivele, 0) / liste.length,
    partTapis: liste.filter((s) => s.tapis).length / liste.length,
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
    deniveleReference: deniveleRef,
    ajuster,
    pente,
    penteDenivele,
    decalageTapis,
    sorties: lignes
      .map((s) => ({ ...s, actuelle: actuelle(s.date), ajuste: ajuster(s) }))
      .sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0)),
    brut: { avant: moyenne(lignes.filter((s) => !actuelle(s.date))), actuel: moyenne(lignes.filter((s) => actuelle(s.date))) },
  };
}

export type StatutCourse = 'hausse' | 'stable' | 'baisse' | 'incertain';

/** Le verdict d'une estimation : hausse ou baisse seulement si la fourchette exclut zéro ; sinon « stable » si elle est étroite, « incertain » si elle est large. */
export function statutCourse(e: Pick<EstimationCourse, 'variationPct' | 'bas' | 'haut'>): StatutCourse {
  if (e.bas > 0 && e.variationPct >= ECART_MINI_PCT) return 'hausse';
  if (e.haut < 0 && e.variationPct <= -ECART_MINI_PCT) return 'baisse';
  return (e.haut - e.bas) / 2 <= PRECISION_STABLE_PCT ? 'stable' : 'incertain';
}
