// Progression par sport : « est-ce que j'ai progressé ? ». On compare une période à celle d'avant, avec UN indicateur par sport.
// Calculs purs, sans écran (testés dans tests/progression.test.ts).
//   course   : allure des sorties faciles (cardio à 60–80 % du max). Plus basse = mieux.
//   vélo     : watts des sorties faciles (même cardio). Plus haut = mieux.
//   natation : allure au 100 m. Plus basse = mieux.
//   muscu    : 1RM estimé (Epley), moyenne des exercices faits sur les deux périodes. Plus haut = mieux.
import { familleAffichage } from './familles.ts';
import type { Seance, SerieForce } from './types.ts';

export type PeriodeProgression = 28 | 91 | 365;
export const PERIODES_PROGRESSION: readonly { jours: PeriodeProgression; court: string; nom: string }[] = [
  { jours: 28, court: '4 sem.', nom: '4 semaines' },
  { jours: 91, court: '3 mois', nom: '3 mois' },
  { jours: 365, court: '1 an', nom: '1 an' },
];

/** Combien de jours d'historique il faut pour comparer la période choisie à celle d'avant. */
export const JOURS_HISTORIQUE = 365 * 2;

export type Statut = 'hausse' | 'stable' | 'baisse' | 'insuffisant';

export interface Progression {
  famille: string;
  statut: Statut;
  /** Évolution en % : positive = tu as progressé (dans le bon sens pour le sport), négative = tu as reculé. Null si insuffisant. */
  variationPct: number | null;
  indicateur: string;
  /** Valeur de la période d'avant et de la période actuelle, dans l'unité du sport (s/km, s/100 m, W, kg). Null si insuffisant. */
  avant: number | null;
  actuel: number | null;
  unite: 'allure' | 'allure100' | 'watts' | 'kg';
  /** Ce qui manque, en une phrase, quand le statut est « insuffisant ». */
  manque: string;
}

/** En dessous de cet écart (en %), on dit « stable » plutôt que d'annoncer une hausse ou une baisse qui n'en est pas une. */
export const SEUIL_STABLE = 1;

const JOUR = 86_400_000;
const debutJour = (d: Date): number => new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
const jourDe = (iso: string): number => new Date(String(iso).slice(0, 10) + 'T00:00:00').getTime();

/** Une fenêtre de temps : « cette date tombe-t-elle entre `debut` (inclus) et `fin` (exclu) jours avant aujourd'hui ? » (0 = aujourd'hui). */
type Fenetre = (dateIso: string) => boolean;
const fenetre = (aujourdhui: Date, debut: number, fin: number): Fenetre => (dateIso) => {
  const ecart = Math.round((debutJour(aujourdhui) - jourDe(dateIso)) / JOUR);
  return ecart >= debut && ecart < fin;
};

const arrondi1 = (v: number): number => Math.round(v * 10) / 10;

function statutDe(variationPct: number): Statut {
  return Math.abs(variationPct) < SEUIL_STABLE ? 'stable' : variationPct > 0 ? 'hausse' : 'baisse';
}

interface Donnees {
  seances: Seance[];
  series: SerieForce[];
  hrMax: number | null;
}

const SORTIES_MINI = 2; // il faut au moins deux sorties par période : une seule sortie ne dit rien (météo, forme du jour)

/** Un indicateur mesuré d'un seul bloc sur une fenêtre (course, vélo, natation) : sa valeur et le nombre de séances retenues. */
interface Mesure {
  valeur: number;
  n: number;
}

interface Scalaire {
  indicateur: string;
  unite: Progression['unite'];
  /** Une valeur plus basse est un progrès (une allure) ; sinon plus haute (des watts). */
  plusBasMieux: boolean;
  manque: string;
  mesure: (donnees: Donnees, dans: Fenetre) => Mesure | null;
}

/** La plage de cardio des sorties « faciles » : 60 à 80 % de la FC max (125 à 155 bpm sans FC max). */
const plageFacile = (hrMax: number | null): [number, number] => (hrMax ? [hrMax * 0.6, hrMax * 0.8] : [125, 155]);

