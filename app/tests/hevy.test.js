import test from 'node:test';
import assert from 'node:assert/strict';
import { lireCsv, lireDate, dureeMinutes, nettoyerNom, resoudreExercice, lireExportHevy, ligneActivite, lignesSeriesHevy, cleClient, rapprocher, resumerPlan, LIMITE_OCTETS } from '../src/lib/data/hevy.js';
import { BIBLIOTHEQUE } from '../src/lib/data/exercices.js';

const ENTETE = '"title","start_time","end_time","description","exercise_title","superset_id","exercise_notes","set_index","set_type","weight_kg","reps","distance_km","duration_seconds","rpe"';
const l = (titre, debut, fin, desc, exo, idx, type, kg, reps, rpe = '') => `"${titre}","${debut}","${fin}","${desc}","${exo}","","","${idx}","${type}","${kg}","${reps}","","","${rpe}"`;
const EXPORT = [
  ENTETE,
  l('Upper', '5 Oct 2026, 18:30', '5 Oct 2026, 19:40', 'Bonne séance,\nà refaire', 'Bench Press (Barbell)', 0, 'warmup', 40, 10),
  l('Upper', '5 Oct 2026, 18:30', '5 Oct 2026, 19:40', 'Bonne séance,\nà refaire', 'Bench Press (Barbell)', 1, 'normal', 80, 8, 8),
  l('Upper', '5 Oct 2026, 18:30', '5 Oct 2026, 19:40', 'Bonne séance,\nà refaire', 'Bench Press (Barbell)', 2, 'normal', 80, 6, 9),
  l('Upper', '5 Oct 2026, 18:30', '5 Oct 2026, 19:40', 'Bonne séance,\nà refaire', 'Pull Up', 0, 'normal', '', 10),
  l('Upper', '5 Oct 2026, 18:30', '5 Oct 2026, 19:40', 'Bonne séance,\nà refaire', 'Plank', 0, 'normal', '', ''),
  l('Upper', '5 Oct 2026, 18:30', '5 Oct 2026, 19:40', 'Bonne séance,\nà refaire', 'Machine Étrange 3000', 0, 'normal', 25, 12),
  l('Legs', '7 Oct 2026, 09:00', '7 Oct 2026, 10:05', '', 'Squat (Barbell)', 0, 'normal', 100, 5),
  l('Legs', '7 Oct 2026, 09:00', '7 Oct 2026, 10:05', '', 'Squat (Barbell)', 1, 'dropset', 80, 8),
].join('\r\n');

test('lireCsv : guillemets, virgules et retours à la ligne dans un champ, CRLF, BOM', () => {
  const r = lireCsv('﻿a,"b,c","d ""x"" e"\r\n1,"ligne1\nligne2",3\r\n');
  assert.deepEqual(r, [['a', 'b,c', 'd "x" e'], ['1', 'ligne1\nligne2', '3']]);
  assert.deepEqual(lireCsv(''), []);
  assert.deepEqual(lireCsv('a,b\n\n\nc,d'), [['a', 'b'], ['c', 'd']]);
  assert.deepEqual(lireCsv('x,y'), [['x', 'y']]); // pas de retour à la ligne final
});

test('lireDate : anglais, français, ISO, jj/mm/aaaa ; refuse le reste', () => {
  assert.deepEqual(lireDate('5 Oct 2026, 18:30'), { date: '2026-10-05', heure: '18:30', minutes: 1110 });
  assert.equal(lireDate('12 sept. 2026, 07:05').date, '2026-09-12');
  assert.equal(lireDate('3 févr. 2026, 07:05').date, '2026-02-03');
  assert.equal(lireDate('14 août 2026, 21:00').date, '2026-08-14');
  assert.equal(lireDate('2026-10-05 18:30:00').heure, '18:30');
  assert.equal(lireDate('05/10/2026 18:30').date, '2026-10-05');
  for (const mauvais of ['', null, 'hier', '32 Oct 2026, 10:00', '30 Feb 2026, 10:00', '5 Oct 2026, 25:00', '5 Xyz 2026, 10:00', '5 Oct 1999, 10:00']) assert.equal(lireDate(mauvais), null, String(mauvais));
});

