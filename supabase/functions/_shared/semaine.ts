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
import { reglesDuProfil } from './profil-coureur.ts';
import type { ProfilCoureur } from './profil-coureur.ts';

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

type Role = 'facile' | 'qualite' | 'longue';

/**
 * La raison d'une séance, écrite d'après sa place DANS la semaine (une phrase vague comme « construire ta base » ne dit rien à l'utilisateur) :
 * une séance facile dit si elle suit ou précède une séance dure ; la qualité et la longue disent ce qu'elles travaillent.
 */
export function justificationSemaine(role: Role, minutes: number, apresUneDure: boolean, avantUneDure: boolean): string {
  if (role === 'qualite') return "Ta séance de qualité de la semaine : on travaille l'allure, et le reste de la semaine reste facile autour pour bien l'encaisser.";
  if (role === 'longue') return `Ta sortie longue de la semaine (${minutes} min) : elle développe l'endurance, à un rythme tranquille.`;
  if (apresUneDure) return 'Séance facile le lendemain d\'une séance dure : elle détend les jambes sans les fatiguer.';
  if (avantUneDure) return 'Séance facile la veille d\'une séance dure : tu arrives frais pour elle.';
  return `Séance facile de ${minutes} min : elle ajoute du volume à ta base sans te fatiguer.`;
}

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
  /** Ce que le profil du coureur a changé dans la semaine (vide si rien) : le coach le dit */
  profilUtilise: string[];
}

/**
 * Construit une semaine d'ajouts. Fonction pure : aucune lecture de base. `seances` = les séances déjà prévues (elles occupent leur jour).
 * Ne supprime et ne déplace jamais rien : elle ne fait qu'ajouter.
 */
