// Import d'un export CSV de Hevy (Paramètres de Hevy → Exporter les données).
// Fonctions pures : lecture du CSV, regroupement en séances, reconnaissance des exercices, rapprochement avec les séances déjà dans l'app.
// Rien n'est écrit ici ; les écritures sont dans hevy-import.js.
//
// Format d'une ligne du CSV (une ligne = une série) :
//   title, start_time, end_time, description, exercise_title, superset_id, exercise_notes, set_index, set_type, weight_kg, reps, distance_km, duration_seconds, rpe
import { BIBLIOTHEQUE, groupeValide } from './exercices.js';
import { LIMITES } from './force.js';
import { estimerTss } from './prevue.js';

export const LIMITE_OCTETS = 5 * 1024 * 1024; // un export de plusieurs années fait quelques centaines de Ko
export const LIMITE_LIGNES = 100000;

// --- Lecture du CSV ---------------------------------------------------------------------------------------------------------

/** Lit un CSV (guillemets, virgules et retours à la ligne dans les champs, BOM, CRLF) et renvoie un tableau de lignes. */
export function lireCsv(texte) {
  const t = String(texte ?? '').replace(/^﻿/, '');
  const lignes = [];
  let ligne = [];
  let champ = '';
  let entre = false;
  for (let i = 0; i < t.length; i++) {
    const c = t[i];
    if (entre) {
      if (c === '"') {
        if (t[i + 1] === '"') {
          champ += '"';
          i++;
        } else entre = false;
      } else champ += c;
    } else if (c === '"') entre = true;
    else if (c === ',') {
      ligne.push(champ);
      champ = '';
    } else if (c === '\n' || c === '\r') {
      if (c === '\r' && t[i + 1] === '\n') i++;
      ligne.push(champ);
      champ = '';
      if (ligne.length > 1 || ligne[0] !== '') lignes.push(ligne);
      ligne = [];
      if (lignes.length > LIMITE_LIGNES) return lignes;
    } else champ += c;
  }
  if (champ !== '' || ligne.length) {
    ligne.push(champ);
    if (ligne.length > 1 || ligne[0] !== '') lignes.push(ligne);
  }
  return lignes;
}

// --- Dates ------------------------------------------------------------------------------------------------------------------

const MOIS = [['jan', 1], ['feb', 2], ['fev', 2], ['mar', 3], ['apr', 4], ['avr', 4], ['may', 5], ['mai', 5], ['jun', 6], ['jul', 7], ['aug', 8], ['aou', 8], ['sep', 9], ['oct', 10], ['nov', 11], ['dec', 12]];
const sansAccent = (s) => String(s).normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
const deux = (n) => String(n).padStart(2, '0');

/**
 * Date et heure d'un export Hevy : « 5 Oct 2026, 18:30 » (anglais ou français), « 2026-10-05 18:30:00 » ou « 05/10/2026 18:30 ».
 * Renvoie { date: 'AAAA-MM-JJ', heure: 'HH:MM', minutes (depuis minuit) } ou null.
 */
export function lireDate(brut) {
  const s = sansAccent(String(brut || '').trim()).replace(/\./g, '');
  let m = /^(\d{4})-(\d{2})-(\d{2})[ t](\d{1,2}):(\d{2})/.exec(s);
  let a, mo, j, h, mi;
  if (m) [, a, mo, j, h, mi] = m;
  else if ((m = /^(\d{1,2})\/(\d{1,2})\/(\d{4})[ ,]+(\d{1,2}):(\d{2})/.exec(s))) [, j, mo, a, h, mi] = m;
  else if ((m = /^(\d{1,2})\s+([a-z]+)\s+(\d{4}),?\s+(\d{1,2}):(\d{2})/.exec(s))) {
    const nom = MOIS.find(([p]) => m[2].startsWith(p));
    if (!nom) return null;
    [, j, , a, h, mi] = m;
    mo = nom[1];
  } else return null;
  const An = Number(a);
  const Mo = Number(mo);
  const Jo = Number(j);
  const H = Number(h);
  const Mi = Number(mi);
  if (!(An >= 2000 && An <= 2100 && Mo >= 1 && Mo <= 12 && Jo >= 1 && Jo <= 31 && H >= 0 && H <= 23 && Mi >= 0 && Mi <= 59)) return null;
  const jourDuMois = new Date(An, Mo, 0).getDate();
  if (Jo > jourDuMois) return null;
  return { date: `${An}-${deux(Mo)}-${deux(Jo)}`, heure: `${deux(H)}:${deux(Mi)}`, minutes: H * 60 + Mi };
}

