// Ce qu'on ajoute depuis le « + » du détail d'un jour : une séance prévue, une compétition, une note. Fonctions pures, sans réseau.
// Port des règles de app/src/lib/data/prevue.js, competitions.js et annotations.js : mêmes bornes, mêmes colonnes. La base refait ces vérifications (RLS, contraintes) :
// ici on écrit seulement des messages clairs.
//
import { CATALOGUE } from './catalogue-sports.ts';
import { verifierParcours, type ParcoursGpx } from './gpx.ts';
import { verifierDonneesImport, type DonneesImport } from './import-activite.ts';
import { aUnFormat, FORMATS_TRI, federationsDuSport, lireTempsCible, texteTempsCible } from './competition.ts';
import { nettoyerDetails, type DetailsNote, type TypeNote } from './sante-notes.ts';
import { metriquesDuSport, normaliser, resume, sportAvecStructure, type Bloc, type Reference } from './structure.ts';
import type { PrevueComplete } from './types.ts';

// STOCKAGE :
//  - séance prévue : une ligne de `activity_planned` (category = 'entrainement')
//  - compétition   : une ligne de `activity_planned` (category = 'competition', priority 'A' ou 'B')
//  - note          : une ligne de `day_notes` { type, text, color, from_date, to_date }

/** Les sports proposés quand on planifie : tous ceux du catalogue (famille de l'app → type brut stocké en base, comme Strava). */
export const SPORTS_AJOUT: { cle: string; type: string }[] = CATALOGUE.map((s) => ({ cle: s.famille, type: s.type }));
const TYPES = new Set(SPORTS_AJOUT.map((s) => s.type));

/** La clé de sport (course, velo…) d'un type brut (Run, Ride…), et inversement. */
/** Pour une famille (course, velo…), son sport de base ; « autre » et l'inconnu donnent `Other`. */
export const cleDuType = (type: string): string => SPORTS_AJOUT.find((s) => s.type === type)?.cle ?? 'autre';
export const typeDeCle = (cle: string): string => (cle === 'autre' ? 'Other' : (SPORTS_AJOUT.find((s) => s.cle === cle)?.type ?? 'Other'));

/** La distance se saisit en mètres pour la natation (« 2400 »), en kilomètres pour le reste (« 7,5 »). */
export const distanceEnMetres = (type: string): boolean => type === 'Swim';

const DATE_ISO = /^\d{4}-\d{2}-\d{2}$/;
const HEURE = /^([01]\d|2[0-3]):[0-5]\d$/;
const COULEUR = /^#[0-9a-f]{6}$/i;

export const dateValide = (iso: string): boolean => {
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
  dplus: string; // dénivelé positif prévu, en mètres
  rpe: number | null; // effort ressenti estimé, de 1 à 10
  tss: string; // charge saisie à la main (facultatif) ; vide = estimée
  notes: string;
}

/** Le sport d'ouverture : celui choisi dans la barre du haut, ou le premier de la barre quand on est sur « tout » ; sans sport connu → course. */
export const typeInitial = (filtre?: string, familles: string[] = []): string => {
  const cle = filtre === 'tout' ? familles[0] : filtre;
  return SPORTS_AJOUT.find((s) => s.cle === cle)?.type ?? 'Run';
};

export const formulaireSeanceVide = (filtre?: string, familles?: string[]): FormulaireSeance => ({ nom: '', type: typeInitial(filtre, familles), duree: '60', heure: '12:00', distance: '', dplus: '', rpe: null, tss: '', notes: '' });

/**
 * La charge (points) estimée d'une séance en cours de saisie, pour l'afficher avant de l'enregistrer : celle des blocs s'il y en a (et que le sport en accepte),
 * sinon celle de la durée et de l'effort estimé. Null si la durée n'est pas encore lisible.
 */
