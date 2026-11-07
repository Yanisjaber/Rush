// ============================================================
// Validateur de séances du coach IA (docs/ia/CADRAGE_IA.md).
//
// Claude peut sortir un plan incohérent avec aplomb : AUCUNE séance ne devient une carte, ni ne s'écrit dans le
// calendrier, sans passer ici. C'est le même contrôle à deux moments : quand le modèle propose (sinon on le redemande)
// et quand l'utilisateur tape « Ajouter » (le calendrier a pu changer entre-temps).
//
// Deux couches de règles :
//   1. Les RÉGLAGES de l'utilisateur (hausse hebdo max, séances dures d'affilée, repos par semaine, longueur de séance).
//      Il les change à tout moment ; `normaliserReglages` les ramène toujours dans les bornes.
//   2. Les PLAFONDS ABSOLUS, fixes pour tout le monde : jamais de séance un jour malade / blessé / indisponible,
//      hausse hebdo jamais au-dessus de PLAFONDS.hausseHebdoMaxPct, durée maximale par sport.
//
// Fonction pure : aucune lecture de base, aucun réseau. Le contexte vient du résumé `rpc_coach_resume`
// (supabase/migrations/2026-11-06_rpc_coach_resume.sql) et du garde-fou (garde-fou.ts).
// ============================================================
import { ajouterJours, dateValide, ecartJours, entre } from './dates-iso.ts';
import type { DecisionGardeFou } from './garde-fou.ts';
import { estFamilleCoach, PLAFOND_MINUTES, tssEstime, typeSeance } from './menu-seances.ts';
import type { FamilleCoach } from './menu-seances.ts';

export interface Proposition {
  date: string;
  sport: string;
  type: string;
  minutes: number;
}

export interface ReglagesCoach {
  /** Hausse de charge maximale d'une semaine glissante par rapport à la moyenne des 4 dernières semaines, en % */
  hausseHebdoMaxPct: number;
  /** Nombre maximal de jours durs consécutifs (1 = jamais deux d'affilée) */
  duresAffileeMax: number;
  /** Jours sans séance minimum sur 7 jours glissants (0 = pas de contrainte) */
  reposMinParSemaine: number;
  /** Une séance ne dépasse pas ce multiple de la plus longue des 28 derniers jours (dans ce sport) */
  facteurLongueMax: number;
}

export const REGLAGES_DEFAUT: ReglagesCoach = { hausseHebdoMaxPct: 10, duresAffileeMax: 1, reposMinParSemaine: 1, facteurLongueMax: 2 };

/** Plafonds ABSOLUS : l'utilisateur ne peut pas les dépasser, quoi qu'il demande. */
export const PLAFONDS = {
  hausseHebdoMaxPct: 20,
  duresAffileeMax: 2,
  facteurLongueMax: 3,
  /** Une charge hebdo de départ ne bloque jamais en dessous de ce seuil (reprise, début d'historique) */
  plancherHebdoTss: 60,
  /** Une séance peut être placée jusqu'à 14 jours à l'avance */
  horizonJours: 14,
  /** Longueur permise quand le sport n'a aucune séance dans les 28 derniers jours */
  minutesSansHistorique: 60,
  /** Longueur toujours permise, même si l'historique est court */
  minutesToujoursPermises: 90,
} as const;

function borner(x: unknown, min: number, max: number, defaut: number, entier = false): number {
  const n = typeof x === 'number' ? x : typeof x === 'string' && x.trim() !== '' ? Number(x) : NaN;
  if (!Number.isFinite(n)) return defaut;
  const v = Math.min(max, Math.max(min, n));
  return entier ? Math.round(v) : v;
}

/** Ramène des réglages venus de n'importe où (base, formulaire, chat) à des valeurs valides, jamais au-delà des plafonds. */
export function normaliserReglages(brut: unknown): ReglagesCoach {
  const r = (brut && typeof brut === 'object' ? brut : {}) as Record<string, unknown>;
  return {
    hausseHebdoMaxPct: borner(r.hausseHebdoMaxPct, 0, PLAFONDS.hausseHebdoMaxPct, REGLAGES_DEFAUT.hausseHebdoMaxPct),
    duresAffileeMax: borner(r.duresAffileeMax, 1, PLAFONDS.duresAffileeMax, REGLAGES_DEFAUT.duresAffileeMax, true),
    reposMinParSemaine: borner(r.reposMinParSemaine, 0, 3, REGLAGES_DEFAUT.reposMinParSemaine, true),
    facteurLongueMax: borner(r.facteurLongueMax, 1, PLAFONDS.facteurLongueMax, REGLAGES_DEFAUT.facteurLongueMax),
  };
}

