// Natation : volume, allure au 100 m, plus longue séance. Calculs purs, sans écran (testés dans tests/natation.test.ts).
// On ne lit que la distance et la durée des séances (Swim) : c'est ce que Strava nous donne de façon fiable.
import { familleAffichage } from './familles.ts';
import { joursAvant } from '../outils/format.ts';
import { indexSemaine } from '../bilan/synthese.ts';
import type { Seance } from '../types.ts';

// En dessous de 300 m, la distance est trop courte pour une allure fiable (repos, départs, plongeons)
const KM_MINI_ALLURE = 0.3;

const EST_NATATION = (s: Seance): boolean => familleAffichage(s.sport) === 'natation';
const nage = (seances: Seance[]): Seance[] => seances.filter((s) => EST_NATATION(s) && (s.distance_km ?? 0) > 0 && s.moving_time > 0);
/** Secondes pour 100 m (distance en km : 1 km = 10 fois 100 m). */
const allure100 = (secondes: number, km: number): number => secondes / (km * 10);

export interface VolumeNatation {
  /** Mètres nagés par semaine glissante, de la plus ancienne à la plus récente (la dernière = les 7 derniers jours). */
  parSemaine: number[];
  derniere: number;
  /** Écart de la dernière semaine à la moyenne des précédentes, en % (null sans semaine de comparaison). */
  ecartPct: number | null;
}

export function volumeNatation(seances: Seance[], nbSemaines = 8, aujourdhui: Date = new Date()): VolumeNatation {
  const parSemaine: number[] = new Array(nbSemaines).fill(0);
  for (const s of nage(seances)) {
    const i = indexSemaine(s.start_date_local, aujourdhui);
    if (i < 0 || i >= nbSemaines) continue;
    parSemaine[nbSemaines - 1 - i] += Number(s.distance_km) * 1000;
  }
  const derniere = Math.round(parSemaine[nbSemaines - 1]);
  const avant = parSemaine.slice(0, -1).filter((v) => v > 0);
  const moyenne = avant.length ? avant.reduce((a, b) => a + b, 0) / avant.length : 0;
  return { parSemaine: parSemaine.map((v) => Math.round(v)), derniere, ecartPct: moyenne > 0 ? Math.round(((parSemaine[nbSemaines - 1] - moyenne) / moyenne) * 100) : null };
}

export interface AllureNatation {
  /** Allure moyenne des 4 dernières semaines, en secondes pour 100 m (null sans séance exploitable). */
  actuelle: number | null;
  /** Allure moyenne des 4 semaines d'avant. */
  precedente: number | null;
  /** Évolution en % : négatif = plus rapide. Null sans les deux périodes. */
  evolutionPct: number | null;
  /** Allure par semaine (4 + 4), de la plus ancienne à la plus récente : null si rien nagé cette semaine-là. */
  parSemaine: (number | null)[];
}

export function allureNatation(seances: Seance[], aujourdhui: Date = new Date()): AllureNatation {
  const semaines = Array.from({ length: 8 }, () => ({ temps: 0, km: 0 }));
  for (const s of nage(seances)) {
    if (Number(s.distance_km) < KM_MINI_ALLURE) continue;
    const i = indexSemaine(s.start_date_local, aujourdhui);
    if (i < 0 || i >= 8) continue;
    const m = semaines[7 - i];
    m.temps += s.moving_time;
    m.km += Number(s.distance_km);
  }
  const moyenne = (liste: { temps: number; km: number }[]): number | null => {
    const temps = liste.reduce((t, m) => t + m.temps, 0);
    const km = liste.reduce((t, m) => t + m.km, 0);
    return km > 0 ? Math.round(allure100(temps, km)) : null;
  };
  const precedente = moyenne(semaines.slice(0, 4));
  const actuelle = moyenne(semaines.slice(4));
  return {
    actuelle,
    precedente,
    evolutionPct: actuelle !== null && precedente !== null ? Math.round(((actuelle - precedente) / precedente) * 1000) / 10 : null,
    parSemaine: semaines.map((m) => (m.km >= KM_MINI_ALLURE ? Math.round(allure100(m.temps, m.km)) : null)),
  };
}