test('dureeMinutes : normale, passage de minuit, absurde', () => {
  const a = lireDate('5 Oct 2026, 18:30');
  assert.equal(dureeMinutes(a, lireDate('5 Oct 2026, 19:40')), 70);
  assert.equal(dureeMinutes(lireDate('5 Oct 2026, 23:30'), lireDate('6 Oct 2026, 00:20')), 50);
  assert.equal(dureeMinutes(a, lireDate('5 Oct 2026, 18:30')), null);
  assert.equal(dureeMinutes(a, lireDate('8 Oct 2026, 18:30')), null);
  assert.equal(dureeMinutes(a, null), null);
});

test('exercices : les noms Hevy courants retrouvent la bibliothèque de l\'app', () => {
  const attendu = {
    'Bench Press (Barbell)': 'developpe-couche',
    'Bench Press (Dumbbell)': 'developpe-halteres',
    'Incline Bench Press (Barbell)': 'developpe-incline-barre',
    'Incline Bench Press (Dumbbell)': 'developpe-incline-halteres',
    'Chest Fly (Dumbbell)': 'ecartes',
    'Butterfly (Pec Deck)': 'pec-deck',
    'Push Up': 'pompes',
    'Chest Dip': 'dips',
    'Triceps Dip': 'dips',
    'Deadlift (Barbell)': 'souleve-de-terre',
    'Romanian Deadlift (Barbell)': 'souleve-de-terre-roumain',
    'Pull Up': 'tractions',
    'Chin Up': 'tractions',
    'Lat Pulldown (Cable)': 'tirage-vertical',
    'Seated Cable Row (Cable)': 'tirage-horizontal',
    'Bent Over Row (Barbell)': 'rowing-barre',
    'Dumbbell Row': 'rowing-haltere',
    'Squat (Barbell)': 'squat',
    'Front Squat (Barbell)': 'front-squat',
    'Bulgarian Split Squat': 'fentes-bulgares',
    'Leg Press (Machine)': 'presse-a-cuisses',
    'Lunge (Dumbbell)': 'fentes',
    'Hip Thrust (Barbell)': 'hip-thrust',
    'Leg Extension (Machine)': 'leg-extension',
    'Lying Leg Curl (Machine)': 'leg-curl',
    'Standing Calf Raise (Machine)': 'mollets-debout',
    'Overhead Press (Barbell)': 'developpe-militaire',
    'Shoulder Press (Dumbbell)': 'developpe-epaules-halteres',
    'Lateral Raise (Dumbbell)': 'elevations-laterales',
    'Face Pull (Cable)': 'face-pull',
    'Shrug (Dumbbell)': 'shrugs',
    'Bicep Curl (Barbell)': 'curl-barre',
    'Bicep Curl (Dumbbell)': 'curl-halteres',
    'Hammer Curl (Dumbbell)': 'curl-marteau',
    'Preacher Curl (Machine)': 'curl-pupitre',
    'Triceps Pushdown (Cable - Straight Bar)': 'extension-triceps-poulie',
    'Skullcrusher (Barbell)': 'barre-au-front',
    'Hanging Leg Raise': 'releve-de-jambes',
    'Plank': 'gainage',
    'Crunch': 'crunch',
  };
  for (const [nom, cle] of Object.entries(attendu)) {
    const e = resoudreExercice(nom);
    assert.equal(e.cle, cle, `${nom} → ${e.cle}`);
    assert.equal(e.reconnu, true);
  }
  // toutes les clés renvoyées existent dans la bibliothèque
  for (const nom of Object.keys(attendu)) assert.ok(BIBLIOTHEQUE.some((b) => b.cle === resoudreExercice(nom).cle), nom);
});

test('exercices inconnus : importés tels quels, groupe deviné, jamais d\'erreur', () => {
  const e = resoudreExercice('Machine Étrange 3000');
  assert.equal(e.reconnu, false);
  assert.equal(e.nom, 'Machine Étrange 3000');
  assert.match(e.cle, /^hevy-machine-etrange-3000$/);
  assert.equal(resoudreExercice('Cable Wrist Curl').groupe, 'bras');
  assert.equal(resoudreExercice('Glute Kickback Machine').groupe, 'jambes');
  assert.equal(resoudreExercice('').cle.startsWith('hevy-'), true);
  assert.equal(resoudreExercice('x'.repeat(300)).nom.length, 80);
  assert.deepEqual(nettoyerNom('Squat (Barbell)'), { base: 'squat', equipement: 'barbell' });
});

