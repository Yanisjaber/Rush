// Course à pied : kilométrage par semaine et répartition du temps par zone d'allure. Calculs purs, sans écran (testés dans tests/course.test.ts).
import { familleAffichage } from './familles.ts';
import { MODELES_ZONES } from './profil.ts';
import { indexSemaine } from './synthese.ts';
import type { Seance } from './types.ts';

const courses = (seances: Seance[]): Seance[] => seances.filter((s) => familleAffichage(s.sport) === 'course' && (s.distance_km ?? 0) > 0 && s.moving_time > 0);

export interface KmHebdo {
  /** Kilomètres courus par semaine glissante (1 décimale), de la plus ancienne à la plus récente (la dernière = les 7 derniers jours). */
  parSemaine: number[];
  derniere: number;
  /** Écart de la dernière semaine à la moyenne des précédentes, en % (null sans semaine de comparaison). */
  ecartPct: number | null;
}

export function kmParSemaine(seances: Seance[], nbSemaines = 12, aujourdhui: Date = new Date()): KmHebdo {
  const valeurs: number[] = new Array(nbSemaines).fill(0);
  for (const s of courses(seances)) {
    const i = indexSemaine(s.start_date_local, aujourdhui);
    if (i < 0 || i >= nbSemaines) continue;
    valeurs[nbSemaines - 1 - i] += Number(s.distance_km);
  }
  const arrondi = (v: number) => Math.round(v * 10) / 10;
  const parSemaine = valeurs.map(arrondi);
  const avant = valeurs.slice(0, -1).filter((v) => v > 0);
  const moyenne = avant.length ? avant.reduce((a, b) => a + b, 0) / avant.length : 0;
  return { parSemaine, derniere: parSemaine[nbSemaines - 1], ecartPct: moyenne > 0 ? Math.round(((valeurs[nbSemaines - 1] - moyenne) / moyenne) * 100) : null };
}

export interface ZoneAllure {
  nom: string;
  /** Temps de course passé dans la zone, en secondes. */
  temps: number;
  /** Part du temps total, en % (entier). */
  pct: number;
}

export interface RepartitionAllure {
  zones: ZoneAllure[];
  /** Temps de course total sur la période, en secondes. */
  total: number;
  /** Indice de la zone où l'on passe le plus de temps. */
  dominante: number;
}

/**
 * Temps de course par zone d'allure sur les 4 dernières semaines. Une sortie est classée tout entière dans la zone de son allure moyenne
 * (on n'a pas l'allure seconde par seconde) : c'est une estimation. `vitesseSeuil` en km/h (profil › Physiologie) ; null si absente ou invalide.
 */
export function repartitionAllure(seances: Seance[], vitesseSeuil: unknown, nbSemaines = 4, aujourdhui: Date = new Date()): RepartitionAllure | null {
  const seuil = Number(vitesseSeuil);
  if (!(seuil > 0)) return null;
  const modele = MODELES_ZONES.allure.zones;
  const temps: number[] = new Array(modele.length).fill(0);
  for (const s of courses(seances)) {
    const i = indexSemaine(s.start_date_local, aujourdhui);
    if (i < 0 || i >= nbSemaines) continue;
    const pct = (Number(s.distance_km) / (s.moving_time / 3600) / seuil) * 100;
    // La première zone dont la suivante commence au-dessus de l'allure ; au-delà de la dernière, on reste dans la dernière
    let z = modele.findIndex((_, k) => k === modele.length - 1 || pct < modele[k + 1][1]);
    if (z < 0) z = modele.length - 1;
    temps[z] += s.moving_time;
  }
  const total = temps.reduce((a, b) => a + b, 0);
  if (total <= 0) return null;
  const zones = modele.map(([nom], k) => ({ nom, temps: temps[k], pct: Math.round((temps[k] / total) * 100) }));
  return { zones, total, dominante: temps.indexOf(Math.max(...temps)) };
}
