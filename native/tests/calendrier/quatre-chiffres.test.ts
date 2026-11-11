import assert from 'node:assert/strict';
import test from 'node:test';
import { choisirChiffres, ordrePrevue, ordreSortie } from '../../src/data/calendrier/quatre-chiffres.ts';

const ch = (...cles: string[]) => cles.map((cle) => ({ cle }));
const cles = (l: { cle: string }[]) => l.map((c) => c.cle);
const pour = (sport: string, famille: string, ...presents: string[]) => {
  const { ordre, repli } = ordreSortie(sport, famille);
  return cles(choisirChiffres(ch(...presents), ordre, repli));
};

test('course : distance, durée, allure, dénivelé ; le cardio remplace un dénivelé absent', () => {
  assert.deepEqual(pour('Run', 'course', 'duree', 'distance', 'allure', 'denivele', 'fc'), ['distance', 'duree', 'allure', 'denivele']);
  assert.deepEqual(pour('Run', 'course', 'duree', 'distance', 'allure', 'fc', 'charge'), ['distance', 'duree', 'allure', 'fc']);
});

test('vélo : la puissance mesurée passe avant le dénivelé, sinon le dénivelé', () => {
  assert.deepEqual(pour('Ride', 'velo', 'duree', 'distance', 'vitesse', 'watts', 'denivele'), ['distance', 'duree', 'vitesse', 'watts']);
  assert.deepEqual(pour('Ride', 'velo', 'duree', 'distance', 'vitesse', 'denivele'), ['distance', 'duree', 'vitesse', 'denivele']);
});

test('muscu : durée, cardio, charge, énergie ; sans cardio, l\'effort comble', () => {
  assert.deepEqual(pour('WeightTraining', 'muscu', 'duree', 'fc', 'charge', 'energie'), ['duree', 'fc', 'charge', 'energie']);
  assert.deepEqual(pour('WeightTraining', 'muscu', 'duree', 'charge', 'rpe'), ['duree', 'charge', 'rpe']);
});

test('natation, Hyrox et autre sport', () => {
  assert.deepEqual(pour('Swim', 'natation', 'duree', 'distance', 'allure', 'fc'), ['distance', 'duree', 'allure', 'fc']);
  assert.deepEqual(pour('Hyrox', 'hyrox', 'duree', 'distance', 'allure', 'fc'), ['duree', 'distance', 'allure', 'fc']);
  assert.deepEqual(pour('Yoga', 'autre', 'duree', 'fc', 'charge', 'energie'), ['duree', 'fc', 'charge', 'energie']);
});

test('ski alpin : avec les flux, descendu, distance, descentes, durée ; sans flux, distance, durée, dénivelé, cardio', () => {
  assert.deepEqual(pour('AlpineSki', 'autre', 'duree', 'distance', 'denivele', 'descendu', 'vmax', 'descentes'), ['descendu', 'distance', 'descentes', 'duree']);
  assert.deepEqual(pour('AlpineSki', 'autre', 'duree', 'distance', 'denivele', 'fc'), ['distance', 'duree', 'denivele', 'fc']);
});

test('ski de rando et ski de fond', () => {
  assert.deepEqual(pour('BackcountrySki', 'autre', 'duree', 'distance', 'denivele', 'descendu'), ['denivele', 'descendu', 'duree', 'distance']);
  assert.deepEqual(pour('NordicSki', 'autre', 'duree', 'distance', 'vitesse', 'denivele'), ['distance', 'duree', 'vitesse', 'denivele']);
});

test('prévue : durée, distance (sinon charge), allure, charge (sinon effort)', () => {
  const o = ordrePrevue(false);
  assert.deepEqual(cles(choisirChiffres(ch('duree', 'charge', 'distance', 'allure', 'effort'), o.ordre, o.repli)), ['duree', 'distance', 'allure', 'charge']);
  assert.deepEqual(cles(choisirChiffres(ch('duree', 'charge', 'effort'), o.ordre, o.repli)), ['duree', 'charge', 'effort']);
});

test('compétition : temps cible, distance, allure cible, dénivelé', () => {
  const o = ordrePrevue(true);
  assert.deepEqual(cles(choisirChiffres(ch('cible', 'distance', 'dplus', 'allure', 'charge'), o.ordre, o.repli)), ['cible', 'distance', 'allure', 'dplus']);
  assert.deepEqual(cles(choisirChiffres(ch('distance', 'charge', 'effort'), o.ordre, o.repli)), ['distance', 'charge', 'effort']);
});

test('jamais plus de quatre, jamais deux fois le même', () => {
  assert.equal(choisirChiffres(ch('a', 'b', 'c', 'd', 'e'), ['a', ['a', 'b'], 'c', 'd', 'e'], ['b']).length, 4);
  assert.deepEqual(choisirChiffres([], ['a']), []);
});
