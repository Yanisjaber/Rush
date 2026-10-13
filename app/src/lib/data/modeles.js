// Modèles de séances (table activity_template) : conversion formulaire ↔ modèle, regroupement par sport. Fonctions pures.
//
// Un modèle est une séance réutilisable : nom, sport, durée, charge, structure en blocs… Le format de la structure est celui de
// activity_planned (voir structure.js) : les deux versions relisent les mêmes modèles.
import { normaliser } from './structure.js';
import { SPORTS_PREVUE, formulaireVide } from './prevue.js';

const TYPES = new Set(SPORTS_PREVUE.map((s) => s.type));

/** Clé de regroupement d'un type de sport brut (colonne `sport` des modèles). */
export function categorieDe(sportBrut) {
  if (['Ride', 'VirtualRide', 'GravelRide', 'EBikeRide'].includes(sportBrut)) return 'cyclisme';
  if (['MountainBikeRide', 'EMountainBikeRide'].includes(sportBrut)) return 'vtt';
  if (['Run', 'VirtualRun'].includes(sportBrut)) return 'course';
  if (sportBrut === 'TrailRun') return 'trail';
  if (['Swim', 'OpenWaterSwim'].includes(sportBrut)) return 'natation';
  if (sportBrut === 'WeightTraining') return 'musculation';
  return 'autre';
}
export const NOM_CATEGORIE = { cyclisme: 'Cyclisme', vtt: 'VTT', course: 'Course à pied', trail: 'Trail', natation: 'Natation', musculation: 'Musculation', triathlon: 'Triathlon', autre: 'Autre' };
const TYPE_PAR_CATEGORIE = { cyclisme: 'Ride', vtt: 'MountainBikeRide', course: 'Run', trail: 'TrailRun', natation: 'Swim', musculation: 'WeightTraining', autre: 'Other' };

const texte = (v) => (v == null ? '' : String(v));

/** Formulaire de séance prévue prérempli depuis un modèle, pour la date donnée. */
export function formulaireDepuisModele(m, dateIso) {
  const sport = TYPES.has(m.sport_raw) ? m.sport_raw : TYPE_PAR_CATEGORIE[m.sport] || 'Other';
  return {
    ...formulaireVide(dateIso),
    nom: texte(m.name),
    sport,
    duree: texte(m.duration_min),
    tss: texte(m.tss),
    rpe: texte(m.rpe),
    km: texte(m.distance_km),
    dPlus: texte(m.dplus),
    notes: texte(m.description),
    structure: normaliser(m.structure, 'power'),
  };
}

/** Ligne à écrire dans activity_template à partir des valeurs validées d'une séance (validerPrevue). Sans user_id. */
export function modeleDepuisValeurs(v) {
  return {
    name: v.nom,
    sport: categorieDe(v.sport),
    sport_raw: v.sport,
    duration_min: v.duree,
    tss: v.tss,
    description: v.notes,
    rpe: v.rpe,
    distance_km: v.km,
    dplus: v.dPlus,
    structure: v.structure && v.structure.length ? v.structure : null,
    est_watts: v.estimations?.watts ?? null,
    est_bpm: v.estimations?.bpm ?? null,
    est_kj: v.estimations?.kj ?? null,
    est_if: v.estimations?.facteurIntensite ?? null,
  };
}

const sansAccent = (s) => String(s).normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

/**
 * Modèles regroupés par catégorie de sport : [{ cle, nom, modeles }], filtrés par une recherche (nom ou description).
 * Les groupes vides ne sont pas renvoyés ; les modèles sont triés par nom.
 */
export function grouper(modeles, recherche = '') {
  const q = sansAccent(recherche).trim();
  const filtres = (modeles || []).filter((m) => !q || sansAccent(`${m.name} ${m.description || ''}`).includes(q));
  const par = new Map();
  for (const m of filtres) {
    const cle = Object.hasOwn(NOM_CATEGORIE, m.sport) ? m.sport : 'autre';
    if (!par.has(cle)) par.set(cle, []);
    par.get(cle).push(m);
  }
  return [...par.entries()]
    .map(([cle, liste]) => ({ cle, nom: NOM_CATEGORIE[cle], modeles: liste.sort((a, b) => String(a.name).localeCompare(String(b.name), 'fr')) }))
    .sort((a, b) => a.nom.localeCompare(b.nom, 'fr'));
}

/** Résumé d'une ligne de modèle : « 55 min · 48 TSS · par blocs ». */
export function resume(m) {
  const morceaux = [];
  if (m.duration_min) morceaux.push(`${m.duration_min} min`);
  if (m.tss) morceaux.push(`${m.tss} TSS`);
  if (m.distance_km) morceaux.push(`${String(m.distance_km).replace('.', ',')} km`);
  if (Array.isArray(m.structure) && m.structure.length) morceaux.push('par blocs');
  return morceaux.join(' · ');
}
