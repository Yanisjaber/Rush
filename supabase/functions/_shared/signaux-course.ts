// ============================================================
// Les courbes de la course à pied (Bilan › Records › Course) : pour chaque distance ou chaque durée, la meilleure valeur d'une séance.
//  - pace : le meilleur TEMPS (en secondes) sur chaque distance (400 m, 1 km, 1 mile, 3 km, 5 km, 10 km, 15 km, 20 km, semi, 30 km, marathon), clé = distance en mètres
//  - dis  : la meilleure DISTANCE (en mètres) sur chaque durée (1 min à 3 h), clé = durée en secondes
//  - fc   : la meilleure fréquence cardiaque moyenne (bpm) sur chaque durée, clé = durée en secondes
// Fonctions pures, sans réseau ni Deno : le même code tourne dans l'Edge Function et dans les tests.
// Les vitesses impossibles (un saut de GPS) sont écartées : jamais plus de 9,5 m/s sur moins de 1 km (le record du monde du 400 m est à 9,1 m/s), 8,5 m/s sur 1 km ou plus (record du 1 000 m : 7,9 m/s).
// ============================================================
import { reechantillonner1Hz } from './flux.ts';
import { medianeGlissante, meilleureMoyenne, reechantillonnerContinu, type CourbeSignal } from './signaux.ts';

/** À augmenter quand les distances, les durées ou les calculs changent : les anciennes courses sont alors recalculées (la version du vélo est dans signaux.ts, c'est un autre nombre). */
export const SIGNAUX_COURSE_VERSION = 11;

/** Les distances (mètres) des meilleurs temps : 400 m, 1 km, 1 mile, 3 km, 5 km, 10 km, 15 km, 20 km, semi-marathon, 30 km, marathon. */
export const DISTANCES_COURSE = [400, 1000, 1609, 3000, 5000, 10000, 15000, 20000, 21097, 30000, 42195];
/** Les durées (secondes) de la meilleure distance et de la FC : 1, 3, 5, 6, 7, 10, 12, 15, 20, 30, 40, 50 minutes, 1 h, 1 h 30, 2 h, 3 h. */
export const DUREES_COURSE = [60, 180, 300, 360, 420, 600, 720, 900, 1200, 1800, 2400, 3000, 3600, 5400, 7200, 10800];

const VITESSE_MAX_COURTE = 9.5;
const VITESSE_MAX_LONGUE = 8.5;
/** Un saut de GPS donne 60 à 70 m en une seconde (vu dans l'historique) : au-delà de cette vitesse instantanée (m/s, soit 43 km/h), un pas de distance est une erreur de GPS, pas de la course. */
const PAS_MAX_CREDIBLE = 12;
const vitesseMax = (metres: number): number => (metres < 1000 ? VITESSE_MAX_COURTE : VITESSE_MAX_LONGUE);

const FC_MAX_CREDIBLE = 215;
const FC_MIN_CREDIBLE = 30;
/** Le filtre de l'altitude (comme pour le vélo) : sert à la VAM et à la descente. */
const FILTRE_ALTITUDE_S = 15;

export interface FluxCourse {
  time?: any[];
  distance?: any[];
  heartrate?: any[];
  altitude?: any[];
}

export interface CourbesCourse {
  v: number;
  pace?: CourbeSignal;
  dis?: CourbeSignal;
  fc?: CourbeSignal;
}

const arrondi = (x: number, decimales: number): number => {
  const k = 10 ** decimales;
  return Math.round(x * k) / k;
};

/**
 * Le meilleur temps (secondes) sur chaque distance (mètres) : la plus courte fenêtre qui couvre au moins la distance, avec la fraction de seconde (la distance est interpolée entre deux secondes).
 * `distance` : le cumul à 1 point par seconde (mètres). Une distance plus longue que la sortie est absente ; une fenêtre trop rapide pour être humaine est écartée.
 */
export function meilleursTemps(distance: number[], distances: number[]): CourbeSignal {
  const n = distance.length;
  const sortie: CourbeSignal = {};
  if (n < 2) return sortie;
  for (const L of distances) {
    if (distance[n - 1] - distance[0] < L) continue;
    let meilleur = Infinity;
    let j = 1;
    for (let i = 0; i < n - 1; i++) {
      if (j <= i) j = i + 1;
      while (j < n && distance[j] - distance[i] < L) j++;
      if (j >= n) break;
      // Entre la seconde j - 1 et j, le coureur franchit la distance : on place le franchissement à la fraction de seconde
      const avant = distance[j - 1] - distance[i];
      const pas = distance[j] - distance[j - 1];
      const t = j - 1 - i + (pas > 0 ? (L - avant) / pas : 1);
      if (t > 0 && t < meilleur && L / t <= vitesseMax(L)) meilleur = t;
    }
    if (Number.isFinite(meilleur)) sortie[String(L)] = arrondi(meilleur, 1);
  }
  return sortie;
}

