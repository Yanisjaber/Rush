// Le niveau global de la natation : quatre piliers notés de 0 à 100 (mécanique commune : piliers-sport.ts), calculés année après année sur les séances de natation (distance et durée de chaque séance).
//   vitesse    : la moyenne de tes 3 allures au 100 m les plus rapides de l'année (séances de 300 m ou plus) contre la même mesure dans ta meilleure année (100 = ta meilleure année, 0 = 25 % plus lent) ;
//   endurance  : l'allure médiane au 100 m de tes séances de 1 500 m ou plus de l'année, même échelle ; nager loin à bonne allure ;
//   régularité : 50 % les séances par semaine (2 par semaine = 100) et 50 % la part des semaines avec au moins une séance, sur les semaines couvertes de l'année ;
//   volume     : 50 % les kilomètres, 30 % les heures et 20 % les jours actifs de l'année, chacun contre la moyenne de tes 3 MEILLEURES années (0 à 40 %), ramenés à 365 jours pour l'année en cours et la première
//                (à partir de 30 jours couverts).
// Preuves : la vitesse et l'endurance demandent 3 séances (de 300 m ou plus, de 1 500 m ou plus) dans l'année ; la régularité et le volume 30 jours de données. Score global : 3 piliers prouvés sur 4.
import type { ActiviteBilan } from './bilan.ts';
import { moyenneDesMeilleures, noteChargeDe, noteLineaire, preuveDe, surUneAnnee } from './piliers-niveau.ts';
import { assemblerNiveau, joursCouverts, moyennePonderee, type NiveauGlobalSport, type PilierSport } from './piliers-sport.ts';

export const PILIERS_NATATION: readonly PilierSport[] = [
  { cle: 'vitesse', nom: 'Vitesse', abrege: 'Vitesse', explication: 'Tes 3 allures les plus rapides' },
  { cle: 'endurance', nom: 'Endurance', abrege: 'Endur.', explication: 'Allure sur les séances de 1,5 km ou plus' },
  { cle: 'regularite', nom: 'Régularité', abrege: 'Régul.', explication: 'Séances par semaine, semaines actives' },
  { cle: 'volume', nom: 'Volume', abrege: 'Volume', explication: 'Kilomètres, heures, jours actifs' },
];

/** Une allure de natation n'a de sens qu'à partir de 300 m (départs, plongeons, repos) ; l'endurance regarde les séances de 1 500 m ou plus. */
export const DISTANCE_MIN_KM = 0.3;
export const DISTANCE_ENDURANCE_KM = 1.5;
/** Trois séances dans l'année pour que la vitesse et l'endurance aient toutes leurs preuves. */
export const SEANCES_MINI = 3;
/** Une note de 0 (25 % plus lent que ta meilleure année) à 100 (ta meilleure année). */
export const NATATION_ZERO = 0.75;
/** Les séances par semaine qui valent 100 en régularité. */
export const SEANCES_SEMAINE_CENT = 2;
/** Ce que compte le volume. */
export const POIDS_VOLUME_NATATION = { km: 0.5, heures: 0.3, jours: 0.2 } as const;
const JOURS_MINI = 30;

const anDe = (iso: string): number => Number(iso.slice(0, 4));
const jourDe = (iso: string): number => Date.UTC(Number(iso.slice(0, 4)), Number(iso.slice(5, 7)) - 1, Number(iso.slice(8, 10))) / 86400000;
/** La semaine (lundi = 0) d'un jour, pour compter les semaines actives. */
const semaineDe = (iso: string): number => Math.floor((jourDe(iso) + 3) / 7);
const mediane = (v: number[]): number => {
  const t = [...v].sort((a, b) => a - b);
  return t.length % 2 ? t[(t.length - 1) / 2] : (t[t.length / 2 - 1] + t[t.length / 2]) / 2;
};
/** L'allure d'une séance en secondes pour 100 m. */
export const allure100DeSeance = (a: ActiviteBilan): number => (a.duree_min * 60) / (a.distance_km * 10);

/**
 * Le niveau global de la natation année après année. `acts` : les séances (seules celles de la famille « natation » comptent). Une année existe dès qu'elle a une séance. Null sans séance.
 */