export interface MeilleuresNatation {
  plusLongue: { id: string; date: string; km: number; secondes: number } | null;
  /** La séance la plus rapide parmi celles d'au moins 500 m. */
  plusRapide: { id: string; date: string; km: number; allure: number } | null;
}

export function meilleuresNatation(seances: Seance[]): MeilleuresNatation {
  const liste = nage(seances);
  const plusLongueSeance = liste.length ? liste.reduce((a, b) => (Number(b.distance_km) > Number(a.distance_km) ? b : a)) : null;
  const longues = liste.filter((s) => Number(s.distance_km) >= 0.5);
  const rapideSeance = longues.length ? longues.reduce((a, b) => (allure100(b.moving_time, Number(b.distance_km)) < allure100(a.moving_time, Number(a.distance_km)) ? b : a)) : null;
  return {
    plusLongue: plusLongueSeance && { id: plusLongueSeance.id, date: String(plusLongueSeance.start_date_local).slice(0, 10), km: Number(plusLongueSeance.distance_km), secondes: plusLongueSeance.moving_time },
    plusRapide: rapideSeance && { id: rapideSeance.id, date: String(rapideSeance.start_date_local).slice(0, 10), km: Number(rapideSeance.distance_km), allure: Math.round(allure100(rapideSeance.moving_time, Number(rapideSeance.distance_km))) },
  };
}

// --- Suivi de l'allure, du mois, de la distance et de la préparation ----------------------------------------------------------

export interface AllureHebdoNatation {
  /** Une allure (secondes pour 100 m) par semaine où tu as nagé au moins 300 m, de la plus ancienne à la plus récente. */
  points: number[];
  actuelle: number;
  premiere: number;
  /** La meilleure (la plus basse) allure d'une semaine. */
  meilleure: number;
  /** Évolution entre la première et la dernière semaine, en % : négatif = plus rapide. Null avec une seule semaine. */
  evolutionPct: number | null;
}

/** L'allure de chaque semaine glissante sur `nbSemaines` semaines (les semaines sans natation sont sautées). Null sans semaine exploitable. */
export function allureParSemaineNatation(seances: Seance[], nbSemaines = 12, aujourdhui: Date = new Date()): AllureHebdoNatation | null {
  const semaines = new Map<number, { temps: number; km: number }>();
  for (const s of nage(seances)) {
    const i = indexSemaine(s.start_date_local, aujourdhui);
    if (i < 0 || i >= nbSemaines) continue;
    const m = semaines.get(nbSemaines - 1 - i) ?? { temps: 0, km: 0 };
    m.temps += s.moving_time;
    m.km += Number(s.distance_km);
    semaines.set(nbSemaines - 1 - i, m);
  }
  const points = [...semaines.entries()].filter(([, m]) => m.km >= KM_MINI_ALLURE).sort((a, b) => a[0] - b[0]).map(([, m]) => Math.round(allure100(m.temps, m.km)));
  if (!points.length) return null;
  const premiere = points[0];
  const actuelle = points[points.length - 1];
  return { points, actuelle, premiere, meilleure: Math.min(...points), evolutionPct: points.length > 1 ? Math.round(((actuelle - premiere) / premiere) * 1000) / 10 : null };
}

export interface BilanMois {
  /** Le mois en cours jusqu'à aujourd'hui. */
  actuel: { metres: number; seances: number; secondes: number };
  /** Le mois d'avant, en entier. */
  precedent: { metres: number; seances: number; secondes: number };
  /** Le mois d'avant jusqu'au même jour du mois : la comparaison juste (on n'oppose pas 10 jours à 31). */
  precedentMemeJour: { metres: number; seances: number };
  /** Mètres du mois en cours face à ceux du mois d'avant au même jour, en % ; null sans point de comparaison. */
  ecartPct: number | null;
  /** Le mois en cours (1 à 12) et l'année, pour écrire son nom. */
  mois: number;
  annee: number;
  /** Le jour du mois (1 à 31). */
  jour: number;
}

