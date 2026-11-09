// ============================================================
// Planifier une PÉRIODE : « prépare-moi mon marathon du 12 avril », « un plan de 3 mois, 4 séances par semaine ».
//
// Le modèle traduit la demande (sports, séances par semaine, durée ou date de la course). Le CODE construit tout, semaine après semaine,
// avec le planificateur de semaine (jours espacés, types, durées, validateur) et les bonnes habitudes d'un entraîneur :
//   - la charge monte doucement sur 3 semaines, puis une semaine plus légère (récupération) ;
//   - avant une course : deux dernières semaines allégées (affûtage), plus aucune séance le jour J et la veille légère.
// Ce sont des HABITUDES du générateur, pas des refus : rien n'empêche l'utilisateur d'ajouter ce qu'il veut ensuite.
// Un plan d'un an tient sur UNE carte (jusqu'à 60 semaines).
// ============================================================
import { ajouterJours, ecartJours } from './dates-iso.ts';
import type { FamilleCoach } from './menu-seances.ts';
import type { Operation, SeancePrevue } from './planning.ts';
import { habitudesDepuisResume, planifierSemaine } from './semaine.ts';
import type { Habitude } from './semaine.ts';
import { tssEstime, typeSeance } from './menu-seances.ts';
import { HORIZON_TECHNIQUE_JOURS } from './validateur.ts';
import type { ContexteValidation } from './validateur.ts';

export const SEMAINES_MAX = 60;

export interface DemandePeriode {
  /** Séances par semaine et par sport */
  sports: { sport: FamilleCoach; seances: number }[];
  /** Premier jour (défaut : demain) */
  debut?: string;
  /** Nombre de semaines (1 à 60) — ou la date de la course ci-dessous */
  semaines?: number;
  /** Jour de la course visée : le plan s'arrête la veille, avec un affûtage */
  objectif?: string;
  joursLibres?: string[];
  intensite?: 'facile' | 'normale';
}

export interface ResultatPeriode {
  operations: Operation[];
  abandons: string[];
  /** Une phrase par semaine (« Semaine 3 : montée, 4 séances ») pour que le modèle explique le plan */
  semaines: string[];
}

/** Le but de la semaine tel que l'écran l'affiche en titre (« Montée », « Récupération », « Affûtage », « Reprise ») */
export function butSemaine(nom: string): string {
  if (nom.includes('affûtage')) return 'Affûtage';
  if (nom === 'récupération') return 'Récupération';
  if (nom === 'reprise du cycle') return 'Reprise';
  return 'Montée';
}

/** Le coefficient de volume d'une semaine : montée (1, 1,05, 1,10), récupération (0,75) toutes les 4 semaines, affûtage avant la course */
export function coefficientSemaine(index: number, semainesAvantCourse: number | null): { facteur: number; nom: string } {
  if (semainesAvantCourse === 0) return { facteur: 0.5, nom: 'dernière semaine, affûtage' };
  if (semainesAvantCourse === 1) return { facteur: 0.7, nom: 'affûtage' };
  const pos = index % 4;
  if (pos === 3) return { facteur: 0.75, nom: 'récupération' };
  return { facteur: 1 + 0.05 * pos, nom: pos === 0 ? 'reprise du cycle' : 'montée' };
}

const echelle = (h: Habitude, f: number): Habitude => ({
  moyenneMinutes: h.moyenneMinutes === null ? null : Math.max(15, Math.round(h.moyenneMinutes * f)),
  plusLongueMinutes: h.plusLongueMinutes === null ? null : Math.max(15, Math.round(h.plusLongueMinutes * f)),
});

export function planifierPeriode(d: DemandePeriode, seances: SeancePrevue[], base: ContexteValidation, habitudes: ReturnType<typeof habitudesDepuisResume>): ResultatPeriode {
  const aujourdhui = base.aujourdhui;
  const horizon = ajouterJours(aujourdhui, HORIZON_TECHNIQUE_JOURS);
  const debut = d.debut && d.debut > aujourdhui ? d.debut : d.debut === aujourdhui ? aujourdhui : ajouterJours(aujourdhui, 1);
  if (debut > horizon) return { operations: [], abandons: ["Cette date est trop lointaine pour être vraie : vérifie l'année."], semaines: [] };

  let nbSemaines: number;
  let jourCourse: string | null = null;
  if (d.objectif) {
    if (d.objectif <= debut) return { operations: [], abandons: ['La course est avant le début du plan : vérifie les dates.'], semaines: [] };
    jourCourse = d.objectif;
    nbSemaines = Math.ceil(ecartJours(debut, d.objectif) / 7);
  } else {
    nbSemaines = Math.round(d.semaines ?? 4);
  }
  const abandons: string[] = [];
  if (nbSemaines > SEMAINES_MAX) {
    abandons.push(`Je planifie ${SEMAINES_MAX} semaines au plus d'un coup (environ 14 mois) : le reste se fera dans un second plan.`);
    nbSemaines = SEMAINES_MAX;
    jourCourse = null;
  }
  if (nbSemaines < 1) return { operations: [], abandons: ['Il faut au moins une semaine.'], semaines: [] };

  const operations: Operation[] = [];
  const lignesSemaines: string[] = [];
  let toutes: SeancePrevue[] = seances.map((s) => ({ ...s }));
  const libres = [...(d.joursLibres ?? [])];
  // Le jour J et tous les jours qui suivent : aucune séance du plan
  if (jourCourse) for (let j = jourCourse; j < ajouterJours(jourCourse, 7); j = ajouterJours(j, 1)) libres.push(j);

  for (let w = 0; w < nbSemaines; w++) {
    const du = ajouterJours(debut, w * 7);
    const avantCourse = jourCourse ? Math.floor((ecartJours(du, jourCourse) - 1) / 7) : null;
    if (avantCourse !== null && avantCourse < 0) break;
    const fin7 = ajouterJours(du, 6);
    const { facteur, nom } = coefficientSemaine(w, avantCourse);
    const h = { velo: echelle(habitudes.velo, facteur), course: echelle(habitudes.course, facteur), natation: echelle(habitudes.natation, facteur) };
    // Affûtage : une séance de moins par sport dans la dernière semaine (au moins une)
    const sports = d.sports.map((s) => ({ sport: s.sport, seances: avantCourse === 0 ? Math.max(1, s.seances - 1) : s.seances }));
    const r = planifierSemaine({ sports, debut: du, jours: 7, joursLibres: libres, intensite: avantCourse !== null && avantCourse <= 1 ? 'facile' : d.intensite }, toutes.filter((x) => x.date >= du && x.date <= fin7), base, h);
    for (const o of r.operations) {
      if (o.op === 'ajouter') o.phase = butSemaine(nom);
      operations.push(o);
      if (o.op === 'ajouter') toutes.push({ id: `periode-${operations.length}`, date: o.proposition.date, sport: o.proposition.sport, minutes: o.proposition.minutes, tss: (() => { const t = typeSeance(o.proposition.sport, o.proposition.type); return t ? tssEstime(t, o.proposition.minutes) : null; })(), creeeParIa: true });
    }
    for (const a of r.abandons) if (abandons.length < 12) abandons.push(`Semaine ${w + 1} : ${a}`);
    lignesSemaines.push(`Semaine ${w + 1} (${du}) : ${nom}, ${r.operations.length} séance${r.operations.length > 1 ? 's' : ''}`);
  }
  return { operations, abandons, semaines: lignesSemaines };
}
