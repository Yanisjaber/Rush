// Ce que l'écran Progrès de la course dessine, calculé sans écran : la cascade « de l'écart brut à l'écart à cardio égal », et la géométrie du nuage de courses.
// Testé dans tests/bilan/progression-course-affichage.test.ts. L'échelle de la fourchette est celle du vélo (progression-velo-affichage.ts).
import { formatAllure, formatNum } from '../outils/format.ts';
import type { EstimationCourse } from './progression-course.ts';

// --- Cascade ----------------------------------------------------------------------------------------------------------------

export interface EtapeCascadeCourse {
  cle: 'brut' | 'cardio' | 'denivele' | 'tapis' | 'final';
  nom: string;
  /** Ce qui a changé, en une ligne (« allure moyenne 5'22"/km → 5'12"/km »). */
  detail: string;
  /** Secondes par km GAGNÉES (positif : plus rapide, comme un progrès ; négatif : plus lent). */
  secondes: number;
  /** Les deux bouts de la barre sur l'axe : la cascade enchaîne les étapes, la dernière repart de zéro. */
  de: number;
  a: number;
  total: boolean;
}

/**
 * De l'écart brut (la différence des allures moyennes) à l'écart à cardio et dénivelé égaux : on retire ce qui vient d'un cardio plus haut, d'un parcours
 * plus ou moins vallonné, puis du tapis. Les étapes s'additionnent exactement au dernier chiffre (propriété de la régression avec ordonnée à l'origine).
 * Les étapes dénivelé et tapis n'existent que si on a pu mesurer leur effet.
 */
export function cascadeCourse(e: EstimationCourse): EtapeCascadeCourse[] {
  const { avant, actuel } = e.brut;
  const brut = avant.allure - actuel.allure;
  const cardio = e.pente * (actuel.fc - avant.fc);
  const denivele = e.penteDenivele * (actuel.denivele - avant.denivele);
  const tapis = e.decalageTapis * (actuel.partTapis - avant.partTapis);
  const etapes: Omit<EtapeCascadeCourse, 'de' | 'a'>[] = [
    { cle: 'brut', nom: 'Écart brut', detail: `allure moyenne ${formatAllure(avant.allure)} → ${formatAllure(actuel.allure)}`, secondes: brut, total: false },
    { cle: 'cardio', nom: 'Cardio différent', detail: `cardio moyen ${formatNum(avant.fc)} → ${formatNum(actuel.fc)} bpm`, secondes: cardio, total: false },
  ];
  if (e.penteDenivele !== 0) {
    etapes.push({ cle: 'denivele', nom: 'Dénivelé différent', detail: `dénivelé ${formatNum(avant.denivele, 1)} → ${formatNum(actuel.denivele, 1)} m par km`, secondes: denivele, total: false });
  }
  if (e.decalageTapis !== 0) {
    etapes.push({ cle: 'tapis', nom: 'Tapis', detail: `courses sur tapis : ${formatNum(avant.partTapis * 100)} % → ${formatNum(actuel.partTapis * 100)} %`, secondes: tapis, total: false });
  }
  etapes.push({ cle: 'final', nom: 'À cardio et dénivelé égaux', detail: `${formatNum(e.variationPct, 1)} % sur ${formatAllure(e.avant)}`, secondes: e.avant - e.actuel, total: true });
  let cumul = 0;
  return etapes.map((etape) => {
    if (etape.total) return { ...etape, de: 0, a: etape.secondes };
    const de = cumul;
    cumul += etape.secondes;
    return { ...etape, de, a: cumul };
  });
}

// --- Nuage de courses -------------------------------------------------------------------------------------------------------

/** Des graduations rondes en secondes (pas de 5, 10, 15, 20, 30, 60…) qui tiennent en `nombreMax` repères entre `min` et `max`. */
export function graduationsAllure(min: number, max: number, nombreMax: number): number[] {
  const pas = [5, 10, 15, 20, 30, 60, 120, 300, 600, 1200, 3600].find((p) => Math.floor(max / p) - Math.ceil(min / p) + 1 <= nombreMax) ?? 3600;
  const reperes: number[] = [];
  for (let v = Math.ceil(min / pas) * pas; v <= max; v += pas) reperes.push(v);
  return reperes;
}

/** L'allure d'une course ramenée au dénivelé de référence (mais pas au cardio : le cardio est l'axe du nuage), pour qu'elle se compare aux droites. */
export function allureAuDenivele(e: EstimationCourse, s: { allure: number; denivele: number }): number {
  return s.allure - e.penteDenivele * (s.denivele - e.deniveleReference);
}

export interface GeometrieNuageCourse {
  /** Axe du cardio (bpm). */
  x0: number;
  x1: number;
  /** Axe des allures (s/km) : `rapide` est la borne de la course la plus rapide (en haut du dessin), `lent` la plus lente (en bas). */
  rapide: number;
  lent: number;
  reperesX: number[];
  reperesY: number[];
  /** Les deux droites parallèles, d'un bord à l'autre de l'axe du cardio : celle d'avant et celle de maintenant (allures en s/km). */
  droiteAvant: { de: number; a: number };
  droiteActuelle: { de: number; a: number };
  /** Les allures des deux droites au cardio de référence. */
  auReference: { avant: number; actuel: number };
}

export function geometrieNuageCourse(e: EstimationCourse): GeometrieNuageCourse {
  const fcs = e.sorties.map((s) => s.fc);
  const allures = e.sorties.map((s) => allureAuDenivele(e, s));
  const x0 = Math.floor((Math.min(...fcs) - 4) / 5) * 5;
  const x1 = Math.ceil((Math.max(...fcs) + 4) / 5) * 5;
  const droite = (x: number, decalage: number): number => e.avant + e.pente * (x - e.fcReference) + decalage;
  const ecart = e.actuel - e.avant;
  const droiteAvant = { de: droite(x0, 0), a: droite(x1, 0) };
  const droiteActuelle = { de: droite(x0, ecart), a: droite(x1, ecart) };
  const tout = [...allures, droiteAvant.de, droiteAvant.a, droiteActuelle.de, droiteActuelle.a];
  const rapide = Math.floor((Math.min(...tout) - 8) / 15) * 15;
  const lent = Math.ceil((Math.max(...tout) + 8) / 15) * 15;
  return {
    x0, x1, rapide, lent,
    reperesX: graduationsAllure(x0, x1, 5).length >= 2 ? graduationsAllure(x0, x1, 5) : [x0, x1],
    reperesY: graduationsAllure(rapide, lent, 5),
    droiteAvant, droiteActuelle,
    auReference: { avant: e.avant, actuel: e.actuel },
  };
}
