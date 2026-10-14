// Calculs du carnet de force : tonnage, 1RM estimé, records, séries par groupe, programme du jour, brouillon de séance.
// Fonctions pures (ni réseau ni écran), donc testables. Une « série » vient de la table strength_sets :
// { date, exercise_key, exercise_name, muscle_group, position, set_no, reps, weight_kg, activity_id }.
import { GROUPES, ORDRE_GROUPES, GRANDS_MOUVEMENTS, groupeValide } from './exercices.js';
import { estimerTss } from './prevue.js';

const JOUR = 86400000;

const nombre = (v) => (Number.isFinite(Number(v)) ? Number(v) : 0);
const arrondi1 = (v) => Math.round(v * 10) / 10;

/** Tonnage d'une série : répétitions × charge (en kg). */
export function tonnageSerie(s) {
  return nombre(s.reps) * nombre(s.weight_kg);
}

/** Tonnage total d'une liste de séries (kg). */
export function tonnage(series) {
  return Math.round(series.reduce((somme, s) => somme + tonnageSerie(s), 0));
}

/**
 * 1RM estimé (la charge qu'on soulèverait une seule fois) par la formule d'Epley : poids × (1 + reps / 30).
 * Au-delà de 12 répétitions, l'estimation n'est plus fiable : on renvoie null. Poids nul (gainage, pompes) : null.
 */
export function unRmEstime(poids, reps) {
  const p = nombre(poids);
  const r = nombre(reps);
  if (!(p > 0) || !(r >= 1) || r > 12) return null;
  return arrondi1(r === 1 ? p : p * (1 + r / 30));
}

/** Nombre de jours entiers entre une date ISO et aujourd'hui (positif = passé). */
function joursDepuis(dateIso, aujourdhui) {
  const base = new Date(aujourdhui.getFullYear(), aujourdhui.getMonth(), aujourdhui.getDate());
  const d = new Date(`${String(dateIso).slice(0, 10)}T00:00:00`);
  return Math.floor((base - d) / JOUR);
}

/** Tonnage par fenêtre de 7 jours glissants, sur N fenêtres (la dernière = les 7 derniers jours). */
export function tonnageParSemaine(series, nbSemaines = 12, aujourdhui = new Date()) {
  const valeurs = new Array(nbSemaines).fill(0);
  for (const s of series) {
    const j = joursDepuis(s.date, aujourdhui);
    if (j < 0) continue;
    const i = Math.floor(j / 7);
    if (i >= nbSemaines) continue;
    valeurs[nbSemaines - 1 - i] += tonnageSerie(s);
  }
  const parSemaine = valeurs.map(Math.round);
  const derniere = parSemaine[nbSemaines - 1];
  const avant = parSemaine.slice(0, nbSemaines - 1).filter((v) => v > 0);
  const moyenne = avant.length ? avant.reduce((a, b) => a + b, 0) / avant.length : 0;
  // Écart en % de la semaine en cours par rapport à la moyenne des semaines d'avant (null si rien à comparer)
  const ecartPct = moyenne > 0 ? Math.round(((derniere - moyenne) / moyenne) * 100) : null;
  return { parSemaine, derniere, moyenne: Math.round(moyenne), ecartPct };
}

/** Séries par groupe musculaire sur les 7 derniers jours, avec la zone cible de chaque groupe. */
export function seriesParGroupe(series, aujourdhui = new Date()) {
  const compte = Object.fromEntries(ORDRE_GROUPES.map((g) => [g, 0]));
  for (const s of series) {
    const j = joursDepuis(s.date, aujourdhui);
    if (j < 0 || j >= 7) continue;
    if (groupeValide(s.muscle_group) && nombre(s.reps) > 0) compte[s.muscle_group] += 1;
  }
  return ORDRE_GROUPES.map((g) => ({ groupe: g, nom: GROUPES[g].nom, series: compte[g], cible: GROUPES[g].cible }));
}