/** Durée en minutes entre deux dates lues (peut passer minuit), ou null si absurde. */
export function dureeMinutes(debut, fin) {
  if (!debut || !fin) return null;
  const jours = Math.round((Date.parse(`${fin.date}T12:00:00Z`) - Date.parse(`${debut.date}T12:00:00Z`)) / 86400000);
  const d = jours * 1440 + fin.minutes - debut.minutes;
  return d >= 1 && d <= 600 ? d : null;
}

// --- Reconnaissance des exercices -------------------------------------------------------------------------------------------

/** Nom Hevy → nom nettoyé : minuscules, sans accents, sans l'équipement entre parenthèses « (Barbell) » (renvoyé à part). */
export function nettoyerNom(titre) {
  const brut = sansAccent(titre).trim();
  const equip = /\(([^)]*)\)\s*$/.exec(brut);
  return { base: brut.replace(/\([^)]*\)\s*$/, '').replace(/\s+/g, ' ').trim(), equipement: equip ? equip[1].trim() : '' };
}

// Règles dans l'ordre : la première qui correspond gagne (les cas précis avant les cas généraux). [motif sur le nom sans équipement, clé de la bibliothèque]
const REGLES = [
  [/romanian deadlift|stiff.?leg/, 'souleve-de-terre-roumain'],
  [/sumo deadlift|deadlift|trap bar/, 'souleve-de-terre'],
  [/incline.*(bench|press)/, null, { barbell: 'developpe-incline-barre', _: 'developpe-incline-halteres' }],
  [/(bench press|chest press)/, null, { dumbbell: 'developpe-halteres', _: 'developpe-couche' }],
  [/pec deck|butterfly/, 'pec-deck'],
  [/machine fly|chest fly|cable fly|crossover|dumbbell fly|^fly/, null, { machine: 'pec-deck', _: 'ecartes' }],
  [/push.?up/, 'pompes'],
  [/chest dip|triceps dip|^dip|dips$/, 'dips'],
  [/bench dip/, 'dips-banc'],
  [/pull.?up|chin.?up/, 'tractions'],
  [/lat pulldown|pulldown(?! triceps)|pull down/, 'tirage-vertical'],
  [/seated.*row|cable row|low row/, 'tirage-horizontal'],
  [/upright row/, 'tirage-menton'],
  [/(dumbbell|one arm|single arm|db).*row|row.*(dumbbell)/, 'rowing-haltere'],
  [/(bent over|barbell|pendlay|t.?bar).*row|^row/, 'rowing-barre'],
  [/back extension|hyperextension/, 'hyperextensions'],
  [/front squat/, 'front-squat'],
  [/bulgarian|split squat/, 'fentes-bulgares'],
  [/(^|\s)squat/, 'squat'],
  [/leg press|hack squat/, 'presse-a-cuisses'],
  [/lunge/, 'fentes'],
  [/hip thrust|glute bridge/, 'hip-thrust'],
  [/leg extension/, 'leg-extension'],
  [/leg curl|hamstring curl/, 'leg-curl'],
  [/calf raise|calf press|seated calf/, 'mollets-debout'],
  [/step.?up/, 'step-up'],
  [/overhead press|military press|shoulder press|arnold press|push press/, null, { dumbbell: 'developpe-epaules-halteres', _: 'developpe-militaire' }],
  [/lateral raise|side raise/, 'elevations-laterales'],
  [/front raise/, 'elevations-frontales'],
  [/reverse fly|rear delt|bent over (lateral|fly)/, 'oiseau'],
  [/face pull/, 'face-pull'],
  [/shrug/, 'shrugs'],
  [/hammer curl/, 'curl-marteau'],
  [/preacher curl/, 'curl-pupitre'],
  [/(bicep|biceps|ez|barbell|standing).*curl|^curl/, null, { dumbbell: 'curl-halteres', _: 'curl-barre' }],
  [/skull.?crusher|lying triceps|french press/, 'barre-au-front'],
  [/tricep.*kickback|kickback.*tricep/, 'kickback'],
  [/triceps? (pushdown|extension)|pushdown|rope pushdown|overhead triceps/, 'extension-triceps-poulie'],
  [/cable crunch/, 'crunch-poulie'],
  [/leg raise|knee raise|toes to bar/, 'releve-de-jambes'],
  [/russian twist/, 'russian-twist'],
  [/ab wheel|ab roller|rollout/, 'roue-abdominale'],
  [/plank|dead bug|hollow/, 'gainage'],
  [/crunch|sit.?up/, 'crunch'],
];

