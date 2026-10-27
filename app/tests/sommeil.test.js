import test from 'node:test';
import assert from 'node:assert/strict';
import { nuitVoisine, segmentsValides, heureApres, heureDe, heureDepuisMinutes } from '../src/lib/data/sommeil.js';

test('heureDe : extrait HH:MM, tolère les valeurs absentes ou bizarres', () => {
  assert.equal(heureDe('2026-10-11 23:10'), '23:10');
  assert.equal(heureDe('2026-10-12 6:05'), '06:05');
  assert.equal(heureDe(null), null);
  assert.equal(heureDe('n’importe quoi'), null);
});

test('heureDepuisMinutes : repasse minuit, tolère les valeurs absentes', () => {
  assert.equal(heureDepuisMinutes(25 * 60), '01:00');
  assert.equal(heureDepuisMinutes(0), '00:00');
  assert.equal(heureDepuisMinutes(null), null);
});

test('heureDe accepte aussi le format ISO avec T', () => {
  assert.equal(heureDe('2026-10-26T23:05:00'), '23:05');
  assert.equal(heureDe('2026-10-26 7:05'), '07:05');
  assert.equal(heureDe('n’importe quoi'), null);
});

test('heureApres : repères d\'heure sans « :60 », passage de minuit, null sans coucher', () => {
  assert.equal(heureApres('23:00', 119.5), '01:00'); // avant : « 00:60 »
  assert.equal(heureApres('23:00', 0), '23:00');
  assert.equal(heureApres('23:00', 478), '06:58');
  assert.equal(heureApres(null, 30), null);
  assert.equal(heureApres('23:00', null), null);
});

test('segmentsValides : garde les segments sains, ignore le reste sans planter', () => {
  const bons = [[0, 20, 3], [20, 90, 1], [90, 120, 0]];
  assert.deepEqual(segmentsValides({ segments: bons }), bons);
  assert.deepEqual(segmentsValides({ segments: null }), []);
  assert.deepEqual(segmentsValides({ segments: 'oups' }), []);
  assert.deepEqual(segmentsValides(null), []);
  const melanges = [[0, 20, 3], null, 'x', [5], [10, 5, 1], [0, 0, 1], [0, 10, 7], [0, 10, 1.5], [null, 10, 1], [0, '10', 1], [0, NaN, 1], [-5, 10, 1], [20, 40, 2]];
  assert.deepEqual(segmentsValides({ segments: melanges }), [[0, 20, 3], [20, 40, 2]]);
});

test('nuitVoisine : saute les jours sans nuit, null aux extrémités ou si la date est inconnue', () => {
  const nuits = [{ date: '2026-10-27' }, { date: '2026-10-24' }, { date: '2026-10-20' }]; // la plus récente d'abord
  assert.equal(nuitVoisine(nuits, '2026-10-24', -1), '2026-10-20');
  assert.equal(nuitVoisine(nuits, '2026-10-24', 1), '2026-10-27');
  assert.equal(nuitVoisine(nuits, '2026-10-27', 1), null);
  assert.equal(nuitVoisine(nuits, '2026-10-20', -1), null);
  assert.equal(nuitVoisine(nuits, '2026-01-01', 1), null);
  assert.equal(nuitVoisine(null, '2026-10-24', 1), null);
});