/** Le bilan du mois en cours de natation, face au mois d'avant (au même jour du mois). Les séances sont lues sur la période chargée (12 semaines). */
export function bilanMoisNatation(seances: Seance[], aujourdhui: Date = new Date()): BilanMois {
  const annee = aujourdhui.getFullYear();
  const mois = aujourdhui.getMonth() + 1;
  const jour = aujourdhui.getDate();
  const veille = new Date(annee, aujourdhui.getMonth() - 1, 1);
  const cleActuel = annee * 12 + mois;
  const clePrecedent = veille.getFullYear() * 12 + veille.getMonth() + 1;
  const total = () => ({ metres: 0, seances: 0, secondes: 0 });
  const actuel = total();
  const precedent = total();
  const memeJour = { metres: 0, seances: 0 };
  for (const s of nage(seances)) {
    const d = String(s.start_date_local).slice(0, 10);
    const a = Number(d.slice(0, 4));
    const m = Number(d.slice(5, 7));
    const j = Number(d.slice(8, 10));
    const cle = a * 12 + m;
    const metres = Number(s.distance_km) * 1000;
    if (cle === cleActuel && j <= jour) {
      actuel.metres += metres;
      actuel.seances += 1;
      actuel.secondes += s.moving_time;
    } else if (cle === clePrecedent) {
      precedent.metres += metres;
      precedent.seances += 1;
      precedent.secondes += s.moving_time;
      if (j <= jour) {
        memeJour.metres += metres;
        memeJour.seances += 1;
      }
    }
  }
  const arrondi = (t: { metres: number; seances: number; secondes: number }) => ({ ...t, metres: Math.round(t.metres) });
  return {
    actuel: arrondi(actuel),
    precedent: arrondi(precedent),
    precedentMemeJour: { metres: Math.round(memeJour.metres), seances: memeJour.seances },
    ecartPct: memeJour.metres > 0 ? Math.round(((actuel.metres - memeJour.metres) / memeJour.metres) * 100) : null,
    mois,
    annee,
    jour,
  };
}

export type TrancheDistance = 'courte' | 'moyenne' | 'longue';

/** Les tranches de distance d'une séance : moins de 1,5 km, de 1,5 à 2,5 km, 2,5 km et plus. */
export const SEUILS_DISTANCE = { moyenne: 1.5, longue: 2.5 } as const;
export const trancheDe = (km: number): TrancheDistance => (km >= SEUILS_DISTANCE.longue ? 'longue' : km >= SEUILS_DISTANCE.moyenne ? 'moyenne' : 'courte');

export interface AlluresParDistance {
  tranches: { cle: TrancheDistance; seances: number; /** Allure moyenne (s pour 100 m), null sans séance. */ allure: number | null }[];
  /** La tranche où tu nages le plus vite et celle où tu nages le plus lentement ; null sans au moins deux tranches. */
  plusRapide: TrancheDistance | null;
  plusLente: TrancheDistance | null;
}

