import type { FluxBruts } from '../../outils/courbes-sortie.ts';

// Les flux d'une sortie remis à 1 point par seconde sur le temps ENREGISTRÉ (les pauses du chrono sont retirées : un trou de plus de 10 s n'existe pas dans cette échelle).
// Sert à toutes les lectures de l'analyse (moitiés, fenêtres du plan, début de la dérive, temps par zone). Fonctions pures : aucun écran, aucun réseau.

export interface Flux1Hz {
  /** Nombre de secondes enregistrées. */
  n: number;
  /** Vitesse en m/s (0 à l'arrêt). */
  v: number[];
  /** Cœur en bpm, 0 = inconnu. */
  fc: number[];
  /** Puissance en W, 0 = inconnue. */
  w: number[];
  /** Secondes de pause du chrono retirées (trous de plus de 10 s). */
  pauseS: number;
}

const TROU_MAX_S = 10;
const DUREE_MAX_S = 24 * 3600;
/** En dessous de cette vitesse (m/s, 2,2 km/h) on est à l'arrêt. */
export const VITESSE_ARRET = 0.6;
const FC_MIN = 30;
const FC_MAX = 230;
const W_MAX = 2500;

const propre = (x: unknown, min: number, max: number): number => (typeof x === 'number' && Number.isFinite(x) && x >= min && x <= max ? x : 0);

/** Null sans temps ni vitesse, avec des temps qui ne croissent pas, ou trop court (moins d'une minute). */
export function flux1Hz(brut: FluxBruts | null | undefined): Flux1Hz | null {
  const t = brut?.temps;
  const vit = brut?.vitesse;
  if (!t || !vit || t.length !== vit.length || t.length < 30) return null;
  const n = t.length;
  for (let i = 0; i < n; i++) {
    if (!Number.isFinite(t[i]) || (i > 0 && !(t[i] > t[i - 1]))) return null;
  }
  const fcs = brut?.fc && brut.fc.length === n ? brut.fc : null;
  const ws = brut?.watts && brut.watts.length === n ? brut.watts : null;
  const v: number[] = [];
  const fc: number[] = [];
  const w: number[] = [];
  let pause = 0;
  for (let i = 0; i < n && v.length < DUREE_MAX_S; i++) {
    const ecart = i + 1 < n ? t[i + 1] - t[i] : 1;
    const tient = Math.min(Math.max(1, Math.round(ecart)), ecart <= TROU_MAX_S ? TROU_MAX_S : 1);
    if (ecart > TROU_MAX_S) pause += Math.round(ecart) - 1;
    const vi = propre(vit[i], 0, 15);
    const fi = fcs ? propre(fcs[i], FC_MIN, FC_MAX) : 0;
    const wi = ws ? propre(ws[i], 1, W_MAX) : 0;
    for (let k = 0; k < tient && v.length < DUREE_MAX_S; k++) {
      v.push(vi);
      fc.push(fi);
      w.push(wi);
    }
  }
  return v.length >= 60 ? { n: v.length, v, fc, w, pauseS: pause } : null;
}

/** Moyenne d'une fenêtre [de, fin[, en ignorant les 0 (inconnu) ; null s'il n'y a rien. */
export function moyenne(a: number[], de: number, fin: number, ignorerZeros = true): number | null {
  let s = 0;
  let k = 0;
  for (let i = Math.max(0, de); i < Math.min(a.length, fin); i++) {
    if (ignorerZeros && !(a[i] > 0)) continue;
    s += a[i];
    k++;
  }
  return k ? s / k : null;
}

/** Allure d'une fenêtre (secondes par km) : distance parcourue sur le temps de la fenêtre, arrêts compris. Null sans mouvement. */
export function allureFenetre(v: number[], de: number, fin: number): number | null {
  const d = Math.max(0, de);
  const f = Math.min(v.length, fin);
  if (f - d < 1) return null;
  let metres = 0;
  for (let i = d; i < f; i++) metres += v[i];
  return metres > 0 ? ((f - d) * 1000) / metres : null;
}

