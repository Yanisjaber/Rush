// La forme de la natation semaine par semaine sur une année civile (graphique « Forme par saison » de la natation) : même idée que la forme de la musculation (forme-force.ts) sur l'allure au 100 m des séances.
// Chaque séance de 300 m ou plus donne un point : le rapport de ton allure record (la plus rapide de toutes tes séances) à l'allure de la séance (1 = ton record). La forme d'une semaine est la moyenne de ces points
// jusqu'à sa fin, chaque point pesant moitié moins tous les 28 jours ; 100 = ta meilleure semaine, 0 = 30 % en dessous. Peu de séances récentes ramènent la note vers le bas, et après plus de 2 semaines sans séance
// elle baisse (5 % par semaine, au plus de moitié) et passe en pointillé. À côté, au lieu des heures : les kilomètres nagés chaque semaine.
import type { ActiviteBilan } from './bilan.ts';
import { formeDepuisPoints, type PointNiveauJour } from './forme-force.ts';
import type { FormeSaison } from './forme-saison.ts';

const DISTANCE_MIN_KM = 0.3;
/** Six séances avant de noter une semaine. */
export const SEANCES_MINI_FORME = 6;

const jourDe = (date: string): number => Date.UTC(Number(date.slice(0, 4)), Number(date.slice(5, 7)) - 1, Number(date.slice(8, 10))) / 86400000;

/** Un point par séance de natation de 300 m ou plus : l'allure record ÷ l'allure de la séance (au 100 m), du plus ancien au plus récent. */
export function pointsDeNatation(acts: readonly ActiviteBilan[]): PointNiveauJour[] {
  const seances = acts.filter((a) => a.famille === 'natation' && a.duree_min > 0 && a.distance_km >= DISTANCE_MIN_KM);
  const allures = seances.map((a) => (a.duree_min * 60) / (a.distance_km * 10));
  const record = Math.min(Infinity, ...allures);
  if (!Number.isFinite(record)) return [];
  return seances.map((a, i) => ({ jour: jourDe(a.iso), ratio: record / allures[i] })).sort((a, b) => a.jour - b.jour);
}

/** La forme de chaque semaine de `annee` et les kilomètres nagés de la semaine (dans le champ `heures`, avec `unite: 'km'`). Null sans assez de séances pour noter une semaine de l'année. */
export function formeNatationParSemaine(acts: readonly ActiviteBilan[], annee: number, aujourdhui: Date): FormeSaison | null {
  return formeDepuisPoints(
    pointsDeNatation(acts),
    annee,
    aujourdhui,
    (debutAn, finAn) => {
      const km = new Map<number, number>();
      for (const a of acts) {
        if (a.famille !== 'natation') continue;
        const j = jourDe(a.iso);
        if (j < debutAn || j >= finAn) continue;
        const i = Math.min(51, Math.floor((j - debutAn) / 7));
        km.set(i, (km.get(i) ?? 0) + a.distance_km);
      }
      return km;
    },
    'km',
    SEANCES_MINI_FORME,
  );
}
