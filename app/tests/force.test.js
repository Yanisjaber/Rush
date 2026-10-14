import test from 'node:test';
import assert from 'node:assert/strict';
import {
  tonnage,
  unRmEstime,
  tonnageParSemaine,
  seriesParGroupe,
  progressionParExercice,
  recordsParGroupe,
  recordsParSeance,
  resumeProgramme,
  programmeDuJour,
  brouillonDepuisProgramme,
  brouillonDepuisSeance,
  dernieresCharges,
  validerSeance,
  ligneSeanceForce,
  lignesSeries,
} from '../src/lib/data/force.js';
import { trouverExercice, chercherExercices, groupeValide, BIBLIOTHEQUE, GROUPES } from '../src/lib/data/exercices.js';

// Lundi 12 octobre 2026
const AUJ = new Date(2026, 9, 12, 14, 0);
const serie = (date, cle, reps, poids, extra = {}) => ({
  date,
  exercise_key: cle,
  exercise_name: cle,
  muscle_group: 'pectoraux',
  position: 0,
  set_no: 1,
  reps,
  weight_kg: poids,
  ...extra,
});

test('bibliothèque : clés uniques, groupes valides', () => {
  const cles = new Set(BIBLIOTHEQUE.map((e) => e.cle));
  assert.equal(cles.size, BIBLIOTHEQUE.length);
  for (const e of BIBLIOTHEQUE) assert.ok(groupeValide(e.groupe), e.cle);
  assert.equal(groupeValide('constructor'), false);
  assert.equal(groupeValide('__proto__'), false);
  assert.ok(Object.keys(GROUPES).length >= 6);
});

test('trouverExercice et chercherExercices (accents ignorés, perso mélangés)', () => {
  assert.equal(trouverExercice('squat').nom, 'Squat');
  assert.equal(trouverExercice('inconnu'), null);
  const perso = [{ cle: 'perso-1', nom: 'Développé Svend', groupe: 'pectoraux', perso: true }];
  assert.equal(trouverExercice('perso-1', perso).nom, 'Développé Svend');
  const r = chercherExercices(perso, { texte: 'developpe', groupe: 'pectoraux' });
  assert.ok(r.some((e) => e.cle === 'perso-1'));
  assert.ok(r.every((e) => e.groupe === 'pectoraux'));
  assert.equal(chercherExercices(perso, { texte: 'zzzz' }).length, 0);
});

test('tonnage et 1RM estimé (Epley)', () => {
  assert.equal(tonnage([serie('2026-10-12', 'a', 5, 100), serie('2026-10-12', 'a', 8, 50.5)]), 904);
  assert.equal(unRmEstime(100, 1), 100);
  assert.equal(unRmEstime(100, 5), 116.7);
  assert.equal(unRmEstime(100, 13), null); // trop de répétitions : estimation non fiable
  assert.equal(unRmEstime(0, 10), null); // poids du corps
  assert.equal(unRmEstime(100, 0), null);
});

test('tonnage par semaine : fenêtres de 7 jours glissants et écart à la moyenne', () => {
  const s = [
    serie('2026-10-12', 'a', 10, 100), // aujourd'hui → dernière semaine : 1000
    serie('2026-10-06', 'a', 10, 100), // il y a 6 jours → même fenêtre : +1000
    serie('2026-10-05', 'a', 10, 50), // il y a 7 jours → fenêtre d'avant : 500
    serie('2026-09-28', 'a', 10, 100), // il y a 14 jours → encore avant : 1000
    serie('2026-10-13', 'a', 10, 999), // dans le futur : ignorée
  ];
  const t = tonnageParSemaine(s, 4, AUJ);
  assert.deepEqual(t.parSemaine, [0, 1000, 500, 2000]);
  assert.equal(t.derniere, 2000);
  assert.equal(t.moyenne, 750);
  assert.equal(t.ecartPct, 167);
  assert.equal(tonnageParSemaine([], 4, AUJ).ecartPct, null);
});