const SCALAIRES: Record<string, Scalaire> = {
  course: {
    indicateur: 'Allure à cardio égal', unite: 'allure', plusBasMieux: true,
    manque: 'Il faut au moins 2 sorties faciles de 3 km avec cardio sur chaque période.',
    mesure: ({ seances, hrMax }, dans) => {
      const [bas, haut] = plageFacile(hrMax);
      let temps = 0, km = 0, n = 0;
      for (const s of seances) {
        if (familleAffichage(s.sport) !== 'course' || !((s.distance_km ?? 0) >= 3) || !(s.moving_time > 0)) continue;
        const fc = Number(s.avg_heartrate);
        if (!(fc >= bas && fc <= haut) || !dans(s.start_date_local)) continue;
        temps += s.moving_time;
        km += Number(s.distance_km);
        n += 1;
      }
      return n ? { valeur: temps / km, n } : null;
    },
  },
  velo: {
    indicateur: 'Watts à cardio égal', unite: 'watts', plusBasMieux: false,
    manque: 'Il faut au moins 2 sorties faciles de 20 min avec puissance et cardio sur chaque période.',
    mesure: ({ seances, hrMax }, dans) => {
      const [bas, haut] = plageFacile(hrMax);
      let temps = 0, wattsTemps = 0, n = 0;
      for (const s of seances) {
        const watts = Number(s.avg_watts);
        const fc = Number(s.avg_heartrate);
        if (familleAffichage(s.sport) !== 'velo' || !(watts > 0) || !(s.moving_time >= 1200) || !(fc >= bas && fc <= haut) || !dans(s.start_date_local)) continue;
        temps += s.moving_time;
        wattsTemps += watts * s.moving_time;
        n += 1;
      }
      return n ? { valeur: wattsTemps / temps, n } : null;
    },
  },
  natation: {
    indicateur: 'Allure au 100 m', unite: 'allure100', plusBasMieux: true,
    manque: 'Il faut au moins 2 séances de 300 m ou plus sur chaque période.',
    mesure: ({ seances }, dans) => {
      let temps = 0, km = 0, n = 0;
      for (const s of seances) {
        // Sous 300 m, l'allure n'est pas fiable (départs, plongeons, repos) : même seuil que les widgets de natation
        if (familleAffichage(s.sport) !== 'natation' || !((s.distance_km ?? 0) >= 0.3) || !(s.moving_time > 0) || !dans(s.start_date_local)) continue;
        temps += s.moving_time;
        km += Number(s.distance_km);
        n += 1;
      }
      return n ? { valeur: temps / (km * 10), n } : null;
    },
  },
};

function insuffisant(famille: string, indicateur: string, unite: Progression['unite'], manque: string): Progression {
  return { famille, statut: 'insuffisant', variationPct: null, indicateur, avant: null, actuel: null, unite, manque };
}

/** Comparaison de deux valeurs ; `plusBasMieux` : une allure qui baisse est une progression. */
function comparer(famille: string, indicateur: string, unite: Progression['unite'], avant: number, actuel: number, plusBasMieux: boolean): Progression {
  const brut = ((actuel - avant) / avant) * 100;
  const variationPct = arrondi1(plusBasMieux ? -brut : brut);
  return { famille, statut: statutDe(variationPct), variationPct, indicateur, avant, actuel, unite, manque: '' };
}

// --- Musculation ----------------------------------------------------------------------------------------------------------

const epley = (poids: number, reps: number): number => poids * (1 + reps / 30);
const INDICATEUR_MUSCU = '1RM estimé';

/** Meilleur 1RM estimé de chaque exercice sur une fenêtre (séries de 1 à 12 répétitions, plus fiables). */
function meilleursMuscu(series: SerieForce[], dans: Fenetre): Map<string, number> {
  const meilleurs = new Map<string, number>();
  for (const s of series) {
    const poids = Number(s.weight_kg);
    const reps = Number(s.reps);
    if (!(poids > 0) || !(reps >= 1 && reps <= 12) || !dans(s.date)) continue;
    const e = epley(poids, reps);
    if (e > (meilleurs.get(s.exercise_key) ?? 0)) meilleurs.set(s.exercise_key, e);
  }
  return meilleurs;
}

function progressionMuscu(series: SerieForce[], jours: number, aujourdhui: Date): Progression {
  const actuel = meilleursMuscu(series, fenetre(aujourdhui, 0, jours));
  const avant = meilleursMuscu(series, fenetre(aujourdhui, jours, jours * 2));
  // Seuls comptent les exercices faits sur les deux périodes : on compare du comparable
  const communs = [...actuel.keys()].filter((cle) => avant.has(cle));
  if (!communs.length) return insuffisant('muscu', INDICATEUR_MUSCU, 'kg', 'Il faut au moins un exercice (1 à 12 répétitions) fait sur chaque période.');
  const moyenne = (m: Map<string, number>): number => communs.reduce((somme, cle) => somme + m.get(cle)!, 0) / communs.length;
  return comparer('muscu', INDICATEUR_MUSCU, 'kg', moyenne(avant), moyenne(actuel), false);
}