// Mots-clés pour deviner le groupe musculaire d'un exercice inconnu
const MOTS_GROUPE = [
  ['pectoraux', /chest|\bpec|bench|\bfly|push.?up|\bdip|incline/],
  ['dos', /\brow|\bpull|\blat\b|deadlift|\bback\b|\bchin\b|rhomboid|\btrap/],
  ['jambes', /squat|leg|lunge|calf|glute|hip|thrust|hamstring|quad|abductor|adductor/],
  ['epaules', /shoulder|lateral|delt|overhead|shrug|face pull|raise|arnold/],
  ['bras', /curl|tricep|bicep|forearm|wrist|pushdown|skull|kickback/],
  ['tronc', /crunch|plank|abs?\b|twist|sit.?up|core|oblique|woodchop|rollout/],
];

const PAR_CLE = new Map(BIBLIOTHEQUE.map((e) => [e.cle, e]));
const slug = (s) => sansAccent(s).replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 60);

/**
 * Exercice Hevy → { cle, nom, groupe, reconnu } de la bibliothèque de l'app si on le reconnaît, sinon un exercice « hevy-<nom> »
 * (avec son nom d'origine et un groupe deviné). Jamais d'erreur : un exercice inconnu est importé tel quel.
 */
export function resoudreExercice(titre) {
  const brut = String(titre || '').trim().slice(0, LIMITES.nom) || 'Exercice';
  const { base, equipement } = nettoyerNom(brut);
  for (const [motif, cle, parEquip] of REGLES) {
    if (!motif.test(base)) continue;
    let k = cle;
    if (!k) {
      const eq = Object.keys(parEquip).find((e) => e !== '_' && equipement.includes(e));
      k = parEquip[eq || '_'];
    }
    const e = PAR_CLE.get(k);
    if (e) return { cle: e.cle, nom: e.nom, groupe: e.groupe, reconnu: true };
  }
  const mot = MOTS_GROUPE.find(([, m]) => m.test(base));
  const groupe = mot ? mot[0] : 'tronc';
  return { cle: `hevy-${slug(brut) || 'exercice'}`, nom: brut, groupe: groupeValide(groupe) ? groupe : 'tronc', reconnu: false };
}

// --- Lecture de l'export ----------------------------------------------------------------------------------------------------

const nombre = (v) => {
  const n = Number(String(v ?? '').trim().replace(',', '.'));
  return String(v ?? '').trim() !== '' && Number.isFinite(n) ? n : null;
};
const LB = 0.45359237;

/**
 * Lit le texte d'un export Hevy.
 * Renvoie { seances, ignorees, erreur } où seances = [{ cle, titre, date, heure, minutes, notes, series, exercices }] (de la plus ancienne à la plus récente).
 * `series` est au format des lignes strength_sets (sans user_id ni activity_id) ; `ignorees` compte ce qui n'a pas pu être gardé.
 */
