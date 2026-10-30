// Progression par sport : « est-ce que j'ai progressé ? ». On compare une période à celle d'avant, avec UN indicateur par sport.
// Calculs purs, sans écran (testés dans tests/progression.test.ts).
//   course   : allure à cardio et dénivelé égaux, par régression avec fourchette (voir progression-course.ts). Plus basse = mieux.
//   vélo     : watts à cardio égal, par régression avec fourchette (voir progression-velo.ts). Plus haut = mieux.
//   natation : allure au 100 m. Plus basse = mieux.
//   muscu    : 1RM estimé (Epley), moyenne des exercices faits sur les deux périodes. Plus haut = mieux.
import { familleAffichage } from '../sports/familles.ts';
import type { Seance, SerieForce } from '../types.ts';
import { compterSortiesCourse, estimerCourse, sortiesCourse, statutCourse, type EstimationCourse, type RaisonCourse } from './progression-course.ts';
import { compterSortiesVelo, estimerVelo, sortiesVelo, statutVelo, type EstimationVelo, type RaisonVelo } from './progression-velo.ts';

export type PeriodeProgression = 28 | 91 | 365;
export const PERIODES_PROGRESSION: readonly { jours: PeriodeProgression; court: string; nom: string }[] = [
  { jours: 28, court: '4 sem.', nom: '4 semaines' },
  { jours: 91, court: '3 mois', nom: '3 mois' },
  { jours: 365, court: '1 an', nom: '1 an' },
];

/** Combien de jours d'historique il faut pour comparer la période choisie à celle d'avant. */
export const JOURS_HISTORIQUE = 365 * 2;

/** `incertain` : on a assez de sorties, mais elles varient trop pour trancher entre progrès, stable et recul. */
export type Statut = 'hausse' | 'stable' | 'baisse' | 'incertain' | 'insuffisant';

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
  /** La fourchette de l'évolution en % (vélo seulement) : le vrai écart est dans cet intervalle. */
  intervalle?: { bas: number; haut: number };
  /** Combien de séances retenues dans la période actuelle et dans celle d'avant (vélo seulement). */
  nbActuel?: number;
  nbAvant?: number;
  /** Le cardio (bpm) auquel les watts sont ramenés (vélo seulement). */
  fcReference?: number;
  /** Tout le détail du calcul vélo : sorties retenues, pente, écart du home-trainer, moyennes brutes. */
  detailVelo?: EstimationVelo;
  /** Tout le détail du calcul course : courses retenues, pentes, moyennes brutes. */
  detailCourse?: EstimationCourse;
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

const SCALAIRES: Record<string, Scalaire> = {
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

// --- Course ------------------------------------------------------------------------------------------------------------------

const INDICATEUR_COURSE = 'Allure à cardio égal';
const MANQUE_COURSE: Record<RaisonCourse, string> = {
  'pas-assez': 'Il faut au moins 3 courses de 3 km avec cardio sur chaque période.',
  'pas-comparable': "Tes courses de cette période et de celle d'avant ne sont pas comparables (tapis d'un côté, route de l'autre).",
};

function progressionCourse({ seances, hrMax }: Donnees, jours: number, aujourdhui: Date): Progression {
  const sorties = sortiesCourse(seances, hrMax);
  const actuelle = fenetre(aujourdhui, 0, jours);
  const avant = fenetre(aujourdhui, jours, jours * 2);
  const e = estimerCourse(sorties, actuelle, avant);
  if (typeof e === 'string') return { ...insuffisant('course', INDICATEUR_COURSE, 'allure', MANQUE_COURSE[e]), ...compterSortiesCourse(sorties, actuelle, avant) };
  return {
    famille: 'course', statut: statutCourse(e), variationPct: e.variationPct, indicateur: INDICATEUR_COURSE, avant: e.avant, actuel: e.actuel, unite: 'allure', manque: '',
    intervalle: { bas: e.bas, haut: e.haut }, nbActuel: e.nbActuel, nbAvant: e.nbAvant, fcReference: e.fcReference, detailCourse: e,
  };
}

// --- Vélo -------------------------------------------------------------------------------------------------------------------

const INDICATEUR_VELO = 'Watts à cardio égal';
const MANQUE_VELO: Record<RaisonVelo, string> = {
  'pas-assez': 'Il faut au moins 3 sorties de 20 min avec capteur de puissance et cardio sur chaque période.',
  'pas-comparable': "Tes sorties de cette période et de celle d'avant ne sont pas comparables (home-trainer d'un côté, route de l'autre).",
};

function progressionVelo({ seances, hrMax }: Donnees, jours: number, aujourdhui: Date): Progression {
  const sorties = sortiesVelo(seances, hrMax);
  const actuelle = fenetre(aujourdhui, 0, jours);
  const avant = fenetre(aujourdhui, jours, jours * 2);
  const e = estimerVelo(sorties, actuelle, avant);
  if (typeof e === 'string') return { ...insuffisant('velo', INDICATEUR_VELO, 'watts', MANQUE_VELO[e]), ...compterSortiesVelo(sorties, actuelle, avant) };
  return {
    famille: 'velo', statut: statutVelo(e), variationPct: e.variationPct, indicateur: INDICATEUR_VELO, avant: e.avant, actuel: e.actuel, unite: 'watts', manque: '',
    intervalle: { bas: e.bas, haut: e.haut }, nbActuel: e.nbActuel, nbAvant: e.nbAvant, fcReference: e.fcReference, detailVelo: e,
  };
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
  } else if (famille === 'course') {
    const sorties = sortiesCourse(donnees.seances, donnees.hrMax);
    const e = estimerCourse(sorties, fenetre(aujourdhui, 0, jours), fenetre(aujourdhui, jours, jours * 2));
    if (typeof e === 'string') return [];
    // Les allures de chaque course sont ramenées au même cardio et au même dénivelé ; un morceau compte à partir de 2 courses, en indice sur la période d'avant (plus rapide = plus haut)
    for (const [debut, fin] of bornes) {
      const dans = fenetre(aujourdhui, debut, fin);
      const morceauSorties = sorties.filter((s) => dans(s.date));
      if (morceauSorties.length >= 2) points.push(arrondi1((e.avant / (morceauSorties.reduce((somme, s) => somme + e.ajuster(s), 0) / morceauSorties.length)) * 100));
    }
  } else if (famille === 'velo') {
    const sorties = sortiesVelo(donnees.seances, donnees.hrMax);
    const e = estimerVelo(sorties, fenetre(aujourdhui, 0, jours), fenetre(aujourdhui, jours, jours * 2));
    if (typeof e === 'string') return [];
    // Les watts de chaque sortie sont ramenés au même cardio et à l'extérieur ; un morceau compte à partir de 2 sorties, en indice sur la période d'avant
    const reference = e.avant;
    for (const [debut, fin] of bornes) {
      const dans = fenetre(aujourdhui, debut, fin);
      const morceauSorties = sorties.filter((s) => dans(s.date));
      if (morceauSorties.length >= 2) points.push(arrondi1((morceauSorties.reduce((somme, s) => somme + e.ajuster(s), 0) / morceauSorties.length / reference) * 100));
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
  if (famille === 'velo') return progressionVelo(donnees, jours, aujourdhui);
  if (famille === 'course') return progressionCourse(donnees, jours, aujourdhui);
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