export function niveauGlobalNatation(acts: readonly ActiviteBilan[], maintenant: Date): NiveauGlobalSport | null {
  const seances = acts.filter((a) => a.famille === 'natation' && a.duree_min > 0);
  if (!seances.length) return null;
  const premier = seances.reduce((m, a) => (a.iso < m ? a.iso : m), seances[0].iso);
  const annees = [...new Set(seances.map((a) => anDe(a.iso)))].sort((a, b) => a - b);

  const parAn = annees.map((an) => {
    const delAn = seances.filter((a) => anDe(a.iso) === an);
    const couverts = joursCouverts(an, premier, maintenant);
    const allures = delAn.filter((a) => a.distance_km >= DISTANCE_MIN_KM).map(allure100DeSeance).sort((a, b) => a - b);
    const longues = delAn.filter((a) => a.distance_km >= DISTANCE_ENDURANCE_KM).map(allure100DeSeance);
    const parSemaine = new Set(delAn.map((a) => semaineDe(a.iso)));
    return {
      an, couverts, delAn,
      nVitesse: allures.length, nEndurance: longues.length,
      vitesse: allures.length ? allures.slice(0, 3).reduce((t, x) => t + x, 0) / Math.min(3, allures.length) : null,
      endurance: longues.length ? mediane(longues) : null,
      km: surUneAnnee(delAn.reduce((t, a) => t + a.distance_km, 0), couverts),
      heures: surUneAnnee(delAn.reduce((t, a) => t + a.duree_min / 60, 0), couverts),
      jours: surUneAnnee(new Set(delAn.map((a) => a.iso)).size, couverts),
      semainesActives: parSemaine.size,
    };
  });
  // Ta meilleure année pour chaque mesure : sur les années à assez de séances, à défaut sur celles qui en ont au moins une
  const meilleur = (cle: 'vitesse' | 'endurance', nCle: 'nVitesse' | 'nEndurance'): number => {
    const avec = parAn.filter((x) => x[cle] !== null);
    const fiables = avec.filter((x) => x[nCle] >= SEANCES_MINI);
    return Math.min(Infinity, ...(fiables.length ? fiables : avec).map((x) => x[cle] as number));
  };
  const mVitesse = meilleur('vitesse', 'nVitesse');
  const mEndurance = meilleur('endurance', 'nEndurance');
  const refKm = moyenneDesMeilleures(parAn.map((x) => x.km));
  const refHeures = moyenneDesMeilleures(parAn.map((x) => x.heures));
  const refJours = moyenneDesMeilleures(parAn.map((x) => x.jours));

  const entrees = parAn.map((x) => {
    const preuveVitesse = x.vitesse !== null ? preuveDe(x.nVitesse, SEANCES_MINI) : 0;
    const preuveEndurance = x.endurance !== null ? preuveDe(x.nEndurance, SEANCES_MINI) : 0;
    const note = (valeur: number | null, record: number, preuve: number): number => (valeur !== null && valeur > 0 && Number.isFinite(record) ? noteLineaire(record / valeur, NATATION_ZERO, 1) * preuve : 0);
    const parts: [number, number][] = [];
    if (x.km !== null && refKm > 0) parts.push([POIDS_VOLUME_NATATION.km, noteChargeDe(x.km / refKm)]);
    if (x.heures !== null && refHeures > 0) parts.push([POIDS_VOLUME_NATATION.heures, noteChargeDe(x.heures / refHeures)]);
    if (x.jours !== null && refJours > 0) parts.push([POIDS_VOLUME_NATATION.jours, noteChargeDe(x.jours / refJours)]);
    const semainesCouvertes = x.couverts / 7;
    const parSemaineMoy = semainesCouvertes > 0 ? x.delAn.length / semainesCouvertes : 0;
    const regularite = semainesCouvertes > 0 ? 100 * (0.5 * Math.min(1, parSemaineMoy / SEANCES_SEMAINE_CENT) + 0.5 * Math.min(1, x.semainesActives / semainesCouvertes)) : 0;
    const preuveRegularite = preuveDe(x.couverts, JOURS_MINI);
    return {
      an: x.an,
      notes: { vitesse: note(x.vitesse, mVitesse, preuveVitesse), endurance: note(x.endurance, mEndurance, preuveEndurance), regularite: regularite * preuveRegularite, volume: moyennePonderee(parts) },
      preuves: { vitesse: preuveVitesse, endurance: preuveEndurance, regularite: preuveRegularite, volume: parts.length ? 1 : 0 },
    };
  });
  return assemblerNiveau(PILIERS_NATATION, entrees);
}
