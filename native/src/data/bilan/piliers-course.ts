// Le niveau global de la course à pied : quatre piliers notés de 0 à 100 (mécanique commune : piliers-sport.ts), calculés année par année.
//   vitesse    : la vitesse de pointe : ton meilleur 1 km et ta meilleure distance en 5 minutes de l'année, chacun contre ton meilleur de TOUS LES TEMPS (100 = ton record, 0 = 25 % plus lent) ;
//   endurance  : tenir : ton meilleur 5 km, 10 km et ta meilleure distance en 1 heure de l'année, même échelle ; une durée ou une distance jamais faite cette année-là ne compte pas ;
//   efficacité : l'allure à cardio égal (et au dénivelé médian) de l'année, la note du niveau année après année (voir niveau-annees.ts) : courir plus vite avec le même cœur ;
//   volume     : ce que tu cours : 40 % les kilomètres, 35 % les heures et 25 % les jours actifs de l'année, chacun contre la moyenne de tes 3 MEILLEURES années (100 = cette référence, 0 à 40 %).
//                Une année en cours ou la première n'ayant pas 365 jours de données, ses totaux sont ramenés à une année complète (× 365 ÷ jours couverts, à partir de 30 jours).
// Les meilleurs temps et distances viennent des courbes calculées par le serveur (voir rpc_piliers_course). Une année a besoin de 3 courses avec courbes pour que vitesse et endurance aient toutes leurs preuves ;
// avec moins, la note est réduite d'autant. Le score global exige 3 piliers sur 4 avec toutes leurs preuves (sinon « — »).
import type { ActiviteBilan } from './bilan.ts';
import type { SerieNiveau } from './niveau-annees.ts';
import { moyenneDesMeilleures, noteChargeDe, noteLineaire, preuveDe, surUneAnnee } from './piliers-niveau.ts';
import { assemblerNiveau, joursCouverts, moyenneNotes, moyennePonderee, type NiveauGlobalSport, type PilierSport } from './piliers-sport.ts';

export const PILIERS_COURSE: readonly PilierSport[] = [
  { cle: 'vitesse', nom: 'Vitesse', abrege: 'Vitesse', explication: '1 km et 5 min' },
  { cle: 'endurance', nom: 'Endurance', abrege: 'Endur.', explication: '5 km, 10 km et 1 h' },
  { cle: 'efficacite', nom: 'Efficacité', abrege: 'Effic.', explication: 'Allure à cardio égal' },
  { cle: 'volume', nom: 'Volume', abrege: 'Volume', explication: 'Kilomètres, heures, jours actifs' },
];

/** Une note de 0 (25 % moins vite que ton record de toujours) à 100 (ton record). */
export const COURSE_ZERO = 0.75;
/** Il faut 3 courses avec courbes dans l'année pour que vitesse et endurance aient toutes leurs preuves. */
export const COURSES_MINI_COURBES = 3;
/** Ce que compte le volume. */
export const POIDS_VOLUME_COURSE = { km: 0.4, heures: 0.35, jours: 0.25 } as const;

/** Ce que rpc_piliers_course renvoie pour une année (les valeurs absentes sont null). */
export interface LignePiliersCourse {
  an: number;
  t1000: number | null;
  t5000: number | null;
  t10000: number | null;
  d300: number | null;
  d3600: number | null;
  nCourbes: number;
}

/** Les mesures d'une année : les courbes du serveur, le volume des séances, et la note d'efficacité du niveau année après année. */
export interface MesuresCourseAnnee extends LignePiliersCourse {
  km: number;
  heures: number;
  joursActifs: number;
  joursCouverts: number;
  /** La note (0 à 100) de l'allure à cardio égal de l'année, ou null sans niveau calculable. */
  efficacite: number | null;
}

/** Réunit les trois sources par année : les courbes (serveur), les séances de course (volume) et le niveau à cardio égal. Les années sans course n'apparaissent pas. */
export function mesuresCourse(lignes: readonly LignePiliersCourse[], acts: readonly ActiviteBilan[], serie: SerieNiveau | null, maintenant: Date): MesuresCourseAnnee[] {
  const courses = acts.filter((a) => a.sport === 'course');
  const premier = courses.length ? courses.reduce((m, a) => (a.iso < m ? a.iso : m), courses[0].iso) : null;
  const parAn = new Map<number, { km: number; min: number; jours: Set<string> }>();
  for (const a of courses) {
    const an = Number(a.iso.slice(0, 4));
    const x = parAn.get(an) ?? { km: 0, min: 0, jours: new Set<string>() };
    x.km += a.distance_km;
    x.min += a.duree_min;
    x.jours.add(a.iso);
    parAn.set(an, x);
  }
  const lignesParAn = new Map(lignes.map((l) => [l.an, l]));
  const efficaciteParAn = new Map((serie?.annuel ?? []).map((p) => [p.an, p.score]));
  const annees = [...new Set([...parAn.keys(), ...lignesParAn.keys()])].sort((a, b) => a - b);
  return annees.map((an) => {
    const v = parAn.get(an);
    const l = lignesParAn.get(an);
    return {
      an, t1000: l?.t1000 ?? null, t5000: l?.t5000 ?? null, t10000: l?.t10000 ?? null, d300: l?.d300 ?? null, d3600: l?.d3600 ?? null, nCourbes: l?.nCourbes ?? 0,
      km: v?.km ?? 0, heures: (v?.min ?? 0) / 60, joursActifs: v?.jours.size ?? 0, joursCouverts: joursCouverts(an, premier, maintenant),
      efficacite: efficaciteParAn.get(an) ?? null,
    };
  });
}

