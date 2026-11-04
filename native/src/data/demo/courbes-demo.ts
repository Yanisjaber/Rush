// Les courbes de records de la démo, CALCULÉES à partir des streams générés (flux-demo.ts) avec les mêmes formules que le serveur :
// supabase/functions/_shared/signaux.ts (vélo) et signaux-course.ts (course). Le code est copié ici (l'app mobile ne peut pas importer le dossier Deno) ;
// tests/demo/courbes-demo.test.ts vérifie que les résultats sont identiques à ceux du serveur à 1 point par seconde.
// Pour garder la démo rapide, les sorties à vélo sont calculées avec 1 point toutes les 5 secondes (`pas`) ; seules les durées de 1 à 4 s se lisent sur le stream à 1 point par seconde.
import type { Seance } from '../types.ts';
import { genererFlux, type Flux } from './flux-demo.ts';

export type CourbeSignal = Record<string, number>;

const arrondi = (x: number, decimales: number): number => {
  const k = 10 ** decimales;
  return Math.round(x * k) / k;
};

/** Les durées (secondes) des courbes du vélo : celles du serveur, à partir de 5 s et multiples de 5 (la démo calcule à 5 s près, sauf 1 à 4 s, calculées sur le stream à 1 s). */
export const DUREES_VELO_DEMO = [1, 2, 3, 4, 5, 10, 15, 20, 25, 30, 40, 50, 60, 75, 90, 120, 150, 180, 240, 300, 360, 420, 480, 600, 720, 900, 1080, 1200, 1500, 1800, 2400, 3000, 3600, 4500, 5400, 7200, 9000, 10800, 14400, 18000];
export const DUREES_VAM_DEMO = DUREES_VELO_DEMO.filter((d) => d >= 30);

/** La meilleure moyenne de la série sur chaque durée (fenêtre glissante) ; `pas` = secondes entre deux points de la série. Même formule que `meilleureMoyenne` du serveur. */
export function meilleureMoyenne(serie: number[], durees: number[], facteur = 1, decimales = 0, pas = 1): CourbeSignal {
  const n = serie.length;
  const sortie: CourbeSignal = {};
  if (!n) return sortie;
  const cum = new Float64Array(n + 1);
  for (let i = 0; i < n; i++) cum[i + 1] = cum[i] + serie[i];
  for (const duree of durees) {
    const d = Math.round(duree / pas);
    if (d < 1 || d > n || d * pas !== duree) continue;
    let meilleure = 0;
    for (let i = 0; i + d <= n; i++) {
      const somme = cum[i + d] - cum[i];
      if (somme > meilleure) meilleure = somme;
    }
    const valeur = (meilleure / d) * facteur;
    if (valeur > 0) sortie[String(duree)] = arrondi(valeur, decimales);
  }
  return sortie;
}

/** La meilleure variation d'altitude (m/h) sur chaque durée. `sens` = 1 pour monter, −1 pour descendre ; une fenêtre plus rapide que `plafondMs` est écartée. */
export function meilleureVariation(altitude: number[], durees: number[], sens: 1 | -1, plafondMs = Infinity, pas = 1): CourbeSignal {
  const n = altitude.length;
  const sortie: CourbeSignal = {};
  for (const duree of durees) {
    const d = Math.round(duree / pas);
    if (d < 1 || d >= n || d * pas !== duree) continue;
    let meilleure = 0;
    for (let i = 0; i + d < n; i++) {
      const gain = sens * (altitude[i + d] - altitude[i]);
      if (gain > meilleure && gain / duree <= plafondMs) meilleure = gain;
    }
    if (meilleure > 0) sortie[String(duree)] = Math.round((meilleure / duree) * 3600);
  }
  return sortie;
}

/** La médiane mobile centrée sur `fenetre` points. */
export function medianeGlissante(serie: number[], fenetre: number): number[] {
  const n = serie.length;
  if (fenetre <= 1 || n < 3) return serie;
  const demi = Math.floor(fenetre / 2);
  return serie.map((_, i) => {
    const morceau = serie.slice(Math.max(0, i - demi), Math.min(n, i + demi + 1)).sort((x, y) => x - y);
    return morceau[Math.floor(morceau.length / 2)];
  });
}

export interface CourbesVelo {
  puissance: CourbeSignal;
  fc?: CourbeSignal;
  cad?: CourbeSignal;
  cou?: CourbeSignal;
  vit?: CourbeSignal;
  vam?: CourbeSignal;
  des?: CourbeSignal;
}

