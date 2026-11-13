// Les records qui comptent dans la note de niveau : pour chaque record (une durée, une distance de séance, la plus longue sortie), les 5 meilleures séances et leur date.
// Un record apporte des points au trimestre de chacune de ses 5 meilleures séances, d'autant plus que la séance est bien classée (1re = POIDS_RANG[0], 5e = POIDS_RANG[4]) :
// ainsi un 2e meilleur record posé en 2024 donne quand même un petit coup de pouce à 2024, même si le 1er date de 2026. Fonctions pures, sans réseau.
import type { ActiviteBilan } from './bilan.ts';
import { classementAllureNatation, DISTANCES_SEANCE_NATATION } from './records-natation.ts';

/** Les 5 meilleures séances de chaque record comptent, la meilleure pèse le plus. */
export const POIDS_RANG = [1, 0.8, 0.6, 0.4, 0.2] as const;
export const NB_CLASSES = POIDS_RANG.length;

/** Les durées (en secondes) des records de puissance du vélo : 5 s, 30 s, 1, 3, 5, 12, 20, 30 min, 40 min (le 45 min n'est pas gardé en base), 1 h, 2 h. */
export const DUREES_VELO = [5, 30, 60, 180, 300, 720, 1200, 1800, 2400, 3600, 7200];
/** Les durées des records d'allure de la course : les mêmes sans le 5 s ni le 30 s (la base garde la course à partir d'1 minute). */
export const DUREES_COURSE = [60, 180, 300, 720, 1200, 1800, 2400, 3600, 7200];

/** Un record : sa famille de sport, son nom et les dates (ISO) de ses meilleures séances, la meilleure d'abord. */
export interface RecordDate {
  famille: string;
  cle: string;
  dates: string[];
}

/** Une ligne renvoyée par le serveur : la durée (ou la clé), le rang de la séance et sa date. */
export interface LigneTop {
  cle: number;
  rang: number;
  start_date_local: string;
}

const jour = (iso: string): string => iso.slice(0, 10);

/** Les records d'un sport à partir des lignes du serveur (rang 1 à 5), pour les durées demandées seulement. */
export function recordsDesLignes(famille: string, prefixe: string, lignes: readonly LigneTop[], durees: readonly number[]): RecordDate[] {
  const garde = new Set(durees);
  const parDuree = new Map<number, LigneTop[]>();
  for (const l of lignes) {
    if (!garde.has(l.cle) || l.rang < 1 || l.rang > NB_CLASSES) continue;
    const liste = parDuree.get(l.cle) ?? [];
    liste.push(l);
    parDuree.set(l.cle, liste);
  }
  return [...parDuree].map(([cle, liste]) => ({ famille, cle: `${prefixe}-${cle}`, dates: liste.sort((a, b) => a.rang - b.rang).map((l) => jour(l.start_date_local)) }));
}

/** La plus longue sortie d'un sport (en distance) : les 5 plus longues séances. */
export function recordLonguesSorties(acts: readonly ActiviteBilan[], famille: string): RecordDate[] {
  const dates = acts
    .filter((a) => a.famille === famille && a.distance_km > 0)
    .sort((a, b) => b.distance_km - a.distance_km || (a.iso < b.iso ? -1 : a.iso > b.iso ? 1 : 0))
    .slice(0, NB_CLASSES)
    .map((a) => jour(a.iso));
  return dates.length ? [{ famille, cle: 'plus-longue-sortie', dates }] : [];
}

/** Les records de natation : l'allure sur chaque distance de séance (300 m à 5 000 m), et la plus longue sortie. */
export function recordsNatation(acts: readonly ActiviteBilan[]): RecordDate[] {
  const records: RecordDate[] = [];
  for (const m of DISTANCES_SEANCE_NATATION) {
    const dates = classementAllureNatation(acts, m, NB_CLASSES).map((e) => jour(e.iso));
    if (dates.length) records.push({ famille: 'natation', cle: `allure-${m}`, dates });
  }
  return [...records, ...recordLonguesSorties(acts, 'natation')];
}

/** Ce que les records apportent à un trimestre : `points` (la somme des poids de rang, sert à la note) et `nb` (combien de places dans un top 5, sert à l'affichage). */
export interface RecordsDuTrimestre {
  points: number;
  nb: number;
}

/** Les records de chaque trimestre pour chaque sport : pour tous ses records, le poids du rang de chaque séance classée dans le trimestre. */
export function pointsRecordsParTrimestre(records: readonly RecordDate[], trimestreDe: (iso: string) => string): Map<string, Map<string, RecordsDuTrimestre>> {
  const parSport = new Map<string, Map<string, RecordsDuTrimestre>>();
  for (const r of records) {
    const m = parSport.get(r.famille) ?? new Map<string, RecordsDuTrimestre>();
    r.dates.slice(0, NB_CLASSES).forEach((iso, rang) => {
      const t = trimestreDe(iso);
      const x = m.get(t) ?? { points: 0, nb: 0 };
      x.points += POIDS_RANG[rang];
      x.nb += 1;
      m.set(t, x);
    });
    parSport.set(r.famille, m);
  }
  return parSport;
}