/**
 * Progression par exercice : meilleur 1RM estimé de chaque séance, record de tous les temps, et évolution.
 * Renvoie les exercices triés par fréquence récente (les plus pratiqués d'abord).
 *  - rm : meilleur 1RM estimé de la séance la plus récente de l'exercice ;
 *  - record : true si ce meilleur 1RM est le plus haut jamais vu ET qu'il bat les séances précédentes ;
 *  - delta : écart en kg avec la meilleure séance précédente (null s'il n'y en a pas).
 */
export function progressionParExercice(series) {
  const parExo = new Map();
  for (const s of series) {
    const rm = unRmEstime(s.weight_kg, s.reps);
    if (rm == null) continue;
    let e = parExo.get(s.exercise_key);
    if (!e) parExo.set(s.exercise_key, (e = { cle: s.exercise_key, nom: s.exercise_name, groupe: s.muscle_group, jours: new Map(), derniere: '', nbSeries: 0, derniereSerie: null }));
    e.nbSeries += 1;
    const date = String(s.date).slice(0, 10);
    const meilleur = e.jours.get(date);
    if (!meilleur || rm > meilleur.rm) e.jours.set(date, { rm, poids: nombre(s.weight_kg), reps: nombre(s.reps) });
    if (date >= e.derniere) e.derniere = date;
  }
  const sortie = [];
  for (const e of parExo.values()) {
    const serie = [...e.jours.entries()].map(([date, v]) => ({ date, ...v })).sort((a, b) => a.date.localeCompare(b.date));
    const dernier = serie[serie.length - 1];
    const avant = serie.slice(0, -1);
    const meilleurAvant = avant.length ? Math.max(...avant.map((p) => p.rm)) : null;
    sortie.push({
      cle: e.cle,
      nom: e.nom,
      groupe: e.groupe,
      rm: dernier.rm,
      poids: dernier.poids,
      reps: dernier.reps,
      date: dernier.date,
      serie,
      meilleurRm: Math.max(...serie.map((p) => p.rm)),
      record: meilleurAvant != null && dernier.rm > meilleurAvant,
      delta: meilleurAvant != null ? arrondi1(dernier.rm - meilleurAvant) : null,
      nbSeries: e.nbSeries,
    });
  }
  return sortie.sort((a, b) => b.date.localeCompare(a.date) || b.nbSeries - a.nbSeries);
}

/**
 * Les N exercices à mettre en avant (cartes « records » de l'accueil), sur TOUT l'historique : un record ne dépend pas
 * de ta régularité récente. Les grands mouvements d'abord (squat, développé couché, soulevé de terre…), puis les plus pratiqués.
 */
export function exercicesPhares(series, n = 3) {
  const rang = (cle) => {
    const i = GRANDS_MOUVEMENTS.indexOf(cle);
    return i === -1 ? GRANDS_MOUVEMENTS.length : i;
  };
  return progressionParExercice(series)
    .sort((a, b) => rang(a.cle) - rang(b.cle) || b.nbSeries - a.nbSeries)
    .slice(0, n);
}

// ---------------------------------------------------------------------------
// Programmes (séances types)
// ---------------------------------------------------------------------------

/** Durée estimée d'un programme : environ 3 minutes par série, repos compris. */
export function resumeProgramme(prog) {
  const exercices = Array.isArray(prog?.exercises) ? prog.exercises : [];
  const series = exercices.reduce((somme, e) => somme + nombre(e.sets), 0);
  return { exercices: exercices.length, series, minutes: series * 3 };
}

/**
 * Programme du jour : on enchaîne les programmes dans l'ordre où ils ont été créés (PUSH, PULL, LEGS, PUSH…).
 * Le suivant est celui qui vient après la dernière séance dont le nom correspond à un programme ;
 * sans historique, c'est le premier.
 */
export function programmeDuJour(programmes, seances = []) {
  if (!programmes.length) return null;
  const ordre = [...programmes].sort((a, b) => String(a.created_at || '').localeCompare(String(b.created_at || '')));
  const noms = ordre.map((p) => p.name.trim().toLowerCase());
  const force = seances.filter((s) => /weight|force|muscu/i.test(s.sport || '') || noms.includes(String(s.name || '').trim().toLowerCase()));
  const derniere = [...force].sort((a, b) => String(b.start_date_local).localeCompare(String(a.start_date_local)))[0];
  const i = derniere ? noms.indexOf(String(derniere.name || '').trim().toLowerCase()) : -1;
  return ordre[(i + 1) % ordre.length];
}