test('séries par groupe : 7 derniers jours seulement', () => {
  const s = [
    serie('2026-10-12', 'a', 8, 50),
    serie('2026-10-10', 'a', 8, 50),
    serie('2026-10-10', 'b', 8, 50, { muscle_group: 'dos' }),
    serie('2026-10-01', 'a', 8, 50), // trop ancienne
    serie('2026-10-11', 'c', 0, 50, { muscle_group: 'jambes' }), // 0 répétition : ne compte pas
  ];
  const g = seriesParGroupe(s, AUJ);
  assert.equal(g.length, 6);
  assert.equal(g.find((x) => x.groupe === 'pectoraux').series, 2);
  assert.equal(g.find((x) => x.groupe === 'dos').series, 1);
  assert.equal(g.find((x) => x.groupe === 'jambes').series, 0);
  assert.deepEqual(g[0].cible, [10, 20]);
});

test('progression : record, delta et séances', () => {
  const s = [
    serie('2026-09-01', 'squat', 5, 100),
    serie('2026-09-01', 'squat', 8, 80), // meilleure série du jour = 100 × 5 → 116,7 (80 × 8 → 101,3)
    serie('2026-09-20', 'squat', 5, 110),
    serie('2026-10-10', 'squat', 5, 120),
    serie('2026-10-10', 'curl', 15, 20), // 15 reps : ignoré (1RM non fiable)
  ];
  const p = progressionParExercice(s);
  assert.equal(p.length, 1);
  const squat = p[0];
  assert.equal(squat.cle, 'squat');
  assert.equal(squat.rm, 140);
  assert.equal(squat.record, true);
  assert.equal(squat.delta, 11.7);
  assert.equal(squat.serie.length, 3);
  assert.equal(squat.meilleurRm, 140);
});

test('progression : pas de record si la dernière séance est plus faible, ni de delta sur une seule séance', () => {
  const baisse = progressionParExercice([serie('2026-09-01', 'a', 5, 120), serie('2026-10-10', 'a', 5, 100)]);
  assert.equal(baisse[0].record, false);
  assert.ok(baisse[0].delta < 0);
  const seule = progressionParExercice([serie('2026-10-10', 'a', 5, 100)]);
  assert.equal(seule[0].record, false);
  assert.equal(seule[0].delta, null);
});

test('records par groupe : un exercice par groupe musculaire, le grand mouvement du groupe d\'abord', () => {
  const g = (groupe) => ({ muscle_group: groupe });
  const s = [
    serie('2026-10-10', 'curl', 10, 20, g('bras')), serie('2026-10-10', 'curl', 10, 20, g('bras')), serie('2026-10-10', 'curl', 10, 20, g('bras')),
    serie('2026-10-10', 'squat', 5, 100, g('jambes')),
    serie('2026-10-10', 'leg-curl', 10, 40, g('jambes')), serie('2026-10-10', 'leg-curl', 10, 40, g('jambes')), // plus pratiqué que le squat, mais le squat est le grand mouvement
    serie('2026-10-10', 'developpe-couche', 5, 80, g('pectoraux')),
    serie('2026-10-10', 'ecartes', 12, 15, g('pectoraux')),
    serie('2026-10-10', 'souleve-de-terre', 5, 120, g('dos')),
    serie('2026-10-10', 'developpe-militaire', 5, 50, g('epaules')),
    serie('2026-10-10', 'gainage', 10, 5, g('tronc')),
  ];
  // 5 cartes : un par groupe, rangés pectoraux, dos, jambes, épaules, bras (le tronc passe après : pas la place)
  assert.deepEqual(recordsParGroupe(s, 5).map((e) => e.cle), ['developpe-couche', 'souleve-de-terre', 'squat', 'developpe-militaire', 'curl']);
  // 2 cartes seulement : jambes et pectoraux en priorité, toujours rangés dans l'ordre habituel
  assert.deepEqual(recordsParGroupe(s, 2).map((e) => e.cle), ['developpe-couche', 'squat']);
  // 6 places : le tronc apparaît aussi
  assert.equal(recordsParGroupe(s, 6).length, 6);
});

