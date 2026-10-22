// Course à pied : kilométrage par semaine et répartition du temps par zone d'allure. Calculs purs, sans écran (testés dans tests/course.test.ts).
import { familleAffichage } from './familles.ts';
import { cumulParSemaine, repartirParZone, type CumulHebdo, type RepartitionZones, type ZoneTemps } from './hebdo.ts';
import { MODELES_ZONES } from './profil.ts';
import { indexSemaine } from './synthese.ts';
import type { Seance } from './types.ts';

const courses = (seances: Seance[]): Seance[] => seances.filter((s) => familleAffichage(s.sport) === 'course' && (s.distance_km ?? 0) > 0 && s.moving_time > 0);

export type KmHebdo = CumulHebdo;

export function kmParSemaine(seances: Seance[], nbSemaines = 12, aujourdhui: Date = new Date()): KmHebdo {
  return cumulParSemaine(courses(seances), () => true, (s) => Number(s.distance_km), nbSemaines, aujourdhui, 1);
}

export type ZoneAllure = ZoneTemps;
export type RepartitionAllure = RepartitionZones;

/**
 * Temps de course par zone d'allure sur les 4 dernières semaines. Une sortie est classée tout entière dans la zone de son allure moyenne
 * (on n'a pas l'allure seconde par seconde) : c'est une estimation. `vitesseSeuil` en km/h (profil › Physiologie) ; null si absente ou invalide.
 */
export function repartitionAllure(seances: Seance[], vitesseSeuil: unknown, nbSemaines = 4, aujourdhui: Date = new Date()): RepartitionAllure | null {
  const seuil = Number(vitesseSeuil);
  if (!(seuil > 0)) return null;
  const entrees = courses(seances)
    .filter((s) => {
      const i = indexSemaine(s.start_date_local, aujourdhui);
      return i >= 0 && i < nbSemaines;
    })
    .map((s) => ({ pct: (Number(s.distance_km) / (s.moving_time / 3600) / seuil) * 100, temps: s.moving_time }));
  return repartirParZone(entrees, MODELES_ZONES.allure.zones);
}