/** L'allure moyenne selon la distance de la séance sur les 12 dernières semaines : on nage rarement aussi vite sur 3 km que sur 1 km. */
export function alluresParDistance(seances: Seance[], nbSemaines = 12, aujourdhui: Date = new Date()): AlluresParDistance {
  const cumul: Record<TrancheDistance, { temps: number; km: number; n: number }> = { courte: { temps: 0, km: 0, n: 0 }, moyenne: { temps: 0, km: 0, n: 0 }, longue: { temps: 0, km: 0, n: 0 } };
  for (const s of nage(seances)) {
    const km = Number(s.distance_km);
    const i = indexSemaine(s.start_date_local, aujourdhui);
    if (km < KM_MINI_ALLURE || i < 0 || i >= nbSemaines) continue;
    const c = cumul[trancheDe(km)];
    c.temps += s.moving_time;
    c.km += km;
    c.n += 1;
  }
  const tranches = (['courte', 'moyenne', 'longue'] as TrancheDistance[]).map((cle) => ({ cle, seances: cumul[cle].n, allure: cumul[cle].km > 0 ? Math.round(allure100(cumul[cle].temps, cumul[cle].km)) : null }));
  const avec = tranches.filter((t) => t.allure != null);
  const tries = [...avec].sort((a, b) => (a.allure as number) - (b.allure as number));
  return { tranches, plusRapide: avec.length >= 2 ? tries[0].cle : null, plusLente: avec.length >= 2 ? tries[tries.length - 1].cle : null };
}

export interface CibleNatation {
  nom: string;
  date: string;
  km: number;
  joursRestants: number;
}

export interface PrepaNatation {
  /** La prochaine course ou traversée avec sa distance ; null s'il n'y en a pas. */
  cible: CibleNatation | null;
  /** Ta plus longue séance des 12 dernières semaines, en kilomètres. */
  plusLongue: number;
  /** Ce que tu as parcouru sur les 4 dernières semaines, en mètres, et par semaine. */
  metres4Semaines: number;
  metresParSemaine: number;
  /** Ta plus longue séance en % de la distance de la course ; null sans cible. */
  pctDistance: number | null;
}

/** Une séance ou un objectif qui a une distance : la forme minimale dont la préparation a besoin. */
type ObjectifDistance = { name: string; date: string; sport: string; km: number | null };

/**
 * Où tu en es de ta préparation à une course définie par sa DISTANCE (une traversée à la nage, une course de ski de fond…) : `garde` choisit tes séances
 * du sport, `estCible` les objectifs du sport. Ta plus longue séance des 12 dernières semaines est comparée à la distance de la course.
 */
export function prepaDistance(seances: Seance[], objectifs: ObjectifDistance[], garde: (s: Seance) => boolean, estCible: (o: ObjectifDistance) => boolean, aujourdhui: Date = new Date()): PrepaNatation {
  const prochaine = objectifs.filter((o) => estCible(o) && Number(o.km) > 0 && joursAvant(o.date, aujourdhui) >= 0).sort((a, b) => a.date.localeCompare(b.date))[0];
  const cible: CibleNatation | null = prochaine ? { nom: prochaine.name, date: prochaine.date, km: Number(prochaine.km), joursRestants: joursAvant(prochaine.date, aujourdhui) } : null;
  const faites = seances.filter((s) => garde(s) && Number(s.distance_km) > 0 && s.moving_time > 0 && indexSemaine(s.start_date_local, aujourdhui) >= 0);
  const douze = faites.filter((s) => indexSemaine(s.start_date_local, aujourdhui) < 12);
  const quatre = faites.filter((s) => indexSemaine(s.start_date_local, aujourdhui) < 4);
  const plusLongue = Math.max(0, ...douze.map((s) => Number(s.distance_km)));
  const metres4Semaines = Math.round(quatre.reduce((t, s) => t + Number(s.distance_km) * 1000, 0));
  return { cible, plusLongue: Math.round(plusLongue * 100) / 100, metres4Semaines, metresParSemaine: Math.round(metres4Semaines / 4), pctDistance: cible ? Math.round((plusLongue / cible.km) * 100) : null };
}

/** Où tu en es de ta préparation à la course de natation visée (une traversée, une course en eau libre). */
export const prepaNatation = (seances: Seance[], objectifs: ObjectifDistance[], aujourdhui: Date = new Date()): PrepaNatation =>
  prepaDistance(seances, objectifs, EST_NATATION, (o) => familleAffichage(o.sport) === 'natation', aujourdhui);
