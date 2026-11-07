// Les mots affichés sur une carte de séance du coach. Le menu complet vit côté serveur (supabase/functions/_shared/menu-seances.ts) :
// ici, seulement les noms. Un test (tests/coach/libelles.test.ts) vérifie que les deux listes restent les mêmes.
import type { CarteSeance, CartePlanning, EtatCarte, LignePlan } from './types.ts';

export const NOM_SPORT_COACH: Record<string, string> = { velo: 'Vélo', course: 'Course', natation: 'Natation' };

/** Le nom de chaque type de séance, par sport */
export const NOM_TYPE_COACH: Record<string, Record<string, string>> = {
  velo: { recuperation: 'Récupération', endurance: 'Endurance', tempo: 'Tempo', seuil: 'Seuil', vo2max: 'VO2max', sortie_longue: 'Sortie longue' },
  course: { footing_recuperation: 'Footing de récupération', footing_facile: 'Footing facile', sortie_longue: 'Sortie longue', tempo: 'Tempo', seuil: 'Seuil', fractionne: 'Fractionné', cotes: 'Côtes' },
  natation: { technique: 'Technique', endurance: 'Endurance', seuil: 'Seuil', vitesse: 'Vitesse' },
};

/** La famille de sport utilisée pour la couleur (course, velo, natation : les mêmes clés que le thème) */
export const sportDeCarte = (c: CarteSeance): string => (Object.hasOwn(NOM_SPORT_COACH, c.proposition.sport) ? c.proposition.sport : 'autre');

export function nomSport(sport: string): string {
  return Object.hasOwn(NOM_SPORT_COACH, sport) ? NOM_SPORT_COACH[sport] : 'Séance';
}

export function nomType(sport: string, type: string): string {
  const types = Object.hasOwn(NOM_TYPE_COACH, sport) ? NOM_TYPE_COACH[sport] : null;
  return types && Object.hasOwn(types, type) ? types[type] : type.replace(/_/g, ' ');
}

/** 90 → « 1 h 30 », 45 → « 45 min », 120 → « 2 h » */
export function dureeMinutes(minutes: number): string {
  const m = Math.max(0, Math.round(minutes));
  if (m < 60) return `${m} min`;
  const h = Math.floor(m / 60);
  const reste = m % 60;
  return reste ? `${h} h ${String(reste).padStart(2, '0')}` : `${h} h`;
}

const JOURS = ['dim.', 'lun.', 'mar.', 'mer.', 'jeu.', 'ven.', 'sam.'];
const MOIS = ['janv.', 'févr.', 'mars', 'avr.', 'mai', 'juin', 'juil.', 'août', 'sept.', 'oct.', 'nov.', 'déc.'];

/** « 2026-11-08 » → « dim. 8 nov. » (le jour de la semaine est calculé en UTC : pas de décalage selon le fuseau) */
export function jourCarte(iso: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso);
  if (!m) return iso;
  const d = new Date(Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3])));
  return `${JOURS[d.getUTCDay()]} ${Number(m[3])} ${MOIS[Number(m[2]) - 1]}`;
}

/** Le titre d'une carte : « Sortie endurance, 1 h 30 » devient « Endurance · 1 h 30 » */
export const titreCarte = (c: CarteSeance): string => `${nomType(c.proposition.sport, c.proposition.type)} · ${dureeMinutes(c.proposition.minutes)}`;

/** Chaque état se dit avec un MOT (jamais la couleur seule) */
export const MOT_ETAT: Record<EtatCarte, string> = {
  proposee: 'Proposée',
  en_cours: 'Ajout en cours…',
  ajoutee: 'Ajoutée au calendrier',
  refusee: 'Refusée',
  annulee: 'Annulée',
};

/** La phrase lue par VoiceOver pour une carte entière */
export function descriptionCarte(c: CarteSeance): string {
  const p = c.proposition;
  return `Séance proposée, ${nomSport(p.sport)}, ${nomType(p.sport, p.type)}, ${dureeMinutes(p.minutes)}, ${jourCarte(p.date)}, charge estimée ${Math.round(c.tss_estime)} points. ${MOT_ETAT[c.etat]}.`;
}

