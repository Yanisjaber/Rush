import { test } from 'node:test';
import assert from 'node:assert/strict';
import { avancement, formaterDuree, tempsCalcul } from '../../src/data/synchro/estimation.ts';

test('tempsCalcul : le temps des sorties restantes, sans pause', () => {
  assert.equal(tempsCalcul(1352, 2), 2704);
  assert.equal(tempsCalcul(-5, 2), 0);
});

test('formaterDuree : arrondie et lisible', () => {
  assert.equal(formaterDuree(20), 'moins d\'une minute');
  assert.equal(formaterDuree(7 * 60), '7 min');
  assert.equal(formaterDuree(43 * 60), '45 min');
  assert.equal(formaterDuree(3 * 3600 + 20 * 60), '3 h 20');
  assert.equal(formaterDuree(2 * 3600), '2 h');
  assert.equal(formaterDuree(2 * 3600 + 58 * 60), '3 h');
  assert.equal(formaterDuree(30 * 3600), '1 jour et 6 h');
  assert.equal(formaterDuree(48 * 3600), '2 jours');
});

test('avancement : la part des sorties faites, entre 0 et 1', () => {
  assert.equal(avancement(338, 1352), 0.25);
  assert.equal(avancement(5, 0), 1);
  assert.equal(avancement(2000, 1352), 1);
});