// ---------------------------------------------------------------------------
// Brouillon de séance (saisie en direct ou après coup)
// ---------------------------------------------------------------------------

export const LIMITES = { exercices: 40, series: 30, reps: 100, poids: 1000, nom: 80, notes: 2000 };

/** Dernier poids et dernières répétitions faites pour chaque exercice (pour pré-remplir la séance suivante). */
export function dernieresCharges(series) {
  const par = new Map();
  for (const s of series) {
    const date = String(s.date).slice(0, 10);
    const e = par.get(s.exercise_key);
    if (!e || date > e.date || (date === e.date && nombre(s.set_no) > e.set_no)) {
      par.set(s.exercise_key, { date, set_no: nombre(s.set_no), poids: nombre(s.weight_kg), reps: nombre(s.reps) });
    }
  }
  return par;
}

/** Brouillon vide. `date` au format AAAA-MM-JJ. */
export function brouillonVide(date, heure = '18:00') {
  return { date, heure, nom: '', duree: '', rpe: '', notes: '', programmeId: '', exercices: [] };
}

/** Une série du brouillon : les valeurs restent du texte tant qu'on n'a pas validé (champs de formulaire). */
export function serieVide(reps = '', poids = '') {
  return { reps: String(reps), poids: String(poids), fait: false };
}

/** Brouillon prérempli depuis un programme : séries cibles, charges = dernière fois si connue, sinon charge du programme. */
export function brouillonDepuisProgramme(prog, date, derniers = new Map(), heure = '18:00') {
  const b = brouillonVide(date, heure);
  b.nom = prog.name;
  b.programmeId = prog.id;
  for (const e of (Array.isArray(prog.exercises) ? prog.exercises : []).slice(0, LIMITES.exercices)) {
    const dernier = derniers.get(e.key);
    const poids = dernier ? dernier.poids : nombre(e.weight);
    const reps = nombre(e.reps) || (dernier ? dernier.reps : 8);
    b.exercices.push({
      cle: e.key,
      nom: e.name,
      groupe: groupeValide(e.group) ? e.group : 'tronc',
      series: Array.from({ length: Math.min(LIMITES.series, Math.max(1, nombre(e.sets) || 3)) }, () => serieVide(reps, poids || '')),
    });
  }
  return b;
}

/** Brouillon depuis une séance déjà enregistrée (ses séries), pour la modifier. */
export function brouillonDepuisSeance(seance, series) {
  const date = String(seance.start_date_local).slice(0, 10);
  const heure = /T(\d{2}:\d{2})/.exec(String(seance.start_date_local))?.[1] || '18:00';
  const b = brouillonVide(date, heure);
  b.nom = seance.name || '';
  b.duree = seance.moving_time ? String(Math.round(seance.moving_time / 60)) : '';
  b.rpe = seance.rpe != null ? String(seance.rpe) : '';
  b.notes = seance.user_notes || '';
  const ordonnees = [...series].sort((a, b2) => nombre(a.position) - nombre(b2.position) || nombre(a.set_no) - nombre(b2.set_no));
  const index = new Map();
  for (const s of ordonnees) {
    const clePos = `${s.position}|${s.exercise_key}`;
    let ex = index.get(clePos);
    if (!ex) {
      ex = { cle: s.exercise_key, nom: s.exercise_name, groupe: groupeValide(s.muscle_group) ? s.muscle_group : 'tronc', series: [] };
      index.set(clePos, ex);
      b.exercices.push(ex);
    }
    ex.series.push(serieVide(s.reps, s.weight_kg));
    ex.series[ex.series.length - 1].fait = true;
  }
  return b;
}

const entier = (txt) => (/^\d{1,4}$/.test(String(txt).trim()) ? Number(txt) : NaN);
const decimal = (txt) => (/^\d{1,4}([.,]\d{1,2})?$/.test(String(txt).trim()) ? Number(String(txt).trim().replace(',', '.')) : NaN);

