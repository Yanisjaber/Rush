// ============================================================
// Structure d'une séance du coach : TOUJOURS construite par le code (jamais par le modèle), à partir du type et de la durée exacte.
// Une séance du coach n'est donc jamais « vierge, juste une durée » : échauffement, corps de séance, retour au calme.
//
// Format = celui de l'app (native/src/data/calendrier/structure.ts), stocké dans activity_planned.structure :
//   { type, name, reps, metric, unit: 'zone', work: { min, int, intHi }, rec?: { min, int, intHi } }
// `int` / `intHi` = bornes de la zone en % (FTP, FC max ou allure de base) : elles se traduisent en watts / allures à l'affichage.
// La somme des durées des blocs (répétitions comprises) est EXACTEMENT la durée de la séance.
// ============================================================
import type { FamilleCoach } from './menu-seances.ts';

export type TypeBloc = 'warmup' | 'interval' | 'steady' | 'recovery' | 'cooldown';
export interface SegmentStructure { min: number; int: number; intHi: number | null }
export interface BlocStructure {
  type: TypeBloc;
  name: string;
  reps: number;
  metric: 'power' | 'hr' | 'pace';
  unit: 'zone' | 'pct';
  work: SegmentStructure;
  rec?: SegmentStructure;
}

/** Bornes des zones en % — mêmes tables que l'app (ZONES de structure.ts) pour la puissance et l'allure */
const ZONES = {
  power: { bas: [40, 56, 76, 91, 106], haut: [55, 75, 90, 105, 120] },
  pace: { bas: [60, 75, 85, 95, 106], haut: [75, 85, 95, 106, 125] },
} as const;

const METRIQUE: Record<FamilleCoach, 'power' | 'pace'> = { velo: 'power', course: 'pace', natation: 'pace' };

/** Une série d'intervalles par type : durée du travail, de la récupération, zone du travail, zone de la récupération */
const SERIES: Record<string, { travail: number; recup: number; zone: number; zoneRecup: number; mini: number }> = {
  seuil: { travail: 10, recup: 3, zone: 4, zoneRecup: 1, mini: 26 },
  vo2max: { travail: 3, recup: 3, zone: 5, zoneRecup: 1, mini: 20 },
  fractionne: { travail: 3, recup: 2, zone: 5, zoneRecup: 1, mini: 20 },
  cotes: { travail: 2, recup: 3, zone: 5, zoneRecup: 1, mini: 20 },
  vitesse: { travail: 2, recup: 2, zone: 5, zoneRecup: 1, mini: 20 },
};
/** Zone d'un corps de séance continu */
const ZONE_CONTINUE: Record<string, number> = {
  recuperation: 1, footing_recuperation: 1, technique: 1, endurance: 2, footing_facile: 2, sortie_longue: 2, tempo: 3,
  seuil: 4, vitesse: 5, vo2max: 5, fractionne: 5, cotes: 5,
};

function segment(metric: 'power' | 'pace', zone: number, min: number): SegmentStructure {
  const t = ZONES[metric];
  const z = Math.min(5, Math.max(1, zone)) - 1;
  return { min, int: t.bas[z], intHi: t.haut[z] };
}
function bloc(type: TypeBloc, name: string, metric: 'power' | 'pace', zone: number, min: number): BlocStructure {
  return { type, name, reps: 1, metric, unit: 'zone', work: segment(metric, zone, min) };
}

/**
 * La structure d'une séance. `minutes` est un entier ≥ 1. La somme des durées des blocs vaut toujours `minutes`.
 * Séance très courte (moins de 10 min) : un seul bloc continu.
 */
export function structureSeance(sport: FamilleCoach, type: string, minutes: number): BlocStructure[] {
  const m = Math.max(1, Math.round(minutes));
  const metric = METRIQUE[sport];
  const zoneCorps = ZONE_CONTINUE[type] ?? 2;
  if (m < 10) return [bloc('steady', 'Séance courte', metric, zoneCorps, m)];

  const echauf = m < 20 ? Math.max(2, Math.round(m * 0.2)) : Math.min(15, Math.round(m * 0.15));
  const retour = m < 20 ? Math.max(2, Math.round(m * 0.15)) : Math.min(10, Math.round(m * 0.1));
  const corps = m - echauf - retour;
  const blocs: BlocStructure[] = [bloc('warmup', 'Échauffement', metric, 1, echauf)];
  let retourFinal = retour;

  const serie = SERIES[type];
  if (serie && corps >= serie.mini) {
    // tours complets (travail + récupération) ; le retour au calme garde au moins 1 minute et absorbe le reste
    const tour = serie.travail + serie.recup;
    const reps = Math.max(1, Math.floor((corps + retour - 1) / tour));
    retourFinal = m - echauf - reps * tour;
    blocs.push({
      type: 'interval', name: `${reps} × ${serie.travail} min`, reps, metric, unit: 'zone',
      work: segment(metric, serie.zone, serie.travail), rec: segment(metric, serie.zoneRecup, serie.recup),
    });
  } else {
    blocs.push(bloc('steady', 'Corps de séance', metric, zoneCorps, corps));
  }
  blocs.push(bloc('cooldown', 'Retour au calme', metric, 1, retourFinal));
  return blocs;
}