/** Le meilleur temps (le plus petit) ou la meilleure distance (la plus grande) de tous les temps, sur les années à assez de courbes (à défaut, sur celles qui en ont au moins une). */
function meilleurs(mesures: readonly MesuresCourseAnnee[]): { t1000: number; t5000: number; t10000: number; d300: number; d3600: number } {
  const fiables = mesures.filter((m) => m.nCourbes >= COURSES_MINI_COURBES);
  const ref = fiables.length ? fiables : mesures.filter((m) => m.nCourbes > 0);
  const min = (v: (number | null)[]): number => Math.min(Infinity, ...v.filter((x): x is number => x !== null && x > 0));
  const max = (v: (number | null)[]): number => Math.max(0, ...v.filter((x): x is number => x !== null));
  return { t1000: min(ref.map((m) => m.t1000)), t5000: min(ref.map((m) => m.t5000)), t10000: min(ref.map((m) => m.t10000)), d300: max(ref.map((m) => m.d300)), d3600: max(ref.map((m) => m.d3600)) };
}

/** Les notes de chaque pilier pour chaque année, et le score global. Null sans année. */
export function niveauGlobalCourse(mesures: readonly MesuresCourseAnnee[]): NiveauGlobalSport | null {
  if (!mesures.length) return null;
  const best = meilleurs(mesures);
  // Un temps se compare en rapport « meilleur ÷ temps » (1 = ton record), une distance en rapport « distance ÷ meilleure »
  const noteTemps = (t: number | null, meilleur: number): number | null => (t !== null && t > 0 && Number.isFinite(meilleur) ? noteLineaire(meilleur / t, COURSE_ZERO, 1) : null);
  const noteDistance = (d: number | null, meilleur: number): number | null => (d !== null && d > 0 && meilleur > 0 ? noteLineaire(d / meilleur, COURSE_ZERO, 1) : null);
  const refKm = moyenneDesMeilleures(mesures.map((m) => surUneAnnee(m.km, m.joursCouverts)));
  const refHeures = moyenneDesMeilleures(mesures.map((m) => surUneAnnee(m.heures, m.joursCouverts)));
  const refJours = moyenneDesMeilleures(mesures.map((m) => surUneAnnee(m.joursActifs, m.joursCouverts)));

  const entrees = mesures.map((m) => {
    const preuveCourbes = preuveDe(m.nCourbes, COURSES_MINI_COURBES);
    const vitesse = moyenneNotes([noteTemps(m.t1000, best.t1000), noteDistance(m.d300, best.d300)]) * preuveCourbes;
    const endurance = moyenneNotes([noteTemps(m.t5000, best.t5000), noteTemps(m.t10000, best.t10000), noteDistance(m.d3600, best.d3600)]) * preuveCourbes;
    const km = surUneAnnee(m.km, m.joursCouverts);
    const heures = surUneAnnee(m.heures, m.joursCouverts);
    const jours = surUneAnnee(m.joursActifs, m.joursCouverts);
    const parts: [number, number][] = [];
    if (km !== null && refKm > 0) parts.push([POIDS_VOLUME_COURSE.km, noteChargeDe(km / refKm)]);
    if (heures !== null && refHeures > 0) parts.push([POIDS_VOLUME_COURSE.heures, noteChargeDe(heures / refHeures)]);
    if (jours !== null && refJours > 0) parts.push([POIDS_VOLUME_COURSE.jours, noteChargeDe(jours / refJours)]);
    return {
      an: m.an,
      notes: { vitesse, endurance, efficacite: m.efficacite ?? 0, volume: moyennePonderee(parts) },
      // Vitesse et endurance : sans courbe, rien n'est prouvé ; l'efficacité a sa preuve dans le niveau (3 courses au moins) ; le volume demande 30 jours de données (sinon, aucune part mesurée)
      preuves: { vitesse: preuveCourbes, endurance: preuveCourbes, efficacite: m.efficacite !== null ? 1 : 0, volume: parts.length ? 1 : 0 },
    };
  });
  return assemblerNiveau(PILIERS_COURSE, entrees);
}
