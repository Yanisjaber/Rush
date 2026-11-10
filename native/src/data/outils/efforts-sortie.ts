import type { FluxBruts } from './courbes-sortie.ts';
import type { PointCourbe } from '../bilan/records.ts';

// Les meilleurs efforts d'UNE sortie : pour chaque durée, la meilleure moyenne de la mesure (puissance, vitesse) sur une fenêtre de cette durée, calculée sur les flux.
// Même forme que les courbes du Bilan (`PointCourbe`) pour utiliser le même graphique. Fonctions pures : aucun écran, aucun réseau.

/** Les durées essayées pour la course (en secondes) : de 1 min à 3 h. */
export const DUREES_COURSE = [60, 120, 300, 600, 900, 1200, 1800, 2700, 3600, 5400, 7200, 10800];
/** Les durées essayées pour le vélo (en secondes) : de 5 s à 5 h. */
export const DUREES_VELO = [5, 10, 30, 60, 120, 300, 600, 1200, 1800, 3600, 5400, 7200, 10800, 18000];

/**
 * La meilleure moyenne de `valeurs` sur une fenêtre de `duree` secondes de temps de mouvement (les pauses plus longues que trois fois l'écart habituel ne comptent pas).
 * Chaque point vaut pour le temps jusqu'au suivant. Une valeur manquante (NaN) reprend la précédente. Null si la sortie est plus courte que la fenêtre.
 */
export function meilleureMoyenne(valeurs: number[], temps: number[], duree: number): number | null {
  const n = valeurs.length;
  if (n < 3 || temps.length !== n || !(duree > 0)) return null;
  const ecarts = temps.slice(1).map((t, i) => t - temps[i]).filter((e) => e > 0);
  if (!ecarts.length) return null;
  const mediane = [...ecarts].sort((a, b) => a - b)[Math.floor(ecarts.length / 2)];
  if (duree < mediane * 2.5) return null; // la résolution des flux est trop grossière pour une fenêtre si courte
  // Le temps de mouvement cumulé, et l'intégrale cumulée de la valeur (chaque point vaut jusqu'au suivant)
  const tau: number[] = [0];
  const integrale: number[] = [0];
  let precedente = valeurs.find((v) => Number.isFinite(v));
  if (precedente === undefined) return null;
  const v = valeurs.map((x) => (Number.isFinite(x) ? (precedente = x) : (precedente as number)));
  for (let i = 0; i < n - 1; i++) {
    const dt = Math.min(Math.max(0, temps[i + 1] - temps[i]), mediane * 3);
    tau.push(tau[i] + dt);
    integrale.push(integrale[i] + v[i] * dt);
  }
  const total = tau[n - 1];
  if (duree > total) return null;
  // L'intégrale à un instant x du temps de mouvement (recherche du point juste avant x)
  const aire = (x: number): number => {
    let bas = 0;
    let haut = n - 1;
    while (bas < haut) {
      const milieu = (bas + haut + 1) >> 1;
      if (tau[milieu] <= x) bas = milieu;
      else haut = milieu - 1;
    }
    return integrale[bas] + v[bas] * (x - tau[bas]);
  };
  let meilleur = -Infinity;
  for (let j = 0; j < n; j++) {
    if (tau[j] + duree > total + 1e-9) break;
    meilleur = Math.max(meilleur, (aire(tau[j] + duree) - integrale[j]) / duree);
  }
  return Number.isFinite(meilleur) ? meilleur : null;
}

/** La courbe des meilleurs efforts de la sortie : un point par durée possible. Vide sans flux exploitable. */
export function courbeEffortsSortie(valeurs: number[] | undefined, temps: number[] | undefined, durees: number[], iso: string): PointCourbe[] {
  if (!valeurs || !temps) return [];
  const sortie: PointCourbe[] = [];
  for (const d of durees) {
    const m = meilleureMoyenne(valeurs, temps, d);
    if (m != null && m > 0) sortie.push({ duree: d, top: [{ valeur: m, id: 'sortie', nom: 'Cette sortie', iso }] });
  }
  return sortie;
}

/** Les courbes d'efforts qu'on sait faire pour cette sortie, selon le sport : l'allure par durée (la vitesse, en km/h) pour la course, la puissance (W) pour le vélo. */
export function effortsDeSortie(brut: FluxBruts | null | undefined, famille: 'course' | 'velo', iso: string): PointCourbe[] {
  if (!brut) return [];
  if (famille === 'course') return courbeEffortsSortie(brut.vitesse?.map((v) => v * 3.6), brut.temps, DUREES_COURSE, iso);
  return courbeEffortsSortie(brut.watts, brut.temps, DUREES_VELO, iso);
}
