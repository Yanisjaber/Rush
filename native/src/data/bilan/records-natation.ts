// La courbe de meilleurs efforts de la natation (Bilan › Records › Natation). Les séances de natation n'ont presque jamais de flux détaillé (la piscine n'en envoie pas à Strava) : on lit donc les séances
// entières. Pour chaque distance de séance (300 m, 500 m, 750 m, 1 km, 1,5 km, 2 km… 5 km), la meilleure allure moyenne au 100 m tenue sur une séance d'AU MOINS cette distance : nager vite
// pendant 3 km compte plus que nager vite pendant 400 m, et une séance de 3 km compte aussi pour 1 km (comme la charge tenue pour au moins n répétitions en musculation). Fonctions pures, sans réseau.
import type { ActiviteBilan } from './bilan.ts';
import type { EntreeCourbe, PointCourbe } from './records.ts';

/** Les distances de séance de la courbe (mètres) : de 300 m (en dessous, l'allure n'est pas fiable : départs, plongeons, repos) à 5 km. */
export const DISTANCES_SEANCE_NATATION = [300, 500, 750, 1000, 1500, 2000, 2500, 3000, 4000, 5000];

/** La vitesse moyenne d'une séance en km/h (la valeur de la courbe : la plus haute gagne ; écrite en allure au 100 m). */
const vitesse = (a: ActiviteBilan): number => (a.duree_min > 0 ? a.distance_km / (a.duree_min / 60) : 0);

/**
 * Le classement des séances de natation d'au moins `metres` : la plus rapide d'abord (à égalité la plus ancienne), au plus `n`. `valeur` est une vitesse en km/h.
 * Les séances sans distance ou sans durée ne comptent pas.
 */
export function classementAllureNatation(acts: readonly ActiviteBilan[], metres: number, n = 30): EntreeCourbe[] {
  return acts
    .filter((a) => a.famille === 'natation' && a.duree_min > 0 && a.distance_km * 1000 >= metres)
    .sort((a, b) => vitesse(b) - vitesse(a) || (a.iso < b.iso ? -1 : a.iso > b.iso ? 1 : 0))
    .slice(0, n)
    .map((a) => ({ valeur: vitesse(a), id: a.id, nom: a.name || 'Sans titre', iso: a.iso }));
}

/** La courbe : un point par distance de séance (de la plus courte à la plus longue), avec les `n` meilleures séances ; une distance qu'aucune séance n'atteint est absente. `duree` porte la distance en mètres. */
export function courbeNatation(acts: readonly ActiviteBilan[], n = 3): PointCourbe[] {
  const points: PointCourbe[] = [];
  for (const metres of DISTANCES_SEANCE_NATATION) {
    const top = classementAllureNatation(acts, metres, n);
    if (top.length) points.push({ duree: metres, top });
  }
  return points;
}

/** L'écart d'allure au 100 m entre la meilleure séance et une autre : « +0'05"/100 m » (deux vitesses en km/h). */
export function ecartAllure100(meilleureKmh: number, kmh: number): string {
  if (!(meilleureKmh > 0) || !(kmh > 0)) return '';
  const s = Math.round(360 / kmh - 360 / meilleureKmh);
  return `+${Math.floor(s / 60)}'${String(s % 60).padStart(2, '0')}"/100 m`;
}
