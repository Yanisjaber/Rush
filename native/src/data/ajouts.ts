// Ce qu'on ajoute depuis le « + » du détail d'un jour : une séance prévue, une compétition, une note. Fonctions pures, sans réseau.
// Port des règles de app/src/lib/data/prevue.js, competitions.js et annotations.js : mêmes bornes, mêmes colonnes. La base refait ces vérifications (RLS, contraintes) :
// ici on écrit seulement des messages clairs.
//
// STOCKAGE :
//  - séance prévue : une ligne de `activity_planned` (category = 'entrainement')
//  - compétition   : une ligne de `activity_planned` (category = 'competition', priority 'A' ou 'B')
//  - note          : une ligne de `day_notes` { type, text, color, from_date, to_date }

/** Les sports proposés quand on planifie : clé du sport de l'app → type brut stocké en base (comme Strava). */
export const SPORTS_AJOUT: { cle: string; type: string }[] = [
  { cle: 'course', type: 'Run' },
  { cle: 'velo', type: 'Ride' },
  { cle: 'natation', type: 'Swim' },
  { cle: 'muscu', type: 'WeightTraining' },
  { cle: 'hyrox', type: 'Hyrox' },
  { cle: 'triathlon', type: 'Triathlon' },
  { cle: 'duathlon', type: 'Duathlon' },
  { cle: 'autre', type: 'Other' },
];
const TYPES = new Set(SPORTS_AJOUT.map((s) => s.type));

/** La clé de sport (course, velo…) d'un type brut (Run, Ride…), et inversement. */
export const cleDuType = (type: string): string => SPORTS_AJOUT.find((s) => s.type === type)?.cle ?? 'autre';
export const typeDeCle = (cle: string): string => SPORTS_AJOUT.find((s) => s.cle === cle)?.type ?? 'Other';

/** La distance se saisit en mètres pour la natation (« 2400 »), en kilomètres pour le reste (« 7,5 »). */
export const distanceEnMetres = (type: string): boolean => type === 'Swim';

const DATE_ISO = /^\d{4}-\d{2}-\d{2}$/;
const HEURE = /^([01]\d|2[0-3]):[0-5]\d$/;
const COULEUR = /^#[0-9a-f]{6}$/i;

const dateValide = (iso: string): boolean => {
  if (!DATE_ISO.test(iso)) return false;
  const d = new Date(`${iso}T12:00:00Z`);
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === iso;
};

/** « 7,5 » → 7.5 ; vide → null ; illisible → NaN. */
const nombreOuNull = (v: unknown): number | null => {
  const t = String(v ?? '').trim().replace(',', '.');
  return t === '' ? null : Number(t);
};

/**
 * Charge estimée (TSS) à partir de la durée et de l'effort ressenti (5 par défaut).
 * Facteur d'intensité ≈ 0,45 + 0,05 × effort ; TSS = heures × IF² × 100.
 */
export function estimerTss(dureeMin: number, effort = 5): number {
  if (!(dureeMin > 0)) return 0;
  const r = effort >= 1 && effort <= 10 ? effort : 5;
  const intensite = 0.45 + 0.05 * r;
  return Math.round((dureeMin / 60) * intensite * intensite * 100);
}

/** La distance saisie (mètres en natation, kilomètres sinon) en kilomètres, ou null si vide. NaN si illisible. */
function distanceEnKm(saisie: unknown, type: string): number | null {
  const v = nombreOuNull(saisie);
  if (v == null) return null;
  return distanceEnMetres(type) ? v / 1000 : v;
}

export type Resultat<L> = { ok: true; ligne: L } | { ok: false; erreur: string };

// --- Séance prévue -------------------------------------------------------------------------------------------------------

export interface FormulaireSeance {
  nom: string;
  type: string;
  duree: string; // minutes
  heure: string; // HH:MM
  distance: string;
}

export const formulaireSeanceVide = (): FormulaireSeance => ({ nom: '', type: 'Run', duree: '60', heure: '12:00', distance: '' });

/** Ligne à écrire dans activity_planned (sans user_id : il vient de la session, ajouté par l'API). */
export interface LignePrevue {
  category: 'entrainement' | 'competition';
  name: string;
  date: string;
  start_date_local: string;
  sport: string;
  duration: number | null;
  tss: number | null;
  rpe: null;
  km: number | null;
  d_plus: null;
  notes: null;
  priority?: 'A' | 'B';
  type?: string | null;
}

/** Vérifie une séance prévue pour la date donnée. Sans nom, elle prend celui de son sport (`nomParDefaut`). */
export function validerSeance(f: FormulaireSeance, date: string, nomParDefaut: string): Resultat<LignePrevue> {
  if (!dateValide(date)) return { ok: false, erreur: 'Choisis une date valide.' };
  const nom = (String(f.nom ?? '').trim() || nomParDefaut).replace(/\s+/g, ' ');
  if (nom.length > 120) return { ok: false, erreur: 'Le nom est trop long (120 caractères au plus).' };
  if (!TYPES.has(f.type)) return { ok: false, erreur: 'Choisis un sport.' };
  if (!HEURE.test(String(f.heure ?? ''))) return { ok: false, erreur: "L'heure n'est pas valide (par exemple 18:30)." };
  const duree = nombreOuNull(f.duree);
  if (duree == null || !Number.isInteger(duree) || duree < 1 || duree > 1440) return { ok: false, erreur: 'La durée doit être entre 1 et 1440 minutes.' };
  const km = distanceEnKm(f.distance, f.type);
  if (km != null && !(km >= 0 && km <= 5000)) return { ok: false, erreur: 'La distance doit être entre 0 et 5000 km.' };
  return {
    ok: true,
    ligne: {
      category: 'entrainement',
      name: nom,
      date,
      start_date_local: `${date}T${f.heure}:00`,
      sport: f.type,
      duration: duree,
      tss: estimerTss(duree),
      rpe: null,
      km: km == null ? null : Math.round(km * 1000) / 1000,
      d_plus: null,
      notes: null,
    },
  };
}