/**
 * Valide le brouillon. Ne garde que les séries « faites » avec au moins une répétition.
 * Renvoie { valeurs, erreurs } : valeurs = null s'il y a une erreur.
 */
export function validerSeance(b) {
  const erreurs = {};
  if (!/^\d{4}-\d{2}-\d{2}$/.test(b.date)) erreurs.date = 'Date invalide.';
  if (!/^\d{2}:\d{2}$/.test(b.heure)) erreurs.heure = 'Heure invalide.';
  const nom = String(b.nom || '').trim();
  if (!nom) erreurs.nom = 'Donne un nom à la séance.';
  else if (nom.length > LIMITES.nom) erreurs.nom = `${LIMITES.nom} caractères maximum.`;
  let duree = null;
  if (String(b.duree).trim() !== '') {
    duree = entier(b.duree);
    if (!(duree >= 1 && duree <= 600)) erreurs.duree = 'Durée entre 1 et 600 minutes.';
  }
  let rpe = null;
  if (String(b.rpe).trim() !== '') {
    rpe = entier(b.rpe);
    if (!(rpe >= 1 && rpe <= 10)) erreurs.rpe = 'Effort entre 1 et 10.';
  }
  const notes = String(b.notes || '').trim();
  if (notes.length > LIMITES.notes) erreurs.notes = `${LIMITES.notes} caractères maximum.`;
  if (b.exercices.length > LIMITES.exercices) erreurs.exercices = `${LIMITES.exercices} exercices maximum.`;

  const series = [];
  b.exercices.slice(0, LIMITES.exercices).forEach((ex, position) => {
    let numero = 0;
    for (const s of ex.series.slice(0, LIMITES.series)) {
      if (!s.fait) continue;
      const reps = entier(s.reps);
      const poids = String(s.poids).trim() === '' ? 0 : decimal(s.poids);
      if (!(reps >= 1 && reps <= LIMITES.reps)) {
        erreurs.exercices = `Répétitions invalides sur « ${ex.nom} » (1 à ${LIMITES.reps}).`;
        continue;
      }
      if (!(poids >= 0 && poids <= LIMITES.poids)) {
        erreurs.exercices = `Charge invalide sur « ${ex.nom} » (0 à ${LIMITES.poids} kg).`;
        continue;
      }
      numero += 1;
      series.push({ exercise_key: ex.cle, exercise_name: ex.nom, muscle_group: groupeValide(ex.groupe) ? ex.groupe : 'tronc', position, set_no: numero, reps, weight_kg: poids });
    }
  });
  if (!erreurs.exercices && !series.length) erreurs.exercices = 'Coche au moins une série faite.';
  if (Object.keys(erreurs).length) return { valeurs: null, erreurs };
  return { valeurs: { nom, date: b.date, heure: b.heure, duree, rpe, notes, series }, erreurs: {} };
}

/** Ligne `activities` d'une séance de force saisie (sport « WeightTraining »). Durée absente : 3 min par série. */
export function ligneSeanceForce(v) {
  const minutes = v.duree ?? Math.max(5, v.series.length * 3);
  const tss = estimerTss(minutes, v.rpe);
  return {
    source: 'manual',
    category: 'entrainement',
    name: v.nom,
    start_date_local: `${v.date}T${v.heure}:00`,
    sport: 'WeightTraining',
    moving_time: minutes * 60,
    tss,
    rpe: v.rpe,
    user_notes: v.notes || null,
  };
}

/** Lignes strength_sets d'une séance validée (l'identifiant de séance et l'utilisateur sont ajoutés par l'appelant). */
export function lignesSeries(v) {
  return v.series.map((s) => ({ ...s, date: v.date }));
}

// ---------------------------------------------------------------------------
// Programmes : formulaire et validation
// ---------------------------------------------------------------------------

export const LIMITES_PROGRAMME = { nom: 60, exercices: 30, series: 20, reps: 100, poids: 1000, notes: 500 };

/** Formulaire de programme vide. */
export function formulaireProgrammeVide() {
  return { nom: '', notes: '', exercices: [] };
}

