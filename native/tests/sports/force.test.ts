import { test } from 'node:test';
import assert from 'node:assert/strict';
import { recordsParSeance, unRmEstime } from '../../src/data/sports/force.ts';
import type { SerieForce } from '../../src/data/types.ts';

test('unRmEstime : formule d\'Epley, arrondie à une décimale', () => {
  assert.equal(unRmEstime(100, 5), 116.7);
  assert.equal(unRmEstime(82.5, 8), 104.5);
  assert.equal(unRmEstime(100, 1), 100);
});

test('unRmEstime : null au-delà de 12 répétitions, sans poids ou sans répétition', () => {
  assert.equal(unRmEstime(50, 13), null);
  assert.equal(unRmEstime(0, 5), null);
  assert.equal(unRmEstime(50, 0), null);
  assert.equal(unRmEstime(null, 5), null);
});

const serie = (date: string, seance: string | null, poids: number, reps = 5, exo = 'squat'): SerieForce => ({
  id: `${date}-${poids}`, activity_id: seance, date, exercise_key: exo, exercise_name: exo.toUpperCase(),
  muscle_group: 'jambes', position: 0, set_no: 1, reps, weight_kg: poids,
});

test('recordsParSeance : la première séance d\'un exercice n\'est pas un record', () => {
  assert.equal(recordsParSeance([serie('2026-10-01', 's1', 100)]).size, 0);
});

test('recordsParSeance : battre son meilleur 1RM donne un record sur cette séance', () => {
  const r = recordsParSeance([serie('2026-10-01', 's1', 100), serie('2026-10-08', 's2', 105), serie('2026-10-15', 's3', 102)]);
  assert.deepEqual([...r], [['s2', ['SQUAT']]]);
});

test('recordsParSeance : sans séance rattachée, pas de record affiché', () => {
  const r = recordsParSeance([serie('2026-10-01', 's1', 100), serie('2026-10-08', null, 110)]);
  assert.equal(r.size, 0);
});

test('recordsParSeance : plusieurs exercices battus dans la même séance', () => {
  const r = recordsParSeance([
    serie('2026-10-01', 's1', 100, 5, 'squat'), serie('2026-10-01', 's1', 60, 5, 'rowing'),
    serie('2026-10-08', 's2', 110, 5, 'squat'), serie('2026-10-08', 's2', 65, 5, 'rowing'),
  ]);
  assert.deepEqual(r.get('s2'), ['SQUAT', 'ROWING']);
});