test('records par groupe : un groupe sans séance n\'a pas de carte, et le tronc remplit si on manque de groupes', () => {
  const g = (groupe) => ({ muscle_group: groupe });
  const s = [serie('2026-10-10', 'squat', 5, 100, g('jambes')), serie('2026-10-10', 'gainage', 10, 5, g('tronc'))];
  assert.deepEqual(recordsParGroupe(s, 5).map((e) => e.cle), ['squat', 'gainage']);
  assert.deepEqual(recordsParGroupe([], 5), []);
});

test('records par groupe : sur tout l\'historique, même sans séance récente (rien depuis 90 jours)', () => {
  const s = [serie('2026-05-06', 'squat', 5, 100, { muscle_group: 'jambes' }), serie('2026-05-06', 'squat', 5, 110, { muscle_group: 'jambes' }), serie('2026-04-20', 'curl', 10, 20, { muscle_group: 'bras' })];
  const e = recordsParGroupe(s, 5);
  assert.deepEqual(e.map((x) => x.cle), ['squat', 'curl']);
  assert.equal(e[0].meilleurRm, 128.3);
});

test('records par groupe : une série dont le groupe est invalide est ignorée (pas de « constructor »)', () => {
  const s = [serie('2026-10-10', 'x', 5, 100, { muscle_group: 'constructor' }), serie('2026-10-10', 'y', 5, 100, { muscle_group: '' })];
  assert.deepEqual(recordsParGroupe(s, 5), []);
});

const PUSH = { id: 'p1', name: 'PUSH', created_at: '2026-01-01', exercises: [
  { key: 'developpe-couche', name: 'Développé couché', group: 'pectoraux', sets: 4, reps: 6, weight: 82.5 },
  { key: 'dips', name: 'Dips', group: 'pectoraux', sets: 3, reps: 10, weight: 0 },
] };
const PULL = { id: 'p2', name: 'PULL', created_at: '2026-01-02', exercises: [{ key: 'tractions', name: 'Tractions', group: 'dos', sets: 4, reps: 8, weight: 0 }] };

test('résumé de programme et programme du jour (rotation)', () => {
  assert.deepEqual(resumeProgramme(PUSH), { exercices: 2, series: 7, minutes: 21 });
  assert.deepEqual(resumeProgramme(null), { exercices: 0, series: 0, minutes: 0 });
  assert.equal(programmeDuJour([], []), null);
  assert.equal(programmeDuJour([PULL, PUSH], []).name, 'PUSH'); // sans historique : le premier créé
  const apresPush = [{ name: 'PUSH', sport: 'WeightTraining', start_date_local: '2026-10-10T18:00:00' }];
  assert.equal(programmeDuJour([PUSH, PULL], apresPush).name, 'PULL');
  const apresPull = [{ name: 'PULL', sport: 'WeightTraining', start_date_local: '2026-10-11T18:00:00' }, ...apresPush];
  assert.equal(programmeDuJour([PUSH, PULL], apresPull).name, 'PUSH'); // on reboucle
});

test('brouillon depuis un programme : séries cibles et dernière charge connue', () => {
  const derniers = dernieresCharges([serie('2026-10-01', 'developpe-couche', 6, 80), serie('2026-10-08', 'developpe-couche', 6, 85, { set_no: 2 })]);
  const b = brouillonDepuisProgramme(PUSH, '2026-10-12', derniers);
  assert.equal(b.nom, 'PUSH');
  assert.equal(b.programmeId, 'p1');
  assert.equal(b.exercices.length, 2);
  assert.equal(b.exercices[0].series.length, 4);
  assert.equal(b.exercices[0].series[0].poids, '85'); // la dernière fois, pas la charge du programme
  assert.equal(b.exercices[1].series[0].poids, '');
  assert.equal(b.exercices[0].series[0].fait, false);
});

