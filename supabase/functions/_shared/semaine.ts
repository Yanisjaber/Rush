// ============================================================
// Planifier une semaine : « fais-moi ma semaine » (docs/ia/PLAN_COACH_COMPLET.md).
//
// Le modèle TRADUIT la demande (« deux sorties vélo et deux footings, pas le mardi ») en paramètres. Le CODE construit la semaine :
// il choisit les jours (bien espacés, jamais une séance un jour indisponible, de repos ou de compétition), les sports (en alternant),
// les types (facile d'abord, une séance de qualité et une sortie longue seulement si l'historique le permet) et les durées (d'après
// ce que l'utilisateur fait déjà). Chaque séance passe par le validateur ; une séance refusée est raccourcie, adoucie, puis abandonnée
// avec la raison. Le résultat est un plan d'ajouts, vérifié et présenté sur UNE carte, comme tous les plans.
// ============================================================
import { ajouterJours, ecartJours, entre, nomDuJour } from './dates-iso.ts';
import { MENU } from './menu-seances.ts';
import type { FamilleCoach } from './menu-seances.ts';
import { ctxAvec, etiquetteDate } from './planning.ts';
import type { Operation, SeancePrevue } from './planning.ts';
import { HORIZON_TECHNIQUE_JOURS, validerSeance } from './validateur.ts';
import type { ContexteValidation, Proposition } from './validateur.ts';

export interface DemandeSemaine {
  /** Premier jour à planifier (défaut : demain) */
  debut?: string;
  /** Nombre de jours (défaut 7, 14 au plus) */
  jours?: number;
  sports: { sport: FamilleCoach; seances: number }[];
  /** Jours sans séance (« pas le mardi », un voyage) */
  joursLibres?: string[];
  /** « facile » : que des séances faciles ; « normale » (défaut) : de la qualité et une sortie longue si l'historique le permet */
  intensite?: 'facile' | 'normale';
}

/** Ce que l'utilisateur fait déjà dans un sport : de quoi calibrer les durées */
export interface Habitude {
  /** Durée moyenne d'une séance sur 28 jours, null s'il n'en a pas fait */
  moyenneMinutes: number | null;
  /** Sa plus longue séance sur 28 jours, null s'il n'en a pas fait */
  plusLongueMinutes: number | null;
}

export const SEANCES_PAR_SPORT_MAX = 6;
export const SEANCES_TOTAL_MAX = 10;
const JOURS_MAX = 60;
/** Une bonne habitude du générateur (pas un refus du validateur) : au moins un jour sans séance sur chaque période de 7 jours */
const REPOS_PAR_SEMAINE = 1;
/** Une séance plus courte que ça n'a pas de sens : plancher des durées calculées */
const DUREE_MINI = 15;
/** La sortie longue n'est proposée que si la plus longue séance récente du sport atteint ce seuil (minutes) */
const LONGUE_MINI: Record<FamilleCoach, number> = { velo: 120, course: 60, natation: 0 };

const FACILE: Record<FamilleCoach, string> = { velo: 'endurance', course: 'footing_facile', natation: 'endurance' };
const QUALITE: Record<FamilleCoach, string> = { velo: 'tempo', course: 'tempo', natation: 'seuil' };
const LONGUE: Record<FamilleCoach, string | null> = { velo: 'sortie_longue', course: 'sortie_longue', natation: null };
/** Durée d'une séance facile quand on n'a aucun historique dans ce sport */
const DUREE_PAR_DEFAUT: Record<FamilleCoach, number> = { velo: 60, course: 40, natation: 30 };
/** On ne propose de la qualité qu'à partir d'une forme de fond de ce niveau (CTL) */
const CTL_MINI_QUALITE = 30;

type Role = 'facile' | 'qualite' | 'longue';

const JUSTIFICATION: Record<Role, string> = {
  facile: 'Une séance facile pour construire ta base sans te fatiguer.',
  qualite: 'Une séance de qualité pour travailler ton allure, entourée de séances faciles.',
  longue: 'Ta sortie longue de la semaine, à un rythme tranquille.',
};

