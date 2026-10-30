import { test } from 'node:test';
import assert from 'node:assert/strict';
import { avancement, faitesAffichees, formaterDuree, formaterPourcent, tempsCalcul } from '../../src/data/synchro/estimation.ts';

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

test('faitesAffichees : une sortie de plus à chaque temps d\'une sortie, sans dépasser la fin du lot', () => {
  assert.equal(faitesAffichees(100, 1352, 2, 0, 20), 100);
  assert.equal(faitesAffichees(100, 1352, 2, 1.9, 20), 100);
  assert.equal(faitesAffichees(100, 1352, 2, 2, 20), 101);
  assert.equal(faitesAffichees(100, 1352, 2, 11, 20), 105);
  assert.equal(faitesAffichees(100, 1352, 2, 500, 20), 119); // le lot est de 20 : la 20e attend la réponse du serveur
  assert.equal(faitesAffichees(1350, 1352, 2, 500, 20), 1352); // jamais au-delà du total
  assert.equal(faitesAffichees(100, 1352, 0, 30, 20), 100); // temps par sortie inconnu : on n'invente rien
});

test('formaterPourcent : une décimale, une virgule, jamais 100 avant la fin', () => {
  assert.equal(formaterPourcent(0), '0,0');
  assert.equal(formaterPourcent(0.0234), '2,3');
  assert.equal(formaterPourcent(0.5), '50,0');
  assert.equal(formaterPourcent(0.9996), '99,9');
  assert.equal(formaterPourcent(1), '100');
  assert.equal(formaterPourcent(7), '100');
});

test('avancement : la part des sorties faites, entre 0 et 1', () => {
  assert.equal(avancement(338, 1352), 0.25);
  assert.equal(avancement(5, 0), 1);
  assert.equal(avancement(2000, 1352), 1);
});
