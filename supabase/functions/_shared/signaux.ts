// ============================================================
// Les courbes des autres signaux du vélo (Bilan › Records › Cyclisme) : pour chaque durée, la meilleure valeur d'une séance.
// Comme la courbe de puissance (meilleure puissance moyenne sur N secondes), mais pour :
//  - fc  : la fréquence cardiaque moyenne (bpm)
//  - cad : la cadence moyenne (tours par minute, les arrêts de pédalage comptent pour zéro)
//  - cou : le couple moyen (N·m) = puissance ÷ vitesse de rotation, seulement quand on pédale (cadence d'au moins 30 tr/min)
//  - vit : la vitesse moyenne (km/h)
//  - vam : la vitesse ascensionnelle (mètres montés à l'heure), meilleure montée nette sur la durée
//  - des : les mètres descendus à l'heure, meilleure descente nette sur la durée
// Fonctions pures, sans réseau ni Deno : le même code tourne dans l'Edge Function et dans les tests.
// ============================================================
import { reechantillonner1Hz } from './flux.ts';

/** À augmenter quand les durées ou les calculs changent : les anciennes séances sont alors recalculées. */
export const SIGNAUX_VERSION = 4;

/** Durées (secondes) de chaque signal : les mêmes repères que la puissance (de 1 s à 5 h).
 *  Les très courtes durées sont moins fiables pour la FC (le capteur est en retard sur le cœur) et pour l'altitude (le GPS bouge de quelques mètres) : la VAM et la descente commencent à 30 s, et l'altitude est lissée. */
export const DUREES_MOYENNE = [1, 2, 3, 4, 5, 10, 15, 30, 45, 60, 120, 180, 300, 420, 600, 900, 1200, 1800, 2400, 3600, 5400, 7200, 10800, 14400, 18000];
export const DUREES_VAM = [30, 60, 120, 300, 600, 900, 1200, 1800, 2700, 3600, 5400, 7200, 10800];
export const DUREES_DESCENTE = [30, 60, 120, 300, 600, 900, 1200, 1800, 3600, 7200];

/** Une FC au-dessus de cette valeur est une pointe de capteur (233 bpm vus) : on l'ignore. */
const FC_MAX_CREDIBLE = 215;
const FC_MIN_CREDIBLE = 30;
/** Une cadence au-dessus de cette valeur est une pointe de capteur (190 tr/min tenus 30 s, vus dans l'historique) : on l'ignore. */
const CADENCE_MAX_CREDIBLE = 180;
/** En dessous de cette cadence, on ne pédale pas vraiment : le couple n'a pas de sens. */
const CADENCE_MIN_COUPLE = 30;
/** Le lissage de l'altitude (secondes) : le GPS et le baromètre bougent de quelques mètres sans que la pente change. */
const LISSAGE_ALTITUDE_S = 15;

export interface FluxSignaux {
  time?: any[];
  watts?: any[];
  heartrate?: any[];
  cadence?: any[];
  velocity_smooth?: any[];
  altitude?: any[];
}

export type CourbeSignal = Record<string, number>;
export interface CourbesSignaux {
  v: number;
  fc?: CourbeSignal;
  cad?: CourbeSignal;
  cou?: CourbeSignal;
  vit?: CourbeSignal;
  vam?: CourbeSignal;
  des?: CourbeSignal;
}

const arrondi = (x: number, decimales: number): number => {
  const k = 10 ** decimales;
  return Math.round(x * k) / k;
};

/** La meilleure moyenne de la série sur chaque durée (fenêtre glissante, sommes cumulées) ; `facteur` change l'unité (m/s → km/h). */
export function meilleureMoyenne(serie: number[], durees: number[], facteur = 1, decimales = 0): CourbeSignal {
  const n = serie.length;
  const sortie: CourbeSignal = {};
  if (!n) return sortie;
  const cum = new Float64Array(n + 1);
  for (let i = 0; i < n; i++) cum[i + 1] = cum[i] + serie[i];
  for (const d of durees) {
    if (d > n) continue;
    let meilleure = 0;
    for (let i = 0; i + d <= n; i++) {
      const somme = cum[i + d] - cum[i];
      if (somme > meilleure) meilleure = somme;
    }
    const valeur = (meilleure / d) * facteur;
    if (valeur > 0) sortie[String(d)] = arrondi(valeur, decimales);
  }
  return sortie;
}

/** La meilleure variation d'altitude sur chaque durée, ramenée à l'heure. `sens` = 1 pour monter, -1 pour descendre. */
export function meilleureVariation(altitude: number[], durees: number[], sens: 1 | -1): CourbeSignal {
  const n = altitude.length;
  const sortie: CourbeSignal = {};
  for (const d of durees) {
    if (d >= n) continue;
    let meilleure = 0;
    for (let i = 0; i + d < n; i++) {
      const gain = sens * (altitude[i + d] - altitude[i]);
      if (gain > meilleure) meilleure = gain;
    }
    if (meilleure > 0) sortie[String(d)] = Math.round((meilleure / d) * 3600);
  }
  return sortie;
}