export interface ContexteValidation {
  /** Aujourd'hui, « AAAA-MM-JJ » */
  aujourdhui: string;
  /** CTL actuel, null si inconnu (sert à repérer un jour « dur » d'après sa charge) */
  ctl: number | null;
  /** Moyenne hebdomadaire de la charge sur 28 jours (charge.moyenne_hebdo_28_jours) */
  referenceHebdoTss: number;
  /** Les 14 derniers jours (derniers_jours du résumé) */
  joursPasses: { date: string; tss: number }[];
  /** Les séances déjà prévues (prevues du résumé) */
  prevues: { date: string; tss: number | null }[];
  indisponibilites: { type: 'maladie' | 'blessure' | 'indisponible'; du: string; au: string }[];
  joursDeRepos: string[];
  competitions: { date: string }[];
  /** plus_longue_minutes_28_jours par sport (absent = aucune séance de ce sport) */
  plusLongueMinutes: Partial<Record<FamilleCoach, number>>;
  gardeFou: DecisionGardeFou;
  reglages: ReglagesCoach;
}

export interface Probleme {
  code: string;
  message: string;
}

export interface ResultatValidation {
  ok: boolean;
  erreurs: Probleme[];
  avertissements: Probleme[];
  /** Charge estimée de la séance (null si la proposition est inutilisable) */
  tssEstime: number | null;
}

const NOM_PERIODE = { maladie: 'maladie', blessure: 'blessure', indisponible: 'indisponibilité' } as const;

/** Un jour « dur » : il dépasse 1,6 fois la charge quotidienne moyenne de l'athlète (CTL), et au moins 60 points. */
export function seuilJourDur(ctl: number | null): number {
  return Math.max(60, 1.6 * (ctl && Number.isFinite(ctl) ? ctl : 0));
}

/** Règles du JOUR choisi : ni passé, ni trop loin, ni indisponible, ni repos déclaré, ni compétition. Commun à l'ajout et au déplacement. */
function controlerJour(date: string, c: ContexteValidation, echec: (code: string, message: string) => void): void {
  // 3. Le jour : ni passé, ni trop loin, ni indisponible, ni repos déclaré, ni jour de compétition
  if (date < c.aujourdhui) echec('date_passee', 'Cette date est déjà passée.');
  if (ecartJours(c.aujourdhui, date) > PLAFONDS.horizonJours) echec('date_trop_loin', `Je planifie au plus ${PLAFONDS.horizonJours} jours à l'avance.`);
  const indispo = c.indisponibilites.find((i) => entre(date, i.du, i.au));
  if (indispo) echec('jour_indisponible', `Pas de séance ce jour-là : tu as déclaré une ${NOM_PERIODE[indispo.type]}.`);
  if (c.joursDeRepos.includes(date)) echec('jour_de_repos', "Ce jour est un jour de repos que tu as posé.");
  if (c.competitions.some((x) => x.date === date)) echec('jour_de_competition', 'Ce jour-là, tu as une compétition.');
}

