// Petites briques de calcul communes aux analyses. Fonctions pures, sans réseau ni écran.
// Port de app/src/lib/analyse/maths.js.
import { dateIsoLocale } from './format.ts';

export const JOUR_MS = 86400000;

export const somme = (t: number[]): number => t.reduce((a, b) => a + b, 0);
export const moyenne = (t: number[]): number => (t.length ? somme(t) / t.length : 0);
export const arrondi = (v: number, n = 0): number => {
  const k = 10 ** n;
  return Math.round(v * k) / k;
};
export const borner = (v: number, min: number, max: number): number => Math.min(max, Math.max(min, v));

/** Écart type (population). 0 s'il y a moins de deux valeurs. */
export function ecartType(t: number[]): number {
  if (t.length < 2) return 0;
  const m = moyenne(t);
  return Math.sqrt(moyenne(t.map((v) => (v - m) ** 2)));
}

/** Pente de la droite des moindres carrés (unité de y par pas de x), et corrélation r² (0 à 1). */
export function regression(ys: number[]): { pente: number; r2: number } {
  const n = ys.length;
  if (n < 2) return { pente: 0, r2: 0 };
  const mx = (n - 1) / 2;
  const my = moyenne(ys);
  let sxy = 0;
  let sxx = 0;
  let syy = 0;
  ys.forEach((y, i) => {
    sxy += (i - mx) * (y - my);
    sxx += (i - mx) ** 2;
    syy += (y - my) ** 2;
  });
  return { pente: sxx ? sxy / sxx : 0, r2: sxx && syy ? (sxy * sxy) / (sxx * syy) : 0 };
}

/** Moyenne mobile exponentielle de constante de temps `tau` jours (la valeur de départ est `depart`). */
export function ewma(valeurs: number[], tau: number, depart = 0): number[] {
  const k = 1 / tau;
  const sortie: number[] = [];
  let courant = depart;
  for (const v of valeurs) {
    courant += (v - courant) * k;
    sortie.push(courant);
  }
  return sortie;
}

/** Jour ISO décalé de n jours (n peut être négatif). */
export function decalerJour(iso: string, n: number): string {
  const d = new Date(`${iso}T12:00:00`);
  d.setDate(d.getDate() + n);
  return dateIsoLocale(d);
}

/** Liste de tous les jours ISO de debut à fin inclus. */
export function joursEntre(debut: string, fin: string): string[] {
  const sortie: string[] = [];
  for (let iso = debut; iso <= fin; iso = decalerJour(iso, 1)) sortie.push(iso);
  return sortie;
}

/** Nombre de jours entre deux dates ISO (b - a). */
export function ecartJours(a: string, b: string): number {
  return Math.round((new Date(`${b}T12:00:00`).getTime() - new Date(`${a}T12:00:00`).getTime()) / JOUR_MS);
}

/** Lundi (ISO) de la semaine d'un jour. */
export function lundiDe(iso: string): string {
  const d = new Date(`${iso}T12:00:00`);
  const decalage = (d.getDay() + 6) % 7;
  d.setDate(d.getDate() - decalage);
  return dateIsoLocale(d);
}