/**
 * Une série continue (altitude) remise à 1 point par seconde : pendant un trou (pause), elle garde la dernière valeur au lieu de tomber à zéro.
 * Sans flux `time` exploitable (absent, longueur différente, temps non croissant), la série est rendue telle quelle.
 */
export function reechantillonnerContinu(valeurs: any[], temps: any[]): number[] {
  const brut = (valeurs || []).map((v) => (Number.isFinite(Number(v)) && v != null ? Number(v) : NaN));
  const n = brut.length;
  const garder = (): number[] => {
    let derniere = brut.find((v) => Number.isFinite(v)) ?? 0;
    return brut.map((v) => (Number.isFinite(v) ? (derniere = v) : derniere));
  };
  if (n < 2 || !Array.isArray(temps) || temps.length !== n) return garder();
  const t0 = Number(temps[0]);
  if (!Number.isFinite(t0)) return garder();
  for (let i = 1; i < n; i++) {
    const t = Number(temps[i]);
    if (!Number.isFinite(t) || t <= Number(temps[i - 1])) return garder();
  }
  const total = Math.round(Number(temps[n - 1]) - t0) + 1;
  if (total < n || total > 24 * 3600) return garder();
  const sortie = new Array<number>(total).fill(NaN);
  for (let i = 0; i < n; i++) {
    const debut = Math.round(Number(temps[i]) - t0);
    const fin = i + 1 < n ? Math.round(Number(temps[i + 1]) - t0) : debut + 1;
    for (let k = debut; k < fin && k < total; k++) sortie[k] = brut[i];
  }
  let derniere = sortie.find((v) => Number.isFinite(v)) ?? 0;
  return sortie.map((v) => (Number.isFinite(v) ? (derniere = v) : derniere));
}

/** La moyenne mobile centrée sur `fenetre` secondes (bords : la fenêtre se réduit). */
export function lisser(serie: number[], fenetre: number): number[] {
  const n = serie.length;
  if (fenetre <= 1 || n < 3) return serie;
  const cum = new Float64Array(n + 1);
  for (let i = 0; i < n; i++) cum[i + 1] = cum[i] + serie[i];
  const demi = Math.floor(fenetre / 2);
  return serie.map((_, i) => {
    const a = Math.max(0, i - demi);
    const b = Math.min(n, i + demi + 1);
    return (cum[b] - cum[a]) / (b - a);
  });
}

/** Les courbes de tous les signaux d'une séance. Un signal sans donnée (pas de cadence, pas de GPS) est absent du résultat. */
export function calculerSignaux(flux: FluxSignaux): CourbesSignaux {
  const temps = flux.time || [];
  const un = (valeurs: any[] | undefined): number[] => reechantillonner1Hz(valeurs || [], temps).map((x) => (x != null && Number.isFinite(Number(x)) ? Number(x) : 0));
  const resultat: CourbesSignaux = { v: SIGNAUX_VERSION };
  const ajoute = (cle: 'fc' | 'cad' | 'cou' | 'vit' | 'vam' | 'des', courbe: CourbeSignal) => {
    if (Object.keys(courbe).length) resultat[cle] = courbe;
  };

  if (flux.heartrate?.length) {
    const fc = un(flux.heartrate).map((x) => (x >= FC_MIN_CREDIBLE && x <= FC_MAX_CREDIBLE ? x : 0));
    ajoute('fc', meilleureMoyenne(fc, DUREES_MOYENNE));
  }
  if (flux.cadence?.length) {
    const cad = un(flux.cadence).map((x) => (x > 0 && x <= CADENCE_MAX_CREDIBLE ? x : 0));
    ajoute('cad', meilleureMoyenne(cad, DUREES_MOYENNE));
    if (flux.watts?.length) {
      const w = un(flux.watts);
      const n = Math.min(w.length, cad.length);
      const couple: number[] = new Array(n);
      for (let i = 0; i < n; i++) couple[i] = w[i] > 0 && cad[i] >= CADENCE_MIN_COUPLE ? w[i] / ((cad[i] * 2 * Math.PI) / 60) : 0;
      ajoute('cou', meilleureMoyenne(couple, DUREES_MOYENNE, 1, 1));
    }
  }
  if (flux.velocity_smooth?.length) {
    const v = un(flux.velocity_smooth).map((x) => (x > 0 ? x : 0));
    ajoute('vit', meilleureMoyenne(v, DUREES_MOYENNE, 3.6, 1));
  }
  if (flux.altitude?.length) {
    const alt = lisser(reechantillonnerContinu(flux.altitude, temps), LISSAGE_ALTITUDE_S);
    ajoute('vam', meilleureVariation(alt, DUREES_VAM, 1));
    ajoute('des', meilleureVariation(alt, DUREES_DESCENTE, -1));
  }
  return resultat;
}