export function lireExportHevy(texte) {
  const vide = { seances: [], ignorees: { echauffement: 0, sansRepetitions: 0, horsLimites: 0, seancesSansSerie: 0, dateInvalide: 0 }, erreur: '' };
  if (typeof texte !== 'string' || !texte.trim()) return { ...vide, erreur: 'Le fichier est vide.' };
  if (texte.length > LIMITE_OCTETS) return { ...vide, erreur: 'Le fichier est trop gros (5 Mo au plus). Un export Hevy est bien plus léger : est-ce le bon fichier ?' };
  const lignes = lireCsv(texte);
  if (lignes.length > LIMITE_LIGNES) return { ...vide, erreur: `Le fichier est trop long (${LIMITE_LIGNES} lignes au plus).` };
  if (lignes.length < 2) return { ...vide, erreur: 'Aucune séance dans ce fichier.' };
  const entetes = lignes[0].map((h) => sansAccent(h).trim());
  const col = (nom) => entetes.indexOf(nom);
  const iTitre = col('title');
  const iDebut = col('start_time');
  const iFin = col('end_time');
  const iDesc = col('description');
  const iExo = col('exercise_title');
  const iType = col('set_type');
  const iKg = col('weight_kg');
  const iLb = col('weight_lbs');
  const iReps = col('reps');
  const iRpe = col('rpe');
  if (iDebut < 0 || iExo < 0 || (iKg < 0 && iLb < 0) || iReps < 0) {
    return { ...vide, erreur: 'Ce fichier ne ressemble pas à un export Hevy (colonnes start_time, exercise_title, weight_kg et reps attendues).' };
  }
  const ignorees = { ...vide.ignorees };
  const parSeance = new Map();
  for (const l of lignes.slice(1)) {
    const cleDebut = String(l[iDebut] ?? '').trim();
    if (!cleDebut) continue;
    const debut = lireDate(cleDebut);
    if (!debut) {
      ignorees.dateInvalide++;
      continue;
    }
    let s = parSeance.get(cleDebut);
    if (!s) {
      s = { cle: `${debut.date}T${debut.heure}`, titre: String(l[iTitre] ?? '').trim().slice(0, LIMITES.nom) || 'Séance Hevy', debut, fin: lireDate(l[iFin]), notes: String(l[iDesc] ?? '').trim().slice(0, LIMITES.notes), lignes: [] };
      parSeance.set(cleDebut, s);
    }
    s.lignes.push(l);
  }

  const seances = [];
  for (const s of parSeance.values()) {
    const exercices = new Map(); // titre → { ...exercice, position, nSeries }
    const series = [];
    const rpes = [];
    for (const l of s.lignes) {
      const type = String(l[iType] ?? 'normal').trim().toLowerCase();
      if (type === 'warmup') {
        ignorees.echauffement++;
        continue;
      }
      const reps = nombre(l[iReps]);
      if (reps == null || reps < 1) {
        ignorees.sansRepetitions++; // gainage, cardio… : pas de répétitions, rien à compter en tonnage
        continue;
      }
      const brutKg = iKg >= 0 ? nombre(l[iKg]) : nombre(l[iLb]) == null ? null : nombre(l[iLb]) * LB;
      const kg = brutKg == null ? 0 : Math.round(brutKg * 10) / 10;
      if (!(kg >= 0 && kg <= LIMITES.poids) || reps > LIMITES.reps) {
        ignorees.horsLimites++;
        continue;
      }
      const titre = String(l[iExo] ?? '').trim();
      let e = exercices.get(titre);
      if (!e) {
        if (exercices.size >= LIMITES.exercices) {
          ignorees.horsLimites++;
          continue;
        }
        e = { ...resoudreExercice(titre), position: exercices.size, n: 0 };
        exercices.set(titre, e);
      }
      if (e.n >= LIMITES.series) {
        ignorees.horsLimites++;
        continue;
      }
      e.n++;
      series.push({ exercise_key: e.cle, exercise_name: e.nom, muscle_group: e.groupe, position: e.position, set_no: e.n, reps: Math.round(reps), weight_kg: kg });
      const r = iRpe >= 0 ? nombre(l[iRpe]) : null;
      if (r != null && r >= 1 && r <= 10) rpes.push(r);
    }
    if (!series.length) {
      ignorees.seancesSansSerie++;
      continue;
    }
    const minutes = dureeMinutes(s.debut, s.fin) ?? Math.max(5, series.length * 3);
    seances.push({
      cle: s.cle,
      titre: s.titre,
      date: s.debut.date,
      heure: s.debut.heure,
      minutes,
      notes: s.notes,
      rpe: rpes.length ? Math.round(rpes.reduce((a, b) => a + b, 0) / rpes.length) : null,
      series,
      exercices: [...exercices.values()].map((e) => ({ cle: e.cle, nom: e.nom, groupe: e.groupe, reconnu: e.reconnu, series: e.n })),
    });
  }
  seances.sort((a, b) => a.cle.localeCompare(b.cle));
  if (!seances.length) return { ...vide, ignorees, erreur: 'Aucune série exploitable dans ce fichier (séries avec répétitions, hors échauffements).' };
  return { seances, ignorees, erreur: '' };
}

