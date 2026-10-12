// Accès unique aux données de force et d'Hyrox pour les pages : en mode démo, tout reste en mémoire (voir demo.js) ;
// sinon on passe par la base (api.js). Les pages n'ont ainsi jamais à distinguer les deux cas.
// Toutes les fonctions renvoient { data, erreur } comme api.js.
import * as api from './api.js';
import {
  ajoutsDemo, donneesDemo, programmesDemo, seriesForceDemo, testsHyroxDemo, objectifHyroxDemo,
} from './demo.js';

const ok = (data) => ({ data, erreur: '' });
const estForce = (s) => /^WeightTraining$/i.test(String(s.sport || ''));

/** Séances de force des 12 derniers mois (WeightTraining), toutes sources confondues. */
async function seancesForce(demo, userId) {
  if (demo) return ok(donneesDemo().seances.filter(estForce));
  const r = await api.chargerSeances(userId, 365, 600);
  return r.erreur ? r : ok((r.data || []).filter(estForce));
}

/** Tout ce que les pages de force affichent : séances, séries, programmes, exercices perso. */
export async function lireForce(demo, userId) {
  if (demo) {
    return ok({ seances: (await seancesForce(true)).data, series: seriesForceDemo(), programmes: programmesDemo(), exercicesPerso: ajoutsDemo.exercices });
  }
  const [seances, series, programmes, exercices] = await Promise.all([
    seancesForce(false, userId),
    api.chargerSeriesForce(userId, 365),
    api.chargerProgrammes(userId),
    api.chargerExercicesPerso(userId),
  ]);
  const erreur = [seances, series, programmes, exercices].map((r) => r.erreur).find(Boolean) || '';
  return { data: { seances: seances.data || [], series: series.data || [], programmes: programmes.data || [], exercicesPerso: exercices.data || [] }, erreur };
}

/** Une séance de force et ses séries (pour la modifier). */
export async function lireSeanceForce(demo, userId, id) {
  if (demo) {
    const base = donneesDemo().seances.find((s) => s.id === id);
    if (!base) return { data: null, erreur: 'Séance introuvable.' };
    return ok({ seance: base, series: seriesForceDemo().filter((l) => l.activity_id === id) });
  }
  const [s, series] = await Promise.all([api.chargerSeance(userId, id), api.chargerSeriesSeance(userId, id)]);
  if (s.erreur || !s.data) return { data: null, erreur: s.erreur || 'Séance introuvable.' };
  return { data: { seance: s.data, series: series.data || [] }, erreur: series.erreur };
}

/** Enregistre une séance (création, ou modification si `existante` = { id, manuelle }). */
export async function sauverSeance(demo, userId, ligne, lignesSeries, existante = null) {
  if (!demo) return api.enregistrerSeanceForce(userId, ligne, lignesSeries, existante);
  const id = existante?.id || `demo-force-${Date.now()}`;
  if (!existante) ajoutsDemo.manuelles.push({ ...ligne, id });
  else if (existante.manuelle) {
    const i = ajoutsDemo.manuelles.findIndex((m) => m.id === id);
    if (i >= 0) ajoutsDemo.manuelles[i] = { ...ajoutsDemo.manuelles[i], ...ligne };
  }
  ajoutsDemo.seriesParSeance[id] = lignesSeries.map((l, i) => ({ ...l, id: `demo-serie-${id}-${i}`, activity_id: id }));
  return ok({ id });
}

/** Supprime une séance saisie à la main (avec ses séries) ou seulement les séries d'une séance synchronisée. */
export async function retirerSeance(demo, userId, id, manuelle) {
  if (!demo) return api.supprimerSeanceForce(userId, id, manuelle);
  if (manuelle) ajoutsDemo.manuelles = ajoutsDemo.manuelles.filter((m) => m.id !== id);
  ajoutsDemo.seriesParSeance[id] = [];
  return ok(null);
}

export async function sauverProgramme(demo, userId, ligne, id = null) {
  if (!demo) return id ? api.modifierProgramme(userId, id, ligne) : api.creerProgramme(userId, ligne);
  const liste = programmesDemo();
  if (id) {
    const i = liste.findIndex((p) => p.id === id);
    if (i >= 0) liste[i] = { ...liste[i], ...ligne };
    return ok(liste[i] || null);
  }
  const p = { ...ligne, id: `demo-prog-${Date.now()}`, created_at: new Date().toISOString() };
  liste.push(p);
  return ok(p);
}

export async function retirerProgramme(demo, userId, id) {
  if (!demo) return api.supprimerProgramme(userId, id);
  ajoutsDemo.programmes = programmesDemo().filter((p) => p.id !== id);
  return ok(null);
}

export async function ajouterExercicePerso(demo, userId, nom, groupe) {
  if (!demo) return api.creerExercicePerso(userId, nom, groupe);
  const l = { id: `demo-exo-${Date.now()}`, name: nom, muscle_group: groupe };
  ajoutsDemo.exercices.push(l);
  return ok(l);
}

export async function retirerExercicePerso(demo, userId, id) {
  if (!demo) return api.supprimerExercicePerso(userId, id);
  ajoutsDemo.exercices = ajoutsDemo.exercices.filter((e) => e.id !== id);
  return ok(null);
}

// --- Hyrox ---

export async function lireHyrox(demo, userId) {
  if (demo) return ok({ tests: testsHyroxDemo(), objectif: objectifHyroxDemo(), seances: [] });
  const [tests, objectif] = await Promise.all([api.chargerTestsHyrox(userId), api.chargerObjectifHyrox(userId)]);
  return { data: { tests: tests.data || [], objectif: objectif.data || null }, erreur: tests.erreur || objectif.erreur };
}

export async function sauverTest(demo, userId, valeurs, id = null) {
  if (!demo) return id ? api.modifierTestHyrox(userId, id, valeurs) : api.creerTestHyrox(userId, valeurs);
  const tests = testsHyroxDemo();
  if (id) {
    const i = tests.findIndex((t) => t.id === id);
    if (i >= 0) tests[i] = { ...tests[i], ...valeurs };
  } else tests.push({ ...valeurs, id: `demo-hx-${Date.now()}`, source: 'manuel', activity_id: null });
  tests.sort((a, b) => (a.date < b.date ? 1 : -1));
  return ok(null);
}

export async function retirerTest(demo, userId, id) {
  if (!demo) return api.supprimerTestHyrox(userId, id);
  ajoutsDemo.testsHyrox = testsHyroxDemo().filter((t) => t.id !== id);
  return ok(null);
}

/** Enregistre l'objectif de temps (valeurs = { total_s, segments }) ou l'efface (valeurs = null). */
export async function sauverObjectif(demo, userId, valeurs) {
  if (!demo) return valeurs ? api.enregistrerObjectifHyrox(userId, valeurs) : api.supprimerObjectifHyrox(userId);
  ajoutsDemo.objectifHyrox = valeurs;
  return ok(null);
}