// ---------- La carte de planning ----------

/** Chaque état d'un plan se dit avec un MOT (jamais la couleur seule) */
export const MOT_ETAT_PLAN: Record<EtatCarte, string> = {
  proposee: 'En attente de ton accord',
  en_cours: 'Application en cours…',
  ajoutee: 'Appliqué à ton calendrier',
  refusee: 'Refusé par les règles',
  annulee: 'Plan annulé',
};

const NOM_PERIODE: Record<string, string> = { maladie: 'maladie', blessure: 'blessure', indisponible: 'indisponibilité' };
const accord = (n: number, un: string, plusieurs: string) => `${n} ${n > 1 ? plusieurs : un}`;

/** Le nom d'une période déclarée : « blessure », « maladie », « indisponibilité » */
export const nomPeriode = (type?: string): string => (type && Object.hasOwn(NOM_PERIODE, type) ? NOM_PERIODE[type] : 'période');

/** Les ajouts qui REMPLACENT une séance retirée (la reprise après maladie ou blessure), reconnus à la raison écrite par le serveur */
const estRemplacement = (l: LignePlan): boolean => l.op === 'ajouter' && l.raison === 'reprise progressive';

/** « 1 blessure · 3 séances remplacées · 2 retirées » : le plan en une ligne */
export function resumePlan(lignes: LignePlan[]): string {
  const periodes = lignes.filter((l) => l.op === 'indisponibilite');
  const remplacees = lignes.filter(estRemplacement).length;
  const retirees = Math.max(0, lignes.filter((l) => l.op === 'supprimer').length - remplacees);
  const deplacees = lignes.filter((l) => l.op === 'deplacer').length;
  const ajoutees = lignes.filter((l) => l.op === 'ajouter' && !estRemplacement(l)).length;
  const morceaux: string[] = [];
  for (const t of new Set(periodes.map((l) => l.type))) {
    const n = periodes.filter((l) => l.type === t).length;
    morceaux.push(accord(n, nomPeriode(t), `${nomPeriode(t)}s`));
  }
  if (deplacees) morceaux.push(accord(deplacees, 'séance déplacée', 'séances déplacées'));
  if (remplacees) morceaux.push(accord(remplacees, 'séance remplacée', 'séances remplacées'));
  if (retirees) morceaux.push(accord(retirees, 'retirée', 'retirées'));
  if (ajoutees) morceaux.push(accord(ajoutees, 'séance ajoutée', 'séances ajoutées'));
  return morceaux.join(' · ');
}

/** « 6 changements » */
export const nombreChangements = (lignes: LignePlan[]): string => accord(lignes.length, 'changement', 'changements');

/** La phrase lue par VoiceOver pour une carte de planning entière */
export function descriptionPlan(c: CartePlanning): string {
  const titre = c.intention || 'Plan de modifications';
  return `Plan de modifications, ${titre}, ${nombreChangements(c.lignes)}, charge prévue sur 14 jours : ${Math.round(c.charge_avant)} points avant, ${Math.round(c.charge_apres)} après. ${MOT_ETAT_PLAN[c.etat]}.`;
}

/** Ce que dit la carte annulée : combien de lignes remises, et combien laissées telles quelles */
export function phraseAnnulation(c: CartePlanning): string {
  const base = MOT_ETAT_PLAN.annulee;
  const a = c.annulation;
  if (!a) return `${base}.`;
  if (a.ignorees > 0) return `${base} : ${accord(a.annulees, 'changement défait', 'changements défaits')}. ${accord(a.ignorees, 'ligne que tu avais déjà modifiée à la main est restée', 'lignes que tu avais déjà modifiées à la main sont restées')} telle${a.ignorees > 1 ? 's' : ''} quelle${a.ignorees > 1 ? 's' : ''}.`;
  return `${base} : tout est revenu comme avant.`;
}