/** Ligne `activities` d'une séance Hevy importée (comme une séance de force saisie à la main, mais avec ses vraies heures). */
export function ligneActivite(s) {
  return {
    source: 'manual',
    category: 'entrainement',
    name: s.titre,
    start_date_local: `${s.date}T${s.heure}:00`,
    sport: 'WeightTraining',
    moving_time: s.minutes * 60,
    tss: estimerTss(s.minutes, s.rpe),
    rpe: s.rpe,
    user_notes: s.notes || null,
  };
}

/** Lignes strength_sets d'une séance Hevy (l'identifiant de séance et l'utilisateur sont ajoutés par l'appelant). */
export function lignesSeriesHevy(s) {
  return s.series.map((x) => ({ ...x, date: s.date }));
}

export const cleClient = (s) => `hevy-${s.cle}`; // identifiant stable : permet de ne pas importer deux fois la même séance

// --- Rapprochement avec ce qui existe déjà -----------------------------------------------------------------------------------

const minutesDe = (iso) => {
  const m = /T(\d{2}):(\d{2})/.exec(String(iso));
  return m ? Number(m[1]) * 60 + Number(m[2]) : null;
};

/**
 * Décide quoi faire de chaque séance Hevy :
 *  - 'deja'    : déjà importée (son identifiant `hevy-…` existe) ;
 *  - 'attacher': une séance de muscu synchronisée (Strava) existe le même jour à ±3 h et n'a pas encore de séries : on lui rattache les séries
 *                (Hevy envoie ses séances vers Strava : sans ça on aurait deux séances pour une) ;
 *  - 'creer'   : séance nouvelle.
 * `existantes` : [{ id, source, sport, start_date_local, client_id }] ; `activitesAvecSeries` : Set des identifiants de séances qui ont déjà des séries.
 * Une séance synchronisée n'est rattachée qu'à une seule séance Hevy (la plus proche en heure).
 */
export function rapprocher(seancesHevy, existantes, activitesAvecSeries = new Set(), famille = (sport) => sport) {
  const dejaImportees = new Set(existantes.map((e) => e.client_id).filter(Boolean));
  const pris = new Set();
  const candidates = existantes.filter((e) => e.source !== 'manual' && famille(e.sport) === 'muscu' && !activitesAvecSeries.has(e.id));
  return seancesHevy.map((s) => {
    if (dejaImportees.has(cleClient(s))) return { seance: s, action: 'deja' };
    const t = s.heure ? Number(s.heure.slice(0, 2)) * 60 + Number(s.heure.slice(3, 5)) : null;
    let meilleur = null;
    for (const e of candidates) {
      if (pris.has(e.id) || String(e.start_date_local).slice(0, 10) !== s.date) continue;
      const m = minutesDe(e.start_date_local);
      if (m == null || t == null) continue;
      const ecart = Math.abs(m - t);
      if (ecart <= 180 && (!meilleur || ecart < meilleur.ecart)) meilleur = { e, ecart };
    }
    if (meilleur) {
      pris.add(meilleur.e.id);
      return { seance: s, action: 'attacher', activiteId: meilleur.e.id };
    }
    return { seance: s, action: 'creer' };
  });
}

/** Résumé d'un plan pour l'aperçu : nombres de séances par action, de séries, d'exercices reconnus, période. */
export function resumerPlan(plan) {
  const faire = plan.filter((p) => p.action !== 'deja');
  const exos = new Map();
  for (const p of faire) for (const e of p.seance.exercices) exos.set(e.cle, e.reconnu);
  const dates = plan.map((p) => p.seance.date).sort();
  return {
    total: plan.length,
    creer: plan.filter((p) => p.action === 'creer').length,
    attacher: plan.filter((p) => p.action === 'attacher').length,
    deja: plan.filter((p) => p.action === 'deja').length,
    series: faire.reduce((t, p) => t + p.seance.series.length, 0),
    exercices: exos.size,
    reconnus: [...exos.values()].filter(Boolean).length,
    du: dates[0] || '',
    au: dates[dates.length - 1] || '',
  };
}
