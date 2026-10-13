// Compétitions : priorités, phase de préparation, conseil, validation du formulaire. Fonctions pures, sans réseau.
//
// STOCKAGE : une compétition à venir est une ligne de `activity_planned` (category = 'competition') ;
// une compétition passée est une activité (`activities`, category = 'competition'). Priorité : 'A' (objectif) ou 'B' (préparation).
import { SPORTS_PREVUE, validerGpxFormulaire } from './prevue.js';

export const PRIORITES = [
  ['A', 'Objectif', 'Ta course principale : la préparation vise cette date.'],
  ['B', 'Préparation', 'Une course pour te tester ou t’entraîner, sans viser le pic de forme.'],
];

/** On ne distingue que « principal » (A, ou priorité absente) et « secondaire » (tout le reste). */
export const prioriteDe = (p) => (p === 'A' || p === 'principal' || p == null || p === '' ? 'A' : 'B');
export const nomPriorite = (p) => (prioriteDe(p) === 'A' ? 'Objectif' : 'Préparation');

// --- Phase de préparation et conseil (logique historique) -----------------------------------------------------

export const NOM_PHASE = { build: 'Construction', peak: 'Pic de charge', taper: 'Affûtage', race: 'Semaine de course', recovery: 'Décharge' };

/** Phase selon le nombre de jours avant la course et la forme (TSB). Une grosse fatigue impose la décharge. */
export function phaseDepuis(joursAvant, tsb) {
  if (tsb != null && tsb < -30) return 'recovery';
  if (joursAvant == null) return 'build';
  if (joursAvant <= 7) return 'race';
  if (joursAvant <= 28) return 'taper';
  if (joursAvant <= 56) return 'peak';
  return 'build';
}

/** État de forme à partir du TSB : { texte, ton } où ton vaut 'bon', 'moyen' ou 'mauvais'. */
export function formeDepuisTsb(tsb) {
  if (tsb == null || Number.isNaN(Number(tsb))) return { texte: '—', ton: 'moyen' };
  const t = Number(tsb);
  if (t >= 10) return { texte: 'très frais', ton: 'bon' };
  if (t >= 0) return { texte: 'frais', ton: 'bon' };
  if (t >= -10) return { texte: 'équilibré', ton: 'moyen' };
  if (t >= -20) return { texte: 'fatigué', ton: 'moyen' };
  return { texte: 'très fatigué', ton: 'mauvais' };
}

export function conseilPreparation(phase, tsb) {
  if (tsb != null && tsb < -20) return "Fatigue marquée : priorité à la récupération avant d'affûter.";
  switch (phase) {
    case 'race': return 'Semaine de course : repos et activations courtes, garde la fraîcheur.';
    case 'taper': return "Affûtage en cours : réduis le volume, conserve un peu d'intensité.";
    case 'peak': return 'Pic de charge : intensité spécifique, surveille bien la récupération.';
    case 'build': return "Construis le foncier et ta forme de fond. L'affûtage viendra plus tard.";
    case 'recovery': return 'Phase de décharge : récupère pour mieux rebondir.';
    default: return 'Continue ta préparation régulière.';
  }
}

// --- Temps objectif ------------------------------------------------------------------------------------------------------

/** Temps écrit librement → minutes entières : « 1h45 », « 1:45:00 », « 45 min », « 45 ». null si illisible ou nul. */
export function lireObjectif(texte) {
  const v = String(texte ?? '').trim().toLowerCase().replace(/\s+/g, '');
  if (!v) return null;
  let m = /^(\d+):(\d{1,2}):(\d{1,2})$/.exec(v);
  if (m) return Number(m[1]) * 60 + Number(m[2]) + (Number(m[3]) >= 30 ? 1 : 0);
  m = /^(\d+)h(\d{0,2})$/.exec(v);
  if (m) return Number(m[1]) * 60 + (m[2] ? Number(m[2]) : 0);
  m = /^(\d+):(\d{2})$/.exec(v); // 1:45 = 1 h 45
  if (m) return Number(m[1]) * 60 + Number(m[2]);
  m = /^(\d+)(?:min|mn|m)?$/.exec(v);
  if (m) return Number(m[1]);
  return null;
}

/** Minutes → « 1h45 » ou « 45 min ». */
export function texteObjectif(min) {
  const t = Math.round(Number(min));
  if (!(t > 0)) return '';
  const h = Math.floor(t / 60);
  return h > 0 ? `${h}h${String(t % 60).padStart(2, '0')}` : `${t} min`;
}

// --- Formulaire -----------------------------------------------------------------------------------------------------------

const TYPES = new Set(SPORTS_PREVUE.map((s) => s.type));

export function formulaireVide(dateIso) {
  return { nom: '', date: dateIso, heure: '09:00', sport: 'Run', priorite: 'A', type: '', km: '', dPlus: '', objectif: '', notes: '' };
}