/** Durée totale d'une structure (répétitions comprises) */
export function dureeStructure(blocs: BlocStructure[]): number {
  return blocs.reduce((t, b) => t + b.reps * b.work.min + (b.type === 'interval' && b.rec ? b.reps * b.rec.min : 0), 0);
}

/** Une ligne lisible : « 10 min d'échauffement · 3 × 10 min en zone 4 · 8 min de retour au calme » */
export function resumeStructure(blocs: BlocStructure[]): string {
  return blocs.map((b) => (b.type === 'interval' ? b.name : `${b.work.min} min ${b.type === 'warmup' ? 'd\'échauffement' : b.type === 'cooldown' ? 'de retour au calme' : 'continues'}`)).join(' · ');
}

// ---------- Une séance sur mesure (« jeudi plutôt 4 × 8 min au seuil ») ----------

/** Ce que l'utilisateur veut : des intervalles (répétitions, durée de l'effort, durée de la récupération) ou un effort continu, dans une zone de 1 à 5 */
export interface SpecSurMesure {
  genre: 'intervalles' | 'continu';
  zone: number;
  /** Intervalles : nombre de répétitions, durée de l'effort et de la récupération (minutes entières) */
  reps?: number;
  minutesTravail?: number;
  minutesRecup?: number;
  /** Continu : la durée de l'effort seul (l'échauffement et le retour au calme s'ajoutent) */
  minutes?: number;
}

export interface SeanceSurMesure {
  structure: BlocStructure[];
  /** Durée totale (échauffement et retour au calme compris) */
  minutes: number;
  /** La clé du menu (récupération, endurance, tempo, seuil…) la plus proche de la zone : le validateur s'en sert pour la charge et l'intensité */
  type: string;
  nom: string;
  resume: string;
}

/** Le type du menu qui correspond à une zone : c'est lui que le validateur lit (charge estimée, séance dure ou non) */
const TYPE_PAR_ZONE: Record<FamilleCoach, string[]> = {
  velo: ['recuperation', 'endurance', 'tempo', 'seuil', 'vo2max'],
  course: ['footing_recuperation', 'footing_facile', 'tempo', 'seuil', 'fractionne'],
  natation: ['technique', 'endurance', 'seuil', 'seuil', 'vitesse'],
};

const borner = (x: number, min: number, max: number) => Math.min(max, Math.max(min, x));

/**
 * Construit la structure demandée, avec un échauffement et un retour au calme proportionnés. La durée totale est la somme EXACTE des blocs.
 * Les nombres sont supposés déjà vérifiés par la lecture de l'outil (entiers, bornes) ; ici on ne fait que construire.
 */
export function structureSurMesure(sport: FamilleCoach, spec: SpecSurMesure): SeanceSurMesure {
  const metric = METRIQUE[sport];
  const zone = borner(Math.round(spec.zone), 1, 5);
  const type = TYPE_PAR_ZONE[sport][zone - 1];
  let corps: BlocStructure;
  let duree: number;
  let nom: string;
  if (spec.genre === 'intervalles') {
    const reps = Math.round(spec.reps as number);
    const travail = Math.round(spec.minutesTravail as number);
    const recup = Math.max(1, Math.round(spec.minutesRecup as number));
    duree = reps * (travail + recup);
    nom = `${reps} × ${travail} min en zone ${zone}`;
    corps = { type: 'interval', name: nom, reps, metric, unit: 'zone', work: segment(metric, zone, travail), rec: segment(metric, 1, recup) };
  } else {
    duree = Math.round(spec.minutes as number);
    nom = `${duree} min en zone ${zone}`;
    corps = bloc('steady', nom, metric, zone, duree);
  }
  const echauf = borner(Math.round(duree * (spec.genre === 'intervalles' ? 0.3 : 0.15)), spec.genre === 'intervalles' ? 8 : 5, 15);
  const retour = borner(Math.round(duree * (spec.genre === 'intervalles' ? 0.2 : 0.1)), 5, 10);
  const structure = [bloc('warmup', 'Échauffement', metric, 1, echauf), corps, bloc('cooldown', 'Retour au calme', metric, 1, retour)];
  return { structure, minutes: echauf + duree + retour, type, nom, resume: resumeStructure(structure) };
}