/** Formulaire prérempli depuis une ligne strength_programs (valeurs en texte, comme des champs de formulaire). */
export function formulaireProgramme(prog) {
  return {
    nom: prog.name || '',
    notes: prog.notes || '',
    exercices: (Array.isArray(prog.exercises) ? prog.exercises : []).map((e) => ({
      cle: e.key,
      nom: e.name,
      groupe: groupeValide(e.group) ? e.group : 'tronc',
      sets: String(e.sets ?? 3),
      reps: String(e.reps ?? 8),
      weight: e.weight ? String(e.weight) : '',
    })),
  };
}

/** Exercice du programme à partir d'un exercice de la bibliothèque. */
export function exerciceDeProgramme(exo) {
  return { cle: exo.cle, nom: exo.nom, groupe: exo.groupe, sets: '3', reps: '8', weight: '' };
}

/** Valide un programme. Renvoie { valeurs: { name, exercises, notes }, erreurs } (valeurs = null en cas d'erreur). */
export function validerProgramme(f) {
  const erreurs = {};
  const nom = String(f.nom || '').trim();
  if (!nom) erreurs.nom = 'Donne un nom au programme (Push, Pull, Legs…).';
  else if (nom.length > LIMITES_PROGRAMME.nom) erreurs.nom = `${LIMITES_PROGRAMME.nom} caractères maximum.`;
  const notes = String(f.notes || '').trim();
  if (notes.length > LIMITES_PROGRAMME.notes) erreurs.notes = `${LIMITES_PROGRAMME.notes} caractères maximum.`;
  if (!f.exercices.length) erreurs.exercices = 'Ajoute au moins un exercice.';
  else if (f.exercices.length > LIMITES_PROGRAMME.exercices) erreurs.exercices = `${LIMITES_PROGRAMME.exercices} exercices maximum.`;
  const exercices = [];
  for (const e of f.exercices.slice(0, LIMITES_PROGRAMME.exercices)) {
    const sets = entier(e.sets);
    const reps = entier(e.reps);
    const poids = String(e.weight).trim() === '' ? 0 : decimal(e.weight);
    if (!(sets >= 1 && sets <= LIMITES_PROGRAMME.series)) erreurs.exercices = `« ${e.nom} » : séries entre 1 et ${LIMITES_PROGRAMME.series}.`;
    else if (!(reps >= 1 && reps <= LIMITES_PROGRAMME.reps)) erreurs.exercices = `« ${e.nom} » : répétitions entre 1 et ${LIMITES_PROGRAMME.reps}.`;
    else if (!(poids >= 0 && poids <= LIMITES_PROGRAMME.poids)) erreurs.exercices = `« ${e.nom} » : charge entre 0 et ${LIMITES_PROGRAMME.poids} kg.`;
    else exercices.push({ key: e.cle, name: e.nom, group: groupeValide(e.groupe) ? e.groupe : 'tronc', sets, reps, weight: poids });
  }
  if (Object.keys(erreurs).length) return { valeurs: null, erreurs };
  return { valeurs: { name: nom, exercises: exercices, notes: notes || null }, erreurs: {} };
}

/** Séries d'une séance regroupées par exercice, dans l'ordre : [{ cle, nom, groupe, series: [{ reps, poids }], tonnage }]. */
export function grouperParExercice(series) {
  const ordonnees = [...series].sort((a, b) => nombre(a.position) - nombre(b.position) || nombre(a.set_no) - nombre(b.set_no));
  const index = new Map();
  const sortie = [];
  for (const s of ordonnees) {
    const cle = `${s.position}|${s.exercise_key}`;
    let ex = index.get(cle);
    if (!ex) {
      ex = { cle: s.exercise_key, nom: s.exercise_name, groupe: s.muscle_group, series: [], tonnage: 0 };
      index.set(cle, ex);
      sortie.push(ex);
    }
    ex.series.push({ reps: nombre(s.reps), poids: nombre(s.weight_kg) });
    ex.tonnage += tonnageSerie(s);
  }
  for (const ex of sortie) ex.tonnage = Math.round(ex.tonnage);
  return sortie;
}
