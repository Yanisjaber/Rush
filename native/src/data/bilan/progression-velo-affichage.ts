// Ce que l'écran Progrès du vélo dessine, calculé sans écran : la cascade « de l'écart brut à l'écart à cardio égal », l'échelle de la fourchette et la
// géométrie du nuage de sorties. Testé dans tests/bilan/progression-velo-affichage.test.ts.
import { formatNum } from '../outils/format.ts';
import type { EstimationVelo } from './progression-velo.ts';

// --- Cascade ----------------------------------------------------------------------------------------------------------------

export interface EtapeCascade {
  cle: 'brut' | 'cardio' | 'salle' | 'final';
  nom: string;
  /** Ce qui a changé, en une ligne (« moyenne 173 W → 139 W »). */
  detail: string;
  /** L'écart de cette étape, en watts. */
  watts: number;
  /** Les deux bouts de la barre sur l'axe des watts : la cascade enchaîne les étapes, la dernière repart de zéro. */
  de: number;
  a: number;
  total: boolean;
}

/**
 * De l'écart brut (la différence des moyennes de watts) à l'écart à cardio égal : on retire ce qui vient d'un cardio plus haut ou plus bas, puis du
 * home-trainer. Les trois premiers chiffres s'additionnent exactement au dernier (c'est une propriété de la régression avec ordonnée à l'origine).
 * L'étape « home-trainer » n'existe que si on a pu mesurer son écart.
 */
export function cascadeVelo(e: EstimationVelo): EtapeCascade[] {
  const { avant, actuel } = e.brut;
  const brut = actuel.watts - avant.watts;
  const cardio = -e.pente * (actuel.fc - avant.fc);
  const salle = -e.decalageInterieur * (actuel.partSalle - avant.partSalle);
  const etapes: Omit<EtapeCascade, 'de' | 'a'>[] = [
    { cle: 'brut', nom: 'Écart brut', detail: `moyenne ${formatNum(avant.watts)} W → ${formatNum(actuel.watts)} W`, watts: brut, total: false },
    { cle: 'cardio', nom: 'Cardio différent', detail: `cardio moyen ${formatNum(avant.fc)} → ${formatNum(actuel.fc)} bpm`, watts: cardio, total: false },
  ];
  if (e.decalageInterieur !== 0) {
    etapes.push({ cle: 'salle', nom: 'Home-trainer', detail: `sorties en salle : ${formatNum(avant.partSalle * 100)} % → ${formatNum(actuel.partSalle * 100)} %`, watts: salle, total: false });
  }
  etapes.push({ cle: 'final', nom: 'À cardio égal', detail: `${formatNum(e.variationPct, 1)} % de ${formatNum(e.avant)} W`, watts: e.actuel - e.avant, total: true });
  let cumul = 0;
  return etapes.map((etape) => {
    if (etape.total) return { ...etape, de: 0, a: etape.watts };
    const de = cumul;
    cumul += etape.watts;
    return { ...etape, de, a: cumul };
  });
}

// --- Fourchette -------------------------------------------------------------------------------------------------------------

/** La demi-largeur de la règle de la fourchette (en %) : de quoi voir toute la fourchette avec un peu d'air, par pas de 5, entre 15 et 60. */
export function echelleFourchette(bas: number, haut: number): number {
  return Math.min(60, Math.max(15, Math.ceil((Math.max(Math.abs(bas), Math.abs(haut)) + 3) / 5) * 5));
}

// --- Nuage de sorties -------------------------------------------------------------------------------------------------------

/** Des graduations rondes (pas de 5, 10, 20, 25, 50…) qui tiennent en `max` reperes entre `min` et `max`. */
export function graduations(min: number, max: number, nombreMax: number): number[] {
  const pas = [5, 10, 20, 25, 50, 100, 200, 250, 500, 1000].find((p) => Math.floor(max / p) - Math.ceil(min / p) + 1 <= nombreMax) ?? 1000;
  const reperes: number[] = [];
  for (let v = Math.ceil(min / pas) * pas; v <= max; v += pas) reperes.push(v);
  return reperes;
}

export interface GeometrieNuage {
  /** Les bornes de l'axe du cardio (bpm) et de celui des watts. */
  x0: number;
  x1: number;
  y0: number;
  y1: number;
  reperesX: number[];
  reperesY: number[];
  /** Les deux droites parallèles, d'un bord à l'autre de l'axe du cardio : celle d'avant et celle de maintenant. */
  droiteAvant: { de: number; a: number };
  droiteActuelle: { de: number; a: number };
  /** Les watts des deux droites au cardio de référence : leur écart est l'évolution à cardio égal. */
  auReference: { avant: number; actuel: number };
}

export function geometrieNuage(e: EstimationVelo): GeometrieNuage {
  const fcs = e.sorties.map((s) => s.fc);
  const ws = e.sorties.map((s) => s.watts);
  const x0 = Math.floor((Math.min(...fcs) - 4) / 5) * 5;
  const x1 = Math.ceil((Math.max(...fcs) + 4) / 5) * 5;
  const droite = (x: number, decalage: number): number => e.avant + e.pente * (x - e.fcReference) + decalage;
  const ecart = e.actuel - e.avant;
  const droiteAvant = { de: droite(x0, 0), a: droite(x1, 0) };
  const droiteActuelle = { de: droite(x0, ecart), a: droite(x1, ecart) };
  const bas = Math.min(...ws, droiteAvant.de, droiteAvant.a, droiteActuelle.de, droiteActuelle.a) - 10;
  const hautDroites = Math.max(...ws, droiteAvant.de, droiteAvant.a, droiteActuelle.de, droiteActuelle.a) + 10;
  const y0 = Math.floor(bas / 25) * 25;
  const y1 = Math.ceil(hautDroites / 25) * 25;
  return {
    x0, x1, y0, y1,
    reperesX: graduations(x0, x1, 5),
    reperesY: graduations(y0, y1, 5),
    droiteAvant, droiteActuelle,
    auReference: { avant: e.avant, actuel: e.actuel },
  };
}