/** Règles de CHARGE d'un jour qui reçoit une séance de `tss` points : jours durs d'affilée, hausse de la semaine, repos de la semaine. Commun à l'ajout et au déplacement. */
function controlerCharge(
  date: string,
  tss: number,
  dure: boolean,
  c: ContexteValidation,
  echec: (code: string, message: string) => void,
  avertissements: Probleme[],
): void {
  // 5. La charge de chaque jour : le passé (réel) et l'avenir (prévu), séances prévues déjà passées ignorées
  const chargeDuJour = new Map<string, number>();
  for (const j of c.joursPasses) if (j.date <= c.aujourdhui) chargeDuJour.set(j.date, (chargeDuJour.get(j.date) ?? 0) + (j.tss || 0));
  for (const x of c.prevues) if (x.date > c.aujourdhui) chargeDuJour.set(x.date, (chargeDuJour.get(x.date) ?? 0) + (x.tss ?? 0));
  const existantCeJour = chargeDuJour.get(date) ?? 0;
  if (c.prevues.some((x) => x.date === date)) avertissements.push({ code: 'deja_une_seance', message: 'Tu as déjà une séance prévue ce jour-là.' });
  const avec = new Map(chargeDuJour);
  avec.set(date, existantCeJour + tss);

  // 6. Pas trop de jours durs d'affilée
  const seuilDur = seuilJourDur(c.ctl);
  const estDur = (jour: string) => (jour === date ? dure || (avec.get(jour) ?? 0) >= seuilDur : (avec.get(jour) ?? 0) >= seuilDur);
  if (estDur(date)) {
    let serie = 1;
    for (let i = 1; estDur(ajouterJours(date, -i)); i++) serie++;
    for (let i = 1; estDur(ajouterJours(date, i)); i++) serie++;
    if (serie > c.reglages.duresAffileeMax) {
      echec('dures_affilee', c.reglages.duresAffileeMax === 1
        ? 'Ça ferait deux jours durs de suite : je laisse un jour plus calme entre deux séances dures.'
        : `Ça ferait ${serie} jours durs de suite, c'est plus que ta limite (${c.reglages.duresAffileeMax}).`);
    }
    // La veille d'une compétition : rien de dur
    if (c.competitions.some((x) => x.date === ajouterJours(date, 1))) echec('veille_competition', 'Pas de séance dure la veille d\'une compétition.');
  }

  // 7. Hausse de charge : la semaine glissante qui se termine ce jour-là, comparée à la moyenne des 4 dernières semaines
  const debutSemaine = ajouterJours(date, -6);
  let chargeSemaine = 0;
  let joursActifs = 0;
  for (let i = 0; i < 7; i++) {
    const t = avec.get(ajouterJours(debutSemaine, i)) ?? 0;
    chargeSemaine += t;
    if (t > 0) joursActifs++;
  }
  const ref = Math.max(0, c.referenceHebdoTss);
  // arrondis au dixième : 100 × 1,1 vaut 110,00000000000001 en virgule flottante, et une séance qui tombe pile sur la limite doit passer
  const plafondUtilisateur = Math.max(PLAFONDS.plancherHebdoTss, Math.round(ref * (1 + c.reglages.hausseHebdoMaxPct / 100) * 10) / 10);
  const plafondAbsolu = Math.max(PLAFONDS.plancherHebdoTss, Math.round(ref * (1 + PLAFONDS.hausseHebdoMaxPct / 100) * 10) / 10);
  if (chargeSemaine > plafondAbsolu) {
    echec('hausse_hebdo_plafond', `Ça ferait une semaine bien trop chargée (${Math.round(chargeSemaine)} points pour une base de ${Math.round(ref)}) : c'est au-dessus de la limite de sécurité.`);
  } else if (chargeSemaine > plafondUtilisateur) {
    echec('hausse_hebdo', `Ça ferait une semaine à ${Math.round(chargeSemaine)} points, alors que ta limite est à ${Math.round(plafondUtilisateur)} (+${c.reglages.hausseHebdoMaxPct} % sur tes 4 dernières semaines).`);
  }

  // 8. Au moins N jours sans séance sur 7 jours glissants
  if (7 - joursActifs < c.reglages.reposMinParSemaine) {
    echec('repos_hebdo', `Il te faut au moins ${c.reglages.reposMinParSemaine} jour(s) sans séance sur 7 jours.`);
  }
}