export function chargeEstimee(f: Pick<FormulaireSeance, 'duree' | 'type' | 'rpe'>, blocs: Bloc[] = [], ref: Reference = {}): number | null {
  if (blocs.length > 0 && sportAvecStructure(f.type)) return resume(blocs, ref, f.type).tss;
  const duree = nombreOuNull(f.duree);
  if (duree == null || !Number.isInteger(duree) || duree < 1 || duree > 1440) return null;
  return estimerTss(duree, f.rpe ?? 5);
}

/** Ligne à écrire dans activity_planned (sans user_id : il vient de la session, ajouté par l'API). */
export interface LignePrevue {
  category: 'entrainement' | 'competition';
  name: string;
  date: string;
  start_date_local: string;
  sport: string;
  duration: number | null;
  tss: number | null;
  rpe: number | null;
  km: number | null;
  d_plus: number | null;
  notes: string | null;
  priority?: 'A' | 'B';
  type?: string | null;
  /** Les blocs de la séance (voir structure.ts), et les estimations qu'on en tire ; absents pour une séance sans structure. */
  structure?: unknown[] | null;
  est_watts?: number | null;
  est_bpm?: number | null;
  est_kj?: number | null;
  est_if?: number | null;
  /** Le parcours GPX joint (nom et contenu du fichier), absent sans parcours. */
  gpx_name?: string | null;
  gpx_content?: string | null;
  /** Compétition seulement : le temps cible (en minutes, écrit en texte comme sur le site), le nombre de tours, la fédération, le niveau et le format de triathlon. */
  target?: string | null;
  laps?: number | null;
  federation?: string | null;
  race_level?: string | null;
  tri_format?: string | null;
}

/**
 * Vérifie une séance prévue pour la date donnée. Sans nom, elle prend celui de son sport (`nomParDefaut`).
 * Avec des blocs (pour un sport qui en accepte : vélo, course, natation), la durée et la charge viennent des blocs, calculés avec les références de l'utilisateur (`ref`) ;
 * sans bloc, elles viennent du formulaire (durée saisie, charge estimée).
 */