// --- Courbe -------------------------------------------------------------------------------------------------------------

/** Combien de points a la courbe selon la période : une semaine par point sur 4 semaines, deux semaines sur 3 mois, un mois sur 1 an. */
const POINTS_COURBE: Record<PeriodeProgression, number> = { 28: 4, 91: 6, 365: 12 };

/**
 * La courbe d'un sport sur la période choisie, en indice : 100 = ton niveau de la période d'avant, au-dessus = tu as progressé (quel que soit le sens
 * de l'indicateur : une allure plus basse monte sur la courbe). Chaque point résume un morceau de la période ; un morceau sans séance comparable est sauté.
 * Vide (moins de deux points, ou pas de niveau de référence) : pas de courbe à tracer.
 */
export function courbeProgression(famille: string, donnees: Donnees, jours: PeriodeProgression, aujourdhui: Date = new Date()): number[] {
  const n = POINTS_COURBE[jours];
  const morceau = jours / n;
  const bornes = Array.from({ length: n }, (_, i) => [Math.round(jours - (i + 1) * morceau), Math.round(jours - i * morceau)] as const); // du plus ancien au plus récent
  const points: number[] = [];

  if (famille === 'muscu') {
    const reference = meilleursMuscu(donnees.series, fenetre(aujourdhui, jours, jours * 2));
    for (const [debut, fin] of bornes) {
      const m = meilleursMuscu(donnees.series, fenetre(aujourdhui, debut, fin));
      const rapports = [...m.entries()].filter(([cle]) => reference.has(cle)).map(([cle, v]) => v / reference.get(cle)!);
      if (rapports.length) points.push(arrondi1((rapports.reduce((a, b) => a + b, 0) / rapports.length) * 100));
    }
  } else {
    const sc = SCALAIRES[famille];
    const reference = sc?.mesure(donnees, fenetre(aujourdhui, jours, jours * 2));
    if (!sc || !reference || reference.n < SORTIES_MINI) return [];
    for (const [debut, fin] of bornes) {
      const m = sc.mesure(donnees, fenetre(aujourdhui, debut, fin));
      if (m) points.push(arrondi1((sc.plusBasMieux ? reference.valeur / m.valeur : m.valeur / reference.valeur) * 100));
    }
  }
  return points.length >= 2 ? points : [];
}

// --- Assemblage -----------------------------------------------------------------------------------------------------------

/** Les sports pour lesquels on sait mesurer une progression. Les autres (Hyrox, ski…) n'apparaissent pas : mieux vaut rien qu'une note inventée. */
export const SPORTS_PROGRESSION: readonly string[] = ['course', 'velo', 'natation', 'muscu'];

/** La progression d'un sport sur la période choisie, comparée à la période d'avant. Null pour un sport qu'on ne sait pas mesurer. */
export function progressionSport(
  famille: string,
  donnees: Donnees,
  jours: PeriodeProgression,
  aujourdhui: Date = new Date(),
): Progression | null {
  if (famille === 'muscu') return progressionMuscu(donnees.series, jours, aujourdhui);
  const sc = SCALAIRES[famille];
  if (!sc) return null;
  const actuel = sc.mesure(donnees, fenetre(aujourdhui, 0, jours));
  const avant = sc.mesure(donnees, fenetre(aujourdhui, jours, jours * 2));
  if (!actuel || !avant || actuel.n < SORTIES_MINI || avant.n < SORTIES_MINI) return insuffisant(famille, sc.indicateur, sc.unite, sc.manque);
  return comparer(famille, sc.indicateur, sc.unite, avant.valeur, actuel.valeur, sc.plusBasMieux);
}

/** La progression de chaque sport mesurable que l'utilisateur pratique (`familles`), dans l'ordre de `SPORTS_PROGRESSION`. */
export function progressionTousSports(
  familles: readonly string[],
  donnees: Donnees,
  jours: PeriodeProgression,
  aujourdhui: Date = new Date(),
): Progression[] {
  return SPORTS_PROGRESSION.filter((f) => familles.includes(f)).map((f) => progressionSport(f, donnees, jours, aujourdhui)!);
}
