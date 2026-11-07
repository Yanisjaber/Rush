// ============================================================
// Validateur de séances du coach IA (docs/ia/CADRAGE_IA.md).
//
// Claude peut sortir un plan incohérent avec aplomb : AUCUNE séance ne devient une carte, ni ne s'écrit dans le
// calendrier, sans passer ici. C'est le même contrôle à deux moments : quand le modèle propose (sinon on le redemande)
// et quand l'utilisateur tape « Ajouter » (le calendrier a pu changer entre-temps).
//
// Ce qui est vérifié (8 nov. 2026 : les réglages, la limite de charge, l'horizon de 14 jours et les bornes de durée ont été SUPPRIMÉS) :
//   la forme de la séance, un jour qui n'est ni passé, ni malade / blessé / indisponible, ni un jour de repos posé, ni une compétition ;
//   rien de dur la veille d'une compétition ; et le garde-fou santé, qui a toujours le dernier mot.
//
// Fonction pure : aucune lecture de base, aucun réseau. Le contexte vient du résumé `rpc_coach_resume`
// (supabase/migrations/2026-11-06_rpc_coach_resume.sql) et du garde-fou (garde-fou.ts).
// ============================================================
import { ajouterJours, dateValide, ecartJours, entre } from './dates-iso.ts';
import type { DecisionGardeFou } from './garde-fou.ts';
import { estFamilleCoach, MINUTES_MAX_TECHNIQUE, tssEstime, typeSeance } from './menu-seances.ts';

export interface Proposition {
  date: string;
  sport: string;
  type: string;
  minutes: number;
}

/**
 * Un plan peut aller loin : AUCUN horizon de 14 jours (décision de Yanis, 8 nov. : un plan d'un an est possible). Seule une borne technique
 * (environ trois ans) évite une date absurde écrite par erreur.
 */
export const HORIZON_TECHNIQUE_JOURS = 1100;

export interface ContexteValidation {
  /** Aujourd'hui, « AAAA-MM-JJ » */
  aujourdhui: string;
  /** CTL actuel, null si inconnu (sert à repérer un jour « dur » d'après sa charge) */
  ctl: number | null;
  /** Les 14 derniers jours (derniers_jours du résumé) */
  joursPasses: { date: string; tss: number }[];
  /** Les séances déjà prévues (prevues du résumé) */
  prevues: { date: string; tss: number | null }[];
  indisponibilites: { type: 'maladie' | 'blessure' | 'indisponible'; du: string; au: string }[];
  joursDeRepos: string[];
  competitions: { date: string }[];
  gardeFou: DecisionGardeFou;
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

/**
 * Règles du JOUR choisi : pas dans le passé, ni dans une période déclarée (maladie, blessure, indisponibilité), ni un jour de repos posé,
 * ni un jour de compétition. Commun à l'ajout et au déplacement. Aucun horizon : on peut planifier aussi loin qu'on veut.
 */
function controlerJour(date: string, c: ContexteValidation, echec: (code: string, message: string) => void): void {
  if (date < c.aujourdhui) echec('date_passee', 'Cette date est déjà passée.');
  if (ecartJours(c.aujourdhui, date) > HORIZON_TECHNIQUE_JOURS) echec('date_absurde', "Cette date est trop lointaine pour être vraie : vérifie l'année.");
  const indispo = c.indisponibilites.find((i) => entre(date, i.du, i.au));
  if (indispo) echec('jour_indisponible', `Pas de séance ce jour-là : tu as déclaré une ${NOM_PERIODE[indispo.type]}.`);
  if (c.joursDeRepos.includes(date)) echec('jour_de_repos', "Ce jour est un jour de repos que tu as posé.");
  if (c.competitions.some((x) => x.date === date)) echec('jour_de_competition', 'Ce jour-là, tu as une compétition.');
}

/**
 * Ce qui reste d'une séance qui s'ajoute à un jour de `tss` points : un avertissement si le jour a déjà une séance, et rien de dur la veille d'une
 * compétition. Plus de limite de charge, de jours durs d'affilée ni de repos : ces règles ont été supprimées (8 nov. 2026), le coach garde de
 * bonnes habitudes dans ses générateurs, il ne REFUSE plus pour ces motifs.
 */
function controlerCharge(
  date: string,
  tss: number,
  dure: boolean,
  c: ContexteValidation,
  echec: (code: string, message: string) => void,
  avertissements: Probleme[],
): void {
  if (c.prevues.some((x) => x.date === date)) avertissements.push({ code: 'deja_une_seance', message: 'Tu as déjà une séance prévue ce jour-là.' });
  if (!c.competitions.some((x) => x.date === ajouterJours(date, 1))) return;
  // La veille d'une compétition : rien de dur (un type dur, ou un jour dont la charge dépasse le seuil d'un jour dur)
  let chargeDuJour = tss;
  for (const x of c.prevues) if (x.date === date && x.date > c.aujourdhui) chargeDuJour += x.tss ?? 0;
  if (dure || chargeDuJour >= seuilJourDur(c.ctl)) echec('veille_competition', "Pas de séance dure la veille d'une compétition.");
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
  // Une durée libre : n'importe quel nombre entier de minutes (67 min passe), seulement strictement positif et pas absurde
  if (typeof minutes !== 'number' || !Number.isInteger(minutes) || minutes <= 0 || minutes > MINUTES_MAX_TECHNIQUE) {
    echec('minutes_invalides', `La durée doit être un nombre entier de minutes, entre 1 et ${MINUTES_MAX_TECHNIQUE}.`);
  }
  if (erreurs.length || !type || typeof minutes !== 'number') return { ok: false, erreurs, avertissements, tssEstime: null };

  const date = p.date;
  const tss = tssEstime(type, minutes);

  controlerJour(date, c, echec);

  // 2. Le garde-fou santé a le dernier mot
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
 * Peut-on mettre cette séance prévue à une autre date ? Mêmes règles de JOUR que pour une nouvelle séance (plus la veille de compétition et le garde-fou).
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
  const dure = estSeanceDure(s.tss, s.minutes);

  controlerJour(vers, c, echec);
  // Le garde-fou santé a le dernier mot, comme pour une nouvelle séance
  if (!c.gardeFou.autoriserCartes) echec('garde_fou', c.gardeFou.message ?? "Pas de séance pour l'instant.");
  else if (c.gardeFou.intensiteMax === 'facile' && dure) echec('intensite_trop_haute', "Pour l'instant, je ne place que des séances faciles (zones 1 et 2).");
  controlerCharge(vers, tss, dure, c, echec, avertissements);
  return { ok: erreurs.length === 0, erreurs, avertissements, tssEstime: tss };
}