export function validerSeance(p: Proposition, c: ContexteValidation): ResultatValidation {
  const erreurs: Probleme[] = [];
  const avertissements: Probleme[] = [];
  const echec = (code: string, message: string) => erreurs.push({ code, message });

  // 1. La forme de la proposition (tout vient du modèle : on ne lui fait pas confiance)
  if (!dateValide(p?.date)) echec('date_invalide', "La date n'est pas valide.");
  if (!estFamilleCoach(p?.sport)) echec('sport_inconnu', 'Ce sport ne fait pas partie de ceux que je sais planifier.');
  const type = typeSeance(p?.sport, p?.type);
  if (estFamilleCoach(p?.sport) && !type) echec('type_inconnu', "Ce type de séance n'existe pas pour ce sport.");
  const minutes = p?.minutes;
  if (typeof minutes !== 'number' || !Number.isFinite(minutes) || minutes <= 0) echec('minutes_invalides', 'La durée doit être un nombre de minutes positif.');
  if (erreurs.length || !type || typeof minutes !== 'number') return { ok: false, erreurs, avertissements, tssEstime: null };

  const sport = p.sport as FamilleCoach;
  const date = p.date;
  const tss = tssEstime(type, minutes);

  // 2. Durée : dans le menu, sous le plafond du sport, et pas démesurée par rapport à ce que fait l'utilisateur
  if (minutes < type.minMinutes || minutes > type.maxMinutes) {
    echec('duree_hors_menu', `Pour « ${type.nom} », la durée doit être entre ${type.minMinutes} et ${type.maxMinutes} minutes.`);
  }
  if (minutes > PLAFOND_MINUTES[sport]) echec('duree_plafond', `Une séance de plus de ${PLAFOND_MINUTES[sport]} minutes dépasse la limite de sécurité.`);
  const plusLongue = c.plusLongueMinutes[sport];
  const limiteLongueur = plusLongue
    ? Math.max(PLAFONDS.minutesToujoursPermises, Math.round(c.reglages.facteurLongueMax * plusLongue))
    : PLAFONDS.minutesSansHistorique;
  if (minutes > limiteLongueur) {
    echec('seance_trop_longue', `Ce serait trop long par rapport à ce que tu fais en ce moment (au plus ${limiteLongueur} minutes pour l'instant).`);
  }

  controlerJour(date, c, echec);

  // 4. Le garde-fou santé a le dernier mot
  if (!c.gardeFou.autoriserCartes) echec('garde_fou', c.gardeFou.message ?? "Pas de séance pour l'instant.");
  else if (c.gardeFou.intensiteMax === 'facile' && type.zone > 2) echec('intensite_trop_haute', "Pour l'instant, je ne propose que des séances faciles (zones 1 et 2).");

  controlerCharge(date, tss, type.dure, c, echec, avertissements);

  return { ok: erreurs.length === 0, erreurs, avertissements, tssEstime: tss };
}

// ============================================================
// Déplacer une séance DÉJÀ prévue (replanification, docs/ia/PLAN_COACH_COMPLET.md)
// ============================================================

export interface SeanceADeplacer {
  date: string;
  sport: string | null;
  minutes: number | null;
  tss: number | null;
}

/** Une séance prévue n'a pas de « type » du menu : on la juge dure d'après sa charge par heure (75 points par heure ou plus). */
export function estSeanceDure(tss: number | null, minutes: number | null): boolean {
  return typeof tss === 'number' && typeof minutes === 'number' && minutes > 0 && (tss * 60) / minutes >= 75;
}

/**
 * Peut-on mettre cette séance prévue à une autre date ? Mêmes règles de JOUR et de CHARGE que pour une nouvelle séance.
 * L'appelant retire la séance de `c.prevues` avant (sinon elle compterait deux fois).
 */
export function validerDeplacement(s: SeanceADeplacer, vers: string, c: ContexteValidation): ResultatValidation {
  const erreurs: Probleme[] = [];
  const avertissements: Probleme[] = [];
  const echec = (code: string, message: string) => erreurs.push({ code, message });
  if (!dateValide(vers)) {
    echec('date_invalide', "La nouvelle date n'est pas valide.");
    return { ok: false, erreurs, avertissements, tssEstime: null };
  }
  if (vers === s.date) {
    echec('meme_jour', 'La séance est déjà prévue ce jour-là.');
    return { ok: false, erreurs, avertissements, tssEstime: null };
  }
  const tss = s.tss ?? 0;
  if (s.tss === null) avertissements.push({ code: 'charge_inconnue', message: "La charge de cette séance n'est pas connue : je ne peux pas vérifier la semaine." });
  const dure = estSeanceDure(s.tss, s.minutes);

  controlerJour(vers, c, echec);
  // Le garde-fou santé a le dernier mot, comme pour une nouvelle séance
  if (!c.gardeFou.autoriserCartes) echec('garde_fou', c.gardeFou.message ?? "Pas de séance pour l'instant.");
  else if (c.gardeFou.intensiteMax === 'facile' && dure) echec('intensite_trop_haute', "Pour l'instant, je ne place que des séances faciles (zones 1 et 2).");
  controlerCharge(vers, tss, dure, c, echec, avertissements);
  return { ok: erreurs.length === 0, erreurs, avertissements, tssEstime: tss };
}
