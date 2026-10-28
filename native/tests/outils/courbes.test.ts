import assert from 'node:assert/strict';
import { test } from 'node:test';
import { echelle, lisse, type Point } from '../../src/data/outils/courbes.ts';

test('lisse : un chemin pour des points normaux, rien pour une liste vide', () => {
  assert.equal(lisse([]), '');
  assert.equal(lisse(null), '');
  assert.equal(lisse([[0, 0]]), 'M0.0 0.0');
  assert.equal(lisse([[0, 0], [10, 10]]).startsWith('M0.0 0.0 C'), true);
});

test('lisse : jamais de NaN ni d\'Infinity dans le chemin (le dessin natif planterait)', () => {
  // Le cas qui a planté : une largeur de colonne « … / 0 » donne x = NaN pour le premier point, Infinity pour les suivants
  const colonne = (300 - 10 * (0 - 1)) / 0;
  const pts: Point[] = [20, 30, 40, 50].map((v, i) => [i * (colonne + 10) + colonne / 2, v]);
  assert.equal(lisse(pts), '');
  const mixte = lisse([[0, 0], [NaN, 5], [10, 10], [Infinity, 3], [20, 15]]);
  assert.equal(/NaN|Infinity/.test(mixte), false);
  assert.equal(mixte.startsWith('M0.0 0.0'), true);
});

test('echelle : une série constante ou un seul point ne donnent pas de division par zéro', () => {
  const constante = echelle([5, 5, 5], 100, 50);
  assert.equal(constante.every(([x, y]) => Number.isFinite(x) && Number.isFinite(y)), true);
  const seul = echelle([7], 100, 50);
  assert.equal(seul.length, 1);
  assert.equal(Number.isFinite(seul[0][0]) && Number.isFinite(seul[0][1]), true);
});