test('validation : ne garde que les séries faites, borne les valeurs', () => {
  const b = brouillonDepuisProgramme(PUSH, '2026-10-12');
  b.exercices[0].series[0] = { reps: '6', poids: '82,5', fait: true };
  b.exercices[0].series[1] = { reps: '6', poids: '82.5', fait: true };
  b.exercices[1].series[0] = { reps: '12', poids: '', fait: true };
  const { valeurs, erreurs } = validerSeance(b);
  assert.deepEqual(erreurs, {});
  assert.equal(valeurs.series.length, 3);
  assert.equal(valeurs.series[0].weight_kg, 82.5);
  assert.equal(valeurs.series[1].set_no, 2);
  assert.equal(valeurs.series[2].exercise_key, 'dips');
  assert.equal(valeurs.series[2].set_no, 1);
  assert.equal(valeurs.series[2].position, 1);
});

test('validation : erreurs (aucune série, charge absurde, répétitions, nom, durée, effort)', () => {
  const b = brouillonDepuisProgramme(PUSH, '2026-10-12');
  assert.match(validerSeance(b).erreurs.exercices, /au moins une série/);
  b.exercices[0].series[0] = { reps: '6', poids: '5000', fait: true };
  assert.match(validerSeance(b).erreurs.exercices, /Charge invalide/);
  b.exercices[0].series[0] = { reps: '0', poids: '50', fait: true };
  assert.match(validerSeance(b).erreurs.exercices, /Répétitions invalides/);
  b.exercices[0].series[0] = { reps: '6', poids: '50', fait: true };
  b.nom = '  ';
  b.duree = '9999';
  b.rpe = '11';
  b.date = 'demain';
  const e = validerSeance(b).erreurs;
  assert.ok(e.nom && e.duree && e.rpe && e.date);
  assert.equal(validerSeance(b).valeurs, null);
});

test('ligne de séance : sport musculation, durée estimée si absente, TSS estimé', () => {
  const b = brouillonDepuisProgramme(PUSH, '2026-10-12');
  b.exercices[0].series.forEach((s) => Object.assign(s, { reps: '6', poids: '80', fait: true }));
  const { valeurs } = validerSeance(b);
  const ligne = ligneSeanceForce(valeurs);
  assert.equal(ligne.sport, 'WeightTraining');
  assert.equal(ligne.source, 'manual');
  assert.equal(ligne.moving_time, 4 * 3 * 60);
  assert.ok(ligne.tss > 0);
  assert.equal(ligne.start_date_local, '2026-10-12T18:00:00');
  const lignes = lignesSeries(valeurs);
  assert.equal(lignes.length, 4);
  assert.equal(lignes[0].date, '2026-10-12');
});

test('brouillon depuis une séance enregistrée : regroupe les séries par exercice, dans l\'ordre', () => {
  const seance = { name: 'PUSH', start_date_local: '2026-10-10T17:30:00', moving_time: 3600, rpe: 8, user_notes: 'bien' };
  const series = [
    serie('2026-10-10', 'dips', 10, 0, { position: 1, set_no: 1 }),
    serie('2026-10-10', 'developpe-couche', 6, 80, { position: 0, set_no: 2 }),
    serie('2026-10-10', 'developpe-couche', 6, 80, { position: 0, set_no: 1 }),
  ];
  const b = brouillonDepuisSeance(seance, series);
  assert.equal(b.heure, '17:30');
  assert.equal(b.duree, '60');
  assert.equal(b.exercices.length, 2);
  assert.equal(b.exercices[0].cle, 'developpe-couche');
  assert.equal(b.exercices[0].series.length, 2);
  assert.ok(b.exercices[0].series.every((s) => s.fait));
});

import { formulaireProgrammeVide, formulaireProgramme, exerciceDeProgramme, validerProgramme } from '../src/lib/data/force.js';

test('programme : formulaire ↔ ligne, aller-retour sans perte', () => {
  const f = formulaireProgramme(PUSH);
  assert.equal(f.nom, 'PUSH');
  assert.equal(f.exercices[0].weight, '82.5');
  assert.equal(f.exercices[1].weight, ''); // poids du corps
  const { valeurs, erreurs } = validerProgramme(f);
  assert.deepEqual(erreurs, {});
  assert.deepEqual(valeurs.exercises, PUSH.exercises);
  assert.equal(valeurs.notes, null);
});

