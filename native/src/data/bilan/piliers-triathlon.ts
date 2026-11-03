// Le niveau global du triathlon et du duathlon : un pilier par discipline, plus le volume (mécanique commune : piliers-sport.ts), calculés année après année.
//   natation (triathlon seulement) : l'allure médiane au 100 m des séances de 300 m ou plus de l'année, contre ta meilleure année (100 = ta meilleure année, 0 = 25 % plus lent) ;
//   vélo   : le score du niveau global du vélo de l'année (voir piliers-niveau.ts) ; sans score cette année-là (moins de 3 piliers mesurés), le pilier n'a pas de preuve ;
//   course : le score du niveau global de la course de l'année (voir piliers-course.ts), même règle ;
//   volume : 50 % les heures, 25 % les jours actifs et 25 % les journées multisport (un jour avec au moins deux disciplines : un enchaînement, ou une « brick ») de l'année, tous sports du filtre confondus,
//            chacun contre la moyenne de tes 3 MEILLEURES années (100 = cette référence, 0 à 40 %). Les totaux de l'année en cours et de la première sont ramenés à 365 jours (à partir de 30 jours couverts).
// Le score global est la moyenne des piliers, seulement si 3 piliers ont toutes leurs preuves (sinon « — »). Avec trois disciplines, un triathlète sans natation mesurée a encore un score
// (vélo, course et volume) ; un duathlète a 3 piliers et il les faut tous.
import type { ActiviteBilan } from './bilan.ts';
import { moyenneDesMeilleures, noteChargeDe, noteLineaire, preuveDe, surUneAnnee } from './piliers-niveau.ts';
import { assemblerNiveau, joursCouverts, moyennePonderee, type NiveauGlobalSport, type PilierSport } from './piliers-sport.ts';

export type Discipline = 'natation' | 'velo' | 'course';

const PILIER_NATATION: PilierSport = { cle: 'natation', nom: 'Natation', abrege: 'Nat.', explication: 'Allure au 100 m' };
const PILIER_VELO: PilierSport = { cle: 'velo', nom: 'Vélo', abrege: 'Vélo', explication: 'Niveau global du vélo' };
const PILIER_COURSE: PilierSport = { cle: 'course', nom: 'Course', abrege: 'Course', explication: 'Niveau global de la course' };
const PILIER_VOLUME: PilierSport = { cle: 'volume', nom: 'Volume', abrege: 'Volume', explication: 'Heures, jours actifs, enchaînements' };

/** Les piliers d'un onglet : triathlon (natation, vélo, course, volume) ou duathlon (course, vélo, volume). */
export const piliersMultisport = (disciplines: readonly Discipline[]): readonly PilierSport[] => [
  ...(disciplines.includes('natation') ? [PILIER_NATATION] : []),
  PILIER_VELO,
  PILIER_COURSE,
  PILIER_VOLUME,
];

/** La natation : 300 m ou plus pour que l'allure compte (départs, plongeons, repos), 3 séances dans l'année pour une preuve complète, 0 à 25 % plus lent que ta meilleure année. */
export const DISTANCE_MIN_NATATION_KM = 0.3;
export const SEANCES_MINI_NATATION = 3;
export const NATATION_ZERO = 0.75;
/** Ce que compte le volume. */
export const POIDS_VOLUME_MULTISPORT = { heures: 0.5, jours: 0.25, multisport: 0.25 } as const;
/** 30 jours de données pour que le volume soit jugé (comme la course et la musculation). */
const JOURS_MINI = 30;

const anDe = (iso: string): number => Number(iso.slice(0, 4));
const mediane = (v: number[]): number => {
  const t = [...v].sort((a, b) => a - b);
  return t.length % 2 ? t[(t.length - 1) / 2] : (t[t.length / 2 - 1] + t[t.length / 2]) / 2;
};

/** Les mesures d'une année multisport (hors scores du vélo et de la course, qui viennent de leurs propres niveaux). */
export interface MesuresMultisportAnnee {
  an: number;
  heures: number;
  joursActifs: number;
  /** Jours avec au moins deux disciplines différentes. */
  joursMultisport: number;
  joursCouverts: number;
  /** L'allure médiane au 100 m (secondes) des séances de natation de 300 m ou plus, et leur nombre. */
  allure100: number | null;
  nNatation: number;
}

