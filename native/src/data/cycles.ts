// Cycles d'entraînement : la palette, la validation d'un cycle et la règle « deux cycles au plus le même jour ». Fonctions pures, sans réseau
// (testées dans tests/cycles.test.ts). Le calendrier affiche chaque cycle en bande de couleur sous les jours qu'il couvre.
import { DISCIPLINES_DU_FILTRE } from './familles.ts';
import type { Cycle } from './types.ts';

/** Au plus deux cycles le même jour : le calendrier n'a la place que pour deux bandes (la base le garantit aussi). */
export const CYCLES_MAX_PAR_JOUR = 2;
/** Un cycle dure 366 jours au plus (la base le garantit aussi). */
export const JOURS_MAX_CYCLE = 366;
export const NOM_MAX_CYCLE = 60;

/** Les sports auxquels un cycle peut être lié (clés de theme/sports) ; sans sport, un cycle concerne tous les sports. La base refait la même vérification. */
export const SPORTS_CYCLE: string[] = ['course', 'velo', 'natation', 'muscu', 'hyrox', 'triathlon', 'duathlon', 'autre'];

/**
 * Un cycle se voit-il sous cette pastille de la barre des sports ? Sous « Tous », tous les cycles ; sous un sport, ceux de ce sport et ceux sans sport.
 * Triathlon et Duathlon regroupent leurs disciplines : un cycle de natation, de vélo ou de course s'y voit aussi.
 */
export function cycleVisible(c: { sport?: string | null }, filtre: string): boolean {
  if (filtre === 'tout' || !c.sport) return true;
  const disciplines = DISCIPLINES_DU_FILTRE[filtre];
  return disciplines ? disciplines.includes(c.sport) : c.sport === filtre;
}

/** Les couleurs proposées : des teintes terreuses, volontairement éloignées des couleurs des sports (orange, bleu, cyan, corail, jaune). */
export const COULEURS_CYCLE: { nom: string; hex: string }[] = [
  { nom: 'Ocre', hex: '#e0a458' },
  { nom: 'Sauge', hex: '#7fb069' },
  { nom: 'Rose', hex: '#d65a7a' },
  { nom: 'Sarcelle', hex: '#5ec2b7' },
  { nom: 'Prune', hex: '#9b6b9e' },
  { nom: 'Ardoise', hex: '#8d99ae' },
  { nom: 'Terre', hex: '#c07a5a' },
  { nom: 'Mousse', hex: '#b5c26a' },
];

const COULEUR_VALIDE = /^#[0-9a-fA-F]{6}$/;
const DATE_ISO = /^\d{4}-\d{2}-\d{2}$/;

const enJours = (iso: string): number => Math.round(Date.UTC(Number(iso.slice(0, 4)), Number(iso.slice(5, 7)) - 1, Number(iso.slice(8, 10))) / 86400000);
const dateValide = (iso: string): boolean => {
  if (!DATE_ISO.test(iso)) return false;
  const d = new Date(`${iso}T12:00:00Z`);
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === iso;
};
const deJours = (n: number): string => new Date(n * 86400000).toISOString().slice(0, 10);

/** Le nombre de jours d'un cycle, bornes incluses. */
export const joursDuCycle = (c: Pick<Cycle, 'from_date' | 'to_date'>): number => enJours(String(c.to_date).slice(0, 10)) - enJours(String(c.from_date).slice(0, 10)) + 1;

/** L'état d'un choix de période sur un calendrier : le début, la fin, et si on attend maintenant le jour de fin. */
export interface ChoixPeriode {
  debut: string;
  fin: string;
  attenteFin: boolean;
}

/**
 * Ce qui se passe quand on touche un jour du calendrier de période : le premier toucher pose le début (la fin le suit), le suivant pose la fin.
 * Toucher un jour AVANT le début recommence la période à ce jour (on ne retourne jamais une période à l'envers).
 */
export function toucherJourPeriode(etat: ChoixPeriode, iso: string): ChoixPeriode {
  if (!etat.attenteFin || iso < etat.debut) return { debut: iso, fin: iso, attenteFin: true };
  return { debut: etat.debut, fin: iso, attenteFin: false };
}

/** Où en est un cycle un jour donné : « jour 22 sur 23 » et la part faite (de 0 à 1). Le jour est ramené dans les bornes du cycle. */
export function avancementCycle(c: Pick<Cycle, 'from_date' | 'to_date'>, iso: string): { jour: number; total: number; part: number } {
  const total = Math.max(1, joursDuCycle(c));
  const jour = Math.min(total, Math.max(1, enJours(iso.slice(0, 10)) - enJours(String(c.from_date).slice(0, 10)) + 1));
  return { jour, total, part: jour / total };
}

export interface FormulaireCycle {
  name: string;
  from_date: string;
  to_date: string;
  color: string;
  /** Le sport du cycle, ou null pour tous les sports. */
  sport: string | null;
}

export type ResultatCycle = { ok: true; valeur: FormulaireCycle } | { ok: false; erreur: string };

/**
 * Vérifie un cycle avant de l'enregistrer : un nom, deux dates, une couleur, au plus 366 jours, et jamais plus de deux cycles le même jour
 * (en comptant les `existants`, sauf celui qu'on modifie, `idEnCours`). Renvoie le cycle nettoyé, ou la première erreur, en français.
 * La base refait les mêmes vérifications : ceci sert à écrire un message clair, pas à protéger.
 */
export function validerCycle(f: FormulaireCycle, existants: Cycle[], idEnCours?: string): ResultatCycle {
  const name = String(f.name ?? '').trim().replace(/\s+/g, ' ');
  if (!name) return { ok: false, erreur: 'Donne un nom à ton cycle.' };
  if (name.length > NOM_MAX_CYCLE) return { ok: false, erreur: `Le nom est trop long (${NOM_MAX_CYCLE} caractères au plus).` };
  if (!dateValide(f.from_date) || !dateValide(f.to_date)) return { ok: false, erreur: 'Choisis une date de début et une date de fin.' };
  if (f.to_date < f.from_date) return { ok: false, erreur: 'La fin ne peut pas être avant le début.' };
  const jours = enJours(f.to_date) - enJours(f.from_date) + 1;
  if (jours > JOURS_MAX_CYCLE) return { ok: false, erreur: `Un cycle dure ${JOURS_MAX_CYCLE} jours au plus.` };
  if (!COULEUR_VALIDE.test(f.color)) return { ok: false, erreur: 'Choisis une couleur.' };
  if (f.sport != null && !SPORTS_CYCLE.includes(f.sport)) return { ok: false, erreur: 'Choisis un sport de la liste, ou aucun.' };
  const autres = existants.filter((c) => c.id !== idEnCours);
  const debut = enJours(f.from_date);
  for (let n = debut; n < debut + jours; n++) {
    const iso = deJours(n);
    const couvrent = autres.filter((c) => String(c.from_date).slice(0, 10) <= iso && iso <= String(c.to_date).slice(0, 10));
    if (couvrent.length >= CYCLES_MAX_PAR_JOUR) {
      const date = new Date(`${iso}T12:00:00`).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long' });
      return { ok: false, erreur: `Le ${date}, tu as déjà deux cycles (${couvrent.map((c) => `« ${c.name} »`).join(' et ')}) : trois, c'est trop.` };
    }
  }
  return { ok: true, valeur: { name, from_date: f.from_date, to_date: f.to_date, color: f.color, sport: f.sport ?? null } };
}