const borner = (x: number, min: number, max: number) => Math.min(max, Math.max(min, x));

/** Les habitudes de l'utilisateur par sport, lues dans le résumé (volume_par_sport) */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function habitudesDepuisResume(resume: any): Record<FamilleCoach, Habitude> {
  const lire = (sport: FamilleCoach): Habitude => {
    const v = resume?.volume_par_sport?.[sport];
    const seances = typeof v?.seances_28_jours === 'number' ? v.seances_28_jours : 0;
    const minutes = typeof v?.minutes_28_jours === 'number' ? v.minutes_28_jours : 0;
    const longue = typeof v?.plus_longue_minutes_28_jours === 'number' && v.plus_longue_minutes_28_jours > 0 ? v.plus_longue_minutes_28_jours : null;
    return { moyenneMinutes: seances > 0 && minutes > 0 ? Math.round(minutes / seances) : null, plusLongueMinutes: longue };
  };
  return { velo: lire('velo'), course: lire('course'), natation: lire('natation') };
}

/** Les sports dans l'ordre où on les pose sur les jours choisis : on alterne, jamais deux fois le même sport de suite tant qu'on peut l'éviter */
function sequenceSports(sports: { sport: FamilleCoach; seances: number }[]): FamilleCoach[] {
  const restant = sports.map((s) => ({ ...s }));
  const sortie: FamilleCoach[] = [];
  let precedent: FamilleCoach | null = null;
  for (;;) {
    const candidats = restant.filter((s) => s.seances > 0);
    if (!candidats.length) return sortie;
    const autres = candidats.filter((s) => s.sport !== precedent);
    const pool = autres.length ? autres : candidats;
    pool.sort((a, b) => b.seances - a.seances);
    pool[0].seances--;
    precedent = pool[0].sport;
    sortie.push(pool[0].sport);
  }
}

/** n jours parmi ceux qui sont libres, le plus espacés possible (jamais deux jours collés quand on peut l'éviter) */
export function choisirJours(libres: string[], n: number): string[] {
  const m = libres.length;
  if (n >= m) return [...libres];
  if (n === 1) return [libres[Math.floor(m / 2)]];
  const idx = new Set<number>();
  for (let k = 0; k < n; k++) idx.add(Math.round((k * (m - 1)) / (n - 1)));
  // L'arrondi peut faire tomber deux séances sur le même indice : on complète par les indices libres les plus proches
  for (let i = 0; idx.size < n && i < m; i++) idx.add(i);
  return [...idx].sort((a, b) => a - b).map((i) => libres[i]);
}

export interface ResultatSemaine {
  operations: Operation[];
  /** Ce qui n'a pas pu être placé, avec la raison, une phrase chacun */
  abandons: string[];
}

/**
 * Construit une semaine d'ajouts. Fonction pure : aucune lecture de base. `seances` = les séances déjà prévues (elles occupent leur jour).
 * Ne supprime et ne déplace jamais rien : elle ne fait qu'ajouter.
 */