const FC_MIN = 30;
const FC_MAX = 215;
const CAD_MAX = 180;
const CAD_MIN_COUPLE = 30;
const FILTRE_ALTITUDE_S = 15;
const MONTEE_MAX_MS = 1.3;
const DESCENTE_MAX_MS = 4;

/** Les courbes d'une sortie à vélo à partir de son stream (même logique que `calculerSignaux` du serveur). */
export function courbesDuFluxVelo(flux: Flux, pas = 1, durees: number[] = DUREES_VELO_DEMO): CourbesVelo {
  const watts = (flux.watts ?? []).map((x) => (x > 0 ? x : 0));
  const sortie: CourbesVelo = { puissance: meilleureMoyenne(watts, durees, 1, 0, pas) };
  const ajoute = (cle: 'fc' | 'cad' | 'cou' | 'vit' | 'vam' | 'des', c: CourbeSignal): void => {
    if (Object.keys(c).length) sortie[cle] = c;
  };
  const fc = flux.heartrate.map((x) => (x >= FC_MIN && x <= FC_MAX ? x : 0));
  ajoute('fc', meilleureMoyenne(fc, durees, 1, 0, pas));
  if (flux.cadence) {
    const cad = flux.cadence.map((x) => (x > 0 && x <= CAD_MAX ? x : 0));
    ajoute('cad', meilleureMoyenne(cad, durees, 1, 0, pas));
    const couple = cad.map((c, i) => (watts[i] > 0 && c >= CAD_MIN_COUPLE ? watts[i] / ((c * 2 * Math.PI) / 60) : 0));
    ajoute('cou', meilleureMoyenne(couple, durees, 1, 1, pas));
  }
  ajoute('vit', meilleureMoyenne(flux.velocity_smooth.map((x) => (x > 0 ? x : 0)), durees, 3.6, 1, pas));
  const alt = medianeGlissante(flux.altitude, Math.max(1, Math.round(FILTRE_ALTITUDE_S / pas) | 1));
  ajoute('vam', meilleureVariation(alt, durees.filter((d) => d >= 30), 1, MONTEE_MAX_MS, pas));
  ajoute('des', meilleureVariation(alt, durees.filter((d) => d >= 30), -1, DESCENTE_MAX_MS, pas));
  return sortie;
}

/** Le même stream avec 1 point par `pas` secondes : moyenne des `pas` secondes pour les grandeurs qui varient vite, valeur de la fin du bloc pour la distance et l'altitude. */
function sousEchantillonner(f: Flux, pas: number): Flux {
  const n = Math.floor(f.time.length / pas);
  const moy = (a: number[], i: number): number => {
    let somme = 0;
    for (let k = 0; k < pas; k++) somme += a[i * pas + k];
    return somme / pas;
  };
  const serie = (a: number[] | null): number[] | null => (a ? Array.from({ length: n }, (_, i) => moy(a, i)) : null);
  return {
    time: Array.from({ length: n }, (_, i) => i * pas),
    distance: Array.from({ length: n }, (_, i) => f.distance[i * pas]),
    velocity_smooth: serie(f.velocity_smooth) as number[],
    heartrate: serie(f.heartrate) as number[],
    watts: serie(f.watts),
    cadence: serie(f.cadence),
    altitude: Array.from({ length: n }, (_, i) => f.altitude[i * pas]),
  };
}

/** Les courbes d'une sortie à vélo de la démo (stream à 5 s). Mémoïsé par identifiant et par contenu de la ligne. */
const memoVelo = new Map<string, CourbesVelo>();
export function courbesVelo(s: Seance): CourbesVelo {
  const cle = `${s.id}|${s.moving_time}|${s.distance_km}|${s.total_elevation_gain}|${s.avg_watts}|${s.avg_heartrate}`;
  let c = memoVelo.get(cle);
  if (!c) {
    // Le stream à 1 s sert aux durées de 1 à 4 s ; le reste se calcule sur une version à 5 s (moyennes de 5 secondes), bien plus rapide
    const f1 = genererFlux(s, 1);
    c = courbesDuFluxVelo(sousEchantillonner(f1, 5), 5);
    const courtes = courbesDuFluxVelo(f1, 1, [1, 2, 3, 4]);
    for (const cle2 of Object.keys(c) as (keyof CourbesVelo)[]) {
      const ajout = courtes[cle2];
      if (ajout) c[cle2] = { ...ajout, ...c[cle2] };
    }
    memoVelo.set(cle, c);
  }
  return c;
}