export function planifierSemaine(d: DemandeSemaine, seances: SeancePrevue[], base: ContexteValidation, habitudes: Record<FamilleCoach, Habitude>, coureur: ProfilCoureur | null = null): ResultatSemaine {
  const abandons: string[] = [];
  const regles = reglesDuProfil(coureur);
  const profilUtilise: string[] = [];
  const aujourdhui = base.aujourdhui;
  const horizon = ajouterJours(aujourdhui, HORIZON_TECHNIQUE_JOURS);
  const debut = d.debut && d.debut > aujourdhui ? d.debut : d.debut === aujourdhui ? aujourdhui : ajouterJours(aujourdhui, 1);
  const jours = borner(Math.round(d.jours ?? 7), 1, JOURS_MAX);
  const fin = ajouterJours(debut, jours - 1) > horizon ? horizon : ajouterJours(debut, jours - 1);
  if (debut > horizon) return { operations: [], abandons: ["Cette date est trop lointaine pour être vraie : vérifie l'année."], profilUtilise };

  // Les jours où une séance est possible : ni libre demandé, ni indisponible, ni repos, ni compétition, ni déjà occupé
  const pris = new Set(seances.map((s) => s.date));
  const interdits = new Set(d.joursLibres ?? []);
  const libres: string[] = [];
  for (let j = debut; j <= fin; j = ajouterJours(j, 1)) {
    if (interdits.has(j) || regles.joursInterdits.has(nomDuJour(j)) || pris.has(j) || base.joursDeRepos.includes(j) || base.competitions.some((c) => c.date === j)) continue;
    if (base.indisponibilites.some((i) => entre(j, i.du, i.au))) continue;
    libres.push(j);
  }
  if (!libres.length) return { operations: [], abandons: ["Aucun jour libre sur cette période : tout est déjà pris, en repos, indisponible ou réservé."], profilUtilise };
  if (regles.joursInterdits.size) profilUtilise.push(`aucune séance ${[...regles.joursInterdits].join(', ')}`);

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
  const facileSeulement = (d.intensite ?? 'normale') === 'facile' || base.gardeFou.intensiteMax === 'facile' || regles.blessureActive;
  if (regles.blessureActive) profilUtilise.push('blessure encore là : que du facile, ni qualité ni sortie longue');
  if (!facileSeulement) {
    for (const [sport, positions] of parSport) {
      const h = habitudes[sport];
      const typeLongue = LONGUE[sport] ? MENU[sport].find((t) => t.cle === LONGUE[sport]) : undefined;
      const longuePossible = !!typeLongue && h.plusLongueMinutes !== null && h.plusLongueMinutes >= LONGUE_MINI[sport] && positions.length >= 2;
      if (longuePossible) roles[positions[positions.length - 1]] = 'longue';
      // Profil : prudence (blessure des 12 derniers mois) = pas de qualité en plus de la sortie longue ; elle évite le fractionné = pas de séance au seuil en natation
      const prudence = regles.prudent && longuePossible;
      const natationSansFractionne = regles.evite && sport === 'natation';
      // Qualité : seulement si la personne fait déjà ce sport (un historique), avec au moins 3 séances de ce sport dans la période (fiche course-distribution-intensite : 3 séances = 1 séance de qualité) ; l'ancien seuil « CTL ≥ 30 » n'avait pas de source
      const qualitePossible = h.moyenneMinutes !== null && positions.length >= 3 && !prudence && !natationSansFractionne;
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
  const dureeBrute = (sport: FamilleCoach, role: Role): number => {
    const h = habitudes[sport];
    const moyenne = h.moyenneMinutes ?? DUREE_PAR_DEFAUT[sport];
    const voulu = role === 'longue' ? (h.plusLongueMinutes ?? moyenne) * 1.05 : role === 'qualite' ? moyenne * 0.85 : moyenne;
    return Math.max(DUREE_MINI, Math.round(voulu));
  };
  // Profil : la plus grosse semaine de course déjà faite plafonne le volume de course de la semaine (jamais en dessous de ce qu'il fait déjà d'habitude)
  let facteurPic = 1;
  const posCourse = sports.map((s, i) => (s === 'course' ? i : -1)).filter((i) => i >= 0);
  if (regles.picHebdo !== null && posCourse.length) {
    const parSemaine = 7 / jours;
    const total = posCourse.reduce((t, i) => t + dureeBrute('course', roles[i]), 0) * parSemaine;
    const plancher = (habitudes.course.moyenneMinutes ?? 0) * posCourse.length * parSemaine;
    const plafond = Math.max(regles.picHebdo, plancher);
    if (total > plafond) { facteurPic = plafond / total; profilUtilise.push(`volume de course limité à ta plus grosse semaine (${regles.picHebdo} min)`); }
  }
  const duree = (sport: FamilleCoach, role: Role): number => (sport === 'course' && facteurPic < 1 ? Math.max(DUREE_MINI, Math.round(dureeBrute(sport, role) * facteurPic)) : dureeBrute(sport, role));
  /** Durée max d'un jour (profil) : aucune séance plus longue ce jour-là */
  const maxDuJour = (j: string): number => regles.minutesMax[nomDuJour(j)] ?? Infinity;
  let dureeLimitee = false;

  const operations: Operation[] = [];
  let restantes: SeancePrevue[] = seances.map((s) => ({ ...s }));
  const noms = (sport: FamilleCoach) => (sport === 'velo' ? 'vélo' : sport === 'course' ? 'course' : 'natation');
  const utilises = new Set<string>();
  /** Le rôle réellement placé chaque jour (une séance dure peut être redescendue en facile) */
  const rolePlace = new Map<string, Role>();

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
      const cap = maxDuJour(jour);
      if (cap < DUREE_MINI) return `la durée maximale que tu m'as donnée pour ce jour (${cap} min) est trop courte pour une séance`;
      const minutesPour = (r: Role): number => { const m = duree(sport, r); if (m > cap) dureeLimitee = true; return Math.min(m, cap); };
      const essais: { role: Role; type: string; minutes: number }[] = [{ role: roleInitial, type: typeInitial, minutes: minutesPour(roleInitial) }];
      // Dernier recours : la séance facile du sport
      if (roleInitial !== 'facile') essais.push({ role: 'facile', type: FACILE[sport], minutes: minutesPour('facile') });

      let erreur = '';
      for (const e of essais) {
        const p: Proposition = { date: jour, sport, type: e.type, minutes: e.minutes };
        const v = validerSeance(p, ctxAvec(base, restantes, base.indisponibilites));
        if (v.ok) {
          operations.push({ op: 'ajouter', proposition: p, justification: '' });
          rolePlace.set(jour, e.role);
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

  // Les raisons s'écrivent une fois la semaine posée : elles dépendent des séances voisines
  const dure = (jour: string) => rolePlace.get(jour) === 'qualite' || rolePlace.get(jour) === 'longue';
  for (const o of operations) {
    if (o.op !== 'ajouter') continue;
    const jour = o.proposition.date;
    const role = rolePlace.get(jour);
    if (role) o.justification = justificationSemaine(role, o.proposition.minutes, dure(ajouterJours(jour, -1)), dure(ajouterJours(jour, 1)));
  }

  if (dureeLimitee) profilUtilise.push(`durée limitée ${Object.entries(regles.minutesMax).map(([j, m]) => `${j} ${m} min`).join(', ')}`);
  return { operations, abandons, profilUtilise };
}

/** Pour les tests et les messages : le jour de la semaine d'une date (« jeudi ») */
export const jourDe = (date: string): string => nomDuJour(date);
export const joursEntre = (a: string, b: string): number => ecartJours(a, b);