/** Les arrêts : suites d'au moins 10 s sous la vitesse d'arrêt. `debutS` = seconde enregistrée, `km` = distance parcourue au début de l'arrêt. */
export function arrets(f: Flux1Hz): { debutS: number; dureeS: number; km: number }[] {
  const liste: { debutS: number; dureeS: number; km: number }[] = [];
  let distance = 0;
  let debut = -1;
  let kmDebut = 0;
  for (let i = 0; i <= f.n; i++) {
    const arret = i < f.n && f.v[i] < VITESSE_ARRET;
    if (arret && debut < 0) {
      debut = i;
      kmDebut = distance / 1000;
    } else if (!arret && debut >= 0) {
      if (i - debut >= 10) liste.push({ debutS: debut, dureeS: i - debut, km: kmDebut });
      debut = -1;
    }
    if (i < f.n) distance += f.v[i];
  }
  return liste;
}

/** Secondes passées dans chaque zone de cœur. `departs` = le début de chaque zone, du plus bas au plus haut. Les secondes sans cœur ne comptent pas. */
export function tempsParZoneCoeur(f: Flux1Hz, departs: number[]): number[] {
  const s = new Array(departs.length).fill(0);
  for (let i = 0; i < f.n; i++) {
    const c = f.fc[i];
    if (!(c > 0)) continue;
    let z = 0;
    for (let k = 0; k < departs.length; k++) if (c >= departs[k]) z = k;
    s[z]++;
  }
  return s;
}

/** Le percentile p (0 à 1) des valeurs connues d'une série ; null s'il n'y en a pas. */
export function percentile(a: number[], p: number): number | null {
  const v = a.filter((x) => x > 0).sort((x, y) => x - y);
  if (!v.length) return null;
  return v[Math.min(v.length - 1, Math.max(0, Math.floor(p * v.length)))];
}

/** Position en km d'une seconde enregistrée. */
export function kmA(f: Flux1Hz, seconde: number): number {
  let m = 0;
  for (let i = 0; i < Math.min(seconde, f.n); i++) m += f.v[i];
  return m / 1000;
}

/**
 * Où la dérive commence : on compare, par tranches de 5 min, le rendement (vitesse ou puissance par battement) à celui des tranches 2 et 3 (l'échauffement est mis à part).
 * Retourne la première tranche, à partir de la 4e, dont le rendement est au moins 4 % plus bas ET dont la suivante l'est aussi (une baisse isolée n'est pas une dérive).
 * Null sans cœur, trop court (moins de 25 min), ou sans dérive nette.
 */
export function debutDerive(f: Flux1Hz, base: 'puissance' | 'vitesse'): { debutS: number; km: number; baissePct: number } | null {
  const TRANCHE = 300;
  const sortie = base === 'puissance' ? f.w : f.v;
  const nb = Math.floor(f.n / TRANCHE);
  if (nb < 5) return null;
  const rendement: (number | null)[] = [];
  for (let k = 0; k < nb; k++) {
    const a = k * TRANCHE;
    const b = a + TRANCHE;
    let s = 0;
    let c = 0;
    let ok = 0;
    for (let i = a; i < b; i++) {
      if (f.fc[i] > 0 && sortie[i] > 0 && f.v[i] >= VITESSE_ARRET) {
        s += sortie[i];
        c += f.fc[i];
        ok++;
      }
    }
    rendement.push(ok >= TRANCHE * 0.7 && c > 0 ? s / c : null);
  }
  const ref = [rendement[1], rendement[2]].filter((x): x is number => x != null);
  if (ref.length < 2) return null;
  const r0 = (ref[0] + ref[1]) / 2;
  const baisse = (k: number) => (rendement[k] != null ? (r0 - (rendement[k] as number)) / r0 : null);
  for (let k = 3; k < nb - 1; k++) {
    const b1 = baisse(k);
    const b2 = baisse(k + 1);
    if (b1 != null && b2 != null && b1 >= 0.04 && b2 >= 0.04) return { debutS: k * TRANCHE, km: kmA(f, k * TRANCHE), baissePct: Math.round(b1 * 1000) / 10 };
  }
  return null;
}
