import { test } from 'node:test';
import assert from 'node:assert/strict';
import { basculerSport } from '../../src/data/accueil/menu.ts';
import { estMultiple, famillesDuFiltre, filtreDeSelection, filtreGarde, selectionDuFiltre } from '../../src/data/sports/filtre.ts';

const BARRE = ['course', 'velo', 'natation', 'muscu'];

test('basculerSport : coche puis décoche', () => {
  assert.deepEqual(basculerSport([], 'course'), ['course']);
  assert.deepEqual(basculerSport(['course'], 'velo'), ['course', 'velo']);
  assert.deepEqual(basculerSport(['course', 'velo'], 'course'), ['velo']);
});

test('filtreDeSelection : rien ou tout coché = « tout »', () => {
  assert.equal(filtreDeSelection([], BARRE), 'tout');
  assert.equal(filtreDeSelection(BARRE, BARRE), 'tout');
});

test('filtreDeSelection : un sport, ou plusieurs dans l’ordre de la barre', () => {
  assert.equal(filtreDeSelection(['velo'], BARRE), 'velo');
  assert.equal(filtreDeSelection(['natation', 'course'], BARRE), 'course+natation');
  assert.equal(filtreDeSelection(['muscu', 'velo', 'course'], BARRE), 'course+velo+muscu');
});

test('filtreDeSelection : un sport absent de la barre est ignoré', () => {
  assert.equal(filtreDeSelection(['hyrox'], BARRE), 'tout');
  assert.equal(filtreDeSelection(['hyrox', 'course'], BARRE), 'course');
});

test('famillesDuFiltre et estMultiple', () => {
  assert.equal(famillesDuFiltre('tout'), null);
  assert.deepEqual(famillesDuFiltre('course'), ['course']);
  assert.deepEqual(famillesDuFiltre('course+velo'), ['course', 'velo']);
  assert.equal(estMultiple('course+velo'), true);
  assert.equal(estMultiple('course'), false);
  assert.equal(estMultiple('tout'), false);
});

test('filtreGarde : tout garde tout, un filtre garde ses sports seulement', () => {
  assert.equal(filtreGarde('tout', 'hyrox'), true);
  assert.equal(filtreGarde('course', 'course'), true);
  assert.equal(filtreGarde('course', 'velo'), false);
  assert.equal(filtreGarde('course+velo', 'velo'), true);
  assert.equal(filtreGarde('course+velo', 'natation'), false);
});

test('selectionDuFiltre : relit les sports cochés, sans ceux retirés de la barre', () => {
  assert.deepEqual(selectionDuFiltre('tout', BARRE), []);
  assert.deepEqual(selectionDuFiltre('course+velo', BARRE), ['course', 'velo']);
  assert.deepEqual(selectionDuFiltre('course+hyrox', BARRE), ['course']);
});