export function validerSeance(f: FormulaireSeance, date: string, nomParDefaut: string, blocs: Bloc[] = [], ref: Reference = {}, parcours: ParcoursGpx | null = null): Resultat<LignePrevue> {
  if (!dateValide(date)) return { ok: false, erreur: 'Choisis une date valide.' };
  const nom = (String(f.nom ?? '').trim() || nomParDefaut).replace(/\s+/g, ' ');
  if (nom.length > 120) return { ok: false, erreur: 'Le nom est trop long (120 caractères au plus).' };
  if (!TYPES.has(f.type)) return { ok: false, erreur: 'Choisis un sport.' };
  if (!HEURE.test(String(f.heure ?? ''))) return { ok: false, erreur: "L'heure n'est pas valide (par exemple 18:30)." };
  const avecBlocs = blocs.length > 0 && sportAvecStructure(f.type);
  const calcul = avecBlocs ? resume(blocs, ref, f.type) : null;
  const duree = calcul ? Math.max(1, calcul.dureeMin) : nombreOuNull(f.duree);
  if (duree == null || !Number.isInteger(duree) || duree < 1 || duree > 1440) return { ok: false, erreur: 'La durée doit être entre 1 et 1440 minutes.' };
  const km = distanceEnKm(f.distance, f.type);
  if (km != null && !(km >= 0 && km <= 5000)) return { ok: false, erreur: 'La distance doit être entre 0 et 5000 km.' };
  const dplus = nombreOuNull(f.dplus);
  if (dplus != null && !(Number.isInteger(dplus) && dplus >= 0 && dplus <= 30000)) return { ok: false, erreur: 'Le dénivelé doit être un nombre entier entre 0 et 30000 m.' };
  if (f.rpe != null && !(Number.isInteger(f.rpe) && f.rpe >= 1 && f.rpe <= 10)) return { ok: false, erreur: "L'effort estimé doit être entre 1 et 10." };
  const tssSaisi = nombreOuNull(f.tss);
  if (tssSaisi != null && !(tssSaisi >= 0 && tssSaisi <= 1000)) return { ok: false, erreur: 'La charge doit être entre 0 et 1000 points.' };
  const notes = String(f.notes ?? '').trim();
  if (notes.length > 2000) return { ok: false, erreur: 'Les notes sont trop longues (2000 caractères au plus).' };
  const erreurGpx = verifierParcours(parcours);
  if (erreurGpx) return { ok: false, erreur: erreurGpx };
  return {
    ok: true,
    ligne: {
      category: 'entrainement',
      name: nom,
      date,
      start_date_local: `${date}T${f.heure}:00`,
      sport: f.type,
      duration: duree,
      // Avec des blocs, la charge vient des blocs ; sinon celle qu'on a saisie, sinon l'estimation (durée et effort)
      tss: calcul ? calcul.tss : tssSaisi != null ? Math.round(tssSaisi) : estimerTss(duree, f.rpe ?? 5),
      rpe: f.rpe,
      km: km == null ? null : Math.round(km * 1000) / 1000,
      d_plus: dplus,
      notes: notes || null,
      ...(calcul ? { structure: blocs, est_watts: calcul.watts, est_bpm: calcul.bpm, est_kj: calcul.kj, est_if: calcul.facteurIntensite } : {}),
      ...(parcours ? { gpx_name: parcours.nom, gpx_content: parcours.contenu } : {}),
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
  heure: string; // HH:MM, l'heure de départ
  federation: string; // vide = non précisée
  niveau: string; // catégorie ou niveau (facultatif)
  format: string; // XS à XL, triathlon et duathlon seulement
  cible: string; // le temps cible, comme « 3h45 » (facultatif)
  dplus: string;
  tours: string;
  tss: string; // charge estimée saisie ; vide = pas d'estimation
  rpe: number | null; // effort estimé, de 1 à 10
  notes: string;
}

export const formulaireCompetitionVide = (filtre?: string, familles?: string[]): FormulaireCompetition => ({
  nom: '', type: typeInitial(filtre, familles), priorite: 'A', epreuve: '', distance: '', heure: '09:00', federation: '', niveau: '', format: '', cible: '', dplus: '', tours: '', tss: '', rpe: null, notes: '',
});

/** Vérifie une compétition pour la date donnée (9 h par défaut : on ne demande pas l'heure). */
export function validerCompetition(f: FormulaireCompetition, date: string, parcours?: ParcoursGpx | null): Resultat<LignePrevue> {
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
  if (!HEURE.test(String(f.heure ?? ''))) return { ok: false, erreur: "L'heure de départ n'est pas valide (par exemple 09:00)." };
  const federation = String(f.federation ?? '').trim();
  if (federation && !federationsDuSport(f.type).includes(federation)) return { ok: false, erreur: 'Cette fédération ne correspond pas au sport choisi.' };
  const niveau = String(f.niveau ?? '').trim().replace(/\s+/g, ' ');
  if (niveau.length > 60) return { ok: false, erreur: 'Le niveau est trop long (60 caractères au plus).' };
  const format = String(f.format ?? '').trim();
  if (format && !(aUnFormat(f.type) && FORMATS_TRI.includes(format))) return { ok: false, erreur: 'Ce format ne correspond pas au sport choisi.' };
  const cible = lireTempsCible(f.cible);
  if (!cible.ok) return { ok: false, erreur: 'Le temps cible doit s\'écrire comme 3h45, 3:45 ou 45 min (1 minute à 72 heures).' };
  const dplus = nombreOuNull(f.dplus);
  if (dplus != null && !(Number.isInteger(dplus) && dplus >= 0 && dplus <= 30000)) return { ok: false, erreur: 'Le dénivelé doit être un nombre entier entre 0 et 30000 m.' };
  const tours = nombreOuNull(f.tours);
  if (tours != null && !(Number.isInteger(tours) && tours >= 1 && tours <= 999)) return { ok: false, erreur: 'Le nombre de tours doit être entier, de 1 à 999.' };
  const tss = nombreOuNull(f.tss);
  if (tss != null && !(tss >= 0 && tss <= 1000)) return { ok: false, erreur: 'La charge doit être entre 0 et 1000 points.' };
  if (f.rpe != null && !(Number.isInteger(f.rpe) && f.rpe >= 1 && f.rpe <= 10)) return { ok: false, erreur: "L'effort doit être entre 1 et 10." };
  const notes = String(f.notes ?? '').trim();
  if (notes.length > 2000) return { ok: false, erreur: 'Les notes sont trop longues (2000 caractères au plus).' };
  const erreurGpx = verifierParcours(parcours);
  if (erreurGpx) return { ok: false, erreur: erreurGpx };
  return {
    ok: true,
    ligne: {
      category: 'competition',
      name: nom,
      date,
      start_date_local: `${date}T${f.heure}:00`,
      sport: f.type,
      priority: f.priorite,
      type: epreuve || null,
      km: km == null ? null : Math.round(km * 1000) / 1000,
      d_plus: dplus,
      duration: null,
      tss: tss == null ? null : Math.round(tss),
      rpe: f.rpe,
      notes: notes || null,
      target: cible.minutes == null ? null : String(cible.minutes),
      laps: tours,
      federation: federation || null,
      race_level: niveau || null,
      tri_format: format || null,
      ...(parcours ? { gpx_name: parcours.nom, gpx_content: parcours.contenu } : {}),
    },
  };
}

// --- Rouvrir une séance prévue ou une compétition pour la modifier ---------------------------------------------------------------------

/** L'heure « 18:30 » d'une date locale « 2026-10-29T18:30:00 » ; `parDefaut` si la ligne n'en a pas (ou une illisible). */
const heureDe = (iso: string | null | undefined, parDefaut: string): string => {
  const h = /T(\d{2}:\d{2})/.exec(String(iso ?? ''))?.[1];
  return h && HEURE.test(h) ? h : parDefaut;
};

/** Une distance en kilomètres, écrite comme on la saisit (mètres en natation, virgule décimale). */
const distanceEcrite = (km: number | null | undefined, type: string): string =>
  km == null || !(Number(km) > 0) ? '' : distanceEnMetres(type) ? String(Math.round(Number(km) * 1000)) : String(Number(km)).replace('.', ',');

const textOuVide = (v: unknown): string => (v == null ? '' : String(v));

/** Une ligne qu'on vient d'écrire, vue comme la base la rend quand on la relit (les colonnes absentes de la ligne valent null). Sert à la démo, qui n'a pas de base. */
export const prevueDepuisLigne = (id: string, l: LignePrevue): PrevueComplete => ({
  id, name: l.name, date: l.date, sport: l.sport, duration: l.duration, tss: l.tss, category: l.category, km: l.km, d_plus: l.d_plus,
  start_date_local: l.start_date_local, rpe: l.rpe, notes: l.notes, structure: l.structure ?? null,
  est_watts: l.est_watts ?? null, est_bpm: l.est_bpm ?? null, est_kj: l.est_kj ?? null, est_if: l.est_if ?? null,
  gpx_name: l.gpx_name ?? null, gpx_content: l.gpx_content ?? null,
  priority: l.priority ?? null, type: l.type ?? null, target: l.target ?? null, laps: l.laps ?? null,
  federation: l.federation ?? null, race_level: l.race_level ?? null, tri_format: l.tri_format ?? null,
});

/** Le parcours GPX joint à une ligne, ou null. */
export const parcoursDePrevue = (p: Pick<PrevueComplete, 'gpx_name' | 'gpx_content'>): ParcoursGpx | null =>
  p.gpx_content ? { nom: p.gpx_name || 'parcours.gpx', contenu: p.gpx_content } : null;

/** Les blocs d'une séance prévue (vides pour un sport sans structure ou une ligne sans bloc). */
export function blocsDePrevue(p: Pick<PrevueComplete, 'sport' | 'structure'>): Bloc[] {
  if (!sportAvecStructure(p.sport) || !Array.isArray(p.structure)) return [];
  return normaliser(p.structure, metriquesDuSport(p.sport)[0]);
}

/**
 * Le formulaire d'une séance prévue déjà enregistrée, pour la rouvrir. La charge n'est reprise que si elle a été saisie à la main (différente de l'estimation) : sinon elle
 * reste vide et se réestime, comme à la création. Avec des blocs, durée et charge viennent des blocs.
 */
export function formulaireDepuisSeance(p: PrevueComplete): FormulaireSeance {
  const blocs = blocsDePrevue(p);
  const rpe = p.rpe != null && Number.isInteger(Number(p.rpe)) ? Number(p.rpe) : null;
  const saisie = !blocs.length && p.tss != null && p.duration != null && Math.round(Number(p.tss)) !== estimerTss(Number(p.duration), rpe ?? 5);
  return {
    nom: textOuVide(p.name),
    type: TYPES.has(p.sport) ? p.sport : 'Run',
    duree: p.duration != null ? String(p.duration) : '60',
    heure: heureDe(p.start_date_local, '12:00'),
    distance: distanceEcrite(p.km, p.sport),
    dplus: p.d_plus != null ? String(p.d_plus) : '',
    rpe,
    tss: saisie ? String(Math.round(Number(p.tss))) : '',
    notes: textOuVide(p.notes),
  };
}

/** Le formulaire d'une compétition déjà enregistrée, pour la rouvrir (heure de départ 9 h si la ligne n'en a pas). */
export function formulaireDepuisCompetition(p: PrevueComplete): FormulaireCompetition {
  const cible = Number(p.target);
  return {
    nom: textOuVide(p.name),
    type: TYPES.has(p.sport) ? p.sport : 'Run',
    priorite: p.priority === 'B' ? 'B' : 'A',
    epreuve: textOuVide(p.type),
    distance: distanceEcrite(p.km, p.sport),
    heure: heureDe(p.start_date_local, '09:00'),
    federation: textOuVide(p.federation),
    niveau: textOuVide(p.race_level),
    format: textOuVide(p.tri_format),
    cible: Number.isFinite(cible) && cible > 0 ? texteTempsCible(cible) : '',
    dplus: p.d_plus != null ? String(p.d_plus) : '',
    tours: p.laps != null ? String(p.laps) : '',
    tss: p.tss != null ? String(Math.round(Number(p.tss))) : '',
    rpe: p.rpe != null && Number.isInteger(Number(p.rpe)) ? Number(p.rpe) : null,
    notes: textOuVide(p.notes),
  };
}

// --- Note ----------------------------------------------------------------------------------------------------------------

/** Les types de note (le repos n'y est pas : il se pose à part). La couleur est celle du logo dans le calendrier. */
export const TYPES_NOTE: { cle: TypeNote; nom: string; couleur: string }[] = [
  { cle: 'texte', nom: 'Note', couleur: '#60a5fa' },
  { cle: 'maladie', nom: 'Maladie', couleur: '#fbbf24' },
  { cle: 'blessure', nom: 'Blessure', couleur: '#f87171' },
  { cle: 'indisponible', nom: 'Indisponible', couleur: '#94a3b8' },
];
/** Les couleurs proposées pour une note. */
export const PALETTE_NOTE = ['#f87171', '#fb923c', '#fbbf24', '#4ade80', '#34d399', '#60a5fa', '#a78bfa', '#f472b6', '#94a3b8'];
export const TEXTE_MAX_NOTE = 500;
export const JOURS_MAX_NOTE = 90;

export interface FormulaireNote {
  type: TypeNote;
  texte: string;
  couleur: string;
  de: string;
  a: string;
  /** Le détail propre au type (maladie, blessure, indisponibilité). Vide pour une simple note. */
  details: DetailsNote;
}

export const formulaireNoteVide = (date: string): FormulaireNote => ({ type: 'texte', texte: '', couleur: TYPES_NOTE[0].couleur, de: date, a: date, details: {} });

export interface LigneNote {
  type: string;
  text: string | null;
  color: string;
  from_date: string;
  to_date: string;
  details: DetailsNote | null;
}

const enJours = (iso: string): number => Math.round(Date.UTC(Number(iso.slice(0, 4)), Number(iso.slice(5, 7)) - 1, Number(iso.slice(8, 10))) / 86400000);

/** Vérifie une note : un texte (obligatoire pour une simple note), une couleur, une période de 90 jours au plus ; le détail est nettoyé selon le type (voir nettoyerDetails). */
export function validerNote(f: FormulaireNote): Resultat<LigneNote> {
  if (!TYPES_NOTE.some((t) => t.cle === f.type)) return { ok: false, erreur: 'Choisis un type.' };
  if (!dateValide(f.de) || !dateValide(f.a)) return { ok: false, erreur: 'Choisis des dates valides.' };
  if (f.a < f.de) return { ok: false, erreur: 'La fin ne peut pas être avant le début.' };
  if (enJours(f.a) - enJours(f.de) + 1 > JOURS_MAX_NOTE) return { ok: false, erreur: `Une période dure ${JOURS_MAX_NOTE} jours au plus.` };
  const texte = String(f.texte ?? '').trim();
  if (texte.length > TEXTE_MAX_NOTE) return { ok: false, erreur: `Le texte est trop long (${TEXTE_MAX_NOTE} caractères au plus).` };
  if (f.type === 'texte' && !texte) return { ok: false, erreur: 'Écris ta note.' };
  if (!COULEUR.test(String(f.couleur ?? ''))) return { ok: false, erreur: 'Choisis une couleur.' };
  return { ok: true, ligne: { type: f.type, text: texte || null, color: f.couleur, from_date: f.de, to_date: f.a, details: nettoyerDetails(f.type, f.details) } };
}

// --- Sortie déjà faite ---------------------------------------------------------------------------------------------------
// Une sortie saisie à la main est une vraie ligne de `activities` (source = 'manual') : on peut la modifier et la supprimer, jamais celles de Strava.

export interface FormulaireSortie {
  nom: string;
  type: string;
  heure: string; // HH:MM
  heures: string;
  minutes: string;
  distance: string; // mètres en natation, kilomètres sinon
  dplus: string;
  fc: string; // fréquence cardiaque moyenne
  rpe: number | null; // effort ressenti, de 1 à 10
  tss: string; // charge saisie à la main (facultatif) ; vide = estimée d'après la durée et l'effort
  notes: string;
}

export const formulaireSortieVide = (filtre?: string, familles?: string[]): FormulaireSortie => ({ nom: '', type: typeInitial(filtre, familles), heure: '07:30', heures: '0', minutes: '45', distance: '', dplus: '', fc: '', rpe: null, tss: '', notes: '' });

/** La charge (points) estimée d'une activité déjà faite, d'après sa durée et son effort ressenti (5 par défaut), pour l'afficher avant d'enregistrer. Null si la durée n'est pas lisible. */
export function chargeEstimeeSortie(f: Pick<FormulaireSortie, 'heures' | 'minutes' | 'rpe'>): number | null {
  const h = nombreOuNull(f.heures) ?? 0;
  const m = nombreOuNull(f.minutes) ?? 0;
  if (!Number.isInteger(h) || !Number.isInteger(m) || h < 0 || m < 0 || m > 59) return null;
  const duree = h * 60 + m;
  return duree >= 1 && duree <= 1440 ? estimerTss(duree, f.rpe ?? 5) : null;
}

/** Ligne à écrire dans activities (sans user_id ni client_id : ajoutés par l'API depuis la session). */
export interface LigneSortie extends DonneesImport {
  source: 'manual';
  category: 'entrainement';
  name: string;
  start_date_local: string;
  sport: string;
  moving_time: number; // secondes
  tss: number;
  rpe: number | null;
  distance_km: number | null;
  total_elevation_gain: number | null;
  avg_heartrate: number | null;
  user_notes: string | null;
}

/** Vérifie une activité déjà faite : le jour ne peut pas être dans le futur (`aujourdhui`, AAAA-MM-JJ). La charge est estimée d'après la durée et l'effort. */
export function validerSortie(f: FormulaireSortie, date: string, aujourdhui: string, nomParDefaut: string, importe?: DonneesImport | null): Resultat<LigneSortie> {
  if (!dateValide(date)) return { ok: false, erreur: 'Choisis une date valide.' };
  if (date > aujourdhui) return { ok: false, erreur: "Une activité déjà faite ne peut pas être dans le futur : utilise « Séance prévue »." };
  const nom = (String(f.nom ?? '').trim() || nomParDefaut).replace(/\s+/g, ' ');
  if (nom.length > 120) return { ok: false, erreur: 'Le nom est trop long (120 caractères au plus).' };
  if (!TYPES.has(f.type)) return { ok: false, erreur: 'Choisis un sport.' };
  if (!HEURE.test(String(f.heure ?? ''))) return { ok: false, erreur: "L'heure n'est pas valide (par exemple 07:30)." };
  const h = nombreOuNull(f.heures) ?? 0;
  const m = nombreOuNull(f.minutes) ?? 0;
  if (!Number.isInteger(h) || !Number.isInteger(m) || h < 0 || m < 0 || m > 59) return { ok: false, erreur: 'La durée doit être en heures et minutes (minutes de 0 à 59).' };
  const duree = h * 60 + m;
  if (duree < 1 || duree > 1440) return { ok: false, erreur: 'La durée doit être entre 1 minute et 24 heures.' };
  const km = distanceEnKm(f.distance, f.type);
  if (km != null && !(km >= 0 && km <= 5000)) return { ok: false, erreur: 'La distance doit être entre 0 et 5000 km.' };
  const dplus = nombreOuNull(f.dplus);
  if (dplus != null && !(Number.isInteger(dplus) && dplus >= 0 && dplus <= 30000)) return { ok: false, erreur: 'Le dénivelé doit être un nombre entier entre 0 et 30000 m.' };
  const fc = nombreOuNull(f.fc);
  if (fc != null && !(Number.isInteger(fc) && fc >= 30 && fc <= 250)) return { ok: false, erreur: 'La fréquence cardiaque doit être entre 30 et 250.' };
  if (f.rpe != null && !(Number.isInteger(f.rpe) && f.rpe >= 1 && f.rpe <= 10)) return { ok: false, erreur: "L'effort ressenti doit être entre 1 et 10." };
  const tssSaisi = nombreOuNull(f.tss);
  if (tssSaisi != null && !(tssSaisi >= 0 && tssSaisi <= 1000)) return { ok: false, erreur: 'La charge doit être entre 0 et 1000 points.' };
  const notes = String(f.notes ?? '').trim();
  if (notes.length > 2000) return { ok: false, erreur: 'Les notes sont trop longues (2000 caractères au plus).' };
  // Venue d'un fichier : flux, trace, tours et chiffres de résumé, relus avant d'être écrits
  const plus = importe ? verifierDonneesImport(importe) : null;
  if (plus && !plus.ok) return { ok: false, erreur: plus.erreur };
  return {
    ok: true,
    ligne: {
      ...(plus?.donnees ?? {}),
      source: 'manual',
      category: 'entrainement',
      name: nom,
      start_date_local: `${date}T${f.heure}:00`,
      sport: f.type,
      moving_time: duree * 60,
      tss: tssSaisi != null ? Math.round(tssSaisi) : estimerTss(duree, f.rpe ?? 5),
      rpe: f.rpe,
      distance_km: km == null ? null : Math.round(km * 1000) / 1000,
      total_elevation_gain: dplus,
      avg_heartrate: fc,
      user_notes: notes || null,
    },
  };
}