/** La meilleure distance (mètres) sur chaque durée (secondes) ; une fenêtre trop rapide pour être humaine est écartée. */
export function meilleuresDistances(distance: number[], durees: number[]): CourbeSignal {
  const n = distance.length;
  const sortie: CourbeSignal = {};
  for (const d of durees) {
    if (d >= n) continue;
    let meilleure = 0;
    for (let i = 0; i + d < n; i++) {
      const gain = distance[i + d] - distance[i];
      if (gain > meilleure && gain / d <= vitesseMax(gain)) meilleure = gain;
    }
    if (meilleure > 0) sortie[String(d)] = Math.round(meilleure);
  }
  return sortie;
}

/** Un trou de ce nombre de secondes ou moins est un enregistrement « intelligent » (un point toutes les 2 à 4 s) : on interpole. Au-delà, c'est une pause : elle est retirée. */
const TROU_MAX_S = 10;

/**
 * Le cumul de distance à 1 point par seconde de COURSE : entre deux points, la distance est interpolée seconde par seconde ; un trou de plus de 10 s (pause) compte pour une seule seconde.
 * Sans flux `time` exploitable (absent, longueur différente), le cumul est rendu tel quel.
 */
export function distanceEnMouvement(distance: any[], temps: any[]): number[] {
  const d = (distance || []).map((x) => (Number.isFinite(Number(x)) && x != null ? Number(x) : NaN));
  if (d.length < 2 || !Array.isArray(temps) || temps.length !== d.length) return d.map((x) => (Number.isFinite(x) ? x : 0));
  const t = temps.map((x) => Number(x));
  const sortie: number[] = [];
  let derniere = d.find((x) => Number.isFinite(x)) ?? 0;
  sortie.push(derniere);
  for (let i = 0; i + 1 < d.length; i++) {
    const dt = Math.round(t[i + 1] - t[i]);
    const suivante = Number.isFinite(d[i + 1]) ? d[i + 1] : derniere;
    if (!Number.isFinite(dt) || dt <= 0) continue;
    if (dt <= TROU_MAX_S) for (let k = 1; k <= dt; k++) sortie.push(derniere + ((suivante - derniere) * k) / dt);
    else sortie.push(suivante);
    derniere = suivante;
  }
  return sortie;
}

/**
 * Le cumul de distance sans les sauts de GPS : un pas (distance gagnée en une seconde) impossible (plus de 12 m/s, ou négatif) est remplacé par la médiane des 10 pas d'avant (0 au tout début).
 * Sans cela, un seul saut de 60 m donne un « 400 m en 42 secondes » qui n'a jamais existé.
 */
export function distanceSansSauts(distance: number[]): number[] {
  const sortie: number[] = distance.length ? [distance[0]] : [];
  const pas: number[] = [];
  for (let i = 1; i < distance.length; i++) {
    let v = distance[i] - distance[i - 1];
    if (!(v >= 0 && v <= PAS_MAX_CREDIBLE)) {
      const recents = pas.slice(-10).sort((a, b) => a - b);
      v = recents.length ? recents[Math.floor(recents.length / 2)] : 0;
    }
    pas.push(v);
    sortie.push(sortie[i - 1] + v);
  }
  return sortie;
}

/** Les courbes d'une course. Un signal sans donnée (pas de GPS, pas de cardio) est absent du résultat. */
export function calculerSignauxCourse(flux: FluxCourse): CourbesCourse {
  const temps = flux.time || [];
  const resultat: CourbesCourse = { v: SIGNAUX_COURSE_VERSION };
  if (flux.distance?.length) {
    // Le cumul de distance en temps de course : une pause (un trou de plus de 10 s) est retirée, un meilleur temps ne compte pas le feu rouge
    const dist = distanceSansSauts(distanceEnMouvement(flux.distance, temps));
    const pace = meilleursTemps(dist, DISTANCES_COURSE);
    if (Object.keys(pace).length) resultat.pace = pace;
    const dis = meilleuresDistances(dist, DUREES_COURSE);
    if (Object.keys(dis).length) resultat.dis = dis;
  }
  if (flux.heartrate?.length) {
    const fc = reechantillonner1Hz(flux.heartrate, temps).map((x: any) => (x != null && Number.isFinite(Number(x)) ? Number(x) : 0)).map((x: number) => (x >= FC_MIN_CREDIBLE && x <= FC_MAX_CREDIBLE ? x : 0));
    const courbe = meilleureMoyenne(fc, DUREES_COURSE);
    if (Object.keys(courbe).length) resultat.fc = courbe;
  }
  return resultat;
}

// Exporté pour le test : l'altitude filtrée n'est pas utilisée ici, mais gardée à portée si la VAM de la course arrive.
export const _filtreAltitude = (altitude: any[], temps: any[]): number[] => medianeGlissante(reechantillonnerContinu(altitude, temps), FILTRE_ALTITUDE_S);