export function planifierSemaine(d: DemandeSemaine, seances: SeancePrevue[], base: ContexteValidation, habitudes: Record<FamilleCoach, Habitude>): ResultatSemaine {
  const abandons: string[] = [];
  const aujourdhui = base.aujourdhui;
  const horizon = ajouterJours(aujourdhui, HORIZON_TECHNIQUE_JOURS);
  const debut = d.debut && d.debut > aujourdhui ? d.debut : d.debut === aujourdhui ? aujourdhui : ajouterJours(aujourdhui, 1);
  const jours = borner(Math.round(d.jours ?? 7), 1, JOURS_MAX);
  const fin = ajouterJours(debut, jours - 1) > horizon ? horizon : ajouterJours(debut, jours - 1);
  if (debut > horizon) return { operations: [], abandons: ["Cette date est trop lointaine pour être vraie : vérifie l'année."] };

  // Les jours où une séance est possible : ni libre demandé, ni indisponible, ni repos, ni compétition, ni déjà occupé
  const pris = new Set(seances.map((s) => s.date));
  const interdits = new Set(d.joursLibres ?? []);
  const libres: string[] = [];
  for (let j = debut; j <= fin; j = ajouterJours(j, 1)) {
    if (interdits.has(j) || pris.has(j) || base.joursDeRepos.includes(j) || base.competitions.some((c) => c.date === j)) continue;
    if (base.indisponibilites.some((i) => entre(j, i.du, i.au))) continue;
    libres.push(j);
  }
  if (!libres.length) return { operations: [], abandons: ["Aucun jour libre sur cette période : tout est déjà pris, en repos, indisponible ou réservé."] };

  const demandes = d.sports.filter((s) => s.seances > 0);
  let total = Math.min(SEANCES_TOTAL_MAX, demandes.reduce((t, s) => t + Math.min(SEANCES_PAR_SPORT_MAX, s.seances), 0));
  // Au moins un jour sans séance par semaine (le réglage de l'utilisateur) : on ne remplit jamais tous les jours
  const reposMin = REPOS_PAR_SEMAINE;
  const maxSeances = Math.max(1, jours - Math.ceil(jours / 7) * reposMin - pris.size);
  if (total > maxSeances) {
    abandons.push(`Je limite à ${maxSeances} séance${maxSeances > 1 ? 's' : ''} : il te faut au moins ${reposMin} jour${reposMin > 1 ? 's' : ''} de repos par semaine.`);
    total = maxSeances;
  }
  if (total > libres.length) {
    abandons.push(`Je limite à ${libres.length} séance${libres.length > 1 ? 's' : ''} : il n'y a pas plus de jours libres.`);
    total = libres.length;
  }

  // Les sports à poser (en coupant ceux qui dépassent le total), les jours choisis, puis un sport par jour
  let reste = total;
  const retenus = demandes.map((s) => {
    const n = Math.min(Math.min(SEANCES_PAR_SPORT_MAX, s.seances), reste);
    reste -= n;
    return { sport: s.sport, seances: n };
  });
  const joursChoisis = choisirJours(libres, total);
  const sports = sequenceSports(retenus);

  // Le rôle de chaque séance : facile, sauf une qualité et une longue pour un sport qui en a plusieurs (et dont l'historique le permet)
  const parSport = new Map<FamilleCoach, number[]>();
  sports.forEach((s, i) => parSport.set(s, [...(parSport.get(s) ?? []), i]));
  const roles: Role[] = sports.map(() => 'facile');
  // « facile » demandé, ou le garde-fou santé ne veut que du facile : jamais de qualité ni de sortie longue
  const facileSeulement = (d.intensite ?? 'normale') === 'facile' || base.gardeFou.intensiteMax === 'facile';
  if (!facileSeulement) {
    for (const [sport, positions] of parSport) {
      const h = habitudes[sport];
      const typeLongue = LONGUE[sport] ? MENU[sport].find((t) => t.cle === LONGUE[sport]) : undefined;
      const longuePossible = !!typeLongue && h.plusLongueMinutes !== null && h.plusLongueMinutes >= LONGUE_MINI[sport] && positions.length >= 2;
      if (longuePossible) roles[positions[positions.length - 1]] = 'longue';
      const qualitePossible = base.ctl !== null && base.ctl >= CTL_MINI_QUALITE && positions.length >= 3;
      if (qualitePossible) roles[positions[Math.floor(positions.length / 2)]] = 'qualite';
    }
  }

  // Les sorties longues vont le week-end quand c'est possible : on échange leur jour avec une séance qui n'est pas longue
  const estWeekend = (j: string) => nomDuJour(j) === 'samedi' || nomDuJour(j) === 'dimanche';
  const jourLibresWeekend = joursChoisis.map((j, i) => (estWeekend(j) ? i : -1)).filter((i) => i >= 0);
  for (let i = 0; i < roles.length; i++) {
    if (roles[i] !== 'longue' || estWeekend(joursChoisis[i])) continue;
    const cible = jourLibresWeekend.find((w) => roles[w] !== 'longue');
    if (cible === undefined) continue;
    [sports[i], sports[cible]] = [sports[cible], sports[i]];
    [roles[i], roles[cible]] = [roles[cible], roles[i]];
  }

  // Les durées sont LIBRES : d'après ce que l'utilisateur fait déjà (sa moyenne, sa plus longue séance), en minutes entières, sans arrondi ni borne de type
  const duree = (sport: FamilleCoach, role: Role): number => {
    const h = habitudes[sport];
    const moyenne = h.moyenneMinutes ?? DUREE_PAR_DEFAUT[sport];
    const voulu = role === 'longue' ? (h.plusLongueMinutes ?? moyenne) * 1.05 : role === 'qualite' ? moyenne * 0.85 : moyenne;
    return Math.max(DUREE_MINI, Math.round(voulu));
  };

  const operations: Operation[] = [];
  let restantes: SeancePrevue[] = seances.map((s) => ({ ...s }));
  const noms = (sport: FamilleCoach) => (sport === 'velo' ? 'vélo' : sport === 'course' ? 'course' : 'natation');
  const utilises = new Set<string>();

  joursChoisis.forEach((jourChoisi, i) => {
    const sport = sports[i];
    const role = roles[i];
    const typeCle = role === 'longue' ? (LONGUE[sport] as string) : role === 'qualite' ? QUALITE[sport] : FACILE[sport];

    /** Essaie de placer cette séance CE jour-là, telle quelle, puis en version facile. Renvoie la raison du premier refus, ou null si elle est placée. */
    const tenter = (jour: string): string | null => {
      // La veille d'une compétition : jamais de qualité
      const veilleCompetition = base.competitions.some((c) => c.date === ajouterJours(jour, 1));
      const roleInitial: Role = veilleCompetition && role !== 'facile' ? 'facile' : role;
      const typeInitial = roleInitial === 'facile' ? FACILE[sport] : typeCle;
      const essais: { role: Role; type: string; minutes: number }[] = [{ role: roleInitial, type: typeInitial, minutes: duree(sport, roleInitial) }];
      // Dernier recours : la séance facile du sport
      if (roleInitial !== 'facile') essais.push({ role: 'facile', type: FACILE[sport], minutes: duree(sport, 'facile') });

      let erreur = '';
      for (const e of essais) {
        const p: Proposition = { date: jour, sport, type: e.type, minutes: e.minutes };
        const v = validerSeance(p, ctxAvec(base, restantes, base.indisponibilites));
        if (v.ok) {
          operations.push({ op: 'ajouter', proposition: p, justification: JUSTIFICATION[e.role] });
          restantes = [...restantes, { id: `nouvelle-${operations.length}`, date: jour, sport, minutes: e.minutes, tss: v.tssEstime, creeeParIa: true }];
          utilises.add(jour);
          return null;
        }
        if (!erreur) erreur = v.erreurs[0]?.message ?? '';
      }
      return erreur;
    };

    const refus = tenter(jourChoisi);
    if (refus === null) return;

    // Le jour choisi ne passe pas : on essaie les autres jours libres, les plus proches d'abord, en évitant les jours collés à une autre séance
    const autres = libres
      .filter((j) => j !== jourChoisi && !utilises.has(j) && !joursChoisis.includes(j))
      .map((j) => ({ j, colle: [...utilises, ...joursChoisis].some((u) => Math.abs(ecartJours(u, j)) === 1) ? 1 : 0, distance: Math.abs(ecartJours(jourChoisi, j)) }))
      .sort((a, b) => a.colle - b.colle || a.distance - b.distance || a.j.localeCompare(b.j));
    for (const { j } of autres) if (tenter(j) === null) return;

    abandons.push(`${etiquetteDate(jourChoisi)} : je n'ai pas pu placer la séance de ${noms(sport)} (${refus.replace(/\.$/, '')}).`);
  });

  return { operations, abandons };
}

/** Pour les tests et les messages : le jour de la semaine d'une date (« jeudi ») */
export const jourDe = (date: string): string => nomDuJour(date);
export const joursEntre = (a: string, b: string): number => ecartJours(a, b);