// --- Compétition ---------------------------------------------------------------------------------------------------------

export interface FormulaireCompetition {
  nom: string;
  type: string; // le sport (type brut)
  priorite: 'A' | 'B';
  epreuve: string; // « Route, trail, cyclosportive… » (facultatif)
  distance: string;
}

export const formulaireCompetitionVide = (): FormulaireCompetition => ({ nom: '', type: 'Run', priorite: 'A', epreuve: '', distance: '' });

/** Vérifie une compétition pour la date donnée (9 h par défaut : on ne demande pas l'heure). */
export function validerCompetition(f: FormulaireCompetition, date: string): Resultat<LignePrevue> {
  if (!dateValide(date)) return { ok: false, erreur: 'Choisis une date valide.' };
  const nom = String(f.nom ?? '').trim().replace(/\s+/g, ' ');
  if (!nom) return { ok: false, erreur: 'Donne un nom à la compétition.' };
  if (nom.length > 120) return { ok: false, erreur: 'Le nom est trop long (120 caractères au plus).' };
  if (!TYPES.has(f.type)) return { ok: false, erreur: 'Choisis un sport.' };
  if (f.priorite !== 'A' && f.priorite !== 'B') return { ok: false, erreur: 'Choisis une priorité.' };
  const epreuve = String(f.epreuve ?? '').trim();
  if (epreuve.length > 60) return { ok: false, erreur: "Le type d'épreuve est trop long (60 caractères au plus)." };
  const km = distanceEnKm(f.distance, f.type);
  if (km != null && !(km >= 0 && km <= 5000)) return { ok: false, erreur: 'La distance doit être entre 0 et 5000 km.' };
  return {
    ok: true,
    ligne: {
      category: 'competition',
      name: nom,
      date,
      start_date_local: `${date}T09:00:00`,
      sport: f.type,
      priority: f.priorite,
      type: epreuve || null,
      km: km == null ? null : Math.round(km * 1000) / 1000,
      d_plus: null,
      duration: null,
      tss: null,
      rpe: null,
      notes: null,
    },
  };
}

// --- Note ----------------------------------------------------------------------------------------------------------------

/** Les types de note (le repos n'y est pas : il se pose à part). */
export const TYPES_NOTE: { cle: 'texte' | 'maladie' | 'blessure'; nom: string; couleur: string }[] = [
  { cle: 'texte', nom: 'Note', couleur: '#60a5fa' },
  { cle: 'maladie', nom: 'Maladie', couleur: '#f87171' },
  { cle: 'blessure', nom: 'Blessure', couleur: '#fb923c' },
];
/** Les couleurs proposées pour une note. */
export const PALETTE_NOTE = ['#f87171', '#fb923c', '#fbbf24', '#4ade80', '#34d399', '#60a5fa', '#a78bfa', '#f472b6', '#94a3b8'];
export const TEXTE_MAX_NOTE = 500;
export const JOURS_MAX_NOTE = 90;

export interface FormulaireNote {
  type: 'texte' | 'maladie' | 'blessure';
  texte: string;
  couleur: string;
  de: string;
  a: string;
}

export const formulaireNoteVide = (date: string): FormulaireNote => ({ type: 'texte', texte: '', couleur: TYPES_NOTE[0].couleur, de: date, a: date });

export interface LigneNote {
  type: string;
  text: string | null;
  color: string;
  from_date: string;
  to_date: string;
}

const enJours = (iso: string): number => Math.round(Date.UTC(Number(iso.slice(0, 4)), Number(iso.slice(5, 7)) - 1, Number(iso.slice(8, 10))) / 86400000);

/** Vérifie une note : un texte (obligatoire pour une simple note), une couleur, une période de 90 jours au plus. */
export function validerNote(f: FormulaireNote): Resultat<LigneNote> {
  if (!TYPES_NOTE.some((t) => t.cle === f.type)) return { ok: false, erreur: 'Choisis un type.' };
  if (!dateValide(f.de) || !dateValide(f.a)) return { ok: false, erreur: 'Choisis des dates valides.' };
  if (f.a < f.de) return { ok: false, erreur: 'La fin ne peut pas être avant le début.' };
  if (enJours(f.a) - enJours(f.de) + 1 > JOURS_MAX_NOTE) return { ok: false, erreur: `Une période dure ${JOURS_MAX_NOTE} jours au plus.` };
  const texte = String(f.texte ?? '').trim();
  if (texte.length > TEXTE_MAX_NOTE) return { ok: false, erreur: `Le texte est trop long (${TEXTE_MAX_NOTE} caractères au plus).` };
  if (f.type === 'texte' && !texte) return { ok: false, erreur: 'Écris ta note.' };
  if (!COULEUR.test(String(f.couleur ?? ''))) return { ok: false, erreur: 'Choisis une couleur.' };
  return { ok: true, ligne: { type: f.type, text: texte || null, color: f.couleur, from_date: f.de, to_date: f.a } };
}