/** Les mesures de chaque année pour les séances d'un filtre multisport (`acts` : natation, vélo, course et type triathlon). */
export function mesuresMultisport(acts: readonly ActiviteBilan[], disciplines: readonly Discipline[], maintenant: Date): MesuresMultisportAnnee[] {
  const seances = acts.filter((a) => a.duree_min > 0 && (disciplines as readonly string[]).includes(a.famille));
  if (!seances.length) return [];
  const premier = seances.reduce((m, a) => (a.iso < m ? a.iso : m), seances[0].iso);
  const annees = [...new Set(seances.map((a) => anDe(a.iso)))].sort((a, b) => a - b);
  return annees.map((an) => {
    const delAn = seances.filter((a) => anDe(a.iso) === an);
    const parJour = new Map<string, Set<string>>();
    for (const a of delAn) parJour.set(a.iso, (parJour.get(a.iso) ?? new Set<string>()).add(a.famille));
    const nages = delAn.filter((a) => a.famille === 'natation' && a.distance_km >= DISTANCE_MIN_NATATION_KM);
    return {
      an,
      heures: delAn.reduce((t, a) => t + a.duree_min / 60, 0),
      joursActifs: parJour.size,
      joursMultisport: [...parJour.values()].filter((f) => f.size >= 2).length,
      joursCouverts: joursCouverts(an, premier, maintenant),
      allure100: nages.length ? mediane(nages.map((a) => (a.duree_min * 60) / (a.distance_km * 10))) : null,
      nNatation: nages.length,
    };
  });
}

/**
 * Les notes de chaque pilier pour chaque année, et le score global. `scoresVelo` et `scoresCourse` : le score global (0 à 100) de chaque année dans le niveau du vélo et de la course, null quand l'année n'en a pas.
 * Null sans année.
 */
export function niveauGlobalMultisport(
  mesures: readonly MesuresMultisportAnnee[],
  disciplines: readonly Discipline[],
  scoresVelo: ReadonlyMap<number, number | null>,
  scoresCourse: ReadonlyMap<number, number | null>,
): NiveauGlobalSport | null {
  if (!mesures.length) return null;
  const piliers = piliersMultisport(disciplines);
  // Ta meilleure allure au 100 m : sur les années à assez de séances, à défaut sur celles qui en ont au moins une
  const nageurs = mesures.filter((m) => m.allure100 !== null);
  const fiables = nageurs.filter((m) => m.nNatation >= SEANCES_MINI_NATATION);
  const meilleureAllure = Math.min(Infinity, ...(fiables.length ? fiables : nageurs).map((m) => m.allure100 as number));
  const refHeures = moyenneDesMeilleures(mesures.map((m) => surUneAnnee(m.heures, m.joursCouverts)));
  const refJours = moyenneDesMeilleures(mesures.map((m) => surUneAnnee(m.joursActifs, m.joursCouverts)));
  const refMulti = moyenneDesMeilleures(mesures.map((m) => surUneAnnee(m.joursMultisport, m.joursCouverts)));

  const entrees = mesures.map((m) => {
    const nage = m.allure100 !== null && Number.isFinite(meilleureAllure) ? noteLineaire(meilleureAllure / m.allure100, NATATION_ZERO, 1) * preuveDe(m.nNatation, SEANCES_MINI_NATATION) : 0;
    const velo = scoresVelo.get(m.an) ?? null;
    const course = scoresCourse.get(m.an) ?? null;
    const heures = surUneAnnee(m.heures, m.joursCouverts);
    const jours = surUneAnnee(m.joursActifs, m.joursCouverts);
    const multi = surUneAnnee(m.joursMultisport, m.joursCouverts);
    const parts: [number, number][] = [];
    if (heures !== null && refHeures > 0) parts.push([POIDS_VOLUME_MULTISPORT.heures, noteChargeDe(heures / refHeures)]);
    if (jours !== null && refJours > 0) parts.push([POIDS_VOLUME_MULTISPORT.jours, noteChargeDe(jours / refJours)]);
    // Sans aucun enchaînement dans aucune année, la part ne compte pas (un duathlète sans brick garde sa note de volume)
    if (multi !== null && refMulti > 0) parts.push([POIDS_VOLUME_MULTISPORT.multisport, noteChargeDe(multi / refMulti)]);
    return {
      an: m.an,
      notes: { natation: nage, velo: velo ?? 0, course: course ?? 0, volume: moyennePonderee(parts) },
      preuves: {
        natation: m.allure100 !== null ? preuveDe(m.nNatation, SEANCES_MINI_NATATION) : 0,
        velo: velo !== null ? 1 : 0,
        course: course !== null ? 1 : 0,
        volume: m.joursCouverts >= JOURS_MINI && parts.length ? 1 : 0,
      },
    };
  });
  return assemblerNiveau(piliers, entrees);
}