export function formulaireDepuisLigne(l) {
  const heure = /T(\d{2}:\d{2})/.exec(String(l.start_date_local || ''));
  const t = (v) => (v == null ? '' : String(v));
  return {
    nom: t(l.name),
    date: t(l.date),
    heure: heure ? heure[1] : '09:00',
    sport: TYPES.has(l.sport) ? l.sport : 'Workout',
    priorite: prioriteDe(l.priority),
    type: t(l.type),
    km: t(l.km),
    dPlus: t(l.d_plus),
    objectif: texteObjectif(l.duration),
    notes: t(l.notes),
    gpxNom: t(l.gpx_name),
  };
}

const nombreOuNull = (v) => {
  const s = String(v ?? '').trim().replace(',', '.');
  return s === '' ? null : Number(s);
};

function dateValide(iso) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(iso)) return false;
  const d = new Date(`${iso}T12:00:00`);
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === iso;
}

/** Vérifie le formulaire. Renvoie { valeurs, erreurs } (valeurs = null s'il y a des erreurs). */
export function validerCompetition(f) {
  const erreurs = {};
  const nom = String(f.nom ?? '').trim();
  if (!nom) erreurs.nom = 'Donne un nom à la compétition.';
  else if (nom.length > 120) erreurs.nom = '120 caractères maximum.';
  if (!dateValide(String(f.date ?? ''))) erreurs.date = 'Choisis une date valide.';
  if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(String(f.heure ?? ''))) erreurs.heure = 'Heure invalide.';
  if (!TYPES.has(f.sport)) erreurs.sport = 'Choisis un sport.';
  if (!['A', 'B'].includes(f.priorite)) erreurs.priorite = 'Choisis une priorité.';
  const type = String(f.type ?? '').trim();
  if (type.length > 60) erreurs.type = '60 caractères maximum.';
  const km = nombreOuNull(f.km);
  if (km != null && !(km >= 0 && km <= 5000)) erreurs.km = 'Distance entre 0 et 5000 km.';
  const dPlus = nombreOuNull(f.dPlus);
  if (dPlus != null && !(dPlus >= 0 && dPlus <= 30000 && Number.isInteger(dPlus))) erreurs.dPlus = 'D+ entier entre 0 et 30000 m.';
  const objectifBrut = String(f.objectif ?? '').trim();
  const objectif = objectifBrut ? lireObjectif(objectifBrut) : null;
  if (objectifBrut && (objectif == null || objectif < 1 || objectif > 7200)) erreurs.objectif = 'Format attendu : 1h45, 1:45:00 ou 45 min.';
  const notes = String(f.notes ?? '');
  if (notes.length > 2000) erreurs.notes = '2000 caractères maximum.';
  const gpxVerifie = validerGpxFormulaire(f.gpx);
  if (gpxVerifie.erreur) erreurs.gpx = gpxVerifie.erreur;
  if (Object.keys(erreurs).length) return { valeurs: null, erreurs };
  return { erreurs, valeurs: { nom, date: f.date, heure: f.heure, sport: f.sport, priorite: f.priorite, type: type || null, km, dPlus, objectif, notes: notes.trim() || null, gpx: gpxVerifie.gpx } };
}

/** Ligne à écrire dans activity_planned (sans user_id : ajouté par l'API depuis la session). */
export function versLigne(v) {
  return {
    category: 'competition',
    name: v.nom,
    date: v.date,
    start_date_local: `${v.date}T${v.heure}:00`,
    sport: v.sport,
    priority: v.priorite,
    type: v.type,
    km: v.km,
    d_plus: v.dPlus,
    duration: v.objectif,
    notes: v.notes,
    ...(v.gpx !== undefined ? { gpx_name: v.gpx?.nom ?? null, gpx_content: v.gpx?.contenu ?? null } : {}),
  };
}

// --- Tri : à venir / passées ----------------------------------------------------------------------------------------------

/** Sépare les compétitions prévues (date >= aujourd'hui) des passées, chaque liste triée par date. */
export function repartir(prevues, aujourdhuiIso) {
  const liste = Array.isArray(prevues) ? prevues : [];
  const aVenir = liste.filter((c) => String(c.date) >= aujourdhuiIso).sort((a, b) => String(a.date).localeCompare(String(b.date)));
  const passees = liste.filter((c) => String(c.date) < aujourdhuiIso).sort((a, b) => String(b.date).localeCompare(String(a.date)));
  return { aVenir, passees };
}

/** Prochain objectif : la première compétition « Objectif » à venir, sinon la première à venir. */
export function prochainObjectif(aVenir) {
  return aVenir.find((c) => prioriteDe(c.priority) === 'A') || aVenir[0] || null;
}