test('lireExportHevy : séances, échauffements écartés, poids du corps, séries sans répétitions', () => {
  const r = lireExportHevy(EXPORT);
  assert.equal(r.erreur, '');
  assert.equal(r.seances.length, 2);
  const [upper, legs] = r.seances;
  assert.equal(upper.titre, 'Upper');
  assert.equal(upper.date, '2026-10-05');
  assert.equal(upper.heure, '18:30');
  assert.equal(upper.minutes, 70);
  assert.equal(upper.notes, 'Bonne séance,\nà refaire');
  assert.equal(upper.rpe, 9); // moyenne de 8 et 9 arrondie
  // échauffement (1) et gainage sans répétitions (1) écartés
  assert.equal(r.ignorees.echauffement, 1);
  assert.equal(r.ignorees.sansRepetitions, 1);
  assert.equal(upper.series.length, 4);
  const bench = upper.series.filter((s) => s.exercise_key === 'developpe-couche');
  assert.deepEqual(bench.map((s) => [s.set_no, s.reps, s.weight_kg]), [[1, 8, 80], [2, 6, 80]]); // numérotées sans l'échauffement
  const tractions = upper.series.find((s) => s.exercise_key === 'tractions');
  assert.equal(tractions.weight_kg, 0); // poids du corps
  assert.deepEqual(upper.series.map((s) => s.position), [0, 0, 1, 2]);
  assert.equal(upper.exercices.length, 3);
  assert.equal(upper.exercices.filter((e) => e.reconnu).length, 2);
  assert.equal(legs.series.length, 2); // la série « dropset » est gardée
  assert.equal(legs.rpe, null);
  assert.equal(r.seances[0].cle < r.seances[1].cle, true); // du plus ancien au plus récent
});

test('lireExportHevy : poids en livres convertis, dates françaises', () => {
  const csv = [
    '"title","start_time","end_time","description","exercise_title","superset_id","exercise_notes","set_index","set_type","weight_lbs","reps"',
    '"Push","3 oct. 2026, 18:00","3 oct. 2026, 19:00","","Bench Press (Barbell)","","","0","normal","225","5"',
  ].join('\n');
  const r = lireExportHevy(csv);
  assert.equal(r.seances[0].date, '2026-10-03');
  assert.equal(r.seances[0].series[0].weight_kg, 102.1); // 225 lb
});

test('lireExportHevy : fichiers invalides → message clair, pas d\'exception', () => {
  assert.match(lireExportHevy('').erreur, /vide/);
  assert.match(lireExportHevy('juste,du,texte\n1,2,3').erreur, /export Hevy/);
  assert.match(lireExportHevy(ENTETE).erreur, /Aucune séance/);
  assert.match(lireExportHevy('x'.repeat(LIMITE_OCTETS + 1)).erreur, /trop gros/);
  assert.match(lireExportHevy(null).erreur, /vide/);
  const sansSerie = [ENTETE, l('Vide', '5 Oct 2026, 18:30', '', '', 'Plank', 0, 'normal', '', '')].join('\n');
  assert.match(lireExportHevy(sansSerie).erreur, /Aucune série exploitable/);
});

test('lireExportHevy : valeurs hors limites et dates invalides ignorées, sans casser le reste', () => {
  const csv = [
    ENTETE,
    l('A', '5 Oct 2026, 18:30', '5 Oct 2026, 19:00', '', 'Squat (Barbell)', 0, 'normal', 100, 5),
    l('A', '5 Oct 2026, 18:30', '5 Oct 2026, 19:00', '', 'Squat (Barbell)', 1, 'normal', 5000, 5), // poids absurde
    l('A', '5 Oct 2026, 18:30', '5 Oct 2026, 19:00', '', 'Squat (Barbell)', 2, 'normal', 100, 5000), // répétitions absurdes
    l('B', 'pas une date', '', '', 'Squat (Barbell)', 0, 'normal', 100, 5),
  ].join('\n');
  const r = lireExportHevy(csv);
  assert.equal(r.seances.length, 1);
  assert.equal(r.seances[0].series.length, 1);
  assert.equal(r.ignorees.horsLimites, 2);
  assert.equal(r.ignorees.dateInvalide, 1);
});