test('programme : validation (nom, aucun exercice, valeurs hors limites, texte injecté gardé tel quel)', () => {
  const f = formulaireProgrammeVide();
  const e = validerProgramme(f).erreurs;
  assert.ok(e.nom && e.exercices);
  f.nom = '<img src=x onerror=alert(1)>'; // du texte : jamais interprété (Svelte échappe), et la base le stocke tel quel
  f.exercices.push(exerciceDeProgramme(trouverExercice('squat')));
  assert.equal(validerProgramme(f).valeurs.name, '<img src=x onerror=alert(1)>');
  f.exercices[0].sets = '0';
  assert.match(validerProgramme(f).erreurs.exercices, /séries/);
  f.exercices[0].sets = '3';
  f.exercices[0].reps = '500';
  assert.match(validerProgramme(f).erreurs.exercices, /répétitions/);
  f.exercices[0].reps = '5';
  f.exercices[0].weight = '9999';
  assert.match(validerProgramme(f).erreurs.exercices, /charge/);
  f.exercices[0].weight = '120,5';
  assert.equal(validerProgramme(f).valeurs.exercises[0].weight, 120.5);
  f.nom = 'x'.repeat(61);
  assert.ok(validerProgramme(f).erreurs.nom);
});

import { grouperParExercice } from '../src/lib/data/force.js';

test('regroupement par exercice : ordre de la séance, séries dans l\'ordre, tonnage', () => {
  const g = grouperParExercice([
    serie('2026-10-10', 'dips', 10, 0, { position: 1, set_no: 1 }),
    serie('2026-10-10', 'developpe-couche', 6, 80, { position: 0, set_no: 2 }),
    serie('2026-10-10', 'developpe-couche', 8, 70, { position: 0, set_no: 1 }),
  ]);
  assert.deepEqual(g.map((e) => e.cle), ['developpe-couche', 'dips']);
  assert.deepEqual(g[0].series, [{ reps: 8, poids: 70 }, { reps: 6, poids: 80 }]);
  assert.equal(g[0].tonnage, 1040);
  assert.equal(g[1].tonnage, 0);
  assert.deepEqual(grouperParExercice([]), []);
});

test('records par séance : un record = meilleur 1RM de la séance au-dessus de tout le passé de l\'exercice ; la 1re séance n\'en est pas un', () => {
  const l = (date, cle, nom, reps, poids, id) => ({ ...serie(date, cle, reps, poids), exercise_name: nom, activity_id: id });
  const s = [
    l('2026-09-01', 'squat', 'Squat', 5, 100, 'a1'),                                   // 1re séance : pas de record
    l('2026-09-08', 'squat', 'Squat', 5, 105, 'a2'), l('2026-09-08', 'developpe-couche', 'Développé couché', 5, 80, 'a2'), // squat : record ; dév. couché : 1re fois
    l('2026-09-15', 'squat', 'Squat', 5, 100, 'a3'),                                   // moins bien : pas de record
    l('2026-09-22', 'squat', 'Squat', 5, 110, 'a4'), l('2026-09-22', 'developpe-couche', 'Développé couché', 5, 85, 'a4'), // 2 records
    l('2026-09-29', 'squat', 'Squat', 5, 110, 'a5'),                                   // égal : pas un record
  ];
  const r = recordsParSeance(s);
  assert.equal(r.has('a1'), false);
  assert.deepEqual(r.get('a2'), ['Squat']);
  assert.equal(r.has('a3'), false);
  assert.deepEqual(r.get('a4'), ['Squat', 'Développé couché']);
  assert.equal(r.has('a5'), false);
  assert.equal(recordsParSeance([]).size, 0);
});

test('records par séance : les séries sans séance rattachée et sans charge utilisable sont ignorées', () => {
  const s = [serie('2026-09-01', 'squat', 5, 100), serie('2026-09-08', 'squat', 5, 120), { ...serie('2026-09-15', 'pompes', 20, 0), activity_id: 'z' }];
  assert.equal(recordsParSeance(s).size, 0); // pas d'activity_id sur les séries de squat ; pompes sans charge / > 12 reps : pas de 1RM
});