// --- Course à pied (copie de signaux-course.ts) -----------------------------------------------------------------------------

export const DISTANCES_COURSE_DEMO = [400, 1000, 1609, 3000, 5000, 10000, 15000, 20000, 21097, 30000, 42195];
export const DUREES_COURSE_DEMO = [60, 180, 300, 360, 420, 600, 720, 900, 1200, 1800, 2400, 3000, 3600, 5400, 7200, 10800];
const VITESSE_MAX_COURTE = 9.5;
const VITESSE_MAX_LONGUE = 8.5;
const vitesseMax = (metres: number): number => (metres < 1000 ? VITESSE_MAX_COURTE : VITESSE_MAX_LONGUE);

/** Le meilleur temps (s) sur chaque distance (m), à 1 point par seconde. */
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
      const avant = distance[j - 1] - distance[i];
      const pas = distance[j] - distance[j - 1];
      const t = j - 1 - i + (pas > 0 ? (L - avant) / pas : 1);
      if (t > 0 && t < meilleur && L / t <= vitesseMax(L)) meilleur = t;
    }
    if (Number.isFinite(meilleur)) sortie[String(L)] = arrondi(meilleur, 1);
  }
  return sortie;
}

/** La meilleure distance (m) sur chaque durée (s), à 1 point par seconde. */
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

export interface CourbesCourse {
  pace?: CourbeSignal;
  dis?: CourbeSignal;
  fc?: CourbeSignal;
}

/** Les courbes d'une course à partir de son stream à 1 point par seconde (le stream de la démo n'a ni pause ni saut de GPS : pas de nettoyage). */
export function courbesDuFluxCourse(flux: Flux): CourbesCourse {
  const r: CourbesCourse = {};
  const pace = meilleursTemps(flux.distance, DISTANCES_COURSE_DEMO);
  if (Object.keys(pace).length) r.pace = pace;
  const dis = meilleuresDistances(flux.distance, DUREES_COURSE_DEMO);
  if (Object.keys(dis).length) r.dis = dis;
  const fc = meilleureMoyenne(flux.heartrate.map((x) => (x >= FC_MIN && x <= FC_MAX ? x : 0)), DUREES_COURSE_DEMO);
  if (Object.keys(fc).length) r.fc = fc;
  return r;
}

const memoCourse = new Map<string, CourbesCourse>();
export function courbesCourse(s: Seance): CourbesCourse {
  const cle = `${s.id}|${s.moving_time}|${s.distance_km}|${s.avg_heartrate}`;
  let c = memoCourse.get(cle);
  if (!c) {
    c = courbesDuFluxCourse(genererFlux(s, 1));
    memoCourse.set(cle, c);
  }
  return c;
}

// --- La FTP, déduite des courbes (comme recalc_ftp_tss du serveur) -------------------------------------------------------------

const jourDe = (iso: string): number => Date.UTC(Number(iso.slice(0, 4)), Number(iso.slice(5, 7)) - 1, Number(iso.slice(8, 10))) / 86400000;

/**
 * Donne à chaque sortie à vélo sa FTP : 95 % du meilleur 20 minutes dans les ±90 jours autour d'elle (puis ±180, puis ±365 s'il n'y en a pas), lu sur les courbes de puissance des streams.
 * Sans aucun 20 minutes à portée, la sortie garde sa FTP de départ. Les autres sports ne changent pas.
 */
export function avecFtpDesCourbes(lignes: Seance[]): Seance[] {
  const velos = lignes
    .filter((s) => s.sport === 'Ride')
    .map((s) => ({ jour: jourDe(String(s.start_date_local)), w: courbesVelo(s).puissance['1200'] }))
    .filter((x): x is { jour: number; w: number } => x.w > 0);
  const ftpDe = (jour: number): number | null => {
    for (const fenetre of [90, 180, 365]) {
      let m = 0;
      for (const x of velos) if (Math.abs(x.jour - jour) <= fenetre && x.w > m) m = x.w;
      if (m > 0) return Math.round(0.95 * m);
    }
    return null;
  };
  return lignes.map((s) => {
    if (s.sport !== 'Ride') return s;
    const ftp = ftpDe(jourDe(String(s.start_date_local)));
    return ftp ? { ...s, ftp_at_time: ftp } : s;
  });
}
