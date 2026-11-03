// Les courbes de records de la course à pied (Bilan › Records › Course) : l'allure sur chaque distance (400 m à marathon), la distance sur chaque durée, la FC sur chaque durée.
// Les valeurs viennent de la fonction SQL rpc_courbe_course (voir supabase/migrations/2026-11-04_courbes_course.sql) ; ici, on les range comme une courbe de vélo (voir PointCourbe),
// pour réutiliser la même courbe tactile et le même classement. Fonctions pures, sans réseau.
import { formatChrono } from '../outils/format.ts';
import type { EntreeCourbe, PointCourbe } from './records.ts';

/** `pace` : l'allure sur chaque distance ; `pacedur` : l'allure sur chaque durée (la courbe de meilleurs efforts comme la puissance du vélo : ta meilleure allure tenue 1 min, 5 min, 20 min, 1 h) ; `dis` : la distance sur chaque durée ; `fc` : la FC sur chaque durée. */
export type CleCourbeCourse = 'pace' | 'pacedur' | 'dis' | 'fc';

/** Le nom du signal côté serveur : l'allure par durée se déduit de la meilleure distance par durée (`dis`), il n'y a rien de plus à calculer. */
export const signalServeur = (signal: CleCourbeCourse): 'pace' | 'dis' | 'fc' => (signal === 'pacedur' ? 'dis' : signal);

export interface SignalCourse {
  cle: CleCourbeCourse;
  /** Le nom sur le bouton de choix. */
  court: string;
  /** Le nom entier, pour le titre et VoiceOver. */
  nom: string;
  /** L'unité des valeurs de la courbe : « allure » (une vitesse écrite en min/km), « km » ou « bpm ». */
  unite: 'allure' | 'km' | 'bpm';
  /** L'axe horizontal : une distance (mètres) ou une durée (secondes). */
  axe: 'distance' | 'duree';
}

export const SIGNAUX_COURSE: SignalCourse[] = [
  { cle: 'pacedur', court: 'Allure / durée', nom: 'Allure par durée', unite: 'allure', axe: 'duree' },
  { cle: 'pace', court: 'Allure / distance', nom: 'Allure par distance', unite: 'allure', axe: 'distance' },
  { cle: 'dis', court: 'Distance', nom: 'Distance', unite: 'km', axe: 'duree' },
  { cle: 'fc', court: 'FC', nom: 'Fréquence cardiaque', unite: 'bpm', axe: 'duree' },
];

/** Une ligne de rpc_courbe_course : la valeur de rang 1, 2 ou 3 pour une distance (mètres) ou une durée (secondes). Les numeric arrivent parfois en texte. */
export interface LigneCourbeCourse {
  cle: number;
  rang: number;
  valeur: number | string;
  activity_id: string;
  name: string | null;
  start_date_local: string;
}

/**
 * La valeur écrite d'une ligne : l'allure devient une vitesse en km/h (le meilleur temps sur la distance → distance ÷ temps, ou la meilleure distance sur la durée → distance ÷ durée), la plus haute gagne comme partout ;
 * la distance passe de mètres en km ; la FC reste en bpm.
 */
export function valeurDeLigne(signal: CleCourbeCourse, cle: number, valeur: number): number {
  if (signal === 'pace') return valeur > 0 ? (cle / valeur) * 3.6 : 0;
  // L'allure par durée : la meilleure distance (mètres) sur `cle` secondes → une vitesse en km/h
  if (signal === 'pacedur') return cle > 0 ? (valeur / cle) * 3.6 : 0;
  if (signal === 'dis') return valeur / 1000;
  return valeur;
}

/** Les lignes de la base deviennent une courbe : un point par distance (ou durée), du plus court au plus long, avec son podium (la meilleure séance d'abord). `duree` porte la distance en mètres pour l'allure. */
export function courbeCourseDeLignes(signal: CleCourbeCourse, lignes: LigneCourbeCourse[]): PointCourbe[] {
  const par = new Map<number, LigneCourbeCourse[]>();
  for (const l of lignes) par.set(Number(l.cle), [...(par.get(Number(l.cle)) ?? []), l]);
  return [...par]
    .sort((a, b) => a[0] - b[0])
    .map(([cle, ls]) => ({
      duree: cle,
      top: ls
        .sort((a, b) => a.rang - b.rang)
        .map((l): EntreeCourbe => ({ valeur: valeurDeLigne(signal, cle, Number(l.valeur)), id: l.activity_id, nom: l.name || 'Sans titre', iso: String(l.start_date_local || '').slice(0, 10) })),
    }));
}

/** Une distance écrite : « 400 m », « 1 km », « 1 mile », « 5 km », « Semi », « Marathon ». */
export function texteDistance(metres: number): string {
  if (metres === 1609) return '1 mile';
  if (metres === 21097) return 'Semi';
  if (metres === 42195) return 'Marathon';
  if (metres < 1000) return `${Math.round(metres)} m`;
  return `${Number((metres / 1000).toFixed(1)).toString().replace('.', ',')} km`;
}

/** Le temps mis pour couvrir `metres` à la vitesse `kmh` (l'allure de la courbe) : « 21'40" », « 1h45'12" ». */
export const chronoSurDistance = (metres: number, kmh: number): string => (kmh > 0 ? formatChrono(metres / (kmh / 3.6)) : '—');

/** L'écart d'allure entre la meilleure séance et une autre : « +0'12"/km » (deux vitesses en km/h). */
export function ecartAllure(meilleureKmh: number, kmh: number): string {
  if (!(meilleureKmh > 0) || !(kmh > 0)) return '';
  const s = Math.round(3600 / kmh - 3600 / meilleureKmh);
  return `+${Math.floor(s / 60)}'${String(s % 60).padStart(2, '0')}"/km`;
}
