// Les mots affichés sur une carte de séance du coach. Le menu complet vit côté serveur (supabase/functions/_shared/menu-seances.ts) :
// ici, seulement les noms. Un test (tests/coach/libelles.test.ts) vérifie que les deux listes restent les mêmes.
import type { CarteSeance, EtatCarte } from './types.ts';

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
