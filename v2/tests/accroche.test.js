import test from 'node:test';
import assert from 'node:assert/strict';
import { accrocheMuscu, accrocheHyrox } from '../src/lib/data/accroche.js';

const AUJ = new Date(2026, 9, 12, 14, 0);
const serie = (date, cle, nom, reps, poids) => ({ date, exercise_key: cle, exercise_name: nom, muscle_group: 'jambes', position: 0, set_no: 1, reps, weight_kg: poids });

test('accroche muscu : régularité, record récent, séance du jour', () => {
  const series = [serie('2026-09-01', 'squat', 'Squat', 5, 100), serie('2026-10-10', 'squat', 'Squat', 5, 120)];
  const t = accrocheMuscu({ serie: 4, series, programme: { name: 'PUSH' } }, AUJ);
  assert.match(t, /^4 semaines d'affilée sans manquer une séance, et un nouveau record \(Squat\)\./);
  assert.match(t, /Aujourd'hui, push\.$/);
});

test('accroche muscu : nom de l\'exercice entre parenthèses, pas de record ancien, texte vide', () => {
  const s = [serie('2026-09-01', 'e', 'Écartés', 10, 20), serie('2026-10-10', 'e', 'Écartés', 10, 30)];
  assert.match(accrocheMuscu({ serie: 0, series: s }, AUJ), /record \(Écartés\)/);
  const ancien = [serie('2026-06-01', 'x', 'Squat', 5, 100), serie('2026-06-10', 'x', 'Squat', 5, 120)];
  assert.doesNotMatch(accrocheMuscu({ serie: 2, series: ancien }, AUJ), /record/);
  assert.match(accrocheMuscu({}, AUJ), /Crée un programme/);
});

const segments = (run, station) => Array.from({ length: 16 }, (_, i) => (i % 2 === 0 ? run : station));

test('accroche Hyrox : jours, écart total et plus gros écart', () => {
  const t = accrocheHyrox({
    objectif: { name: 'Hyrox Open', date: '2026-11-08' },
    test: { total_s: 4422, segments: segments(285, 268) },
    cible: { total_s: 4200, segments: null },
  }, AUJ);
  assert.match(t, /^Ton Hyrox Open est dans 27 jours\./);
  assert.match(t, /Il te manque 3'42" sur ton objectif de 1:10:00\./);
  assert.match(t, /Le plus gros écart : /);
});

test('accroche Hyrox : test meilleur que l\'objectif, sans test, sans objectif', () => {
  assert.match(accrocheHyrox({ test: { total_s: 4000, segments: segments(250, 250) }, cible: { total_s: 4200, segments: null } }, AUJ), /sous ton objectif/);
  assert.match(accrocheHyrox({ cible: { total_s: 4200 } }, AUJ), /Saisis une simulation/);
  assert.match(accrocheHyrox({ test: { total_s: 4000, segments: segments(250, 250) } }, AUJ), /Fixe un objectif/);
  assert.match(accrocheHyrox({}, AUJ), /Saisis une simulation/);
});
