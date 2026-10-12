// Séance prévue : choix proposés, validation du formulaire, estimation de la charge, conversion vers la ligne de la base.
// Fonctions pures : aucune écriture ici, tout est vérifié avant d'envoyer quoi que ce soit.
import { normaliser, resume, sportAvecStructure } from './structure.js';

/** Sports proposables : clé de famille (voir sports.js) → type brut stocké en base (comme Strava). */
export const SPORTS_PREVUE = [
  { cle: 'course', type: 'Run' },
  { cle: 'trail', type: 'TrailRun' },
  { cle: 'velo', type: 'Ride' },
  { cle: 'vtt', type: 'MountainBikeRide' },
  { cle: 'natation', type: 'Swim' },
  { cle: 'muscu', type: 'WeightTraining' },
  { cle: 'crossfit', type: 'Crossfit' },
  { cle: 'aviron', type: 'Rowing' },
  { cle: 'ski', type: 'NordicSki' },
  { cle: 'combat', type: 'MartialArts' },
  { cle: 'autre', type: 'Workout' },
];

const TYPES = new Set(SPORTS_PREVUE.map((s) => s.type));

/**
 * Charge estimée (TSS) à partir de la durée et de l'effort ressenti (RPE 1 à 10, 5 par défaut).
 * Facteur d'intensité ≈ 0,45 + 0,05 × RPE ; TSS = heures × IF² × 100.
 */
export function estimerTss(dureeMin, rpe) {
  const d = Number(dureeMin);
  if (!(d > 0)) return 0;
  const r = Number(rpe) >= 1 && Number(rpe) <= 10 ? Number(rpe) : 5;
  const intensite = 0.45 + 0.05 * r;
  return Math.round((d / 60) * intensite * intensite * 100);
}

/** Formulaire vide, avec la date (AAAA-MM-JJ) choisie. */
export function formulaireVide(dateIso) {
  return { nom: '', date: dateIso, heure: '12:00', sport: 'Run', duree: '60', tss: '', rpe: '', km: '', dPlus: '', notes: '', structure: [] };
}

/** Formulaire prérempli depuis une ligne de activity_planned. */
export function formulaireDepuisLigne(l) {
  const heure = /T(\d{2}:\d{2})/.exec(String(l.start_date_local || ''));
  const texte = (v) => (v == null ? '' : String(v));
  return {
    nom: texte(l.name),
    date: texte(l.date),
    heure: heure ? heure[1] : '12:00',
    sport: TYPES.has(l.sport) ? l.sport : 'Workout',
    duree: texte(l.duration),
    tss: texte(l.tss),
    rpe: texte(l.rpe),
    km: texte(l.km),
    dPlus: texte(l.d_plus),
    notes: texte(l.notes),
    structure: normaliser(l.structure, 'power'),
  };
}

const nombreOuNull = (v) => {
  const t = String(v ?? '').trim().replace(',', '.');
  return t === '' ? null : Number(t);
};

function dateValide(iso) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(iso)) return false;
  const d = new Date(`${iso}T12:00:00`);
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === iso;
}

/**
 * Vérifie le formulaire. Renvoie { valeurs, erreurs } :
 *  - erreurs : { champ: message } (vide si tout est bon)
 *  - valeurs : données propres, prêtes à être converties (ou null s'il y a des erreurs)
 */
export function validerPrevue(entree, ref = {}) {
  const erreurs = {};
  // Avec une structure, la durée et la charge viennent des blocs (comme dans la v1) : on ne demande plus de les saisir.
  const structure = sportAvecStructure(entree.sport) ? normaliser(entree.structure, 'power') : [];
  const calcul = structure.length ? resume(structure, ref, entree.sport) : null;
  const f = calcul ? { ...entree, duree: String(Math.max(1, calcul.dureeMin)), tss: String(calcul.tss) } : entree;
  const nom = String(f.nom ?? '').trim();
  if (!nom) erreurs.nom = 'Donne un nom à la séance.';
  else if (nom.length > 120) erreurs.nom = '120 caractères maximum.';

  const date = String(f.date ?? '');
  if (!dateValide(date)) erreurs.date = 'Choisis une date valide.';

  const heure = String(f.heure ?? '');
  if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(heure)) erreurs.heure = 'Heure invalide.';

  if (!TYPES.has(f.sport)) erreurs.sport = 'Choisis un sport.';

  const duree = nombreOuNull(f.duree);
  if (duree == null || !Number.isInteger(duree) || duree < 1 || duree > 1440) erreurs.duree = 'Durée entre 1 et 1440 minutes.';

  const rpe = nombreOuNull(f.rpe);
  if (rpe != null && (!(rpe >= 1 && rpe <= 10) || !Number.isInteger(rpe))) erreurs.rpe = 'Effort entre 1 et 10.';

  const tss = nombreOuNull(f.tss);
  if (tss != null && !(tss >= 0 && tss <= 1000)) erreurs.tss = 'Charge entre 0 et 1000.';

  const km = nombreOuNull(f.km);
  if (km != null && !(km >= 0 && km <= 5000)) erreurs.km = 'Distance entre 0 et 5000 km.';

  const dPlus = nombreOuNull(f.dPlus);
  if (dPlus != null && !(dPlus >= 0 && dPlus <= 30000)) erreurs.dPlus = 'D+ entre 0 et 30000 m.';

  const notes = String(f.notes ?? '');
  if (notes.length > 2000) erreurs.notes = '2000 caractères maximum.';

  if (Object.keys(erreurs).length) return { valeurs: null, erreurs };
  return {
    erreurs,
    valeurs: {
      nom,
      date,
      heure,
      sport: f.sport,
      duree,
      tss: tss ?? estimerTss(duree, rpe),
      rpe,
      km,
      dPlus,
      notes: notes.trim() || null,
      structure,
      estimations: calcul,
    },
  };
}

/** Ligne à écrire dans activity_planned (sans user_id : il vient de la session, ajouté par l'API). */
export function versLigne(v) {
  return {
    category: 'entrainement',
    name: v.nom,
    date: v.date,
    start_date_local: `${v.date}T${v.heure}:00`,
    sport: v.sport,
    duration: v.duree,
    tss: v.tss,
    rpe: v.rpe,
    km: v.km,
    d_plus: v.dPlus,
    notes: v.notes,
    structure: v.structure.length ? v.structure : null,
    // Estimations dérivées de la structure (null sans structure) : la v1 les relit pour afficher la séance
    est_watts: v.estimations?.watts ?? null,
    est_bpm: v.estimations?.bpm ?? null,
    est_kj: v.estimations?.kj ?? null,
    est_if: v.estimations?.facteurIntensite ?? null,
  };
}