test('lireExportHevy : plus de 30 séries sur un exercice ou 40 exercices → coupé sans erreur', () => {
  const lignes = [ENTETE];
  for (let i = 0; i < 35; i++) lignes.push(l('Gros', '5 Oct 2026, 18:30', '5 Oct 2026, 19:30', '', 'Squat (Barbell)', i, 'normal', 60, 10));
  const r = lireExportHevy(lignes.join('\n'));
  assert.equal(r.seances[0].series.length, 30);
  assert.equal(r.ignorees.horsLimites, 5);
});

test('lignes à enregistrer : activité (muscu, source manuelle) et séries datées', () => {
  const s = lireExportHevy(EXPORT).seances[0];
  const a = ligneActivite(s);
  assert.equal(a.source, 'manual');
  assert.equal(a.sport, 'WeightTraining');
  assert.equal(a.start_date_local, '2026-10-05T18:30:00');
  assert.equal(a.moving_time, 4200);
  assert.ok(a.tss > 0);
  assert.equal(a.name, 'Upper');
  const lignes = lignesSeriesHevy(s);
  assert.equal(lignes.length, s.series.length);
  assert.ok(lignes.every((x) => x.date === '2026-10-05'));
  assert.equal(cleClient(s), 'hevy-2026-10-05T18:30');
});

test('rapprocher : déjà importée, rattachée à la séance Strava du même jour, ou nouvelle', () => {
  const seances = lireExportHevy(EXPORT).seances; // 5 oct 18:30 et 7 oct 09:00
  const existantes = [
    { id: 'strava-1', source: 'strava', sport: 'WeightTraining', start_date_local: '2026-10-05T18:45:00' }, // même séance (15 min d'écart)
    { id: 'strava-2', source: 'strava', sport: 'Run', start_date_local: '2026-10-07T09:00:00' }, // pas de la muscu
    { id: 'man-1', source: 'manual', sport: 'WeightTraining', start_date_local: '2026-10-07T09:00:00', client_id: 'app-xyz' },
  ];
  const famille = (sp) => (sp === 'WeightTraining' ? 'muscu' : 'course');
  const plan = rapprocher(seances, existantes, new Set(), famille);
  assert.equal(plan[0].action, 'attacher');
  assert.equal(plan[0].activiteId, 'strava-1');
  assert.equal(plan[1].action, 'creer'); // la sortie de course ou la séance manuelle ne comptent pas
  // déjà importée
  const apres = rapprocher(seances, [...existantes, { id: 'man-2', source: 'manual', sport: 'WeightTraining', start_date_local: '2026-10-05T18:30:00', client_id: cleClient(seances[0]) }], new Set(), famille);
  assert.equal(apres[0].action, 'deja');
  // la séance Strava a déjà des séries : on ne les écrase pas
  assert.equal(rapprocher(seances, existantes, new Set(['strava-1']), famille)[0].action, 'creer');
  // une séance Strava n'est rattachée qu'à une seule séance Hevy
  const deux = [seances[0], { ...seances[0], cle: '2026-10-05T19:00', heure: '19:00' }];
  const p2 = rapprocher(deux, [existantes[0]], new Set(), famille);
  assert.deepEqual(p2.map((x) => x.action).sort(), ['attacher', 'creer']);
  // trop d'écart (plus de 3 h) : séance nouvelle
  assert.equal(rapprocher([seances[0]], [{ ...existantes[0], start_date_local: '2026-10-05T07:00:00' }], new Set(), famille)[0].action, 'creer');
});

test('resumerPlan : nombres pour l\'aperçu', () => {
  const seances = lireExportHevy(EXPORT).seances;
  const plan = [{ seance: seances[0], action: 'attacher', activiteId: 'x' }, { seance: seances[1], action: 'deja' }];
  const r = resumerPlan(plan);
  assert.equal(r.total, 2);
  assert.equal(r.attacher, 1);
  assert.equal(r.deja, 1);
  assert.equal(r.creer, 0);
  assert.equal(r.series, seances[0].series.length);
  assert.equal(r.du, '2026-10-05');
  assert.equal(r.au, '2026-10-07');
  assert.equal(r.reconnus, 2);
  assert.equal(r.exercices, 3);
});
